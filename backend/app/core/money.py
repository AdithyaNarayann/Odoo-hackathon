from decimal import Decimal, ROUND_HALF_UP


def round_half_up(value: Decimal | float | int) -> int:
    """Round to nearest integer using ROUND_HALF_UP, returning integer paise."""
    if not isinstance(value, Decimal):
        value = Decimal(str(value))
    return int(value.quantize(Decimal("1"), rounding=ROUND_HALF_UP))
