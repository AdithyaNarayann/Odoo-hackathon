import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Layers,
  Save,
  Plus,
  Trash2,
  Calendar,
  Building,
  CreditCard,
  FileSpreadsheet,
  AlertCircle,
  HelpCircle,
  Check,
} from 'lucide-react';
import { api } from '../../api/client';
import { formatPaise } from '../../utils/format';
import { useToast } from '../../context/ToastContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Skeleton from '../../components/ui/Skeleton';

export default function SubscriptionFormPage() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const [mode, setMode] = useState('custom'); // 'custom' | 'template'
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  // Form Fields
  const [customerId, setCustomerId] = useState('');
  const [planId, setPlanId] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [expiryDate, setExpiryDate] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
  });
  const [paymentTerms, setPaymentTerms] = useState('immediate');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState([]);

  // Field-specific validation errors from backend
  const [fieldErrors, setFieldErrors] = useState({});

  // 1. Fetch Customers
  const { data: customersData } = useQuery({
    queryKey: ['customers-dropdown'],
    queryFn: () => api.get('/api/customers?is_active=true&page_size=100'),
  });

  // 2. Fetch Plans
  const { data: plansData } = useQuery({
    queryKey: ['plans-dropdown'],
    queryFn: () => api.get('/api/plans?is_active=true&page_size=100'),
  });

  // 3. Fetch Products
  const { data: productsData } = useQuery({
    queryKey: ['products-dropdown'],
    queryFn: () => api.get('/api/products?is_active=true&page_size=100'),
  });

  // 4. Fetch Templates
  const { data: templatesData } = useQuery({
    queryKey: ['templates-dropdown'],
    queryFn: () => api.get('/api/quotation-templates?is_active=true&page_size=100'),
  });

  // 5. If editing, fetch existing subscription
  const { data: existingSub, isLoading: subLoading } = useQuery({
    queryKey: ['subscription', id],
    queryFn: () => api.get(`/api/subscriptions/${id}`),
    enabled: isEditing,
  });

  useEffect(() => {
    if (existingSub) {
      setCustomerId(existingSub.customer_id.toString());
      setPlanId(existingSub.plan_id.toString());
      setStartDate(existingSub.start_date);
      setExpiryDate(existingSub.expiry_date);
      setPaymentTerms(existingSub.payment_terms || 'immediate');
      setNotes(existingSub.notes || '');
      setLines(
        (existingSub.lines || []).map((l) => ({
          product_id: l.product_id.toString(),
          variant_id: l.variant_id ? l.variant_id.toString() : '',
          quantity: l.quantity,
          unit_price: l.unit_price,
        }))
      );
    }
  }, [existingSub]);

  // Selected Plan helper
  const selectedPlan = useMemo(() => {
    return plansData?.items?.find((p) => p.id === parseInt(planId, 10));
  }, [plansData, planId]);

  // Handle Template Selection
  const handleSelectTemplate = (templateId) => {
    setSelectedTemplateId(templateId);
    if (!templateId) return;
    const tmpl = templatesData?.items?.find((t) => t.id === parseInt(templateId, 10));
    if (tmpl) {
      setPlanId(tmpl.plan_id.toString());
      // Populate template lines
      setLines(
        (tmpl.lines || []).map((l) => ({
          product_id: l.product_id.toString(),
          variant_id: l.variant_id ? l.variant_id.toString() : '',
          quantity: l.quantity,
          unit_price: l.unit_price,
        }))
      );
    }
  };

  // Add Line
  const handleAddLine = () => {
    const firstProd = productsData?.items?.[0];
    if (!firstProd) {
      toastError('No active products available to add.');
      return;
    }
    const minQty = selectedPlan?.min_quantity || 1;
    setLines((prev) => [
      ...prev,
      {
        product_id: firstProd.id.toString(),
        variant_id: firstProd.variants?.[0]?.id ? firstProd.variants[0].id.toString() : '',
        quantity: minQty,
        unit_price: firstProd.sales_price,
      },
    ]);
  };

  // Remove Line
  const handleRemoveLine = (idx) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  // Line Change
  const handleLineChange = (idx, field, value) => {
    setLines((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };

      if (field === 'product_id') {
        const prod = productsData?.items?.find((p) => p.id === parseInt(value, 10));
        updated[idx].variant_id = '';
        updated[idx].unit_price = prod?.sales_price || 0;
      } else if (field === 'variant_id') {
        const prod = productsData?.items?.find((p) => p.id === parseInt(updated[idx].product_id, 10));
        const variant = prod?.variants?.find((v) => v.id === parseInt(value, 10));
        updated[idx].unit_price = (prod?.sales_price || 0) + (variant?.extra_price || 0);
      }
      return updated;
    });
  };

  // Running Totals Calculation
  const totals = useMemo(() => {
    const planFee = selectedPlan?.price || 0;
    const linesSubtotal = lines.reduce((acc, l) => {
      const prod = productsData?.items?.find((p) => p.id === parseInt(l.product_id, 10));
      const variant = prod?.variants?.find((v) => v.id === parseInt(l.variant_id, 10));
      const unitPrice = (prod?.sales_price || 0) + (variant?.extra_price || 0);
      const qty = parseInt(l.quantity, 10) || 0;
      return acc + unitPrice * qty;
    }, 0);

    const recurringSubtotal = planFee + linesSubtotal;
    return {
      planFee,
      linesSubtotal,
      recurringSubtotal,
    };
  }, [selectedPlan, lines, productsData]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/api/subscriptions', payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-board'] });
      success(`Subscription ${res.number} created successfully.`);
      navigate(`/subscriptions/${res.id}`);
    },
    onError: (err) => {
      handleApiErrors(err);
    },
  });

  const createFromTemplateMutation = useMutation({
    mutationFn: (payload) => api.post('/api/subscriptions/from-template', payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-board'] });
      success(`Subscription ${res.number} created from template.`);
      navigate(`/subscriptions/${res.id}`);
    },
    onError: (err) => {
      handleApiErrors(err);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload) => api.put(`/api/subscriptions/${id}`, payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['subscription', id] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      success(`Subscription ${res.number} updated successfully.`);
      navigate(`/subscriptions/${res.id}`);
    },
    onError: (err) => {
      handleApiErrors(err);
    },
  });

  const handleApiErrors = (err) => {
    toastError(err.detail || 'Validation error saving subscription.');
    if (err.fields && Array.isArray(err.fields)) {
      const mapping = {};
      err.fields.forEach((f) => {
        mapping[f.field] = f.message;
      });
      setFieldErrors(mapping);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setFieldErrors({});

    if (!customerId) {
      setFieldErrors((prev) => ({ ...prev, customer_id: 'Please select a customer.' }));
      toastError('Customer is required.');
      return;
    }
    if (!planId) {
      setFieldErrors((prev) => ({ ...prev, plan_id: 'Please select a plan.' }));
      toastError('Plan is required.');
      return;
    }
    if (expiryDate < startDate) {
      setFieldErrors((prev) => ({ ...prev, expiry_date: 'Expiry date must not be before start date.' }));
      toastError('Expiry date must not be before start date.');
      return;
    }

    // Min quantity validation per line
    if (selectedPlan?.min_quantity) {
      for (const line of lines) {
        if (line.quantity < selectedPlan.min_quantity) {
          toastError(`Quantity must be at least ${selectedPlan.min_quantity} as required by ${selectedPlan.name}.`);
          return;
        }
      }
    }

    if (isEditing) {
      updateMutation.mutate({
        start_date: startDate,
        expiry_date: expiryDate,
        payment_terms: paymentTerms,
        notes: notes.trim() || null,
        lines: lines.map((l) => ({
          product_id: parseInt(l.product_id, 10),
          variant_id: l.variant_id ? parseInt(l.variant_id, 10) : null,
          quantity: parseInt(l.quantity, 10) || 1,
        })),
      });
    } else {
      if (mode === 'template' && selectedTemplateId && lines.length === 0) {
        // Create from template endpoint
        createFromTemplateMutation.mutate({
          customer_id: parseInt(customerId, 10),
          template_id: parseInt(selectedTemplateId, 10),
          start_date: startDate,
          expiry_date: expiryDate,
          payment_terms: paymentTerms,
          notes: notes.trim() || null,
        });
      } else {
        createMutation.mutate({
          customer_id: parseInt(customerId, 10),
          plan_id: parseInt(planId, 10),
          start_date: startDate,
          expiry_date: expiryDate,
          payment_terms: paymentTerms,
          notes: notes.trim() || null,
          lines: lines.map((l) => ({
            product_id: parseInt(l.product_id, 10),
            variant_id: l.variant_id ? parseInt(l.variant_id, 10) : null,
            quantity: parseInt(l.quantity, 10) || 1,
          })),
        });
      }
    }
  };

  if (isEditing && subLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Back Button */}
      <div>
        <Link
          to={isEditing ? `/subscriptions/${id}` : '/subscriptions'}
          className="inline-flex items-center gap-1.5 text-xs font-archivo font-extrabold uppercase text-ink hover:text-brand-orange transition-colors"
        >
          <ArrowLeft size={16} />
          <span>{isEditing ? 'Cancel Edit' : 'Back to Subscriptions'}</span>
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-anton text-3xl uppercase tracking-wider text-ink">
            {isEditing ? `EDIT CONTRACT ${existingSub?.number}` : 'NEW SUBSCRIPTION CONTRACT'}
          </h1>
          <p className="font-archivo text-xs font-bold uppercase tracking-wide text-ink/70 mt-1">
            Configure recurring terms, product lines, and contract duration
          </p>
        </div>

        {!isEditing && (
          <div className="inline-flex border-2 border-ink rounded-[4px] shadow-neo-sm overflow-hidden bg-white p-0.5">
            <button
              type="button"
              onClick={() => {
                setMode('custom');
                setSelectedTemplateId('');
              }}
              className={`px-3 py-1.5 rounded-[2px] text-xs font-archivo font-extrabold uppercase transition-all ${
                mode === 'custom' ? 'bg-brand-orange text-white shadow-neo-sm' : 'text-ink hover:bg-cream'
              }`}
            >
              Custom Contract
            </button>
            <button
              type="button"
              onClick={() => setMode('template')}
              className={`px-3 py-1.5 rounded-[2px] text-xs font-archivo font-extrabold uppercase transition-all ${
                mode === 'template' ? 'bg-brand-orange text-white shadow-neo-sm' : 'text-ink hover:bg-cream'
              }`}
            >
              From Template
            </button>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Template Picker (if mode === 'template' and not editing) */}
        {!isEditing && mode === 'template' && (
          <div className="bg-cream-light border-2 border-ink rounded-[4px] p-5 shadow-neo">
            <div className="flex items-center gap-2 mb-3">
              <FileSpreadsheet size={18} className="text-brand-orange" />
              <h2 className="font-anton text-lg uppercase tracking-wider text-ink">
                Select Quotation Template
              </h2>
            </div>
            <select
              value={selectedTemplateId}
              onChange={(e) => handleSelectTemplate(e.target.value)}
              className="w-full px-3 py-2 bg-white border-2 border-ink rounded-[4px] text-xs font-archivo font-bold text-ink shadow-neo-sm focus:outline-none"
            >
              <option value="">Choose a template...</option>
              {templatesData?.items?.map((tmpl) => (
                <option key={tmpl.id} value={tmpl.id}>
                  {tmpl.name} (Plan: {tmpl.plan_name}, {tmpl.lines?.length || 0} items)
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Contract Header Details Card */}
        <div className="bg-white border-2 border-ink rounded-[4px] p-6 shadow-neo space-y-4">
          <h2 className="font-anton text-xl uppercase tracking-wider text-ink pb-2 border-b-2 border-ink/10 flex items-center gap-2">
            <Layers size={20} className="text-brand-orange" />
            <span>Contract Terms</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Customer Picker */}
            <div>
              <label className="block text-xs font-archivo font-extrabold uppercase tracking-wider text-ink mb-1.5">
                Customer Account <span className="text-brand-orange">*</span>
              </label>
              <select
                value={customerId}
                disabled={isEditing}
                onChange={(e) => {
                  setCustomerId(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, customer_id: null }));
                }}
                className={`w-full px-3 py-2 bg-white border-2 border-ink rounded-[4px] text-xs font-archivo font-bold text-ink shadow-neo-sm focus:outline-none ${
                  fieldErrors.customer_id ? 'border-red-500 bg-red-50' : ''
                } ${isEditing ? 'opacity-60 cursor-not-allowed' : ''}`}
                required
              >
                <option value="">Select customer...</option>
                {customersData?.items?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.company_name} ({c.email})
                  </option>
                ))}
              </select>
              {fieldErrors.customer_id && (
                <p className="text-xs text-red-600 font-bold mt-1">{fieldErrors.customer_id}</p>
              )}
            </div>

            {/* Plan Picker */}
            <div>
              <label className="block text-xs font-archivo font-extrabold uppercase tracking-wider text-ink mb-1.5">
                Subscription Plan <span className="text-brand-orange">*</span>
              </label>
              <select
                value={planId}
                disabled={isEditing}
                onChange={(e) => {
                  setPlanId(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, plan_id: null }));
                }}
                className={`w-full px-3 py-2 bg-white border-2 border-ink rounded-[4px] text-xs font-archivo font-bold text-ink shadow-neo-sm focus:outline-none ${
                  fieldErrors.plan_id ? 'border-red-500 bg-red-50' : ''
                } ${isEditing ? 'opacity-60 cursor-not-allowed' : ''}`}
                required
              >
                <option value="">Select subscription plan...</option>
                {plansData?.items?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({formatPaise(p.price)} / {p.billing_period})
                  </option>
                ))}
              </select>
              {fieldErrors.plan_id && (
                <p className="text-xs text-red-600 font-bold mt-1">{fieldErrors.plan_id}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Start Date */}
            <div>
              <Input
                label="Start Date *"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                error={fieldErrors.start_date}
                required
              />
            </div>

            {/* Expiry Date */}
            <div>
              <Input
                label="Expiry Date *"
                type="date"
                value={expiryDate}
                onChange={(e) => {
                  setExpiryDate(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, expiry_date: null }));
                }}
                error={fieldErrors.expiry_date}
                required
              />
            </div>

            {/* Payment Terms */}
            <div>
              <label className="block text-xs font-archivo font-extrabold uppercase tracking-wider text-ink mb-1.5">
                Payment Terms
              </label>
              <select
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                className="w-full px-3 py-2 bg-white border-2 border-ink rounded-[4px] text-xs font-archivo font-bold text-ink shadow-neo-sm focus:outline-none"
              >
                <option value="immediate">Immediate Due</option>
                <option value="net_15">Net 15 Days</option>
                <option value="net_30">Net 30 Days</option>
                <option value="net_45">Net 45 Days</option>
              </select>
            </div>
          </div>

          <Input
            label="Internal Notes / Agreement Terms"
            placeholder="Reference quotation notes, customer procurement IDs, or special terms"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Line Items Editor */}
        <div className="bg-white border-2 border-ink rounded-[4px] p-6 shadow-neo space-y-4">
          <div className="flex items-center justify-between pb-2 border-b-2 border-ink/10">
            <div>
              <h2 className="font-anton text-xl uppercase tracking-wider text-ink">
                Contract Line Items
              </h2>
              <p className="text-xs text-ink/70 font-semibold">
                Product quantities and agreed variant contract prices
              </p>
            </div>

            <Button type="button" variant="secondary" onClick={handleAddLine}>
              <Plus size={16} strokeWidth={3} />
              <span>Add Line Item</span>
            </Button>
          </div>

          {lines.length === 0 ? (
            <div className="py-8 text-center bg-cream-light border-2 border-dashed border-ink/40 rounded-[4px]">
              <p className="text-xs font-bold text-ink/60 uppercase">
                No product lines attached. Only base plan fee will apply.
              </p>
              <button
                type="button"
                onClick={handleAddLine}
                className="mt-2 text-xs font-archivo font-extrabold text-brand-orange hover:underline uppercase"
              >
                + Add your first line item
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {lines.map((line, idx) => {
                const selectedProd = productsData?.items?.find(
                  (p) => p.id === parseInt(line.product_id, 10)
                );
                const selectedVariant = selectedProd?.variants?.find(
                  (v) => v.id === parseInt(line.variant_id, 10)
                );
                const unitPrice =
                  (selectedProd?.sales_price || 0) + (selectedVariant?.extra_price || 0);
                const lineTotal = unitPrice * (parseInt(line.quantity, 10) || 0);

                return (
                  <div
                    key={idx}
                    className="p-3 bg-cream-light border-2 border-ink rounded-[4px] shadow-neo-sm grid grid-cols-12 gap-3 items-center"
                  >
                    {/* Product */}
                    <div className="col-span-12 sm:col-span-4">
                      <label className="block text-[10px] font-archivo font-extrabold uppercase text-ink/70 mb-1">
                        Product
                      </label>
                      <select
                        value={line.product_id}
                        onChange={(e) => handleLineChange(idx, 'product_id', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-ink rounded-[3px] text-xs font-bold text-ink"
                        required
                      >
                        {productsData?.items?.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.type === 'add_on' ? 'Add-on' : 'Standard'})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Variant */}
                    <div className="col-span-12 sm:col-span-3">
                      <label className="block text-[10px] font-archivo font-extrabold uppercase text-ink/70 mb-1">
                        Variant
                      </label>
                      {selectedProd?.variants && selectedProd.variants.length > 0 ? (
                        <select
                          value={line.variant_id}
                          onChange={(e) => handleLineChange(idx, 'variant_id', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-ink rounded-[3px] text-xs font-bold text-ink"
                        >
                          <option value="">Base ({formatPaise(selectedProd.sales_price)})</option>
                          {selectedProd.variants.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.attribute}: {v.value} (+{formatPaise(v.extra_price)})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="px-2.5 py-1.5 text-xs text-ink/50 bg-zinc-100 border border-zinc-300 rounded italic">
                          Standard
                        </div>
                      )}
                    </div>

                    {/* Quantity */}
                    <div className="col-span-4 sm:col-span-2">
                      <label className="block text-[10px] font-archivo font-extrabold uppercase text-ink/70 mb-1">
                        Quantity
                      </label>
                      <input
                        type="number"
                        min={selectedPlan?.min_quantity || 1}
                        value={line.quantity}
                        onChange={(e) => handleLineChange(idx, 'quantity', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-ink rounded-[3px] text-xs font-bold text-ink"
                        required
                      />
                    </div>

                    {/* Amount & Delete */}
                    <div className="col-span-8 sm:col-span-3 flex items-center justify-between pt-3 sm:pt-0">
                      <div>
                        <div className="text-[10px] font-archivo font-bold text-ink/60 uppercase">
                          {formatPaise(unitPrice)} each
                        </div>
                        <div className="font-anton text-sm text-ink tabular-nums">
                          {formatPaise(lineTotal)}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveLine(idx)}
                        className="p-1.5 text-red-600 hover:bg-red-100 rounded-[3px] transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Running Totals Panel */}
          <div className="mt-4 p-4 bg-cream border-2 border-ink rounded-[4px] shadow-neo-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-xs space-y-1">
              <div className="flex items-center gap-3">
                <span className="font-archivo font-extrabold uppercase text-ink/70">Plan Base Fee:</span>
                <span className="font-bold text-ink">{formatPaise(totals.planFee)}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-archivo font-extrabold uppercase text-ink/70">Lines Subtotal:</span>
                <span className="font-bold text-ink">{formatPaise(totals.linesSubtotal)}</span>
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs font-archivo font-extrabold uppercase tracking-wider text-ink/70">
                Recurring Subtotal per {selectedPlan?.billing_period || 'Period'}
              </div>
              <div className="font-anton text-2xl text-brand-orange tabular-nums">
                {formatPaise(totals.recurringSubtotal)}
              </div>
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link to={isEditing ? `/subscriptions/${id}` : '/subscriptions'}>
            <Button type="button" variant="ghost">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            variant="primary"
            disabled={
              createMutation.isPending ||
              createFromTemplateMutation.isPending ||
              updateMutation.isPending
            }
          >
            <Save size={16} />
            <span>
              {isEditing
                ? 'Save Contract Changes'
                : 'Create Subscription Contract'}
            </span>
          </Button>
        </div>
      </form>
    </div>
  );
}
