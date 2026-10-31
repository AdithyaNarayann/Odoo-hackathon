import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Plus,
  Search,
  Eye,
  Edit2,
  UserX,
  UserCheck,
  Building,
  Mail,
  Phone,
  MapPin,
  FileText,
} from 'lucide-react';
import { api } from '../../api/client';
import { formatDate } from '../../utils/format';
import { useToast } from '../../context/ToastContext';
import DataTable from '../../components/ui/DataTable';
import Pagination from '../../components/ui/Pagination';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';

export default function CustomersListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState(''); // '' = all, 'true', 'false'
  const [sortColumn, setSortColumn] = useState('id');
  const [sortDirection, setSortDirection] = useState('desc');

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  const [deactivateCustomer, setDeactivateCustomer] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    company_name: '',
    email: '',
    phone: '',
    tax_id: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'India',
  });
  const [formErrors, setFormErrors] = useState({});

  // Query customers
  const queryParams = new URLSearchParams({
    page: page.toString(),
    page_size: pageSize.toString(),
    sort_by: sortColumn,
    sort_order: sortDirection,
  });
  if (search.trim()) queryParams.set('search', search.trim());
  if (activeFilter) queryParams.set('is_active', activeFilter);

  const { data, isLoading } = useQuery({
    queryKey: ['customers', queryParams.toString()],
    queryFn: () => api.get(`/api/customers?${queryParams.toString()}`),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (newCustomer) => api.post('/api/customers', newCustomer),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      success('Customer created successfully.');
      setCreateModalOpen(false);
      resetForm();
    },
    onError: (err) => {
      toastError(err.detail || 'Failed to create customer.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/api/customers/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      success('Customer updated successfully.');
      setEditCustomer(null);
      resetForm();
    },
    onError: (err) => {
      toastError(err.detail || 'Failed to update customer.');
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id) => api.delete(`/api/customers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      success('Customer deactivated successfully.');
      setDeactivateCustomer(null);
    },
    onError: (err) => {
      toastError(err.detail || 'Failed to deactivate customer.');
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: (id) => api.put(`/api/customers/${id}`, { is_active: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      success('Customer reactivated successfully.');
    },
    onError: (err) => {
      toastError(err.detail || 'Failed to reactivate customer.');
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      company_name: '',
      email: '',
      phone: '',
      tax_id: '',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      postal_code: '',
      country: 'India',
    });
    setFormErrors({});
  };

  const openCreateModal = () => {
    resetForm();
    setCreateModalOpen(true);
  };

  const openEditModal = (cust) => {
    setEditCustomer(cust);
    setFormData({
      name: cust.name || '',
      company_name: cust.company_name || '',
      email: cust.email || '',
      phone: cust.phone || '',
      tax_id: cust.tax_id || '',
      address_line1: cust.address_line1 || '',
      address_line2: cust.address_line2 || '',
      city: cust.city || '',
      state: cust.state || '',
      postal_code: cust.postal_code || '',
      country: cust.country || 'India',
    });
    setFormErrors({});
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    const errors = {};
    if (!formData.name.trim()) errors.name = 'Full name is required.';
    if (!formData.company_name.trim()) errors.company_name = 'Company name is required.';
    if (!formData.email.trim()) errors.email = 'Email is required.';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    if (editCustomer) {
      updateMutation.mutate({ id: editCustomer.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Customer / Company',
      sortable: true,
      render: (val, row) => (
        <div>
          <div className="font-archivo font-extrabold text-ink hover:text-brand-orange cursor-pointer" onClick={() => navigate(`/customers/${row.id}`)}>
            {row.name}
          </div>
          <div className="text-xs text-ink/70 flex items-center gap-1">
            <Building size={12} />
            <span>{row.company_name}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'email',
      label: 'Contact',
      sortable: true,
      render: (val, row) => (
        <div className="text-xs">
          <div className="flex items-center gap-1.5 text-ink">
            <Mail size={12} className="text-ink/60" />
            <span>{row.email}</span>
          </div>
          {row.phone && (
            <div className="flex items-center gap-1.5 text-ink/70 mt-0.5">
              <Phone size={12} className="text-ink/60" />
              <span>{row.phone}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'city',
      label: 'Location',
      sortable: true,
      render: (val, row) => (
        <div className="text-xs text-ink">
          {row.city || row.state ? (
            <div className="flex items-center gap-1">
              <MapPin size={12} className="text-ink/60" />
              <span>{[row.city, row.state].filter(Boolean).join(', ')}</span>
            </div>
          ) : (
            <span className="text-ink/40">—</span>
          )}
        </div>
      ),
    },
    {
      key: 'tax_id',
      label: 'Tax ID / GSTIN',
      render: (val) => (
        <div className="text-xs font-mono font-bold text-ink">
          {val || <span className="text-ink/40 font-normal">—</span>}
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
            inline-flex items-center px-2 py-0.5 rounded-[3px] text-[11px] font-archivo font-extrabold uppercase border
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
    {
      key: 'created_at',
      label: 'Joined',
      sortable: true,
      render: (val) => (
        <span className="text-xs text-ink/80 font-medium">
          {formatDate(val)}
        </span>
      ),
    },
  ];

  const rowActions = [
    {
      label: 'View Details',
      icon: Eye,
      onClick: (row) => navigate(`/customers/${row.id}`),
    },
    {
      label: 'Edit Profile',
      icon: Edit2,
      onClick: (row) => openEditModal(row),
    },
    {
      label: 'Deactivate',
      icon: UserX,
      danger: true,
      onClick: (row) => {
        if (!row.is_active) {
          reactivateMutation.mutate(row.id);
        } else {
          setDeactivateCustomer(row);
        }
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-anton text-3xl uppercase tracking-wider text-ink">
            CUSTOMERS
          </h1>
          <p className="font-archivo text-xs font-bold uppercase tracking-wide text-ink/70 mt-1">
            Manage clients, billing contacts, and subscription ledgers
          </p>
        </div>

        <Button variant="primary" onClick={openCreateModal}>
          <Plus size={16} strokeWidth={3} />
          <span>Add Customer</span>
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-cream-light border-2 border-ink rounded-[4px] p-4 shadow-neo-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="w-full sm:max-w-xs">
          <Input
            placeholder="Search by name, company, email, city..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            icon={Search}
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-archivo font-extrabold uppercase text-ink/70">
            Status:
          </span>
          <select
            value={activeFilter}
            onChange={(e) => {
              setActiveFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-white border-2 border-ink rounded-[4px] text-xs font-archivo font-bold text-ink shadow-neo-sm focus:outline-none"
          >
            <option value="">All Customers</option>
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
        emptyTitle="No Customers Found"
        emptyMessage="Try adjusting your search query or create a new customer."
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

      {/* Create / Edit Customer Modal */}
      <Modal
        isOpen={createModalOpen || Boolean(editCustomer)}
        onClose={() => {
          setCreateModalOpen(false);
          setEditCustomer(null);
          resetForm();
        }}
        title={editCustomer ? 'Edit Customer' : 'Create Customer'}
        confirmText={editCustomer ? 'Save Changes' : 'Create Customer'}
        confirmVariant="primary"
        icon={editCustomer ? Edit2 : Plus}
        loading={createMutation.isPending || updateMutation.isPending}
        onConfirm={handleFormSubmit}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Contact Full Name"
              placeholder="e.g. Adithya Narayan"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              error={formErrors.name}
              required
            />

            <Input
              label="Company Name"
              placeholder="e.g. Acme Tech Solutions"
              value={formData.company_name}
              onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
              error={formErrors.company_name}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Email Address"
              type="email"
              placeholder="billing@company.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              error={formErrors.email}
              required
            />

            <Input
              label="Phone Number"
              placeholder="+91 98765 43210"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>

          <Input
            label="Tax ID / GSTIN"
            placeholder="e.g. 29ABCDE1234F1Z5"
            value={formData.tax_id}
            onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Address Line 1"
              placeholder="Street or Suite"
              value={formData.address_line1}
              onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
            />
            <Input
              label="Address Line 2"
              placeholder="Building, Landmark"
              value={formData.address_line2}
              onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input
              label="City"
              placeholder="City"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            />
            <Input
              label="State"
              placeholder="State"
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
            />
            <Input
              label="Postal Code"
              placeholder="560001"
              value={formData.postal_code}
              onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
            />
          </div>
        </form>
      </Modal>

      {/* Deactivate Confirm Modal */}
      <Modal
        isOpen={Boolean(deactivateCustomer)}
        onClose={() => setDeactivateCustomer(null)}
        title="Deactivate Customer"
        description={`Are you sure you want to deactivate ${deactivateCustomer?.name} (${deactivateCustomer?.company_name})? Their existing subscriptions and invoices will remain intact, but new subscriptions cannot be created.`}
        confirmText="Deactivate"
        confirmVariant="danger"
        loading={deactivateMutation.isPending}
        onConfirm={() => deactivateMutation.mutate(deactivateCustomer.id)}
      />
    </div>
  );
}
