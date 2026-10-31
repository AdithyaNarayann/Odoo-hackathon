import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Receipt,
  Printer,
  Send,
  CheckCircle2,
  XCircle,
  CreditCard,
  Building,
  Calendar,
  AlertTriangle,
  Tag,
  DollarSign,
  Clock,
} from 'lucide-react';
import { api } from '../../api/client';
import { formatPaise, formatDate } from '../../utils/format';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Skeleton from '../../components/ui/Skeleton';

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const isCustomer = role === 'customer';
  const isAdminOrStaff = role === 'admin' || role === 'staff';

  // Modals state
  const [recordPaymentModalOpen, setRecordPaymentModalOpen] = useState(false);
  const [paymentAmountInr, setPaymentAmountInr] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentNote, setPaymentNote] = useState('');
  const [cancelModalOpen, setCancelModalOpen] = useState(false);

  // 1. Fetch Invoice Details
  const {
    data: invoice,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => api.get(`/api/invoices/${id}`),
  });

  // Action Mutations
  const confirmMutation = useMutation({
    mutationFn: () => api.post(`/api/invoices/${id}/confirm`),
    onSuccess: (updated) => {
      queryClient.setQueryData(['invoice', id], updated);
      queryClient.invalidateQueries({ queryKey: ['invoices-list'] });
      success('Invoice posted and confirmed.');
    },
    onError: (err) => toastError(err.detail || 'Failed to confirm invoice.'),
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/api/invoices/${id}/cancel`),
    onSuccess: (updated) => {
      queryClient.setQueryData(['invoice', id], updated);
      queryClient.invalidateQueries({ queryKey: ['invoices-list'] });
      success('Invoice cancelled.');
      setCancelModalOpen(false);
    },
    onError: (err) => toastError(err.detail || 'Failed to cancel invoice.'),
  });

  const sendEmailMutation = useMutation({
    mutationFn: () => api.post(`/api/invoices/${id}/send`),
    onSuccess: (updated) => {
      queryClient.setQueryData(['invoice', id], updated);
      success(`Invoice email sent to ${invoice?.customer_email}.`);
    },
    onError: (err) => toastError(err.detail || 'Failed to send invoice email.'),
  });

  const recordPaymentMutation = useMutation({
    mutationFn: (payload) => api.post('/api/payments', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['invoices-list'] });
      queryClient.invalidateQueries({ queryKey: ['payments-list'] });
      success('Payment recorded successfully.');
      setRecordPaymentModalOpen(false);
    },
    onError: (err) => toastError(err.detail || 'Failed to record payment.'),
  });

  const openPaymentModal = () => {
    if (!invoice) return;
    setPaymentAmountInr((invoice.balance / 100).toFixed(2));
    setPaymentMethod('bank_transfer');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentNote(`Payment for invoice ${invoice.number}`);
    setRecordPaymentModalOpen(true);
  };

  const handleRecordPaymentSubmit = (e) => {
    e.preventDefault();
    const amountPaise = Math.round((parseFloat(paymentAmountInr) || 0) * 100);
    if (amountPaise <= 0 || amountPaise > invoice.balance) {
      toastError(`Payment amount must be between ₹1 and balance of ${formatPaise(invoice.balance)}.`);
      return;
    }

    recordPaymentMutation.mutate({
      invoice_id: invoice.id,
      amount: amountPaise,
      method: paymentMethod,
      payment_date: paymentDate,
      note: paymentNote.trim() || null,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="p-8 bg-cream-light border-2 border-ink rounded-[4px] shadow-neo text-center">
        <div className="w-12 h-12 bg-red-100 text-red-600 border-2 border-ink rounded-full flex items-center justify-center mx-auto mb-3 shadow-neo-sm">
          <AlertTriangle size={24} />
        </div>
        <h2 className="font-anton text-2xl uppercase tracking-wide text-ink mb-2">
          Invoice Not Found
        </h2>
        <p className="text-xs text-ink/70 font-inter mb-4">
          The requested invoice does not exist or you lack permission to view it.
        </p>
        <Link to="/invoices">
          <Button variant="secondary">Back to Invoices</Button>
        </Link>
      </div>
    );
  }

  const canConfirm = isAdminOrStaff && invoice.status === 'draft';
  const canCancel = isAdminOrStaff && ['draft', 'confirmed'].includes(invoice.status);
  const canRecordPayment = isAdminOrStaff && invoice.status === 'confirmed' && invoice.balance > 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Back Button */}
      <div>
        <Link
          to={isCustomer ? '/portal/invoices' : '/invoices'}
          className="inline-flex items-center gap-1.5 text-xs font-archivo font-extrabold uppercase text-ink hover:text-brand-orange transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Back to Invoices</span>
        </Link>
      </div>

      {/* Header Card */}
      <div className="bg-cream-light border-2 border-ink rounded-[4px] p-6 shadow-neo-md flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-anton text-3xl uppercase tracking-wider text-ink">
              {invoice.number}
            </h1>
            <Badge status={invoice.is_overdue ? 'overdue' : invoice.status} isInvoice />
            {invoice.is_overdue && (
              <span className="px-2 py-0.5 rounded-[3px] text-[10px] font-archivo font-extrabold uppercase bg-red-100 text-red-700 border border-red-300">
                {invoice.days_overdue} Days Overdue
              </span>
            )}
          </div>

          <div className="text-xs text-ink/70 font-semibold flex flex-wrap items-center gap-2 mt-1">
            <span className="text-ink font-bold">{invoice.customer_name}</span>
            <span>•</span>
            <span>{invoice.company_name}</span>
            <span>•</span>
            <span>Invoice Date: {formatDate(invoice.invoice_date)}</span>
            <span>•</span>
            <span>Due Date: {formatDate(invoice.due_date)}</span>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {canConfirm && (
            <Button
              variant="success"
              loading={confirmMutation.isPending}
              onClick={() => confirmMutation.mutate()}
            >
              <CheckCircle2 size={15} />
              <span>Confirm Invoice</span>
            </Button>
          )}

          {canRecordPayment && (
            <Button variant="primary" onClick={openPaymentModal}>
              <CreditCard size={15} />
              <span>Record Payment</span>
            </Button>
          )}

          {isAdminOrStaff && (
            <Button
              variant="secondary"
              loading={sendEmailMutation.isPending}
              onClick={() => sendEmailMutation.mutate()}
            >
              <Send size={15} />
              <span>{invoice.sent_at ? 'Resend Email' : 'Send Email'}</span>
            </Button>
          )}

          <Link to={`/invoices/${id}/print`}>
            <Button variant="secondary">
              <Printer size={15} />
              <span>Print Invoice</span>
            </Button>
          </Link>

          {canCancel && (
            <Button variant="danger" onClick={() => setCancelModalOpen(true)}>
              <XCircle size={15} />
              <span>Cancel</span>
            </Button>
          )}
        </div>
      </div>

      {/* Overview Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Customer & Billing Address */}
        <div className="bg-white border-2 border-ink rounded-[4px] p-5 shadow-neo">
          <h3 className="font-anton text-lg uppercase tracking-wider text-ink mb-3 pb-2 border-b-2 border-ink/10 flex items-center gap-2">
            <Building size={18} className="text-brand-orange" />
            <span>Billed To</span>
          </h3>
          <div className="text-xs space-y-1 text-ink">
            <div className="font-bold text-sm">{invoice.customer_name}</div>
            <div className="font-semibold text-ink/80">{invoice.company_name}</div>
            <div className="text-ink/70">{invoice.customer_email}</div>
            {invoice.billing_address_line1 && <div>{invoice.billing_address_line1}</div>}
            {invoice.billing_address_line2 && <div>{invoice.billing_address_line2}</div>}
            <div>
              {[invoice.city, invoice.state, invoice.postal_code].filter(Boolean).join(', ')}
            </div>
            {invoice.country && <div>{invoice.country}</div>}
            {invoice.tax_id && (
              <div className="pt-1 font-mono font-bold text-ink">
                GSTIN / Tax ID: {invoice.tax_id}
              </div>
            )}
          </div>
        </div>

        {/* Invoice Metadata */}
        <div className="bg-white border-2 border-ink rounded-[4px] p-5 shadow-neo">
          <h3 className="font-anton text-lg uppercase tracking-wider text-ink mb-3 pb-2 border-b-2 border-ink/10 flex items-center gap-2">
            <Clock size={18} className="text-brand-teal" />
            <span>Billing Term & Details</span>
          </h3>
          <dl className="space-y-2 text-xs">
            <div className="flex justify-between py-0.5 border-b border-ink/10">
              <dt className="font-archivo font-extrabold uppercase text-ink/60">Subscription</dt>
              <dd className="font-bold text-ink">
                {invoice.subscription_id ? (
                  <Link
                    to={`/subscriptions/${invoice.subscription_id}`}
                    className="text-brand-orange hover:underline font-extrabold"
                  >
                    View Subscription
                  </Link>
                ) : (
                  '—'
                )}
              </dd>
            </div>
            <div className="flex justify-between py-0.5 border-b border-ink/10">
              <dt className="font-archivo font-extrabold uppercase text-ink/60">Billing Period</dt>
              <dd className="font-bold text-ink">
                {formatDate(invoice.period_start)} to {formatDate(invoice.period_end)}
              </dd>
            </div>
            <div className="flex justify-between py-0.5 border-b border-ink/10">
              <dt className="font-archivo font-extrabold uppercase text-ink/60">Invoice Date</dt>
              <dd className="font-bold text-ink">{formatDate(invoice.invoice_date)}</dd>
            </div>
            <div className="flex justify-between py-0.5 border-b border-ink/10">
              <dt className="font-archivo font-extrabold uppercase text-ink/60">Payment Due Date</dt>
              <dd className={`font-bold ${invoice.is_overdue ? 'text-red-600' : 'text-ink'}`}>
                {formatDate(invoice.due_date)}
              </dd>
            </div>
            <div className="flex justify-between py-0.5 border-b border-ink/10">
              <dt className="font-archivo font-extrabold uppercase text-ink/60">Email Notification</dt>
              <dd className="font-bold text-ink">
                {invoice.sent_at ? `Sent ${formatDate(invoice.sent_at)}` : 'Not sent yet'}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Applied Discount Banner if any */}
      {invoice.discount_name && (
        <div className="p-3 bg-brand-teal/15 border-2 border-brand-teal text-brand-teal rounded-[4px] shadow-neo-sm flex items-center justify-between text-xs font-bold">
          <div className="flex items-center gap-2">
            <Tag size={16} />
            <span>Applied Promotion: <strong>{invoice.discount_name}</strong></span>
          </div>
          <span className="font-anton text-sm">
            Saved {formatPaise(invoice.discount_total)}
          </span>
        </div>
      )}

      {/* Line Items Table */}
      <div className="bg-white border-2 border-ink rounded-[4px] p-5 shadow-neo">
        <h3 className="font-anton text-lg uppercase tracking-wider text-ink mb-4 pb-2 border-b-2 border-ink/10">
          Line Item Details
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-cream-light border-b-2 border-ink">
                <th className="p-2.5 font-archivo font-extrabold uppercase text-ink">Description</th>
                <th className="p-2.5 font-archivo font-extrabold uppercase text-ink text-center">Qty</th>
                <th className="p-2.5 font-archivo font-extrabold uppercase text-ink text-right">Unit Price</th>
                <th className="p-2.5 font-archivo font-extrabold uppercase text-ink text-right">Discount</th>
                <th className="p-2.5 font-archivo font-extrabold uppercase text-ink text-right">Tax Rate</th>
                <th className="p-2.5 font-archivo font-extrabold uppercase text-ink text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {invoice.lines?.map((line) => (
                <tr key={line.id}>
                  <td className="p-2.5 font-bold text-ink">{line.description}</td>
                  <td className="p-2.5 text-center font-bold text-ink">{line.quantity}</td>
                  <td className="p-2.5 text-right font-anton tabular-nums">{formatPaise(line.unit_price)}</td>
                  <td className="p-2.5 text-right font-anton tabular-nums text-brand-teal">
                    {line.discount_amount > 0 ? `-${formatPaise(line.discount_amount)}` : '—'}
                  </td>
                  <td className="p-2.5 text-right font-medium text-ink/70">
                    {line.tax_rate > 0 ? `${(line.tax_rate / 100).toFixed(0)}% (${line.tax_name})` : '0%'}
                  </td>
                  <td className="p-2.5 text-right font-anton tabular-nums text-sm text-ink">
                    {formatPaise(line.line_total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Invoice Grand Totals Calculation Card */}
        <div className="mt-4 pt-4 border-t-2 border-ink/20 flex flex-col sm:flex-row justify-end">
          <div className="w-full sm:w-72 space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-ink/10">
              <span className="font-archivo font-extrabold uppercase text-ink/60">Subtotal</span>
              <span className="font-anton tabular-nums text-ink">{formatPaise(invoice.subtotal)}</span>
            </div>
            {invoice.discount_total > 0 && (
              <div className="flex justify-between py-1 border-b border-ink/10 text-brand-teal">
                <span className="font-archivo font-extrabold uppercase">Discount Savings</span>
                <span className="font-anton tabular-nums">-{formatPaise(invoice.discount_total)}</span>
              </div>
            )}
            <div className="flex justify-between py-1 border-b border-ink/10">
              <span className="font-archivo font-extrabold uppercase text-ink/60">Tax Total</span>
              <span className="font-anton tabular-nums text-ink">+{formatPaise(invoice.tax_total)}</span>
            </div>
            <div className="flex justify-between py-1 border-b-2 border-ink text-sm">
              <span className="font-anton uppercase text-ink">Grand Total</span>
              <span className="font-anton tabular-nums text-ink">{formatPaise(invoice.total)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-ink/10 text-brand-teal">
              <span className="font-archivo font-extrabold uppercase">Amount Paid</span>
              <span className="font-anton tabular-nums">{formatPaise(invoice.amount_paid)}</span>
            </div>
            <div className="flex justify-between py-1.5 bg-cream-light p-2 rounded border border-ink">
              <span className="font-anton uppercase text-ink">Balance Due</span>
              <span className={`font-anton text-base tabular-nums ${invoice.balance > 0 ? 'text-brand-orange' : 'text-brand-teal'}`}>
                {formatPaise(invoice.balance)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment History Table */}
      <div className="bg-white border-2 border-ink rounded-[4px] p-5 shadow-neo">
        <div className="flex items-center justify-between pb-3 mb-3 border-b-2 border-ink/10">
          <h3 className="font-anton text-lg uppercase tracking-wider text-ink flex items-center gap-2">
            <CreditCard size={18} className="text-brand-orange" />
            <span>Payment History ({invoice.payments?.length || 0})</span>
          </h3>

          {canRecordPayment && (
            <Button variant="primary" onClick={openPaymentModal}>
              <DollarSign size={15} />
              <span>Record Payment</span>
            </Button>
          )}
        </div>

        {invoice.payments && invoice.payments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-cream-light border-b border-ink">
                  <th className="p-2.5 font-archivo font-extrabold uppercase text-ink">Payment Date</th>
                  <th className="p-2.5 font-archivo font-extrabold uppercase text-ink">Method</th>
                  <th className="p-2.5 font-archivo font-extrabold uppercase text-ink">Note</th>
                  <th className="p-2.5 font-archivo font-extrabold uppercase text-ink">Recorded By</th>
                  <th className="p-2.5 font-archivo font-extrabold uppercase text-ink text-right">Amount Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/10">
                {invoice.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="p-2.5 font-semibold text-ink">{formatDate(p.payment_date)}</td>
                    <td className="p-2.5">
                      <span className="px-1.5 py-0.5 rounded-[2px] bg-cream border border-ink/30 font-archivo font-extrabold uppercase text-[10px] text-ink">
                        {p.method?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="p-2.5 text-ink/70 italic">{p.note || '—'}</td>
                    <td className="p-2.5 text-ink/60">{p.recorded_by || 'Staff'}</td>
                    <td className="p-2.5 text-right font-anton text-brand-teal text-sm tabular-nums">
                      {formatPaise(p.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-xs font-bold text-ink/40 uppercase">
            No payments recorded yet for this invoice
          </div>
        )}
      </div>

      {/* Record Payment Modal */}
      <Modal
        isOpen={recordPaymentModalOpen}
        onClose={() => setRecordPaymentModalOpen(false)}
        title="Record Invoice Payment"
        confirmText="Confirm Payment"
        confirmVariant="primary"
        icon={CreditCard}
        loading={recordPaymentMutation.isPending}
        onConfirm={handleRecordPaymentSubmit}
      >
        <form onSubmit={handleRecordPaymentSubmit} className="space-y-4">
          <div className="p-3 bg-cream-light border-2 border-ink rounded-[4px] shadow-neo-sm flex justify-between items-center text-xs">
            <span className="font-archivo font-extrabold uppercase text-ink/70">Remaining Balance Due:</span>
            <span className="font-anton text-lg text-brand-orange tabular-nums">{formatPaise(invoice.balance)}</span>
          </div>

          <Input
            label="Payment Amount (INR)"
            type="number"
            step="0.01"
            placeholder="e.g. 5000.00"
            value={paymentAmountInr}
            onChange={(e) => setPaymentAmountInr(e.target.value)}
            required
          />

          <div>
            <label className="block text-xs font-archivo font-extrabold uppercase tracking-wider text-ink mb-1.5">
              Payment Method
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 bg-white border-2 border-ink rounded-[4px] text-xs font-archivo font-bold text-ink shadow-neo-sm focus:outline-none"
            >
              <option value="bank_transfer">Bank Transfer (NEFT / RTGS / IMPS)</option>
              <option value="upi">UPI</option>
              <option value="card">Credit / Debit Card</option>
              <option value="cheque">Cheque</option>
              <option value="cash">Cash</option>
            </select>
          </div>

          <Input
            label="Payment Received Date"
            type="date"
            max={new Date().toISOString().split('T')[0]}
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            required
          />

          <Input
            label="Transaction Reference / Note"
            placeholder="e.g. UTR / Cheque #102938"
            value={paymentNote}
            onChange={(e) => setPaymentNote(e.target.value)}
          />
        </form>
      </Modal>

      {/* Cancel Modal */}
      <Modal
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        title="Cancel Invoice"
        description={`Are you sure you want to cancel invoice ${invoice.number}? Any applied discount usage count will be released.`}
        confirmText="Cancel Invoice"
        confirmVariant="danger"
        loading={cancelMutation.isPending}
        onConfirm={() => cancelMutation.mutate()}
      />
    </div>
  );
}
