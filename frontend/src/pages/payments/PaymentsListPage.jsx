import React, { useState, useMemo } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CreditCard,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Calendar,
  Building,
  Receipt,
  DollarSign,
  ArrowRight,
} from 'lucide-react';
import { api } from '../../api/client';
import { formatPaise, formatPaiseCompact, formatDate } from '../../utils/format';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import DataTable from '../../components/ui/DataTable';
import Pagination from '../../components/ui/Pagination';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import StatCard from '../../components/ui/StatCard';

export default function PaymentsListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const isAdminOrStaff = role === 'admin' || role === 'staff';

  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = 15;
  const methodFilter = searchParams.get('method') || '';
  const customerFilter = searchParams.get('customer_id') || '';
  const fromDate = searchParams.get('from_date') || '';
  const toDate = searchParams.get('to_date') || '';
  const sortColumn = searchParams.get('sort_by') || 'created_at';
  const sortDirection = searchParams.get('sort_order') || 'desc';

  // Record Payment Modal State
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [paymentAmountInr, setPaymentAmountInr] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentNote, setPaymentNote] = useState('');

  const updateParams = (newParams) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(newParams).forEach(([k, v]) => {
      if (!v) next.delete(k);
      else next.set(k, v.toString());
    });
    setSearchParams(next);
  };

  // 1. Fetch Summary for Paid vs Outstanding overview
  const { data: summary } = useQuery({
    queryKey: ['reports-summary-payments'],
    queryFn: () => api.get('/api/reports/summary'),
    enabled: isAdminOrStaff,
  });

  // 2. Fetch Payments List
  const paymentsQueryParams = new URLSearchParams({
    page: page.toString(),
    page_size: pageSize.toString(),
    sort_by: sortColumn,
    sort_order: sortDirection,
  });
  if (methodFilter) paymentsQueryParams.set('method', methodFilter);
  if (customerFilter) paymentsQueryParams.set('customer_id', customerFilter);
  if (fromDate) paymentsQueryParams.set('from_date', fromDate);
  if (toDate) paymentsQueryParams.set('to_date', toDate);

  const { data: paymentsData, isLoading } = useQuery({
    queryKey: ['payments-list', paymentsQueryParams.toString()],
    queryFn: () => api.get(`/api/payments?${paymentsQueryParams.toString()}`),
  });

  // 3. Fetch Outstanding Invoices for the Picker
  const { data: outstandingInvoices } = useQuery({
    queryKey: ['outstanding-invoices-picker'],
    queryFn: () => api.get('/api/invoices?status=confirmed&outstanding=true&page_size=100'),
    enabled: recordModalOpen,
  });

  // 4. Fetch Customers for filter dropdown
  const { data: customersData } = useQuery({
    queryKey: ['customers-dropdown'],
    queryFn: () => api.get('/api/customers?is_active=true&page_size=100'),
    enabled: isAdminOrStaff,
  });

  // Handle invoice selection in modal
  const handleSelectInvoice = (invId) => {
    setSelectedInvoiceId(invId);
    if (!invId) {
      setPaymentAmountInr('');
      return;
    }
    const inv = outstandingInvoices?.items?.find((i) => i.id === parseInt(invId, 10));
    if (inv) {
      setPaymentAmountInr((inv.balance / 100).toFixed(2));
      setPaymentNote(`Payment for ${inv.number}`);
    }
  };

  const selectedInvoice = useMemo(() => {
    return outstandingInvoices?.items?.find((i) => i.id === parseInt(selectedInvoiceId, 10));
  }, [outstandingInvoices, selectedInvoiceId]);

  // Record Payment Mutation
  const recordMutation = useMutation({
    mutationFn: (payload) => api.post('/api/payments', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments-list'] });
      queryClient.invalidateQueries({ queryKey: ['reports-summary-payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices-list'] });
      success('Payment recorded successfully.');
      setRecordModalOpen(false);
      setSelectedInvoiceId('');
      setPaymentAmountInr('');
      setPaymentNote('');
    },
    onError: (err) => toastError(err.detail || 'Failed to record payment.'),
  });

  const handleRecordSubmit = (e) => {
    e.preventDefault();
    if (!selectedInvoiceId) {
      toastError('Please select an invoice.');
      return;
    }
    const amountPaise = Math.round((parseFloat(paymentAmountInr) || 0) * 100);
    if (amountPaise <= 0 || (selectedInvoice && amountPaise > selectedInvoice.balance)) {
      toastError(`Amount must be between ₹1 and ${formatPaise(selectedInvoice?.balance || 0)}.`);
      return;
    }

    recordMutation.mutate({
      invoice_id: parseInt(selectedInvoiceId, 10),
      amount: amountPaise,
      method: paymentMethod,
      payment_date: paymentDate,
      note: paymentNote.trim() || null,
    });
  };

  const columns = [
    {
      key: 'payment_date',
      label: 'Payment Date',
      sortable: true,
      render: (val) => (
        <span className="font-semibold text-ink text-xs">
          {formatDate(val)}
        </span>
      ),
    },
    {
      key: 'invoice_number',
      label: 'Invoice #',
      render: (val, row) => (
        <Link
          to={`/invoices/${row.invoice_id}`}
          className="font-archivo font-extrabold text-ink hover:text-brand-orange"
        >
          {val}
        </Link>
      ),
    },
    {
      key: 'customer_name',
      label: 'Customer',
      render: (val, row) => (
        <div className="text-xs">
          <div className="font-bold text-ink">{val}</div>
        </div>
      ),
    },
    {
      key: 'method',
      label: 'Method',
      render: (val) => (
        <span className="px-2 py-0.5 rounded-[3px] bg-cream border border-ink/40 text-[10px] font-archivo font-extrabold uppercase text-ink">
          {val?.replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      key: 'note',
      label: 'Reference / Note',
      render: (val) => (
        <span className="text-xs text-ink/70 italic truncate max-w-xs block">
          {val || '—'}
        </span>
      ),
    },
    {
      key: 'amount',
      label: 'Amount Collected',
      align: 'right',
      sortable: true,
      render: (val) => (
        <span className="font-anton text-brand-teal text-sm tabular-nums">
          +{formatPaise(val)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-anton text-3xl uppercase tracking-wider text-ink">
            PAYMENTS
          </h1>
          <p className="font-archivo text-xs font-bold uppercase tracking-wide text-ink/70 mt-1">
            Reconciliation ledger, collection methods, and cash receipts
          </p>
        </div>

        {isAdminOrStaff && (
          <Button variant="primary" onClick={() => setRecordModalOpen(true)}>
            <Plus size={16} strokeWidth={3} />
            <span>Record Payment</span>
          </Button>
        )}
      </div>

      {/* Paid vs Outstanding StatCards Overview */}
      {isAdminOrStaff && summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            highlight
            title="Revenue Collected"
            value={formatPaiseCompact(summary.revenue_collected)}
            subvalue={`${formatPaise(summary.revenue_collected)} in period`}
          />
          <StatCard
            title="Outstanding Receivables"
            value={formatPaiseCompact(summary.outstanding_amount)}
            subvalue={`${summary.outstanding_count} invoices pending payment`}
            trend={
              summary.overdue_count > 0
                ? {
                    value: `${summary.overdue_count} overdue`,
                    positive: false,
                    label: `(${formatPaise(summary.overdue_amount)})`,
                  }
                : { value: 'All current', positive: true }
            }
          />
          <StatCard
            title="Invoiced Total"
            value={formatPaiseCompact(summary.invoiced_total)}
            subvalue={`${summary.invoices_by_status?.paid || 0} invoices fully paid`}
          />
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-cream-light border-2 border-ink rounded-[4px] p-4 shadow-neo-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Method Filter */}
          <select
            value={methodFilter}
            onChange={(e) => updateParams({ method: e.target.value, page: 1 })}
            className="px-3 py-2 bg-white border-2 border-ink rounded-[4px] text-xs font-archivo font-bold text-ink shadow-neo-sm focus:outline-none"
          >
            <option value="">All Payment Methods</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="upi">UPI</option>
            <option value="card">Card</option>
            <option value="cheque">Cheque</option>
            <option value="cash">Cash</option>
          </select>

          {/* Customer Filter */}
          {isAdminOrStaff && (
            <select
              value={customerFilter}
              onChange={(e) => updateParams({ customer_id: e.target.value, page: 1 })}
              className="px-3 py-2 bg-white border-2 border-ink rounded-[4px] text-xs font-archivo font-bold text-ink shadow-neo-sm focus:outline-none"
            >
              <option value="">All Customers</option>
              {customersData?.items?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}

          {/* Date range filters */}
          <div className="flex items-center gap-1.5 text-xs font-archivo font-bold text-ink">
            <span>From:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => updateParams({ from_date: e.target.value, page: 1 })}
              className="px-2 py-1.5 bg-white border border-ink rounded text-xs font-semibold"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs font-archivo font-bold text-ink">
            <span>To:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => updateParams({ to_date: e.target.value, page: 1 })}
              className="px-2 py-1.5 bg-white border border-ink rounded text-xs font-semibold"
            />
          </div>
        </div>

        {(methodFilter || customerFilter || fromDate || toDate) && (
          <button
            type="button"
            onClick={() =>
              updateParams({ method: null, customer_id: null, from_date: null, to_date: null, page: 1 })
            }
            className="text-xs font-bold text-brand-orange underline"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* DataTable */}
      <DataTable
        columns={columns}
        data={paymentsData?.items || []}
        loading={isLoading}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={(col, dir) => updateParams({ sort_by: col, sort_order: dir })}
        emptyTitle="No Payments Recorded"
        emptyMessage="No payments match the selected date or method filters."
      />

      {/* Pagination */}
      {paymentsData && paymentsData.total > pageSize && (
        <Pagination
          currentPage={page}
          totalItems={paymentsData.total}
          pageSize={pageSize}
          onPageChange={(p) => updateParams({ page: p })}
        />
      )}

      {/* Record Payment Modal */}
      <Modal
        isOpen={recordModalOpen}
        onClose={() => setRecordModalOpen(false)}
        title="Record Customer Payment"
        confirmText="Confirm & Post Payment"
        confirmVariant="primary"
        icon={CreditCard}
        loading={recordMutation.isPending}
        onConfirm={handleRecordSubmit}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleRecordSubmit} className="space-y-4">
          {/* Invoice Picker */}
          <div>
            <label className="block text-xs font-archivo font-extrabold uppercase tracking-wider text-ink mb-1.5">
              Select Invoice <span className="text-brand-orange">*</span>
            </label>
            <select
              value={selectedInvoiceId}
              onChange={(e) => handleSelectInvoice(e.target.value)}
              className="w-full px-3 py-2 bg-white border-2 border-ink rounded-[4px] text-xs font-archivo font-bold text-ink shadow-neo-sm focus:outline-none"
              required
            >
              <option value="">Choose an outstanding invoice...</option>
              {outstandingInvoices?.items?.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.number} — {inv.customer_name} (Balance: {formatPaise(inv.balance)})
                </option>
              ))}
            </select>
          </div>

          {/* Balance info banner */}
          {selectedInvoice && (
            <div className="p-3 bg-cream-light border-2 border-ink rounded-[4px] shadow-neo-sm flex justify-between items-center text-xs">
              <div>
                <div className="font-bold text-ink">{selectedInvoice.customer_name}</div>
                <div className="text-[11px] text-ink/70">Due: {formatDate(selectedInvoice.due_date)}</div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-archivo font-extrabold uppercase text-ink/60 block">Remaining:</span>
                <span className="font-anton text-base text-brand-orange tabular-nums">
                  {formatPaise(selectedInvoice.balance)}
                </span>
              </div>
            </div>
          )}

          <Input
            label="Payment Amount (INR) *"
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
              <option value="bank_transfer">Bank Transfer (NEFT / RTGS)</option>
              <option value="upi">UPI</option>
              <option value="card">Credit / Debit Card</option>
              <option value="cheque">Cheque</option>
              <option value="cash">Cash</option>
            </select>
          </div>

          <Input
            label="Payment Date *"
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
    </div>
  );
}
