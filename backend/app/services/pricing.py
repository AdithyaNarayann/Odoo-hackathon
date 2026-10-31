from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import List, Optional, Tuple
from sqlalchemy import or_, update
from sqlalchemy.orm import Session

from app.core.money import round_half_up
from app.models.catalog import DiscountRule, Product, TaxRule
from app.models.subscription import Subscription
from app.routers.taxes import resolve_product_tax


@dataclass
class CalculatedLine:
    product_id: Optional[int]
    description: str
    quantity: int
    unit_price: int  # in paise
    amount: int  # quantity * unit_price (in paise)
    is_plan: bool
    discount_amount: int = 0
    tax_name: Optional[str] = None
    tax_rate: int = 0  # basis points
    tax_amount: int = 0  # in paise
    line_total: int = 0  # in paise


@dataclass
class PricingResult:
    lines: List[CalculatedLine]
    applied_discount: Optional[DiscountRule]
    subtotal: int
    discount_total: int
    tax_total: int
    total: int


def build_raw_lines(sub: Subscription) -> List[CalculatedLine]:
    """
    Builds the base lines for a subscription:
    - First line: "Plan: <name>", quantity 1, unit price plan.price (only when price > 0)
    - Followed by enabled product lines in order
    """
    raw_lines: List[CalculatedLine] = []

    # 1. Plan line (only if price > 0)
    if sub.plan and sub.plan.price > 0:
        raw_lines.append(
            CalculatedLine(
                product_id=None,
                description=f"Plan: {sub.plan.name}",
                quantity=1,
                unit_price=sub.plan.price,
                amount=sub.plan.price,
                is_plan=True,
            )
        )

    # 2. Enabled product lines
    for line in sub.lines:
        if not line.enabled:
            continue
        variant_desc = f" ({line.variant.attribute}: {line.variant.value})" if line.variant else ""
        desc = f"{line.product.name}{variant_desc}"
        raw_lines.append(
            CalculatedLine(
                product_id=line.product_id,
                description=desc,
                quantity=line.quantity,
                unit_price=line.unit_price,
                amount=line.amount,
                is_plan=False,
            )
        )

    return raw_lines


def evaluate_discount(
    rule: DiscountRule,
    lines: List[CalculatedLine],
    today: date,
) -> Tuple[bool, int, List[CalculatedLine]]:
    """
    Evaluates discount eligibility and calculates potential savings.
    Returns (is_eligible, saving, eligible_lines).
    """
    if not rule.is_active:
        return False, 0, []
    if today < rule.start_date or today > rule.end_date:
        return False, 0, []
    if rule.usage_limit is not None and rule.used_count >= rule.usage_limit:
        return False, 0, []

    eligible_lines: List[CalculatedLine] = []
    rule_prod_ids = {p.id for p in rule.products}

    if rule.applies_to == "products":
        # Only matching product lines count
        eligible_lines = [l for l in lines if l.product_id in rule_prod_ids]
        if not eligible_lines:
            return False, 0, []

        eligible_base = sum(l.amount for l in eligible_lines)
        matching_quantity = sum(l.quantity for l in eligible_lines)

        if rule.min_purchase_amount is not None and eligible_base < rule.min_purchase_amount:
            return False, 0, []
        if rule.min_quantity is not None and matching_quantity < rule.min_quantity:
            return False, 0, []

    elif rule.applies_to == "subscription":
        # All lines (including plan fee) count for amount, product-line quantity for min_quantity
        eligible_lines = list(lines)
        eligible_base = sum(l.amount for l in eligible_lines)
        prod_quantity = sum(l.quantity for l in eligible_lines if not l.is_plan)

        if rule.min_purchase_amount is not None and eligible_base < rule.min_purchase_amount:
            return False, 0, []
        if rule.min_quantity is not None and prod_quantity < rule.min_quantity:
            return False, 0, []
    else:
        return False, 0, []

    # Calculate savings
    if rule.type == "fixed":
        saving = min(rule.value, eligible_base)
    elif rule.type == "percent":
        # value in basis points (e.g. 1000 = 10%)
        saving = round_half_up(Decimal(eligible_base) * Decimal(rule.value) / Decimal(10000))
        saving = min(saving, eligible_base)
    else:
        saving = 0

    return True, saving, eligible_lines


