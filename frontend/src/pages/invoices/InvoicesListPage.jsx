import React, { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Receipt,
  Search,
  Filter,
  CheckCircle2,
  Send,
  Printer,
  CreditCard,
  Building,
  Clock,
  ArrowRight,
  AlertTriangle,
  Play,
  XCircle,
} from 'lucide-react';
import { api } from '../../api/client';
import { formatPaise, formatDate } from '../../utils/format';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Tabs from '../../components/ui/Tabs';
import DataTable from '../../components/ui/DataTable';
import Pagination from '../../components/ui/Pagination';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';

export default function InvoicesListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const { success, error: toastError } = useToast();

  const isCustomer = role === 'customer';
  const isAdminOrStaff = role === 'admin' || role === 'staff';

  const activeTab = searchParams.get('tab') || 'all';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = 15;
  const searchQuery = searchParams.get('q') || '';
  const sortColumn = searchParams.get('sort_by') || 'id';
  const sortDirection = searchParams.get('sort_order') || 'desc';

  // Selected rows for bulk actions
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkResultModal, setBulkResultModal] = useState(null);

  // Tab count stats query (using reports summary)
  const { data: summaryData } = useQuery({
    queryKey: ['reports-summary-invoices'],
    queryFn: () => api.get('/api/reports/summary'),
    enabled: isAdminOrStaff,
  });

  // Query Invoices
  const queryParams = new URLSearchParams({
    page: page.toString(),
    page_size: pageSize.toString(),
    sort_by: sortColumn,
    sort_order: sortDirection,
  });
  if (searchQuery.trim()) queryParams.set('q', searchQuery.trim());

  if (activeTab === 'draft') queryParams.set('status', 'draft');
  else if (activeTab === 'confirmed') queryParams.set('status', 'confirmed');
  else if (activeTab === 'paid') queryParams.set('status', 'paid');
  else if (activeTab === 'overdue') queryParams.set('overdue', 'true');
  else if (activeTab === 'outstanding') queryParams.set('outstanding', 'true');

  const { data: invoicesData, isLoading } = useQuery({
    queryKey: ['invoices-list', queryParams.toString()],
    queryFn: () => api.get(`/api/invoices?${queryParams.toString()}`),
  });

  // Bulk Action Mutation
  const bulkMutation = useMutation({
    mutationFn: (action) =>
      api.post('/api/invoices/bulk-action', {
        action: action,
        invoice_ids: selectedIds,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invoices-list'] });
      queryClient.invalidateQueries({ queryKey: ['reports-summary-invoices'] });
      setBulkResultModal(data);
      setSelectedIds([]);
      success(`Bulk action completed: ${data.succeeded} succeeded, ${data.failed} failed.`);
    },
    onError: (err) => {
      toastError(err.detail || 'Failed to execute bulk action.');
    },
  });

  const updateTab = (tabId) => {
    setSelectedIds([]);
    const next = new URLSearchParams(searchParams);
    next.set('tab', tabId);
    next.set('page', '1');
    setSearchParams(next);
  };

  const updateSearch = (query) => {
    const next = new URLSearchParams(searchParams);
    if (query.trim()) next.set('q', query.trim());
    else next.delete('q');
    next.set('page', '1');
    setSearchParams(next);
  };

  const columns = [
    {
      key: 'number',
      label: 'Invoice #',
      sortable: true,
      render: (val, row) => (
        <div>
          <span
            onClick={() => navigate(`/invoices/${row.id}`)}
            className="font-archivo font-extrabold text-ink hover:text-brand-orange cursor-pointer"
          >
            {val}
          </span>
          <div className="text-[11px] text-ink/60">
            Due {formatDate(row.due_date)}
          </div>
        </div>
      ),
    },
    {
      key: 'customer_name',
      label: 'Customer',
      render: (val, row) => (
        <div>
          <div className="font-bold text-ink">{val}</div>
          <div className="text-xs text-ink/70 flex items-center gap-1">
            <Building size={12} />
            <span>{row.company_name}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'invoice_date',
      label: 'Invoice Date',
      sortable: true,
      render: (val) => formatDate(val),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (val, row) => (
        <div className="flex items-center gap-1.5">
          <Badge status={row.is_overdue ? 'overdue' : val} isInvoice />
          {row.is_overdue && (
            <span className="text-[10px] font-bold text-red-600">
              +{row.days_overdue}d
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'total',
      label: 'Total Amount',
      sortable: true,
      align: 'right',
      render: (val) => (
        <span className="font-anton text-ink tabular-nums text-sm">
          {formatPaise(val)}
        </span>
      ),
    },
    {
      key: 'balance',
      label: 'Balance Due',
      sortable: true,
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

  const rowActions = [
    {
      label: 'View Invoice',
      icon: Receipt,
      onClick: (row) => navigate(`/invoices/${row.id}`),
    },
    {
      label: 'Print View',
      icon: Printer,
      onClick: (row) => navigate(`/invoices/${row.id}/print`),
    },
  ];

  // Tab items with dynamic counts
  const tabs = [
    { id: 'all', label: 'All Invoices' },
    { id: 'draft', label: 'Draft', count: summaryData?.invoices_by_status?.draft },
    { id: 'confirmed', label: 'Confirmed', count: summaryData?.invoices_by_status?.confirmed },
    { id: 'paid', label: 'Paid', count: summaryData?.invoices_by_status?.paid },
    { id: 'overdue', label: 'Overdue', count: summaryData?.overdue_count },
    { id: 'outstanding', label: 'Outstanding', count: summaryData?.outstanding_count },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-anton text-3xl uppercase tracking-wider text-ink">
            INVOICES
          </h1>
          <p className="font-archivo text-xs font-bold uppercase tracking-wide text-ink/70 mt-1">
            Accounts receivable, payment collections, and recurring billing receipts
          </p>
        </div>

        {isAdminOrStaff && (
          <Link to="/billing">
            <Button variant="primary">
              <Play size={16} />
              <span>Advance Billing Run</span>
            </Button>
          </Link>
        )}
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={updateTab} />

      {/* Bulk Action Bar (when rows selected) */}
      {selectedIds.length > 0 && (
        <div className="p-3 bg-brand-orange text-white border-2 border-ink rounded-[4px] shadow-neo-sm flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-100">
          <div className="flex items-center gap-2 text-xs font-archivo font-extrabold uppercase text-ink">
            <span className="w-6 h-6 rounded bg-ink text-white flex items-center justify-center text-xs">
              {selectedIds.length}
            </span>
            <span>Invoices Selected</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              loading={bulkMutation.isPending}
              onClick={() => bulkMutation.mutate('confirm')}
            >
              <CheckCircle2 size={15} />
              <span>Bulk Confirm</span>
            </Button>

            <Button
              variant="secondary"
              loading={bulkMutation.isPending}
              onClick={() => bulkMutation.mutate('send')}
            >
              <Send size={15} />
              <span>Bulk Send Email</span>
            </Button>

            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="px-2 py-1 text-xs font-bold text-ink underline"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-cream-light border-2 border-ink rounded-[4px] p-4 shadow-neo-sm flex items-center justify-between gap-4">
        <div className="w-full sm:max-w-xs">
          <Input
            placeholder="Search invoice #, customer name, company..."
            value={searchQuery}
            onChange={(e) => updateSearch(e.target.value)}
            icon={Search}
          />
        </div>

        <div className="text-xs font-archivo font-extrabold uppercase text-ink/60">
          Showing page {page} of {Math.ceil((invoicesData?.total || 1) / pageSize)}
        </div>
      </div>

      {/* DataTable with Selection */}
      <DataTable
        columns={columns}
        data={invoicesData?.items || []}
        loading={isLoading}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={(col, dir) => {
          const next = new URLSearchParams(searchParams);
          next.set('sort_by', col);
          next.set('sort_order', dir);
          setSearchParams(next);
        }}
        selectedIds={selectedIds}
        onSelectRow={(id) => {
          setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
          );
        }}
        onSelectAll={(all) => {
          if (all) {
            setSelectedIds(invoicesData?.items?.map((i) => i.id) || []);
          } else {
            setSelectedIds([]);
          }
        }}
        rowActions={rowActions}
        emptyTitle="No Invoices Found"
        emptyMessage="No billing invoices match the active tab and search criteria."
      />

      {/* Pagination */}
      {invoicesData && invoicesData.total > pageSize && (
        <Pagination
          currentPage={page}
          totalItems={invoicesData.total}
          pageSize={pageSize}
          onPageChange={(p) => {
            const next = new URLSearchParams(searchParams);
            next.set('page', p.toString());
            setSearchParams(next);
          }}
        />
      )}

      {/* Bulk Action Result Modal */}
      <Modal
        isOpen={Boolean(bulkResultModal)}
        onClose={() => setBulkResultModal(null)}
        title="Bulk Action Completed"
        confirmText="Done"
        confirmVariant="primary"
        icon={CheckCircle2}
        onConfirm={() => setBulkResultModal(null)}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2 bg-cream-light border border-ink rounded">
              <div className="text-ink/60 font-bold uppercase">Total</div>
              <div className="font-anton text-lg">{bulkResultModal?.total_processed}</div>
            </div>
            <div className="p-2 bg-teal-50 border border-teal-500 rounded text-brand-teal">
              <div className="font-bold uppercase">Succeeded</div>
              <div className="font-anton text-lg">{bulkResultModal?.succeeded}</div>
            </div>
            <div className="p-2 bg-red-50 border border-red-500 rounded text-red-600">
              <div className="font-bold uppercase">Failed</div>
              <div className="font-anton text-lg">{bulkResultModal?.failed}</div>
            </div>
          </div>

          {bulkResultModal?.results && (
            <div className="max-h-48 overflow-y-auto space-y-1.5 pt-2 text-xs">
              {bulkResultModal.results.map((r, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-1.5 bg-white border border-ink/20 rounded"
                >
                  <span className="font-bold text-ink">Invoice #{r.invoice_id}</span>
                  {r.success ? (
                    <span className="text-brand-teal font-extrabold uppercase text-[10px]">Success</span>
                  ) : (
                    <span className="text-red-600 font-bold text-[10px] truncate max-w-xs">{r.error}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
