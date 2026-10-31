import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  Check,
  AlertCircle,
  TrendingUp,
  Tag,
  Boxes,
} from 'lucide-react';
import { api } from '../../api/client';
import { formatPaise } from '../../utils/format';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import DataTable from '../../components/ui/DataTable';
import Pagination from '../../components/ui/Pagination';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Tooltip from '../../components/ui/Tooltip';

export default function ProductsPage() {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [sortColumn, setSortColumn] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');

  // Modals state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [deactivateProduct, setDeactivateProduct] = useState(null);

  // Form state (prices kept as string in Rupees for the UI)
  const [formData, setFormData] = useState({
    name: '',
    type: 'standard',
    sales_price_inr: '',
    cost_price_inr: '',
    notes: '',
    is_active: true,
    variants: [],
  });

  // Query Products
  const queryParams = new URLSearchParams({
    page: page.toString(),
    page_size: pageSize.toString(),
    sort_by: sortColumn,
    sort_order: sortDirection,
  });
  if (search.trim()) queryParams.set('search', search.trim());
  if (typeFilter) queryParams.set('type', typeFilter);
  if (activeFilter) queryParams.set('is_active', activeFilter);

  const { data, isLoading } = useQuery({
    queryKey: ['products', queryParams.toString()],
    queryFn: () => api.get(`/api/products?${queryParams.toString()}`),
  });

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/api/products', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      success('Product created successfully.');
      closeModal();
    },
    onError: (err) => {
      toastError(err.detail || 'Failed to create product.');
    },
  });

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => api.put(`/api/products/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      success('Product updated successfully.');
      closeModal();
    },
    onError: (err) => {
      toastError(err.detail || 'Failed to update product.');
    },
  });

  // Deactivate Mutation
  const deactivateMutation = useMutation({
    mutationFn: (id) => api.delete(`/api/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      success('Product deactivated.');
      setDeactivateProduct(null);
    },
    onError: (err) => {
      toastError(err.detail || 'Failed to deactivate product.');
    },
  });

  // Reactivate Mutation
  const reactivateMutation = useMutation({
    mutationFn: (id) => api.put(`/api/products/${id}`, { is_active: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      success('Product reactivated.');
    },
    onError: (err) => {
      toastError(err.detail || 'Failed to reactivate product.');
    },
  });

  const closeModal = () => {
    setModalOpen(false);
    setEditingProduct(null);
    setFormData({
      name: '',
      type: 'standard',
      sales_price_inr: '',
      cost_price_inr: '',
      notes: '',
      is_active: true,
      variants: [],
    });
  };

  const openCreateModal = () => {
    setFormData({
      name: '',
      type: 'standard',
      sales_price_inr: '',
      cost_price_inr: '',
      notes: '',
      is_active: true,
      variants: [],
    });
    setEditingProduct(null);
    setModalOpen(true);
  };

  const openEditModal = (p) => {
    setEditingProduct(p);
    setFormData({
      name: p.name,
      type: p.type,
      sales_price_inr: (p.sales_price / 100).toString(),
      cost_price_inr: (p.cost_price / 100).toString(),
      notes: p.notes || '',
      is_active: p.is_active,
      variants: (p.variants || []).map((v) => ({
        id: v.id,
        attribute: v.attribute,
        value: v.value,
        extra_price_inr: (v.extra_price / 100).toString(),
      })),
    });
    setModalOpen(true);
  };

  // Add a variant row
  const handleAddVariant = () => {
    setFormData((prev) => ({
      ...prev,
      variants: [
        ...prev.variants,
        { attribute: 'Brand', value: 'Odoo', extra_price_inr: '560' },
      ],
    }));
  };

  // Remove variant row
  const handleRemoveVariant = (index) => {
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index),
    }));
  };

  // Update variant row
  const handleVariantChange = (index, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.variants];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, variants: updated };
    });
  };

  // Form live margin
  const liveMargin = useMemo(() => {
    const sp = parseFloat(formData.sales_price_inr) || 0;
    const cp = parseFloat(formData.cost_price_inr) || 0;
    const margin = sp - cp;
    const pct = sp > 0 ? (margin / sp) * 100 : 0;
    return {
      marginInr: margin,
      marginPct: pct.toFixed(1),
      isPositive: margin >= 0,
    };
  }, [formData.sales_price_inr, formData.cost_price_inr]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toastError('Product name is required.');
      return;
    }

    const salesPaise = Math.round((parseFloat(formData.sales_price_inr) || 0) * 100);
    const costPaise = Math.round((parseFloat(formData.cost_price_inr) || 0) * 100);

    const payload = {
      name: formData.name.trim(),
      type: formData.type,
      sales_price: salesPaise,
      cost_price: costPaise,
      notes: formData.notes.trim() || null,
      is_active: formData.is_active,
      variants: formData.variants.map((v) => ({
        attribute: v.attribute.trim(),
        value: v.value.trim(),
        extra_price: Math.round((parseFloat(v.extra_price_inr) || 0) * 100),
      })),
    };

    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Product Name',
      sortable: true,
      render: (val, row) => (
        <div>
          <div className="font-archivo font-extrabold text-ink">{val}</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className={`
                px-1.5 py-0.2 rounded-[2px] text-[10px] font-archivo font-extrabold uppercase border
                ${
                  row.type === 'add_on'
                    ? 'bg-brand-teal/15 text-brand-teal border-brand-teal'
                    : 'bg-zinc-100 text-ink/70 border-zinc-300'
                }
              `}
            >
              {row.type === 'add_on' ? 'Add-on' : 'Standard'}
            </span>
            {row.notes && (
              <span className="text-[11px] text-ink/60 truncate max-w-xs">
                {row.notes}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'sales_price',
      label: 'Sales Price',
      sortable: true,
      align: 'right',
      render: (val) => (
        <span className="font-anton text-ink tabular-nums text-sm">
          {formatPaise(val)}
        </span>
      ),
    },
    {
      key: 'cost_price',
      label: 'Cost Price',
      sortable: true,
      align: 'right',
      render: (val) => (
        <span className="font-anton text-ink/70 tabular-nums text-xs">
          {formatPaise(val)}
        </span>
      ),
    },
    {
      key: 'margin',
      label: 'Margin (Profit)',
      align: 'right',
      render: (_, row) => {
        const marginPaise = row.sales_price - row.cost_price;
        const pct = row.sales_price > 0 ? ((marginPaise / row.sales_price) * 100).toFixed(1) : 0;
        const isPos = marginPaise >= 0;
        return (
          <div className="text-right">
            <div className={`font-anton text-xs tabular-nums ${isPos ? 'text-brand-teal' : 'text-red-600'}`}>
              {formatPaise(marginPaise)}
            </div>
            <div className={`text-[10px] font-bold ${isPos ? 'text-brand-teal/80' : 'text-red-500'}`}>
              {pct}% margin
            </div>
          </div>
        );
      },
    },
    {
      key: 'variants',
      label: 'Variants',
      render: (val) => {
        const variantsList = val || [];
        if (variantsList.length === 0) {
          return <span className="text-xs text-ink/40 font-normal">None</span>;
        }
        return (
          <div className="flex flex-wrap gap-1 max-w-xs">
            {variantsList.map((v) => (
              <span
                key={v.id || `${v.attribute}-${v.value}`}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[2px] bg-cream-light border border-ink/40 text-[10px] font-archivo font-bold text-ink"
              >
                <span>{v.attribute}: {v.value}</span>
                {v.extra_price > 0 && (
                  <span className="text-brand-orange">+{formatPaise(v.extra_price)}</span>
                )}
              </span>
            ))}
          </div>
        );
      },
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
          label: 'Edit Product',
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
              setDeactivateProduct(row);
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
            PRODUCTS & ADD-ONS
          </h1>
          <p className="font-archivo text-xs font-bold uppercase tracking-wide text-ink/70 mt-1">
            Standard subscription add-ons, physical items, and variant pricing
          </p>
        </div>

        {isAdmin ? (
          <Button variant="primary" onClick={openCreateModal}>
            <Plus size={16} strokeWidth={3} />
            <span>Add Product</span>
          </Button>
        ) : (
          <Tooltip text="Only administrators can create or edit products.">
            <Button variant="ghost" disabled>
              <span>Read-Only Access</span>
            </Button>
          </Tooltip>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-cream-light border-2 border-ink rounded-[4px] p-4 shadow-neo-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="w-full sm:max-w-xs">
          <Input
            placeholder="Search products by name or notes..."
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
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-white border-2 border-ink rounded-[4px] text-xs font-archivo font-bold text-ink shadow-neo-sm focus:outline-none"
          >
            <option value="">All Types</option>
            <option value="standard">Standard Products</option>
            <option value="add_on">Add-ons Only</option>
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
        emptyTitle="No Products Found"
        emptyMessage="Try adjusting your filters or create your first product."
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
        title={editingProduct ? 'Edit Product' : 'Create New Product'}
        confirmText={editingProduct ? 'Save Changes' : 'Create Product'}
        confirmVariant="primary"
        icon={editingProduct ? Edit2 : Plus}
        loading={createMutation.isPending || updateMutation.isPending}
        onConfirm={handleSubmit}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <Input
                label="Product Name"
                placeholder="e.g. Dedicated Support Seat"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-archivo font-extrabold uppercase tracking-wider text-ink mb-1.5">
                Product Type
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-3 py-2 bg-white border-2 border-ink rounded-[4px] text-xs font-archivo font-bold text-ink shadow-neo-sm focus:outline-none"
              >
                <option value="standard">Standard Product</option>
                <option value="add_on">Add-on Item</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Sales Price (INR)"
              type="number"
              step="0.01"
              placeholder="e.g. 1200.00"
              value={formData.sales_price_inr}
              onChange={(e) => setFormData({ ...formData, sales_price_inr: e.target.value })}
              required
            />

            <Input
              label="Cost Price (INR)"
              type="number"
              step="0.01"
              placeholder="e.g. 400.00"
              value={formData.cost_price_inr}
              onChange={(e) => setFormData({ ...formData, cost_price_inr: e.target.value })}
            />
          </div>

          {/* Live Margin Card */}
          <div className="p-3 bg-cream-light border-2 border-ink rounded-[4px] shadow-neo-sm flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-archivo font-extrabold uppercase text-ink">
              <TrendingUp size={16} className={liveMargin.isPositive ? 'text-brand-teal' : 'text-red-500'} />
              <span>Projected Margin:</span>
            </div>
            <div className="text-right">
              <span className={`font-anton text-sm ${liveMargin.isPositive ? 'text-brand-teal' : 'text-red-600'}`}>
                ₹{liveMargin.marginInr.toFixed(2)} ({liveMargin.marginPct}%)
              </span>
            </div>
          </div>

          <Input
            label="Internal Notes / Description"
            placeholder="Technical details, billing reminders, or SLAs"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />

          {/* Variants Editor */}
          <div className="pt-2 border-t-2 border-ink/10">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-archivo font-extrabold uppercase tracking-wider text-ink flex items-center gap-1.5">
                <Boxes size={14} />
                <span>Product Variants</span>
              </div>
              <button
                type="button"
                onClick={handleAddVariant}
                className="px-2.5 py-1 text-[11px] font-archivo font-extrabold uppercase bg-white border-2 border-ink rounded-[4px] text-ink shadow-neo-sm hover:bg-cream active:translate-y-0.5"
              >
                + Add Variant
              </button>
            </div>

            {formData.variants.length === 0 ? (
              <p className="text-xs text-ink/60 font-inter italic">
                No variants configured. Product uses base sales price.
              </p>
            ) : (
              <div className="space-y-2">
                {formData.variants.map((v, idx) => {
                  const baseSp = parseFloat(formData.sales_price_inr) || 0;
                  const extra = parseFloat(v.extra_price_inr) || 0;
                  const effective = baseSp + extra;

                  return (
                    <div
                      key={idx}
                      className="p-2.5 bg-white border-2 border-ink rounded-[4px] shadow-neo-sm grid grid-cols-12 gap-2 items-center"
                    >
                      <div className="col-span-4">
                        <input
                          type="text"
                          placeholder="Attribute (e.g. Brand)"
                          value={v.attribute}
                          onChange={(e) => handleVariantChange(idx, 'attribute', e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-ink rounded font-bold"
                          required
                        />
                      </div>
                      <div className="col-span-4">
                        <input
                          type="text"
                          placeholder="Value (e.g. Odoo)"
                          value={v.value}
                          onChange={(e) => handleVariantChange(idx, 'value', e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-ink rounded font-bold"
                          required
                        />
                      </div>
                      <div className="col-span-3">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-bold text-ink">+₹</span>
                          <input
                            type="number"
                            placeholder="560"
                            value={v.extra_price_inr}
                            onChange={(e) => handleVariantChange(idx, 'extra_price_inr', e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-ink rounded font-bold"
                          />
                        </div>
                        <div className="text-[10px] text-ink/60 font-medium">
                          Total: ₹{effective.toFixed(2)}
                        </div>
                      </div>
                      <div className="col-span-1 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveVariant(idx)}
                          className="p-1 text-red-500 hover:text-red-700"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </form>
      </Modal>

      {/* Deactivate Confirm Dialog */}
      <Modal
        isOpen={Boolean(deactivateProduct)}
        onClose={() => setDeactivateProduct(null)}
        title="Deactivate Product"
        description={`Are you sure you want to deactivate "${deactivateProduct?.name}"? It will no longer be selectable for new subscription lines.`}
        confirmText="Deactivate"
        confirmVariant="danger"
        loading={deactivateMutation.isPending}
        onConfirm={() => deactivateMutation.mutate(deactivateProduct.id)}
      />
    </div>
  );
}
