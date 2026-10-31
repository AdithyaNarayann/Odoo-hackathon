import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Building,
  Mail,
  Phone,
  MapPin,
  FileText,
  Calendar,
  Layers,
  Receipt,
  Plus,
  Edit2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../../api/client';
import { formatPaise, formatPaiseCompact, formatDate } from '../../utils/format';
import { useToast } from '../../context/ToastContext';
import Tabs from '../../components/ui/Tabs';
import StatCard from '../../components/ui/StatCard';
import Badge from '../../components/ui/Badge';
import DataTable from '../../components/ui/DataTable';
import Button from '../../components/ui/Button';
import Skeleton from '../../components/ui/Skeleton';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';

export default function CustomerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const [activeTab, setActiveTab] = useState('overview');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({});

  // 1. Fetch Customer Detail
  const {
    data: customer,
    isLoading: customerLoading,
    error: customerError,
  } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => api.get(`/api/customers/${id}`),
  });

  // 2. Fetch Customer Subscriptions
  const {
    data: subsData,
    isLoading: subsLoading,
  } = useQuery({
    queryKey: ['customer-subscriptions', id],
    queryFn: () => api.get(`/api/subscriptions?customer=${id}&page_size=50`),
  });

  // 3. Fetch Customer Invoices
  const {
    data: invoicesData,
    isLoading: invoicesLoading,
  } = useQuery({
    queryKey: ['customer-invoices', id],
    queryFn: () => api.get(`/api/invoices?customer=${id}&page_size=50`),
  });

  // Calculate Metrics: LTV (Lifetime Value), Total Invoiced, Outstanding, Active count
  const metrics = useMemo(() => {
    const invList = invoicesData?.items || [];
    const subList = subsData?.items || [];

    const lifetimeValue = invList.reduce((sum, inv) => sum + (inv.amount_paid || 0), 0);
    const totalInvoiced = invList.reduce((sum, inv) => sum + (inv.total || 0), 0);
    const totalOutstanding = invList.reduce((sum, inv) => sum + (inv.balance || 0), 0);
    const activeSubs = subList.filter((s) => s.status === 'active').length;

    return {
      lifetimeValue,
      totalInvoiced,
      totalOutstanding,
      activeSubs,
    };
  }, [invoicesData, subsData]);

  // Update Customer Mutation
  const updateMutation = useMutation({
    mutationFn: (data) => api.put(`/api/customers/${id}`, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(['customer', id], updated);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      success('Customer profile updated.');
      setEditModalOpen(false);
    },
    onError: (err) => {
      toastError(err.detail || 'Failed to update customer profile.');
    },
  });

  const openEditModal = () => {
    if (!customer) return;
    setEditFormData({
      name: customer.name || '',
      company_name: customer.company_name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      tax_id: customer.tax_id || '',
      address_line1: customer.address_line1 || '',
      address_line2: customer.address_line2 || '',
      city: customer.city || '',
      state: customer.state || '',
      postal_code: customer.postal_code || '',
      country: customer.country || 'India',
    });
    setEditModalOpen(true);
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    updateMutation.mutate(editFormData);
  };

  if (customerLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-36 w-full" />
        <div className="grid grid-cols-4 gap-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      </div>
    );
  }

  if (customerError || !customer) {
    return (
      <div className="p-8 bg-cream-light border-2 border-ink rounded-[4px] shadow-neo text-center">
        <div className="w-12 h-12 bg-red-100 text-red-600 border-2 border-ink rounded-full flex items-center justify-center mx-auto mb-3 shadow-neo-sm">
          <AlertTriangle size={24} />
        </div>
        <h2 className="font-anton text-2xl uppercase tracking-wide text-ink mb-2">
          Customer Not Found
        </h2>
        <p className="text-xs text-ink/70 font-inter mb-4">
          The requested customer account does not exist or has been removed.
        </p>
        <Link to="/customers">
          <Button variant="secondary">Back to Customers</Button>
        </Link>
      </div>
    );
  }

  // Columns for Customer Subscriptions
  const subscriptionColumns = [
    {
      key: 'number',
      label: 'Subscription #',
      sortable: true,
      render: (val, row) => (
        <span className="font-archivo font-extrabold text-ink hover:text-brand-orange cursor-pointer">
          {val}
        </span>
      ),
    },
    {
      key: 'plan_name',
      label: 'Plan',
      render: (val, row) => (
        <div>
          <div className="font-bold text-ink">{val}</div>
          <div className="text-[11px] text-ink/60 uppercase font-semibold">
            {row.plan_billing_period}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (val, row) => <Badge status={row.is_paused ? 'paused' : val} isSubscription />,
    },
    {
      key: 'start_date',
      label: 'Start Date',
      render: (val) => formatDate(val),
    },
    {
      key: 'expiry_date',
      label: 'Expiry Date',
      render: (val) => formatDate(val),
    },
    {
      key: 'recurring_subtotal',
      label: 'Monthly Subtotal',
      align: 'right',
      render: (val) => (
        <span className="font-anton text-ink tabular-nums">
          {formatPaise(val)}
        </span>
      ),
    },
  ];

  // Columns for Customer Invoices
  const invoiceColumns = [
    {
      key: 'number',
      label: 'Invoice #',
      render: (val) => <span className="font-archivo font-extrabold text-ink">{val}</span>,
    },
    {
      key: 'invoice_date',
      label: 'Invoice Date',
      render: (val) => formatDate(val),
    },
    {
      key: 'due_date',
      label: 'Due Date',
      render: (val, row) => (
        <div className={row.is_overdue ? 'text-red-600 font-bold' : ''}>
          {formatDate(val)}
          {row.is_overdue && (
            <span className="ml-1 text-[10px] uppercase font-archivo font-extrabold">
              ({row.days_overdue}d overdue)
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (val, row) => (
        <Badge status={row.is_overdue ? 'overdue' : val} isInvoice />
      ),
    },
    {
      key: 'total',
      label: 'Total Amount',
      align: 'right',
      render: (val) => (
        <span className="font-anton text-ink tabular-nums">
          {formatPaise(val)}
        </span>
      ),
    },
    {
      key: 'balance',
      label: 'Balance Due',
      align: 'right',
      render: (val) => (
        <span className={`font-anton tabular-nums ${val > 0 ? 'text-brand-orange' : 'text-brand-teal'}`}>
          {formatPaise(val)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link
          to="/customers"
          className="inline-flex items-center gap-1.5 text-xs font-archivo font-extrabold uppercase text-ink hover:text-brand-orange transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Back to Customers</span>
        </Link>
      </div>

      {/* Customer Header Card */}
      <div className="bg-cream-light border-2 border-ink rounded-[4px] p-6 shadow-neo-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-[4px] bg-brand-orange text-white border-2 border-ink shadow-neo font-anton text-2xl flex items-center justify-center shrink-0">
            {customer.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-anton text-2xl sm:text-3xl uppercase tracking-wider text-ink">
                {customer.name}
              </h1>
              <span
                className={`
                  inline-flex items-center px-2 py-0.5 rounded-[3px] text-[10px] font-archivo font-extrabold uppercase border
                  ${
                    customer.is_active
                      ? 'bg-brand-teal/20 text-brand-teal border-brand-teal'
                      : 'bg-zinc-200 text-zinc-600 border-zinc-400'
                  }
                `}
              >
                {customer.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="text-xs text-ink/70 font-semibold flex items-center gap-1.5 mt-0.5">
              <Building size={14} />
              <span>{customer.company_name}</span>
              <span className="mx-1">•</span>
              <span>Joined {formatDate(customer.created_at)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={openEditModal}>
            <Edit2 size={15} />
            <span>Edit Profile</span>
          </Button>
          <Link to={`/subscriptions?customer=${customer.id}`}>
            <Button variant="primary">
              <Plus size={15} strokeWidth={3} />
              <span>New Subscription</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* StatCards: Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          highlight
          title="Lifetime Value (LTV)"
          value={formatPaiseCompact(metrics.lifetimeValue)}
          subvalue={`${formatPaise(metrics.lifetimeValue)} total paid`}
        />
        <StatCard
          title="Active Subscriptions"
          value={metrics.activeSubs.toString()}
          subvalue={`${subsData?.total || 0} total subscriptions`}
          icon={Layers}
        />
        <StatCard
          title="Total Invoiced"
          value={formatPaiseCompact(metrics.totalInvoiced)}
          subvalue={`${formatPaise(metrics.totalInvoiced)} gross`}
          icon={Receipt}
        />
        <StatCard
          title="Outstanding Balance"
          value={formatPaiseCompact(metrics.totalOutstanding)}
          subvalue={`${formatPaise(metrics.totalOutstanding)} unpaid`}
          icon={Receipt}
          trend={
            metrics.totalOutstanding > 0
              ? { value: 'Payment Pending', positive: false }
              : { value: 'Settled', positive: true }
          }
        />
      </div>

      {/* Navigation Tabs */}
      <Tabs
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'subscriptions', label: 'Subscriptions', count: subsData?.total || 0 },
          { id: 'invoices', label: 'Invoices', count: invoicesData?.total || 0 },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Contact Details */}
          <div className="bg-white border-2 border-ink rounded-[4px] p-5 shadow-neo">
            <h3 className="font-anton text-lg uppercase tracking-wider text-ink mb-4 pb-2 border-b-2 border-ink/10 flex items-center gap-2">
              <Mail size={18} className="text-brand-orange" />
              <span>Contact & Identity</span>
            </h3>
            <dl className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-ink/10">
                <dt className="font-archivo font-extrabold uppercase text-ink/60">Full Name</dt>
                <dd className="font-bold text-ink">{customer.name}</dd>
              </div>
              <div className="flex justify-between py-1 border-b border-ink/10">
                <dt className="font-archivo font-extrabold uppercase text-ink/60">Company Name</dt>
                <dd className="font-bold text-ink">{customer.company_name}</dd>
              </div>
              <div className="flex justify-between py-1 border-b border-ink/10">
                <dt className="font-archivo font-extrabold uppercase text-ink/60">Email Address</dt>
                <dd className="font-bold text-ink">{customer.email}</dd>
              </div>
              <div className="flex justify-between py-1 border-b border-ink/10">
                <dt className="font-archivo font-extrabold uppercase text-ink/60">Phone</dt>
                <dd className="font-bold text-ink">{customer.phone || '—'}</dd>
              </div>
              <div className="flex justify-between py-1 border-b border-ink/10">
                <dt className="font-archivo font-extrabold uppercase text-ink/60">GSTIN / Tax ID</dt>
                <dd className="font-mono font-bold text-ink">{customer.tax_id || '—'}</dd>
              </div>
            </dl>
          </div>

          {/* Billing Address */}
          <div className="bg-white border-2 border-ink rounded-[4px] p-5 shadow-neo">
            <h3 className="font-anton text-lg uppercase tracking-wider text-ink mb-4 pb-2 border-b-2 border-ink/10 flex items-center gap-2">
              <MapPin size={18} className="text-brand-teal" />
              <span>Billing Address</span>
            </h3>
            <dl className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-ink/10">
                <dt className="font-archivo font-extrabold uppercase text-ink/60">Address Line 1</dt>
                <dd className="font-bold text-ink">{customer.address_line1 || '—'}</dd>
              </div>
              <div className="flex justify-between py-1 border-b border-ink/10">
                <dt className="font-archivo font-extrabold uppercase text-ink/60">Address Line 2</dt>
                <dd className="font-bold text-ink">{customer.address_line2 || '—'}</dd>
              </div>
              <div className="flex justify-between py-1 border-b border-ink/10">
                <dt className="font-archivo font-extrabold uppercase text-ink/60">City</dt>
                <dd className="font-bold text-ink">{customer.city || '—'}</dd>
              </div>
              <div className="flex justify-between py-1 border-b border-ink/10">
                <dt className="font-archivo font-extrabold uppercase text-ink/60">State</dt>
                <dd className="font-bold text-ink">{customer.state || '—'}</dd>
              </div>
              <div className="flex justify-between py-1 border-b border-ink/10">
                <dt className="font-archivo font-extrabold uppercase text-ink/60">Postal Code</dt>
                <dd className="font-mono font-bold text-ink">{customer.postal_code || '—'}</dd>
              </div>
              <div className="flex justify-between py-1 border-b border-ink/10">
                <dt className="font-archivo font-extrabold uppercase text-ink/60">Country</dt>
                <dd className="font-bold text-ink">{customer.country || 'India'}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      {/* Tab 2: Subscriptions */}
      {activeTab === 'subscriptions' && (
        <DataTable
          columns={subscriptionColumns}
          data={subsData?.items || []}
          loading={subsLoading}
          emptyTitle="No Subscriptions Yet"
          emptyMessage="This customer does not have any subscriptions attached yet."
        />
      )}

      {/* Tab 3: Invoices */}
      {activeTab === 'invoices' && (
        <DataTable
          columns={invoiceColumns}
          data={invoicesData?.items || []}
          loading={invoicesLoading}
          emptyTitle="No Invoices Issued"
          emptyMessage="No billing invoices have been generated for this customer yet."
        />
      )}

      {/* Edit Customer Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit Customer Profile"
        confirmText="Save Changes"
        confirmVariant="primary"
        icon={Edit2}
        loading={updateMutation.isPending}
        onConfirm={handleEditSubmit}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Contact Full Name"
              value={editFormData.name || ''}
              onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
              required
            />
            <Input
              label="Company Name"
              value={editFormData.company_name || ''}
              onChange={(e) => setEditFormData({ ...editFormData, company_name: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Email Address"
              type="email"
              value={editFormData.email || ''}
              onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
              required
            />
            <Input
              label="Phone Number"
              value={editFormData.phone || ''}
              onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
            />
          </div>

          <Input
            label="Tax ID / GSTIN"
            value={editFormData.tax_id || ''}
            onChange={(e) => setEditFormData({ ...editFormData, tax_id: e.target.value })}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Address Line 1"
              value={editFormData.address_line1 || ''}
              onChange={(e) => setEditFormData({ ...editFormData, address_line1: e.target.value })}
            />
            <Input
              label="Address Line 2"
              value={editFormData.address_line2 || ''}
              onChange={(e) => setEditFormData({ ...editFormData, address_line2: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input
              label="City"
              value={editFormData.city || ''}
              onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })}
            />
            <Input
              label="State"
              value={editFormData.state || ''}
              onChange={(e) => setEditFormData({ ...editFormData, state: e.target.value })}
            />
            <Input
              label="Postal Code"
              value={editFormData.postal_code || ''}
              onChange={(e) => setEditFormData({ ...editFormData, postal_code: e.target.value })}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