def pick_best_discount(
    available_discounts: List[DiscountRule],
    lines: List[CalculatedLine],
    today: date,
    excluded_discount_ids: Optional[set] = None,
) -> Tuple[Optional[DiscountRule], int, List[CalculatedLine]]:
    """
    Selects the single eligible discount with the largest saving (ties broken by lowest id).
    No stacking.
    """
    excluded = excluded_discount_ids or set()
    best_rule: Optional[DiscountRule] = None
    best_saving = 0
    best_eligible_lines: List[CalculatedLine] = []

    for rule in available_discounts:
        if rule.id in excluded:
            continue
        eligible, saving, elig_lines = evaluate_discount(rule, lines, today)
        if not eligible or saving <= 0:
            continue

        if (saving > best_saving) or (saving == best_saving and best_rule and rule.id < best_rule.id):
            best_rule = rule
            best_saving = saving
            best_eligible_lines = elig_lines

    return best_rule, best_saving, best_eligible_lines


def allocate_discount(
    saving: int,
    eligible_lines: List[CalculatedLine],
) -> None:
    """
    Allocates discount saving proportionally across eligible lines.
    The last line takes the rounding remainder.
    """
    if saving <= 0 or not eligible_lines:
        return

    eligible_base = sum(l.amount for l in eligible_lines)
    if eligible_base <= 0:
        return

    allocated_so_far = 0
    for idx, line in enumerate(eligible_lines):
        if idx == len(eligible_lines) - 1:
            # Last line takes remainder
            line.discount_amount = saving - allocated_so_far
        else:
            fraction = Decimal(line.amount) / Decimal(eligible_base)
            alloc = round_half_up(Decimal(saving) * fraction)
            alloc = min(alloc, line.amount)
            line.discount_amount = alloc
            allocated_so_far += alloc


def resolve_line_tax(line: CalculatedLine, db: Session) -> Tuple[Optional[str], int]:
    """Resolves tax for a line (product beats product_type beats all)."""
    if line.product_id is not None:
        prod = db.query(Product).filter(Product.id == line.product_id).first()
        if prod:
            res = resolve_product_tax(prod, db)
            return res.applicable_rule_name, res.rate

    # For plan fee or unspecified product: check active scope='all' tax rule
    all_rule = (
        db.query(TaxRule)
        .filter(TaxRule.scope == "all", TaxRule.is_active == True)
        .order_by(TaxRule.id.desc())
        .first()
    )
    if all_rule:
        return all_rule.name, all_rule.rate

    return None, 0


def calculate_pricing(
    sub: Subscription,
    today: date,
    db: Session,
    excluded_discount_ids: Optional[set] = None,
) -> PricingResult:
    """
    Pure pricing calculation pipeline:
    1. Build raw lines (Plan line first if > 0, then enabled product lines).
    2. Pick single best eligible discount without stacking.
    3. Allocate discount proportionally (last line takes remainder).
    4. Compute tax per line on discounted amount.
    5. Aggregate totals where sum of line totals equals invoice totals exactly.
    """
    lines = build_raw_lines(sub)

    # Fetch active discounts
    all_discounts = (
        db.query(DiscountRule)
        .filter(DiscountRule.is_active == True)
        .all()
    )

    chosen_rule, saving, eligible_lines = pick_best_discount(
        all_discounts,
        lines,
        today,
        excluded_discount_ids=excluded_discount_ids,
    )

    if chosen_rule and saving > 0:
        allocate_discount(saving, eligible_lines)

    # Compute tax and line totals
    for line in lines:
        taxable_amount = line.amount - line.discount_amount
        tax_name, tax_rate = resolve_line_tax(line, db)
        line.tax_name = tax_name
        line.tax_rate = tax_rate
        line.tax_amount = round_half_up(Decimal(taxable_amount) * Decimal(tax_rate) / Decimal(10000))
        line.line_total = taxable_amount + line.tax_amount

    subtotal = sum(l.amount for l in lines)
    discount_total = sum(l.discount_amount for l in lines)
    tax_total = sum(l.tax_amount for l in lines)
    total = sum(l.line_total for l in lines)

    return PricingResult(
        lines=lines,
        applied_discount=chosen_rule,
        subtotal=subtotal,
        discount_total=discount_total,
        tax_total=tax_total,
        total=total,
    )


def try_claim_discount_usage(db: Session, discount_id: int) -> bool:
    """
    Atomically increments used_count if below usage_limit.
    Returns True if successful, False if exhausted.
    """
    stmt = (
        update(DiscountRule)
        .where(
            DiscountRule.id == discount_id,
            or_(
                DiscountRule.usage_limit.is_(None),
                DiscountRule.used_count < DiscountRule.usage_limit,
            ),
        )
        .values(used_count=DiscountRule.used_count + 1)
    )
    res = db.execute(stmt)
    db.flush()
    return res.rowcount > 0


def release_discount_usage(db: Session, discount_id: int) -> None:
    """Releases usage count on invoice cancellation (never below 0)."""
    stmt = (
        update(DiscountRule)
        .where(DiscountRule.id == discount_id, DiscountRule.used_count > 0)
        .values(used_count=DiscountRule.used_count - 1)
    )
    db.execute(stmt)
    db.flush()
