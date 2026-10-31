import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Layers,
  Send,
  RotateCcw,
  CheckCircle2,
  Play,
  Pause,
  XCircle,
  RefreshCw,
  Plus,
  Receipt,
  Clock,
  Calendar,
  Building,
  User,
  AlertTriangle,
  FileText,
  Tag,
  History,
  Check,
} from 'lucide-react';
import { api } from '../../api/client';
import { formatPaise, formatDate } from '../../utils/format';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Tabs from '../../components/ui/Tabs';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Toggle from '../../components/ui/Toggle';
import Skeleton from '../../components/ui/Skeleton';
import DataTable from '../../components/ui/DataTable';

export default function SubscriptionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const isCustomer = role === 'customer';
  const isAdminOrStaff = role === 'admin' || role === 'staff';

  const [activeTab, setActiveTab] = useState('overview');

  // Modals state
  const [renewModalOpen, setRenewModalOpen] = useState(false);
  const [renewPeriods, setRenewPeriods] = useState(1);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [addAddonModalOpen, setAddAddonModalOpen] = useState(false);
  const [newAddonData, setNewAddonData] = useState({ product_id: '', variant_id: '', quantity: 1 });

  // 1. Fetch Subscription Details
  const {
    data: sub,
    isLoading: subLoading,
    error: subError,
  } = useQuery({
    queryKey: ['subscription', id],
    queryFn: () => api.get(`/api/subscriptions/${id}`),
  });

  // 2. Fetch Plan Details (for plan policy flags: auto_close, closable, pausable, renewable)
  const { data: plan } = useQuery({
    queryKey: ['plan', sub?.plan_id],
    queryFn: () => api.get(`/api/plans/${sub.plan_id}`),
    enabled: Boolean(sub?.plan_id),
  });

  // 3. Fetch Next Invoice Preview
  const { data: invoicePreview, isLoading: previewLoading } = useQuery({
    queryKey: ['subscription-invoice-preview', id],
    queryFn: () => api.post(`/api/subscriptions/${id}/invoice-preview`),
    enabled: Boolean(sub && sub.status !== 'closed'),
  });

  // 4. Fetch Invoices for this subscription
  const { data: invoicesData, isLoading: invoicesLoading } = useQuery({
    queryKey: ['subscription-invoices', id],
    queryFn: () => api.get(`/api/invoices?subscription=${id}&page_size=50`),
    enabled: Boolean(sub),
  });

  // 5. Fetch Add-on Products for adding lines
  const { data: addonProducts } = useQuery({
    queryKey: ['addon-products'],
    queryFn: () => api.get('/api/products?type=add_on&is_active=true&page_size=100'),
    enabled: addAddonModalOpen,
  });

  // Mutations
  const statusMutation = useMutation({
    mutationFn: ({ status, note }) => api.post(`/api/subscriptions/${id}/status`, { status, note }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['subscription', id], updated);
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions-board'] });
      queryClient.invalidateQueries({ queryKey: ['subscription-invoice-preview', id] });
      success(`Subscription transitioned to ${updated.status}.`);
    },
    onError: (err) => toastError(err.detail || 'Failed to transition status.'),
  });

  const pauseMutation = useMutation({
    mutationFn: () => api.post(`/api/subscriptions/${id}/pause`),
    onSuccess: (updated) => {
      queryClient.setQueryData(['subscription', id], updated);
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      success('Subscription has been paused.');
    },
    onError: (err) => toastError(err.detail || 'Failed to pause subscription.'),
  });

  const resumeMutation = useMutation({
    mutationFn: () => api.post(`/api/subscriptions/${id}/resume`),
    onSuccess: (updated) => {
      queryClient.setQueryData(['subscription', id], updated);
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      queryClient.invalidateQueries({ queryKey: ['subscription-invoice-preview', id] });
      success('Subscription resumed.');
    },
    onError: (err) => toastError(err.detail || 'Failed to resume subscription.'),
  });

  const renewMutation = useMutation({
    mutationFn: (periods) => api.post(`/api/subscriptions/${id}/renew`, { periods }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['subscription', id], updated);
      queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
      success('Subscription contract renewed.');
      setRenewModalOpen(false);
    },
    onError: (err) => toastError(err.detail || 'Failed to renew subscription.'),
  });

  const toggleLineMutation = useMutation({
    mutationFn: ({ lineId, enabled }) =>
      api.patch(`/api/subscriptions/${id}/lines/${lineId}/toggle`, { enabled }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['subscription', id], updated);
      queryClient.invalidateQueries({ queryKey: ['subscription-invoice-preview', id] });
      success('Add-on line updated.');
    },
    onError: (err) => toastError(err.detail || 'Failed to toggle add-on line.'),
  });

  const addAddonLineMutation = useMutation({
    mutationFn: (payload) => api.post(`/api/subscriptions/${id}/lines`, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(['subscription', id], updated);
      queryClient.invalidateQueries({ queryKey: ['subscription-invoice-preview', id] });
      success('Add-on line added to active contract.');
      setAddAddonModalOpen(false);
      setNewAddonData({ product_id: '', variant_id: '', quantity: 1 });
    },
    onError: (err) => toastError(err.detail || 'Failed to add line.'),
  });

  if (subLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (subError || !sub) {
    return (
      <div className="p-8 bg-cream-light border-2 border-ink rounded-[4px] shadow-neo text-center">
        <div className="w-12 h-12 bg-red-100 text-red-600 border-2 border-ink rounded-full flex items-center justify-center mx-auto mb-3 shadow-neo-sm">
          <AlertTriangle size={24} />
        </div>
        <h2 className="font-anton text-2xl uppercase tracking-wide text-ink mb-2">
          Subscription Not Found
        </h2>
        <p className="text-xs text-ink/70 font-inter mb-4">
          The requested subscription does not exist or you lack permission to view it.
        </p>
        <Link to="/subscriptions">
          <Button variant="secondary">Back to Subscriptions</Button>
        </Link>
      </div>
    );
  }

  // Stepper definition
  const steps = ['draft', 'quotation', 'confirmed', 'active', 'closed'];
  const currentStepIdx = steps.indexOf(sub.status);

  // Determine allowed actions based on user role, status, and plan policy flags
  const canSendQuotation = isAdminOrStaff && sub.status === 'draft';
  const canRevise = isAdminOrStaff && sub.status === 'quotation';
  const canConfirm =
    (isAdminOrStaff || isCustomer) &&
    sub.status === 'quotation' &&
    (!sub.quotation_valid_until || new Date(sub.quotation_valid_until) >= new Date());
  const canActivate = isAdminOrStaff && sub.status === 'confirmed';
  const canPause =
    sub.status === 'active' &&
    !sub.is_paused &&
    Boolean(plan?.pausable) &&
    (isAdminOrStaff || isCustomer);
  const canResume =
    sub.status === 'active' &&
    sub.is_paused &&
    Boolean(plan?.pausable) &&
    (isAdminOrStaff || isCustomer);
  const canClose =
    sub.status !== 'closed' &&
    ((sub.status === 'active' && (plan?.closable || new Date(sub.expiry_date) < new Date())) ||
      (isAdminOrStaff && ['draft', 'quotation', 'confirmed'].includes(sub.status)));
  const canRenew =
    Boolean(plan?.renewable) &&
    (sub.status === 'active' || sub.status === 'closed') &&
    (isAdminOrStaff || isCustomer);
  const canAddAddon = isAdminOrStaff && sub.status === 'active';

  // Invoice Columns for Sub Tab
  const invoiceColumns = [
    {
      key: 'number',
      label: 'Invoice #',
      render: (val, row) => (
        <span
          onClick={() => navigate(`/invoices/${row.id}`)}
          className="font-archivo font-extrabold text-ink hover:text-brand-orange cursor-pointer"
        >
          {val}
        </span>
      ),
    },
    { key: 'invoice_date', label: 'Date', render: (val) => formatDate(val) },
    { key: 'due_date', label: 'Due Date', render: (val) => formatDate(val) },
    {
      key: 'status',
      label: 'Status',
      render: (val, row) => (
        <Badge status={row.is_overdue ? 'overdue' : val} isInvoice />
      ),
    },
    {
      key: 'total',
      label: 'Total',
      align: 'right',
      render: (val) => (
        <span className="font-anton text-ink tabular-nums text-sm">
          {formatPaise(val)}
        </span>
      ),
    },
    {
      key: 'balance',
      label: 'Balance',
      align: 'right',
      render: (val) => (
        <span
          className={`font-anton tabular-nums text-sm ${
            val > 0 ? 'text-brand-orange' : 'text-brand-teal'
          }`}
        >
          {formatPaise(val)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Navigation */}
      <div>
        <Link
          to={isCustomer ? '/portal/subscriptions' : '/subscriptions'}
          className="inline-flex items-center gap-1.5 text-xs font-archivo font-extrabold uppercase text-ink hover:text-brand-orange transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Back to Subscriptions</span>
        </Link>
      </div>

      {/* Header Card with Status and Action Buttons */}
      <div className="bg-cream-light border-2 border-ink rounded-[4px] p-6 shadow-neo-md flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-anton text-3xl uppercase tracking-wider text-ink">
              {sub.number}
            </h1>
            <Badge status={sub.is_paused ? 'paused' : sub.status} isSubscription />
            {sub.is_paused && (
              <span className="px-2 py-0.5 rounded-[3px] text-[10px] font-archivo font-extrabold uppercase bg-amber-100 text-amber-800 border border-amber-300">
                Billing Halted
              </span>
            )}
          </div>

          <div className="text-xs text-ink/70 font-semibold flex flex-wrap items-center gap-2 mt-1">
            <span className="text-ink font-bold">{sub.customer_name}</span>
            <span>•</span>
            <span>{sub.customer_company}</span>
            <span>•</span>
            <span className="uppercase text-brand-orange font-bold">{sub.plan_name}</span>
            <span>•</span>
            <span>{formatPaise(sub.recurring_subtotal)} / {sub.plan_billing_period}</span>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Edit (Draft or Quotation only) */}
          {['draft', 'quotation'].includes(sub.status) && isAdminOrStaff && (
            <Link to={`/subscriptions/${id}/edit`}>
              <Button variant="secondary">
                <span>Edit Contract</span>
              </Button>
            </Link>
          )}

          {/* Send Quotation (Draft -> Quotation) */}
          {canSendQuotation && (
            <Button
              variant="primary"
              loading={statusMutation.isPending}
              onClick={() => statusMutation.mutate({ status: 'quotation', note: 'Sent quotation to customer.' })}
            >
              <Send size={15} />
              <span>Send Quotation</span>
            </Button>
          )}

          {/* Revise Quotation (Quotation -> Draft) */}
          {canRevise && (
            <Button
              variant="secondary"
              loading={statusMutation.isPending}
              onClick={() => statusMutation.mutate({ status: 'draft', note: 'Quotation revised back to draft.' })}
            >
              <RotateCcw size={15} />
              <span>Revise</span>
            </Button>
          )}

          {/* Confirm (Quotation -> Confirmed) */}
          {canConfirm && (
            <Button
              variant="success"
              loading={statusMutation.isPending}
              onClick={() => statusMutation.mutate({ status: 'confirmed', note: 'Quotation accepted and confirmed.' })}
            >
              <CheckCircle2 size={15} />
              <span>Confirm Order</span>
            </Button>
          )}

          {/* Activate (Confirmed -> Active) */}
          {canActivate && (
            <Button
              variant="primary"
              loading={statusMutation.isPending}
              onClick={() => statusMutation.mutate({ status: 'active', note: 'Contract manually activated.' })}
            >
              <Play size={15} />
              <span>Activate</span>
            </Button>
          )}

          {/* Pause */}
          {canPause && (
            <Button
              variant="secondary"
              loading={pauseMutation.isPending}
              onClick={() => pauseMutation.mutate()}
            >
              <Pause size={15} />
              <span>Pause</span>
            </Button>
          )}

          {/* Resume */}
          {canResume && (
            <Button
              variant="primary"
              loading={resumeMutation.isPending}
              onClick={() => resumeMutation.mutate()}
            >
              <Play size={15} />
              <span>Resume</span>
            </Button>
          )}

          {/* Renew */}
          {canRenew && (
            <Button variant="secondary" onClick={() => setRenewModalOpen(true)}>
              <RefreshCw size={15} />
              <span>Renew</span>
            </Button>
          )}

          {/* Close */}
          {canClose && (
            <Button
              variant="danger"
              onClick={() => setCloseModalOpen(true)}
            >
              <XCircle size={15} />
              <span>Close Contract</span>
            </Button>
          )}
        </div>
      </div>

      {/* Status Stepper */}
      <div className="bg-white border-2 border-ink rounded-[4px] p-4 shadow-neo">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          {steps.map((st, idx) => {
            const isCompleted = idx < currentStepIdx;
            const isCurrent = idx === currentStepIdx;

            return (
              <React.Fragment key={st}>
                <div className="flex flex-col items-center gap-1.5 z-10">
                  <div
                    className={`
                      w-8 h-8 rounded-full border-2 border-ink flex items-center justify-center font-anton text-xs transition-all shadow-neo-sm
                      ${
                        isCurrent
                          ? 'bg-brand-orange text-white scale-110 ring-2 ring-brand-orange ring-offset-2'
                          : isCompleted
                          ? 'bg-brand-teal text-white'
                          : 'bg-cream text-ink/40'
                      }
                    `}
                  >
                    {isCompleted ? <Check size={14} strokeWidth={3} /> : idx + 1}
                  </div>
                  <span
                    className={`text-[10px] font-archivo font-extrabold uppercase tracking-wider ${
                      isCurrent ? 'text-brand-orange' : isCompleted ? 'text-brand-teal' : 'text-ink/40'
                    }`}
                  >
                    {st}
                  </span>
                </div>

                {idx < steps.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 border-t-2 mx-2 transition-all ${
                      idx < currentStepIdx ? 'border-brand-teal' : 'border-ink/20'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Next Invoice Preview Panel (Dry-run preview) */}
      {sub.status !== 'closed' && invoicePreview && (
        <div className="bg-cream-light border-2 border-ink rounded-[4px] p-5 shadow-neo">
          <div className="flex items-center justify-between pb-3 mb-3 border-b-2 border-ink/10">
            <div className="flex items-center gap-2">
              <Receipt size={18} className="text-brand-orange" />
              <h2 className="font-anton text-lg uppercase tracking-wider text-ink">
                Next Invoice Preview (Scheduled: {formatDate(invoicePreview.invoice_date)})
              </h2>
            </div>
            <span className="text-xs font-archivo font-bold uppercase text-ink/70">
              Period: {formatDate(invoicePreview.period_start)} to {formatDate(invoicePreview.period_end)}
            </span>
          </div>

          {/* Applied Discount Notice */}
          {invoicePreview.applied_discount_name && (
            <div className="mb-3 p-2.5 bg-brand-teal/10 border-2 border-brand-teal text-brand-teal text-xs font-bold rounded-[3px] flex items-center gap-2">
              <Tag size={15} />
              <span>
                Discount Applied: <strong>{invoicePreview.applied_discount_name}</strong> (-{formatPaise(invoicePreview.discount_total)})
              </span>
            </div>
          )}

          {/* Line summary */}
          <div className="space-y-1.5 text-xs">
            {invoicePreview.lines?.map((line, lIdx) => (
              <div key={lIdx} className="flex items-center justify-between py-1 border-b border-ink/5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-ink">{line.quantity}x</span>
                  <span className="text-ink">{line.description}</span>
                  {line.discount_amount > 0 && (
                    <span className="text-brand-teal font-semibold">
                      (-{formatPaise(line.discount_amount)} disc)
                    </span>
                  )}
                  {line.tax_rate > 0 && (
                    <span className="text-ink/60">
                      (+{(line.tax_rate / 100).toFixed(0)}% tax)
                    </span>
                  )}
                </div>
                <span className="font-anton text-ink tabular-nums">
                  {formatPaise(line.line_total)}
                </span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="mt-3 pt-3 border-t-2 border-ink/20 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="space-x-4">
              <span>Subtotal: <strong className="text-ink">{formatPaise(invoicePreview.subtotal)}</strong></span>
              <span>Discounts: <strong className="text-brand-teal">-{formatPaise(invoicePreview.discount_total)}</strong></span>
              <span>Tax: <strong className="text-ink">+{formatPaise(invoicePreview.tax_total)}</strong></span>
            </div>
            <div className="text-right">
              <span className="font-archivo font-extrabold uppercase mr-2 text-ink">Est. Invoice Total:</span>
              <span className="font-anton text-xl text-brand-orange tabular-nums">
                {formatPaise(invoicePreview.total)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 'overview', label: 'Contract Lines & Terms' },
          { id: 'invoices', label: 'Invoices History', count: invoicesData?.total || 0 },
          { id: 'activity', label: 'Activity Timeline', count: sub.events?.length || 0 },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Terms Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border-2 border-ink rounded-[4px] p-5 shadow-neo">
              <h3 className="font-anton text-lg uppercase tracking-wider text-ink mb-4 pb-2 border-b-2 border-ink/10 flex items-center gap-2">
                <Calendar size={18} className="text-brand-orange" />
                <span>Schedule & Billing</span>
              </h3>
              <dl className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1 border-b border-ink/10">
                  <dt className="font-archivo font-extrabold uppercase text-ink/60">Start Date</dt>
                  <dd className="font-bold text-ink">{formatDate(sub.start_date)}</dd>
                </div>
                <div className="flex justify-between py-1 border-b border-ink/10">
                  <dt className="font-archivo font-extrabold uppercase text-ink/60">Expiry Date</dt>
                  <dd className="font-bold text-ink">{formatDate(sub.expiry_date)}</dd>
                </div>
                <div className="flex justify-between py-1 border-b border-ink/10">
                  <dt className="font-archivo font-extrabold uppercase text-ink/60">Next Billing Date</dt>
                  <dd className="font-bold text-brand-orange">{formatDate(sub.next_billing_date)}</dd>
                </div>
                <div className="flex justify-between py-1 border-b border-ink/10">
                  <dt className="font-archivo font-extrabold uppercase text-ink/60">Payment Terms</dt>
                  <dd className="font-bold text-ink uppercase">{sub.payment_terms}</dd>
                </div>
                {sub.quotation_valid_until && (
                  <div className="flex justify-between py-1 border-b border-ink/10">
                    <dt className="font-archivo font-extrabold uppercase text-ink/60">Quotation Valid Until</dt>
                    <dd className="font-bold text-ink">{formatDate(sub.quotation_valid_until)}</dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="bg-white border-2 border-ink rounded-[4px] p-5 shadow-neo">
              <h3 className="font-anton text-lg uppercase tracking-wider text-ink mb-4 pb-2 border-b-2 border-ink/10 flex items-center gap-2">
                <Building size={18} className="text-brand-teal" />
                <span>Customer & Notes</span>
              </h3>
              <dl className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1 border-b border-ink/10">
                  <dt className="font-archivo font-extrabold uppercase text-ink/60">Company Name</dt>
                  <dd className="font-bold text-ink">{sub.customer_company}</dd>
                </div>
                <div className="flex justify-between py-1 border-b border-ink/10">
                  <dt className="font-archivo font-extrabold uppercase text-ink/60">Contact Person</dt>
                  <dd className="font-bold text-ink">{sub.customer_name}</dd>
                </div>
                <div className="py-1">
                  <dt className="font-archivo font-extrabold uppercase text-ink/60 mb-1">Contract Notes</dt>
                  <dd className="p-2 bg-cream-light border border-ink/20 rounded text-ink/80 italic">
                    {sub.notes || 'No special notes recorded.'}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Line Items Table with Add-on Switch Toggles */}
          <div className="bg-white border-2 border-ink rounded-[4px] p-5 shadow-neo">
            <div className="flex items-center justify-between pb-3 mb-4 border-b-2 border-ink/10">
              <div>
                <h3 className="font-anton text-lg uppercase tracking-wider text-ink">
                  Contract Line Items
                </h3>
                <p className="text-xs text-ink/60 font-semibold">
                  Add-on items can be toggled on active contracts and take effect on next billing
                </p>
              </div>

              {canAddAddon && (
                <Button variant="secondary" onClick={() => setAddAddonModalOpen(true)}>
                  <Plus size={15} strokeWidth={3} />
                  <span>Add Add-on</span>
                </Button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-cream-light border-b-2 border-ink">
                    <th className="p-2.5 font-archivo font-extrabold uppercase text-ink">Item</th>
                    <th className="p-2.5 font-archivo font-extrabold uppercase text-ink">Type</th>
                    <th className="p-2.5 font-archivo font-extrabold uppercase text-ink text-center">Qty</th>
                    <th className="p-2.5 font-archivo font-extrabold uppercase text-ink text-right">Unit Price</th>
                    <th className="p-2.5 font-archivo font-extrabold uppercase text-ink text-right">Amount</th>
                    <th className="p-2.5 font-archivo font-extrabold uppercase text-ink text-center">Active Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/10">
                  {/* Plan Fee Base Line */}
                  <tr className="bg-cream-light/40">
                    <td className="p-2.5 font-bold text-ink">
                      {sub.plan_name} (Base Plan Fee)
                    </td>
                    <td className="p-2.5">
                      <span className="px-1.5 py-0.5 rounded-[2px] bg-zinc-200 text-zinc-700 font-extrabold uppercase text-[10px]">
                        Plan
                      </span>
                    </td>
                    <td className="p-2.5 text-center font-bold text-ink">1</td>
                    <td className="p-2.5 text-right font-anton tabular-nums">{formatPaise(sub.plan_price)}</td>
                    <td className="p-2.5 text-right font-anton tabular-nums">{formatPaise(sub.plan_price)}</td>
                    <td className="p-2.5 text-center">
                      <span className="text-[10px] font-extrabold text-brand-teal uppercase">Included</span>
                    </td>
                  </tr>

                  {/* Product Lines */}
                  {sub.lines?.map((line) => {
                    const isAddon = line.product_type === 'add_on';
                    return (
                      <tr key={line.id} className={!line.enabled ? 'opacity-50 bg-zinc-50' : ''}>
                        <td className="p-2.5 font-bold text-ink">
                          <div>{line.product_name}</div>
                          {line.variant_label && (
                            <div className="text-[10px] text-ink/60 font-semibold">{line.variant_label}</div>
                          )}
                        </td>
                        <td className="p-2.5">
                          <span
                            className={`px-1.5 py-0.5 rounded-[2px] text-[10px] font-extrabold uppercase border ${
                              isAddon
                                ? 'bg-brand-teal/15 text-brand-teal border-brand-teal'
                                : 'bg-zinc-100 text-zinc-700 border-zinc-300'
                            }`}
                          >
                            {isAddon ? 'Add-on' : 'Standard'}
                          </span>
                        </td>
                        <td className="p-2.5 text-center font-bold text-ink">{line.quantity}</td>
                        <td className="p-2.5 text-right font-anton tabular-nums">{formatPaise(line.unit_price)}</td>
                        <td className="p-2.5 text-right font-anton tabular-nums">{formatPaise(line.amount)}</td>
                        <td className="p-2.5 text-center">
                          {isAddon && sub.status === 'active' ? (
                            <div className="flex justify-center">
                              <Toggle
                                checked={line.enabled}
                                onChange={(val) =>
                                  toggleLineMutation.mutate({ lineId: line.id, enabled: val })
                                }
                              />
                            </div>
                          ) : (
                            <span
                              className={`text-[10px] font-extrabold uppercase ${
                                line.enabled ? 'text-brand-teal' : 'text-zinc-500'
                              }`}
                            >
                              {line.enabled ? 'Enabled' : 'Disabled'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: INVOICES */}
      {activeTab === 'invoices' && (
        <DataTable
          columns={invoiceColumns}
          data={invoicesData?.items || []}
          loading={invoicesLoading}
          emptyTitle="No Invoices Generated"
          emptyMessage="Billing invoices generated for this contract will appear here."
        />
      )}

      {/* TAB 3: ACTIVITY TIMELINE */}
      {activeTab === 'activity' && (
        <div className="bg-white border-2 border-ink rounded-[4px] p-6 shadow-neo">
          <h3 className="font-anton text-lg uppercase tracking-wider text-ink mb-4 pb-2 border-b-2 border-ink/10 flex items-center gap-2">
            <History size={18} className="text-brand-orange" />
            <span>Event History & Audit Trail</span>
          </h3>

          {sub.events && sub.events.length > 0 ? (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-ink/20">
              {sub.events.map((ev) => (
                <div key={ev.id} className="relative">
                  <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-brand-orange border-2 border-ink shadow-neo-sm" />
                  <div className="text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-archivo font-extrabold uppercase text-ink">
                        {ev.action?.replace(/_/g, ' ')}
                      </span>
                      {ev.to_status && (
                        <Badge status={ev.to_status} isSubscription />
                      )}
                      <span className="text-ink/50 text-[11px]">• {formatDate(ev.timestamp)}</span>
                    </div>
                    {ev.note && <p className="text-ink/80 mt-1">{ev.note}</p>}
                    <p className="text-[10px] text-ink/60 mt-0.5 font-semibold">
                      Triggered by: {ev.actor_name || 'System'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-xs font-bold text-ink/40 uppercase">
              No lifecycle events recorded yet
            </div>
          )}
        </div>
      )}

      {/* Renew Modal */}
      <Modal
        isOpen={renewModalOpen}
        onClose={() => setRenewModalOpen(false)}
        title="Renew Subscription Contract"
        confirmText="Confirm Renewal"
        confirmVariant="primary"
        icon={RefreshCw}
        loading={renewMutation.isPending}
        onConfirm={() => renewMutation.mutate(parseInt(renewPeriods, 10) || 1)}
      >
        <div className="space-y-4">
          <p className="text-xs text-ink/80">
            Select the number of billing periods to extend this contract term ({sub.plan_billing_period}):
          </p>
          <Input
            label={`Number of Periods (${sub.plan_billing_period})`}
            type="number"
            min="1"
            max="36"
            value={renewPeriods}
            onChange={(e) => setRenewPeriods(e.target.value)}
            required
          />
        </div>
      </Modal>

      {/* Close Confirm Modal */}
      <Modal
        isOpen={closeModalOpen}
        onClose={() => setCloseModalOpen(false)}
        title="Close Subscription Contract"
        description={`Are you sure you want to close subscription ${sub.number}? Closed contracts cannot be edited and will no longer generate future recurring invoices.`}
        confirmText="Close Contract"
        confirmVariant="danger"
        loading={statusMutation.isPending}
        onConfirm={() => {
          statusMutation.mutate({ status: 'closed', note: 'Contract closed by user.' });
          setCloseModalOpen(false);
        }}
      />

      {/* Add Add-on Line Modal */}
      <Modal
        isOpen={addAddonModalOpen}
        onClose={() => setAddAddonModalOpen(false)}
        title="Add Add-on Product Line"
        confirmText="Add to Contract"
        confirmVariant="primary"
        icon={Plus}
        loading={addAddonLineMutation.isPending}
        onConfirm={(e) => {
          e.preventDefault();
          if (!newAddonData.product_id) {
            toastError('Please select an add-on product.');
            return;
          }
          addAddonLineMutation.mutate({
            product_id: parseInt(newAddonData.product_id, 10),
            variant_id: newAddonData.variant_id ? parseInt(newAddonData.variant_id, 10) : null,
            quantity: parseInt(newAddonData.quantity, 10) || 1,
          });
        }}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-archivo font-extrabold uppercase tracking-wider text-ink mb-1.5">
              Add-on Product
            </label>
            <select
              value={newAddonData.product_id}
              onChange={(e) =>
                setNewAddonData({ ...newAddonData, product_id: e.target.value, variant_id: '' })
              }
              className="w-full px-3 py-2 bg-white border-2 border-ink rounded-[4px] text-xs font-archivo font-bold text-ink shadow-neo-sm focus:outline-none"
              required
            >
              <option value="">Select add-on product...</option>
              {addonProducts?.items?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({formatPaise(p.sales_price)})
                </option>
              ))}
            </select>
          </div>

          {/* Variant picker if selected product has variants */}
          {(() => {
            const p = addonProducts?.items?.find((i) => i.id === parseInt(newAddonData.product_id, 10));
            if (p?.variants && p.variants.length > 0) {
              return (
                <div>
                  <label className="block text-xs font-archivo font-extrabold uppercase tracking-wider text-ink mb-1.5">
                    Product Variant
                  </label>
                  <select
                    value={newAddonData.variant_id}
                    onChange={(e) =>
                      setNewAddonData({ ...newAddonData, variant_id: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white border-2 border-ink rounded-[4px] text-xs font-archivo font-bold text-ink shadow-neo-sm focus:outline-none"
                  >
                    <option value="">Base ({formatPaise(p.sales_price)})</option>
                    {p.variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.attribute}: {v.value} (+{formatPaise(v.extra_price)})
                      </option>
                    ))}
                  </select>
                </div>
              );
            }
            return null;
          })()}

          <Input
            label="Quantity"
            type="number"
            min="1"
            value={newAddonData.quantity}
            onChange={(e) => setNewAddonData({ ...newAddonData, quantity: e.target.value })}
            required
          />
        </div>
      </Modal>
    </div>
  );
}
