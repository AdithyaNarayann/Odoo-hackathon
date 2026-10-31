import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileSpreadsheet,
  Plus,
  Search,
  Edit2,
  Trash2,
  Layers,
  Clock,
  ListPlus,
  Package,
} from 'lucide-react';
import { api } from '../../api/client';
import { formatPaise } from '../../utils/format';
import { useToast } from '../../context/ToastContext';
import DataTable from '../../components/ui/DataTable';
import Pagination from '../../components/ui/Pagination';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';

export default function TemplatesPage() {
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('');

  // Modals state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [deactivateTemplate, setDeactivateTemplate] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    plan_id: '',
    validity_days: 30,
    lines: [],
  });

  // Query Templates
  const queryParams = new URLSearchParams({
    page: page.toString(),
    page_size: pageSize.toString(),
  });
  if (search.trim()) queryParams.set('search', search.trim());
  if (activeFilter) queryParams.set('is_active', activeFilter);

  const { data, isLoading } = useQuery({
    queryKey: ['quotation-templates', queryParams.toString()],
    queryFn: () => api.get(`/api/quotation-templates?${queryParams.toString()}`),
  });

  // Query active plans for dropdown
  const { data: plansData } = useQuery({
    queryKey: ['active-plans-dropdown'],
    queryFn: () => api.get('/api/plans?is_active=true&page_size=100'),
  });

  // Query active products for line items
  const { data: productsData } = useQuery({
    queryKey: ['active-products-dropdown'],
    queryFn: () => api.get('/api/products?is_active=true&page_size=100'),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/api/quotation-templates', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotation-templates'] });
      success('Quotation template created.');
      closeModal();
    },
    onError: (err) => {
      toastError(err.detail || 'Failed to create quotation template.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => api.put(`/api/quotation-templates/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotation-templates'] });
      success('Quotation template updated.');
      closeModal();
    },
    onError: (err) => {
      toastError(err.detail || 'Failed to update template.');
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id) => api.delete(`/api/quotation-templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotation-templates'] });
      success('Quotation template deactivated.');
      setDeactivateTemplate(null);
    },
    onError: (err) => {
      toastError(err.detail || 'Failed to deactivate template.');
    },
  });

  const closeModal = () => {
    setModalOpen(false);
    setEditingTemplate(null);
    setFormData({
      name: '',
      plan_id: '',
      validity_days: 30,
      lines: [],
    });
  };

  const openCreateModal = () => {
    const defaultPlanId = plansData?.items?.[0]?.id || '';
    setFormData({
      name: '',
      plan_id: defaultPlanId,
      validity_days: 30,
      lines: [],
    });
    setEditingTemplate(null);
    setModalOpen(true);
  };

  const openEditModal = (tmpl) => {
    setEditingTemplate(tmpl);
    setFormData({
      name: tmpl.name,
      plan_id: tmpl.plan_id,
      validity_days: tmpl.validity_days,
      lines: (tmpl.lines || []).map((l) => ({
        product_id: l.product_id,
        variant_id: l.variant_id || '',
        quantity: l.quantity,
      })),
    });
    setModalOpen(true);
  };

  // Line item helpers
  const handleAddLine = () => {
    const defaultProd = productsData?.items?.[0];
    if (!defaultProd) {
      toastError('No active products available to add.');
      return;
    }
    setFormData((prev) => ({
      ...prev,
      lines: [
        ...prev.lines,
        {
          product_id: defaultProd.id,
          variant_id: defaultProd.variants?.[0]?.id || '',
          quantity: 1,
        },
      ],
    }));
  };

  const handleRemoveLine = (idx) => {
    setFormData((prev) => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== idx),
    }));
  };

  const handleLineChange = (idx, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.lines];
      updated[idx] = { ...updated[idx], [field]: value };
      if (field === 'product_id') {
        // Reset variant when product changes
        const prod = productsData?.items?.find((p) => p.id === parseInt(value, 10));
        updated[idx].variant_id = prod?.variants?.[0]?.id || '';
      }
      return { ...prev, lines: updated };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toastError('Template name is required.');
      return;
    }
    if (!formData.plan_id) {
      toastError('Please select a base subscription plan.');
      return;
    }

    const payload = {
      name: formData.name.trim(),
      plan_id: parseInt(formData.plan_id, 10),
      validity_days: parseInt(formData.validity_days, 10) || 30,
      lines: formData.lines.map((l) => ({
        product_id: parseInt(l.product_id, 10),
        variant_id: l.variant_id ? parseInt(l.variant_id, 10) : null,
        quantity: parseInt(l.quantity, 10) || 1,
      })),
    };

    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Template Name',
      sortable: true,
      render: (val, row) => (
        <div>
          <div className="font-archivo font-extrabold text-ink">{val}</div>
          <div className="text-[11px] text-ink/70 flex items-center gap-1.5 mt-0.5">
            <Layers size={12} />
            <span>Base Plan: {row.plan_name}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'validity_days',
      label: 'Validity Window',
      render: (val) => (
        <div className="text-xs font-bold text-ink flex items-center gap-1">
          <Clock size={13} className="text-brand-orange" />
          <span>{val} Days</span>
        </div>
      ),
    },
    {
      key: 'lines',
      label: 'Pre-configured Items',
      render: (val) => {
        const lineList = val || [];
        return (
          <div className="text-xs">
            <span className="font-bold text-ink">{lineList.length} line(s)</span>
            {lineList.length > 0 && (
              <div className="text-[11px] text-ink/60 truncate max-w-xs mt-0.5">
                {lineList.map((l) => `${l.quantity}x ${l.product_name}`).join(', ')}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'is_active',
      label: 'Status',
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

  const rowActions = [
    {
      label: 'Edit Template',
      icon: Edit2,
      onClick: (row) => openEditModal(row),
    },
    {
      label: 'Deactivate',
      icon: Trash2,
      danger: true,
      onClick: (row) => setDeactivateTemplate(row),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-anton text-3xl uppercase tracking-wider text-ink">
            QUOTATION TEMPLATES
          </h1>
          <p className="font-archivo text-xs font-bold uppercase tracking-wide text-ink/70 mt-1">
            Standard sales configurations, pre-bundled items, and quotation expiration presets
          </p>
        </div>

        <Button variant="primary" onClick={openCreateModal}>
          <Plus size={16} strokeWidth={3} />
          <span>Create Template</span>
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="bg-cream-light border-2 border-ink rounded-[4px] p-4 shadow-neo-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="w-full sm:max-w-xs">
          <Input
            placeholder="Search templates by name..."
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
        rowActions={rowActions}
        emptyTitle="No Templates Found"
        emptyMessage="Create a reusable quotation template to speed up customer contract setup."
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

      {/* Create / Edit Template Modal with Line Items Editor */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingTemplate ? 'Edit Quotation Template' : 'Create Quotation Template'}
        confirmText={editingTemplate ? 'Save Template' : 'Create Template'}
        confirmVariant="primary"
        icon={editingTemplate ? Edit2 : Plus}
        loading={createMutation.isPending || updateMutation.isPending}
        onConfirm={handleSubmit}
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <Input
                label="Template Name"
                placeholder="e.g. Standard SaaS Growth Bundle"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <Input
              label="Quotation Validity (Days)"
              type="number"
              min="1"
              value={formData.validity_days}
              onChange={(e) => setFormData({ ...formData, validity_days: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-archivo font-extrabold uppercase tracking-wider text-ink mb-1.5">
              Base Subscription Plan
            </label>
            <select
              value={formData.plan_id}
              onChange={(e) => setFormData({ ...formData, plan_id: e.target.value })}
              className="w-full px-3 py-2 bg-white border-2 border-ink rounded-[4px] text-xs font-archivo font-bold text-ink shadow-neo-sm focus:outline-none"
              required
            >
              <option value="">Select Plan...</option>
              {plansData?.items?.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} ({formatPaise(plan.price)} / {plan.billing_period})
                </option>
              ))}
            </select>
          </div>

          {/* Line Items Editor */}
          <div className="pt-3 border-t-2 border-ink/10">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-archivo font-extrabold uppercase tracking-wider text-ink flex items-center gap-1.5">
                <Package size={14} />
                <span>Pre-Bundled Line Items</span>
              </div>

              <button
                type="button"
                onClick={handleAddLine}
                className="px-2.5 py-1 text-[11px] font-archivo font-extrabold uppercase bg-white border-2 border-ink rounded-[4px] text-ink shadow-neo-sm hover:bg-cream active:translate-y-0.5"
              >
                + Add Item
              </button>
            </div>

            {formData.lines.length === 0 ? (
              <p className="text-xs text-ink/60 font-inter italic py-2">
                No extra product lines attached. Only base plan fee will apply.
              </p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {formData.lines.map((line, idx) => {
                  const selectedProd = productsData?.items?.find(
                    (p) => p.id === parseInt(line.product_id, 10)
                  );
                  const selectedVariant = selectedProd?.variants?.find(
                    (v) => v.id === parseInt(line.variant_id, 10)
                  );
                  const unitPrice =
                    (selectedProd?.sales_price || 0) + (selectedVariant?.extra_price || 0);

                  return (
                    <div
                      key={idx}
                      className="p-2.5 bg-white border-2 border-ink rounded-[4px] shadow-neo-sm grid grid-cols-12 gap-2 items-center"
                    >
                      {/* Product Selector */}
                      <div className="col-span-5">
                        <select
                          value={line.product_id}
                          onChange={(e) => handleLineChange(idx, 'product_id', e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-ink rounded font-bold"
                          required
                        >
                          {productsData?.items?.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({formatPaise(p.sales_price)})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Variant Selector (if product has variants) */}
                      <div className="col-span-3">
                        {selectedProd?.variants && selectedProd.variants.length > 0 ? (
                          <select
                            value={line.variant_id}
                            onChange={(e) => handleLineChange(idx, 'variant_id', e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-ink rounded font-bold"
                          >
                            <option value="">Base variant</option>
                            {selectedProd.variants.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.attribute}: {v.value} (+{formatPaise(v.extra_price)})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-[11px] text-ink/50 italic px-1">Standard</span>
                        )}
                      </div>

                      {/* Quantity */}
                      <div className="col-span-2">
                        <input
                          type="number"
                          min="1"
                          placeholder="Qty"
                          value={line.quantity}
                          onChange={(e) => handleLineChange(idx, 'quantity', e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-ink rounded font-bold"
                          required
                        />
                      </div>

                      {/* Total and Delete */}
                      <div className="col-span-2 flex items-center justify-between">
                        <span className="font-anton text-xs text-ink">
                          {formatPaise(unitPrice * (parseInt(line.quantity, 10) || 1))}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
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

      {/* Deactivate Modal */}
      <Modal
        isOpen={Boolean(deactivateTemplate)}
        onClose={() => setDeactivateTemplate(null)}
        title="Deactivate Quotation Template"
        description={`Are you sure you want to deactivate "${deactivateTemplate?.name}"?`}
        confirmText="Deactivate"
        confirmVariant="danger"
        loading={deactivateMutation.isPending}
        onConfirm={() => deactivateMutation.mutate(deactivateTemplate.id)}
      />
    </div>
  );
}
