import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CalendarCheck,
  Plus,
  Search,
  Edit2,
  Trash2,
  Info,
  Clock,
  Layers,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { api } from '../../api/client';
import { formatPaise, formatDate } from '../../utils/format';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import DataTable from '../../components/ui/DataTable';
import Pagination from '../../components/ui/Pagination';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Toggle from '../../components/ui/Toggle';
import Tooltip from '../../components/ui/Tooltip';

export default function PlansPage() {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [search, setSearch] = useState('');
  const [periodFilter, setPeriodFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [sortColumn, setSortColumn] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [deactivatePlan, setDeactivatePlan] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    price_inr: '',
    billing_period: 'monthly',
    min_quantity: 1,
    available_from: '',
    available_to: '',
    auto_close: false,
    closable: true,
    pausable: true,
    renewable: true,
    is_active: true,
  });

  // Query Plans
  const queryParams = new URLSearchParams({
    page: page.toString(),
    page_size: pageSize.toString(),
    sort_by: sortColumn,
    sort_order: sortDirection,
  });
  if (search.trim()) queryParams.set('search', search.trim());
  if (periodFilter) queryParams.set('billing_period', periodFilter);
  if (activeFilter) queryParams.set('is_active', activeFilter);

  const { data, isLoading } = useQuery({
    queryKey: ['plans', queryParams.toString()],
    queryFn: () => api.get(`/api/plans?${queryParams.toString()}`),
  });

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/api/plans', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      success('Subscription plan created.');
      closeModal();
    },
    onError: (err) => {
      toastError(err.detail || 'Failed to create plan.');
    },
  });

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => api.put(`/api/plans/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      success('Subscription plan updated.');
      closeModal();
    },
    onError: (err) => {
      toastError(err.detail || 'Failed to update plan.');
    },
  });

  // Deactivate Mutation
  const deactivateMutation = useMutation({
    mutationFn: (id) => api.delete(`/api/plans/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      success('Subscription plan deactivated.');
      setDeactivatePlan(null);
    },
    onError: (err) => {
      toastError(err.detail || 'Failed to deactivate plan.');
    },
  });

  // Reactivate Mutation
  const reactivateMutation = useMutation({
    mutationFn: (id) => api.put(`/api/plans/${id}`, { is_active: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      success('Subscription plan reactivated.');
    },
    onError: (err) => {
      toastError(err.detail || 'Failed to reactivate plan.');
    },
  });

  const closeModal = () => {
    setModalOpen(false);
    setEditingPlan(null);
    setFormData({
      name: '',
      price_inr: '',
      billing_period: 'monthly',
      min_quantity: 1,
      available_from: '',
      available_to: '',
      auto_close: false,
      closable: true,
      pausable: true,
      renewable: true,
      is_active: true,
    });
  };

  const openCreateModal = () => {
    setFormData({
      name: '',
      price_inr: '',
      billing_period: 'monthly',
      min_quantity: 1,
      available_from: '',
      available_to: '',
      auto_close: false,
      closable: true,
      pausable: true,
      renewable: true,
      is_active: true,
    });
    setEditingPlan(null);
    setModalOpen(true);
  };

  const openEditModal = (plan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      price_inr: (plan.price / 100).toString(),
      billing_period: plan.billing_period,
      min_quantity: plan.min_quantity,
      available_from: plan.available_from || '',
      available_to: plan.available_to || '',
      auto_close: plan.auto_close,
      closable: plan.closable,
      pausable: plan.pausable,
      renewable: plan.renewable,
      is_active: plan.is_active,
    });
    setModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toastError('Plan name is required.');
      return;
    }

    const pricePaise = Math.round((parseFloat(formData.price_inr) || 0) * 100);

    const payload = {
      name: formData.name.trim(),
      price: pricePaise,
      billing_period: formData.billing_period,
      min_quantity: parseInt(formData.min_quantity, 10) || 1,
      available_from: formData.available_from || null,
      available_to: formData.available_to || null,
      auto_close: formData.auto_close,
      closable: formData.closable,
      pausable: formData.pausable,
      renewable: formData.renewable,
      is_active: formData.is_active,
    };

    if (editingPlan) {
      updateMutation.mutate({ id: editingPlan.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Plan Name',
      sortable: true,
      render: (val, row) => (
        <div>
          <div className="font-archivo font-extrabold text-ink">{val}</div>
          <div className="text-[11px] text-ink/60 font-medium">
            Min qty: {row.min_quantity} seat(s)
          </div>
        </div>
      ),
    },
    {
      key: 'price',
      label: 'Base Fee / Period',
      sortable: true,
      render: (val, row) => (
        <div>
          <span className="font-anton text-ink tabular-nums text-sm">
            {formatPaise(val)}
          </span>
          <span className="text-xs text-ink/70 font-bold ml-1 uppercase">
            / {row.billing_period}
          </span>
        </div>
      ),
    },
    {
      key: 'availability',
      label: 'Availability Window',
      render: (_, row) => {
        if (!row.available_from && !row.available_to) {
          return <span className="text-xs text-ink/70 font-semibold">Always Available</span>;
        }
        return (
          <div className="text-xs text-ink">
            <div>From: {formatDate(row.available_from)}</div>
            <div>To: {formatDate(row.available_to)}</div>
          </div>
        );
      },
    },
    {
      key: 'flags',
      label: 'Policy Flags',
      render: (_, row) => (
        <div className="flex flex-wrap gap-1">
          {row.auto_close && (
            <Tooltip content="Auto-close: Subscription closes automatically at expiry date.">
              <span className="px-1.5 py-0.5 rounded-[2px] bg-red-100 text-red-700 border border-red-300 text-[10px] font-archivo font-extrabold uppercase">
                Auto-Close
              </span>
            </Tooltip>
          )}
          {row.closable && (
            <Tooltip content="Closable: Customer/staff can cancel before expiry.">
              <span className="px-1.5 py-0.5 rounded-[2px] bg-blue-100 text-blue-700 border border-blue-300 text-[10px] font-archivo font-extrabold uppercase">
                Closable
              </span>
            </Tooltip>
          )}
          {row.pausable && (
            <Tooltip content="Pausable: Customer/staff can temporarily halt billing.">
              <span className="px-1.5 py-0.5 rounded-[2px] bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-archivo font-extrabold uppercase">
                Pausable
              </span>
            </Tooltip>
          )}
          {row.renewable && (
            <Tooltip content="Renewable: Subscription can renew for future cycles.">
              <span className="px-1.5 py-0.5 rounded-[2px] bg-teal-100 text-teal-800 border border-teal-300 text-[10px] font-archivo font-extrabold uppercase">
                Renewable
              </span>
            </Tooltip>
          )}
        </div>
      ),
    },
    {
      key: 'is_active',
      label: 'Status',
      sortable: true,
      render: (val) => (
        <span
          className={`
            inline-flex items-center px-2 py-0.5 rounded-[3px] text-[10px] font-archivo font-extrabold uppercase border
            ${
              val
                ? 'bg-brand-teal/15 text-brand-teal border-brand-teal'
                : 'bg-zinc-200 text-zinc-600 border-zinc-400'
            }
          `}
        >
          {val ? 'Active' : 'Inactive'}
        </span>
      ),
    },
  ];

  const rowActions = isAdmin
    ? [
        {
          label: 'Edit Plan',
          icon: Edit2,
          onClick: (row) => openEditModal(row),
        },
        {
          label: 'Deactivate',
          icon: Trash2,
          danger: true,
          onClick: (row) => {
            if (!row.is_active) {
              reactivateMutation.mutate(row.id);
            } else {
              setDeactivatePlan(row);
            }
          },
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-anton text-3xl uppercase tracking-wider text-ink">
            SUBSCRIPTION PLANS
          </h1>
          <p className="font-archivo text-xs font-bold uppercase tracking-wide text-ink/70 mt-1">
            Recurring pricing terms, availability periods, and contract lifecycle policies
          </p>
        </div>

        {isAdmin ? (
          <Button variant="primary" onClick={openCreateModal}>
            <Plus size={16} strokeWidth={3} />
            <span>Create Plan</span>
          </Button>
        ) : (
          <Tooltip content="Only administrators can create or edit subscription plans.">
            <Button variant="ghost" disabled>
              <span>Read-Only Access</span>
            </Button>
          </Tooltip>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-cream-light border-2 border-ink rounded-[4px] p-4 shadow-neo-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="w-full sm:max-w-xs">
          <Input
            placeholder="Search plans by name..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            icon={Search}
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={periodFilter}
            onChange={(e) => {
              setPeriodFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-white border-2 border-ink rounded-[4px] text-xs font-archivo font-bold text-ink shadow-neo-sm focus:outline-none"
          >
            <option value="">All Periods</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>

          <select
            value={activeFilter}
            onChange={(e) => {
              setActiveFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-white border-2 border-ink rounded-[4px] text-xs font-archivo font-bold text-ink shadow-neo-sm focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="true">Active Only</option>
            <option value="false">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={data?.items || []}
        loading={isLoading}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={(col, dir) => {
          setSortColumn(col);
          setSortDirection(dir);
        }}
        rowActions={rowActions}
        emptyTitle="No Plans Found"
        emptyMessage="Try adjusting your filters or create a new subscription plan."
      />

      {/* Pagination */}
      {data && data.total > pageSize && (
        <Pagination
          currentPage={page}
          totalItems={data.total}
          pageSize={pageSize}
          onPageChange={(p) => setPage(p)}
        />
      )}

      {/* Create / Edit Plan Modal with 4 Flag Toggles */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingPlan ? 'Edit Subscription Plan' : 'Create Subscription Plan'}
        confirmText={editingPlan ? 'Save Changes' : 'Create Plan'}
        confirmVariant="primary"
        icon={editingPlan ? Edit2 : Plus}
        loading={createMutation.isPending || updateMutation.isPending}
        onConfirm={handleSubmit}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <Input
                label="Plan Name"
                placeholder="e.g. Pro Monthly"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-archivo font-extrabold uppercase tracking-wider text-ink mb-1.5">
                Billing Cycle
              </label>
              <select
                value={formData.billing_period}
                onChange={(e) => setFormData({ ...formData, billing_period: e.target.value })}
                className="w-full px-3 py-2 bg-white border-2 border-ink rounded-[4px] text-xs font-archivo font-bold text-ink shadow-neo-sm focus:outline-none"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Base Fee (INR)"
              type="number"
              step="0.01"
              placeholder="e.g. 15000.00"
              value={formData.price_inr}
              onChange={(e) => setFormData({ ...formData, price_inr: e.target.value })}
              required
            />

            <Input
              label="Minimum Line Quantity"
              type="number"
              min="1"
              value={formData.min_quantity}
              onChange={(e) => setFormData({ ...formData, min_quantity: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Available From"
              type="date"
              value={formData.available_from}
              onChange={(e) => setFormData({ ...formData, available_from: e.target.value })}
            />

            <Input
              label="Available To"
              type="date"
              value={formData.available_to}
              onChange={(e) => setFormData({ ...formData, available_to: e.target.value })}
            />
          </div>

          {/* 4 Flag Toggles with Tooltips */}
          <div className="p-4 bg-cream-light border-2 border-ink rounded-[4px] shadow-neo-sm space-y-3">
            <div className="text-xs font-archivo font-extrabold uppercase tracking-wider text-ink mb-1">
              Subscription Behavior & Rules:
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Toggle 1: Auto Close */}
              <div className="flex items-center justify-between p-2.5 bg-white border-2 border-ink rounded-[4px] shadow-neo-sm">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-archivo font-extrabold uppercase text-ink">
                    Auto-Close
                  </span>
                  <Tooltip content="Automatically transitions the subscription to Closed upon reaching its expiry date.">
                    <Info size={14} className="text-ink/60 hover:text-ink cursor-help" />
                  </Tooltip>
                </div>
                <Toggle
                  checked={formData.auto_close}
                  onChange={(val) => setFormData({ ...formData, auto_close: val })}
                />
              </div>

              {/* Toggle 2: Closable */}
              <div className="flex items-center justify-between p-2.5 bg-white border-2 border-ink rounded-[4px] shadow-neo-sm">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-archivo font-extrabold uppercase text-ink">
                    Closable
                  </span>
                  <Tooltip content="Allows the customer or staff to manually close the subscription before its expiry date.">
                    <Info size={14} className="text-ink/60 hover:text-ink cursor-help" />
                  </Tooltip>
                </div>
                <Toggle
                  checked={formData.closable}
                  onChange={(val) => setFormData({ ...formData, closable: val })}
                />
              </div>

              {/* Toggle 3: Pausable */}
              <div className="flex items-center justify-between p-2.5 bg-white border-2 border-ink rounded-[4px] shadow-neo-sm">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-archivo font-extrabold uppercase text-ink">
                    Pausable
                  </span>
                  <Tooltip content="Allows the subscription to be paused by staff or customer. Billing is halted until resumed.">
                    <Info size={14} className="text-ink/60 hover:text-ink cursor-help" />
                  </Tooltip>
                </div>
                <Toggle
                  checked={formData.pausable}
                  onChange={(val) => setFormData({ ...formData, pausable: val })}
                />
              </div>

              {/* Toggle 4: Renewable */}
              <div className="flex items-center justify-between p-2.5 bg-white border-2 border-ink rounded-[4px] shadow-neo-sm">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-archivo font-extrabold uppercase text-ink">
                    Renewable
                  </span>
                  <Tooltip content="Permits manual or automatic renewal extending the subscription contract term.">
                    <Info size={14} className="text-ink/60 hover:text-ink cursor-help" />
                  </Tooltip>
                </div>
                <Toggle
                  checked={formData.renewable}
                  onChange={(val) => setFormData({ ...formData, renewable: val })}
                />
              </div>
            </div>
          </div>
        </form>
      </Modal>

      {/* Deactivate Modal */}
      <Modal
        isOpen={Boolean(deactivatePlan)}
        onClose={() => setDeactivatePlan(null)}
        title="Deactivate Plan"
        description={`Are you sure you want to deactivate "${deactivatePlan?.name}"? New subscriptions will not be able to select this plan.`}
        confirmText="Deactivate"
        confirmVariant="danger"
        loading={deactivateMutation.isPending}
        onConfirm={() => deactivateMutation.mutate(deactivatePlan.id)}
      />
    </div>
  );
}
