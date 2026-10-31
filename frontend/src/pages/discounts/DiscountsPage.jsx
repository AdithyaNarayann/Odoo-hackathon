import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Percent,
  Plus,
  Search,
  Edit2,
  Trash2,
  Calendar,
  Layers,
  CheckCircle2,
  AlertTriangle,
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
import ProgressBar from '../../components/ui/ProgressBar';
import Radio from '../../components/ui/Radio';
import Checkbox from '../../components/ui/Checkbox';
import Tooltip from '../../components/ui/Tooltip';

export default function DiscountsPage() {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortColumn, setSortColumn] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');

  // Modals state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState(null);
  const [deactivateDiscount, setDeactivateDiscount] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    type: 'percentage', // 'percentage' | 'fixed'
    value: '', // in % or INR
    applies_to: 'all', // 'all' | 'products'
    product_ids: [],
    min_purchase_amount_inr: '',
    min_quantity: '',
    start_date: '',
    end_date: '',
    usage_limit: '',
    is_active: true,
  });

  // Query Discounts
  const queryParams = new URLSearchParams({
    page: page.toString(),
    page_size: pageSize.toString(),
    sort_by: sortColumn,
    sort_order: sortDirection,
  });
  if (search.trim()) queryParams.set('search', search.trim());
  if (statusFilter) queryParams.set('status_filter', statusFilter);

  const { data, isLoading } = useQuery({
    queryKey: ['discounts', queryParams.toString()],
    queryFn: () => api.get(`/api/discounts?${queryParams.toString()}`),
  });

  // Query active products for multi-select
  const { data: productsData } = useQuery({
    queryKey: ['active-products-dropdown'],
    queryFn: () => api.get('/api/products?is_active=true&page_size=100'),
  });

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/api/discounts', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discounts'] });
      success('Discount rule created.');
      closeModal();
    },
    onError: (err) => {
      toastError(err.detail || 'Failed to create discount.');
    },
  });

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => api.put(`/api/discounts/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discounts'] });
      success('Discount rule updated.');
      closeModal();
    },
    onError: (err) => {
      toastError(err.detail || 'Failed to update discount.');
    },
  });

  // Deactivate Mutation
  const deactivateMutation = useMutation({
    mutationFn: (id) => api.delete(`/api/discounts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discounts'] });
      success('Discount rule deactivated.');
      setDeactivateDiscount(null);
    },
    onError: (err) => {
      toastError(err.detail || 'Failed to deactivate discount.');
    },
  });

  // Reactivate Mutation
  const reactivateMutation = useMutation({
    mutationFn: (id) => api.put(`/api/discounts/${id}`, { is_active: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discounts'] });
      success('Discount rule reactivated.');
    },
    onError: (err) => {
      toastError(err.detail || 'Failed to reactivate discount.');
    },
  });

  const closeModal = () => {
    setModalOpen(false);
    setEditingDiscount(null);
    setFormData({
      name: '',
      type: 'percentage',
      value: '',
      applies_to: 'all',
      product_ids: [],
      min_purchase_amount_inr: '',
      min_quantity: '',
      start_date: '',
      end_date: '',
      usage_limit: '',
      is_active: true,
    });
  };

  const openCreateModal = () => {
    setFormData({
      name: '',
      type: 'percentage',
      value: '',
      applies_to: 'all',
      product_ids: [],
      min_purchase_amount_inr: '',
      min_quantity: '',
      start_date: '',
      end_date: '',
      usage_limit: '',
      is_active: true,
    });
    setEditingDiscount(null);
    setModalOpen(true);
  };

  const openEditModal = (rule) => {
    setEditingDiscount(rule);
    const valDisplay =
      rule.type === 'percentage'
        ? (rule.value / 100).toString() // basis points to %
        : (rule.value / 100).toString(); // paise to INR

    setFormData({
      name: rule.name,
      type: rule.type,
      value: valDisplay,
      applies_to: rule.applies_to,
      product_ids: rule.product_ids || [],
      min_purchase_amount_inr: rule.min_purchase_amount ? (rule.min_purchase_amount / 100).toString() : '',
      min_quantity: rule.min_quantity ? rule.min_quantity.toString() : '',
      start_date: rule.start_date || '',
      end_date: rule.end_date || '',
      usage_limit: rule.usage_limit ? rule.usage_limit.toString() : '',
      is_active: rule.is_active,
    });
    setModalOpen(true);
  };

  const handleProductToggle = (productId) => {
    setFormData((prev) => {
      const exists = prev.product_ids.includes(productId);
      const updated = exists
        ? prev.product_ids.filter((id) => id !== productId)
        : [...prev.product_ids, productId];
      return { ...prev, product_ids: updated };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toastError('Discount name is required.');
      return;
    }
    const valNum = parseFloat(formData.value) || 0;
    if (valNum <= 0) {
      toastError('Please enter a positive discount value.');
      return;
    }

    // Convert value: percentage -> basis points (15% = 1500), fixed -> paise (500 INR = 50000)
    const storedValue =
      formData.type === 'percentage'
        ? Math.round(valNum * 100)
        : Math.round(valNum * 100);

    const payload = {
      name: formData.name.trim(),
      type: formData.type,
      value: storedValue,
      applies_to: formData.applies_to,
      product_ids: formData.applies_to === 'products' ? formData.product_ids : [],
      min_purchase_amount: formData.min_purchase_amount_inr
        ? Math.round(parseFloat(formData.min_purchase_amount_inr) * 100)
        : null,
      min_quantity: formData.min_quantity ? parseInt(formData.min_quantity, 10) : null,
      start_date: formData.start_date || null,
      end_date: formData.end_date || null,
      usage_limit: formData.usage_limit ? parseInt(formData.usage_limit, 10) : null,
      is_active: formData.is_active,
    };

    if (editingDiscount) {
      updateMutation.mutate({ id: editingDiscount.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Discount Rule',
      sortable: true,
      render: (val, row) => (
        <div>
          <div className="font-archivo font-extrabold text-ink">{val}</div>
          <div className="text-[11px] text-ink/60 font-medium">
            Scope:{' '}
            {row.applies_to === 'all'
              ? 'All Products'
              : `${row.product_ids?.length || 0} Specific Product(s)`}
          </div>
        </div>
      ),
    },
    {
      key: 'value',
      label: 'Benefit',
      render: (_, row) => (
        <span className="font-anton text-ink text-sm">
          {row.type === 'percentage'
            ? `${(row.value / 100).toFixed(0)}% OFF`
            : `${formatPaise(row.value)} OFF`}
        </span>
      ),
    },
    {
      key: 'thresholds',
      label: 'Thresholds',
      render: (_, row) => (
        <div className="text-xs text-ink/80 space-y-0.5">
          {row.min_purchase_amount ? (
            <div>Min Spend: {formatPaise(row.min_purchase_amount)}</div>
          ) : (
            <div>No spend min</div>
          )}
          {row.min_quantity && <div>Min Qty: {row.min_quantity}</div>}
        </div>
      ),
    },
    {
      key: 'dates',
      label: 'Validity Window',
      render: (_, row) => {
        if (!row.start_date && !row.end_date) {
          return <span className="text-xs text-ink/70 font-semibold">Always Active</span>;
        }
        return (
          <div className="text-xs text-ink">
            <div>From: {formatDate(row.start_date)}</div>
            <div>To: {formatDate(row.end_date)}</div>
          </div>
        );
      },
    },
    {
      key: 'usage',
      label: 'Usage Limit',
      render: (_, row) => {
        const used = row.used_count || 0;
        const limit = row.usage_limit;
        if (!limit) {
          return (
            <div className="text-xs font-bold text-ink">
              {used} used (unlimited)
            </div>
          );
        }
        return (
          <div className="w-36">
            <ProgressBar
              value={used}
              max={limit}
              sublabel={`${used} / ${limit} used`}
              color={used >= limit ? 'orange' : 'teal'}
            />
          </div>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (val, row) => {
        const statusMap = {
          active: { label: 'Active', bg: 'bg-brand-teal/15 text-brand-teal border-brand-teal' },
          expired: { label: 'Expired', bg: 'bg-zinc-800 text-white border-zinc-900' },
          limit_reached: { label: 'Limit Reached', bg: 'bg-amber-100 text-amber-800 border-amber-400' },
          inactive: { label: 'Inactive', bg: 'bg-zinc-200 text-zinc-600 border-zinc-400' },
        };
        const s = statusMap[val] || statusMap.inactive;
        return (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-[3px] text-[10px] font-archivo font-extrabold uppercase border ${s.bg}`}
          >
            {s.label}
          </span>
        );
      },
    },
  ];

  const rowActions = isAdmin
    ? [
        {
          label: 'Edit Rule',
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
              setDeactivateDiscount(row);
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
            DISCOUNT RULES
          </h1>
          <p className="font-archivo text-xs font-bold uppercase tracking-wide text-ink/70 mt-1">
            Promotional vouchers, volume tiers, and redemption limits
          </p>
        </div>

        {isAdmin ? (
          <Button variant="primary" onClick={openCreateModal}>
            <Plus size={16} strokeWidth={3} />
            <span>Create Discount</span>
          </Button>
        ) : (
          <Tooltip content="Only administrators can create or edit discount rules.">
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
            placeholder="Search discounts by name..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            icon={Search}
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-white border-2 border-ink rounded-[4px] text-xs font-archivo font-bold text-ink shadow-neo-sm focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="expired">Expired</option>
            <option value="limit_reached">Limit Reached</option>
            <option value="inactive">Inactive</option>
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
        emptyTitle="No Discounts Found"
        emptyMessage="Try adjusting your filter or create a new promotional discount rule."
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

      {/* Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingDiscount ? 'Edit Discount Rule' : 'Create Discount Rule'}
        confirmText={editingDiscount ? 'Save Rule' : 'Create Rule'}
        confirmVariant="primary"
        icon={editingDiscount ? Edit2 : Plus}
        loading={createMutation.isPending || updateMutation.isPending}
        onConfirm={handleSubmit}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Rule Name / Campaign Title"
            placeholder="e.g. Early Adopter 20% Off"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />

          {/* Radios for Discount Type */}
          <div>
            <label className="block text-xs font-archivo font-extrabold uppercase tracking-wider text-ink mb-1.5">
              Discount Type
            </label>
            <div className="flex items-center gap-6 p-3 bg-cream-light border-2 border-ink rounded-[4px] shadow-neo-sm">
              <Radio
                name="discount_type"
                value="percentage"
                checked={formData.type === 'percentage'}
                onChange={(val) => setFormData({ ...formData, type: val })}
                label="Percentage (%)"
                description="Deducts a percentage from the subtotal"
              />
              <Radio
                name="discount_type"
                value="fixed"
                checked={formData.type === 'fixed'}
                onChange={(val) => setFormData({ ...formData, type: val })}
                label="Fixed Amount (INR)"
                description="Deducts a flat rupee amount"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={formData.type === 'percentage' ? 'Percentage (e.g. 15 for 15%)' : 'Amount in INR (e.g. 500)'}
              type="number"
              step="0.01"
              placeholder={formData.type === 'percentage' ? '15' : '500.00'}
              value={formData.value}
              onChange={(e) => setFormData({ ...formData, value: e.target.value })}
              required
            />

            <Input
              label="Usage Limit (Max Redemptions)"
              type="number"
              min="1"
              placeholder="e.g. 100 (leave blank for unlimited)"
              value={formData.usage_limit}
              onChange={(e) => setFormData({ ...formData, usage_limit: e.target.value })}
            />
          </div>

          {/* Scope Radios & Multi-Select */}
          <div>
            <label className="block text-xs font-archivo font-extrabold uppercase tracking-wider text-ink mb-1.5">
              Scope of Application
            </label>
            <div className="flex items-center gap-6 p-3 bg-cream-light border-2 border-ink rounded-[4px] shadow-neo-sm">
              <Radio
                name="applies_to"
                value="all"
                checked={formData.applies_to === 'all'}
                onChange={(val) => setFormData({ ...formData, applies_to: val })}
                label="Entire Subscription"
                description="Applies to total subscription subtotal"
              />
              <Radio
                name="applies_to"
                value="products"
                checked={formData.applies_to === 'products'}
                onChange={(val) => setFormData({ ...formData, applies_to: val })}
                label="Specific Products"
                description="Applies only to selected lines"
              />
            </div>

            {/* Product Multi-select */}
            {formData.applies_to === 'products' && (
              <div className="mt-2 p-3 bg-white border-2 border-ink rounded-[4px] shadow-neo-sm max-h-40 overflow-y-auto space-y-2">
                <div className="text-[11px] font-archivo font-extrabold uppercase text-ink mb-1">
                  Select Applicable Products:
                </div>
                {productsData?.items?.map((prod) => (
                  <label key={prod.id} className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                    <Checkbox
                      checked={formData.product_ids.includes(prod.id)}
                      onChange={() => handleProductToggle(prod.id)}
                    />
                    <span>{prod.name} ({formatPaise(prod.sales_price)})</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Minimum Purchase Amount (INR)"
              type="number"
              placeholder="e.g. 2000.00"
              value={formData.min_purchase_amount_inr}
              onChange={(e) => setFormData({ ...formData, min_purchase_amount_inr: e.target.value })}
            />

            <Input
              label="Minimum Line Quantity"
              type="number"
              min="1"
              placeholder="e.g. 5"
              value={formData.min_quantity}
              onChange={(e) => setFormData({ ...formData, min_quantity: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
            />

            <Input
              label="End Date"
              type="date"
              value={formData.end_date}
              onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
            />
          </div>
        </form>
      </Modal>

      {/* Deactivate Modal */}
      <Modal
        isOpen={Boolean(deactivateDiscount)}
        onClose={() => setDeactivateDiscount(null)}
        title="Deactivate Discount Rule"
        description={`Are you sure you want to deactivate "${deactivateDiscount?.name}"? It will no longer be applied to new subscriptions.`}
        confirmText="Deactivate"
        confirmVariant="danger"
        loading={deactivateMutation.isPending}
        onConfirm={() => deactivateMutation.mutate(deactivateDiscount.id)}
      />
    </div>
  );
}
