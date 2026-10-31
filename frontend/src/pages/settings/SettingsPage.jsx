import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  User,
  ShieldCheck,
  Percent,
  Users,
  Plus,
  KeyRound,
  Edit2,
  Trash2,
  CheckCircle2,
  Circle,
  AlertCircle,
  Mail,
  Lock,
} from 'lucide-react';
import { api } from '../../api/client';
import { formatDate } from '../../utils/format';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Tabs from '../../components/ui/Tabs';
import DataTable from '../../components/ui/DataTable';
import Pagination from '../../components/ui/Pagination';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Toggle from '../../components/ui/Toggle';

export default function SettingsPage() {
  const { user, role } = useAuth();
  const isAdmin = role === 'admin';
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const [activeTab, setActiveTab] = useState('profile');

  // ----------------------------------------------------
  // PROFILE & CHANGE PASSWORD STATE
  // ----------------------------------------------------
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  const passwordRules = useMemo(() => {
    const isLengthValid = newPassword.length > 8;
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasLower = /[a-z]/.test(newPassword);
    const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
    const matches = newPassword.length > 0 && newPassword === confirmPassword;

    return {
      length: { label: 'More than 8 characters', passed: isLengthValid },
      upper: { label: 'At least one uppercase letter', passed: hasUpper },
      lower: { label: 'At least one lowercase letter', passed: hasLower },
      special: { label: 'At least one special character', passed: hasSpecial },
      match: { label: 'New passwords match', passed: matches },
      allPassed: isLengthValid && hasUpper && hasLower && hasSpecial && matches,
    };
  }, [newPassword, confirmPassword]);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!passwordRules.allPassed) {
      toastError('Please satisfy all password rules.');
      return;
    }
    setPasswordSubmitting(true);
    try {
      await api.post('/api/auth/change-password', {
        old_password: oldPassword,
        new_password: newPassword,
      });
      success('Password changed successfully.');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toastError(err.detail || 'Failed to change password.');
    } finally {
      setPasswordSubmitting(false);
    }
  };

  // ----------------------------------------------------
  // TAXES (ADMIN ONLY)
  // ----------------------------------------------------
  const [taxModalOpen, setTaxModalOpen] = useState(false);
  const [editingTax, setEditingTax] = useState(null);
  const [deactivateTax, setDeactivateTax] = useState(null);
  const [taxFormData, setTaxFormData] = useState({
    name: '',
    rate_pct: '18',
    scope: 'all',
    scope_value: '',
    is_active: true,
  });

  const { data: taxesData, isLoading: taxesLoading } = useQuery({
    queryKey: ['taxes'],
    queryFn: () => api.get('/api/taxes?page_size=50'),
    enabled: isAdmin,
  });

  const { data: productsData } = useQuery({
    queryKey: ['products-for-taxes'],
    queryFn: () => api.get('/api/products?is_active=true&page_size=100'),
    enabled: isAdmin,
  });

  const createTaxMutation = useMutation({
    mutationFn: (payload) => api.post('/api/taxes', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxes'] });
      success('Tax rule created.');
      setTaxModalOpen(false);
    },
    onError: (err) => toastError(err.detail || 'Failed to create tax rule.'),
  });

  const updateTaxMutation = useMutation({
    mutationFn: ({ id, payload }) => api.put(`/api/taxes/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxes'] });
      success('Tax rule updated.');
      setTaxModalOpen(false);
    },
    onError: (err) => toastError(err.detail || 'Failed to update tax rule.'),
  });

  const deactivateTaxMutation = useMutation({
    mutationFn: (id) => api.delete(`/api/taxes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxes'] });
      success('Tax rule deactivated.');
      setDeactivateTax(null);
    },
    onError: (err) => toastError(err.detail || 'Failed to deactivate tax rule.'),
  });

  const reactivateTaxMutation = useMutation({
    mutationFn: (id) => api.put(`/api/taxes/${id}`, { is_active: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxes'] });
      success('Tax rule reactivated.');
    },
    onError: (err) => toastError(err.detail || 'Failed to reactivate tax rule.'),
  });

  const openCreateTax = () => {
    setTaxFormData({
      name: '',
      rate_pct: '18',
      scope: 'all',
      scope_value: '',
      is_active: true,
    });
    setEditingTax(null);
    setTaxModalOpen(true);
  };

  const openEditTax = (tax) => {
    setEditingTax(tax);
    setTaxFormData({
      name: tax.name,
      rate_pct: (tax.rate / 100).toString(),
      scope: tax.scope,
      scope_value: tax.scope_value || '',
      is_active: tax.is_active,
    });
    setTaxModalOpen(true);
  };

  const handleTaxSubmit = (e) => {
    e.preventDefault();
    if (!taxFormData.name.trim()) {
      toastError('Tax rule name is required.');
      return;
    }
    const rateBps = Math.round((parseFloat(taxFormData.rate_pct) || 0) * 100);
    const payload = {
      name: taxFormData.name.trim(),
      rate: rateBps,
      scope: taxFormData.scope,
      scope_value: taxFormData.scope === 'all' ? null : taxFormData.scope_value || null,
      is_active: taxFormData.is_active,
    };

    if (editingTax) {
      updateTaxMutation.mutate({ id: editingTax.id, payload });
    } else {
      createTaxMutation.mutate(payload);
    }
  };

  const taxColumns = [
    {
      key: 'name',
      label: 'Rule Name',
      sortable: true,
      render: (val, row) => <span className="font-archivo font-extrabold text-ink">{val}</span>,
    },
    {
      key: 'rate',
      label: 'Tax Rate',
      render: (val) => (
        <span className="font-anton text-ink text-sm">
          {(val / 100).toFixed(2)}%
        </span>
      ),
    },
    {
      key: 'scope',
      label: 'Scope & Priority',
      render: (val, row) => (
        <div className="text-xs">
          <span className="font-bold text-ink capitalize">
            {val === 'all' ? 'All Products (Default)' : `By ${val}`}
          </span>
          {row.scope_value && (
            <span className="text-ink/60 ml-1">({row.scope_value})</span>
          )}
        </div>
      ),
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (val) => (
        <span
          className={`
            inline-flex items-center px-2 py-0.5 rounded-[3px] text-[10px] font-archivo font-extrabold uppercase border
            ${val ? 'bg-brand-teal/15 text-brand-teal border-brand-teal' : 'bg-zinc-200 text-zinc-600 border-zinc-400'}
          `}
        >
          {val ? 'Active' : 'Inactive'}
        </span>
      ),
    },
  ];

  const taxActions = [
    {
      label: 'Edit Tax',
      icon: Edit2,
      onClick: (row) => openEditTax(row),
    },
    {
      label: 'Deactivate',
      icon: Trash2,
      danger: true,
      onClick: (row) => {
        if (!row.is_active) {
          reactivateTaxMutation.mutate(row.id);
        } else {
          setDeactivateTax(row);
        }
      },
    },
  ];

  // ----------------------------------------------------
  // STAFF MEMBERS (ADMIN ONLY)
  // ----------------------------------------------------
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [staffFormData, setStaffFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    is_active: true,
  });

  const { data: staffData, isLoading: staffLoading } = useQuery({
    queryKey: ['staff-members'],
    queryFn: () => api.get('/api/staff?page_size=50'),
    enabled: isAdmin,
  });

  const createStaffMutation = useMutation({
    mutationFn: (payload) => api.post('/api/staff', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-members'] });
      success('Staff member created.');
      setStaffModalOpen(false);
    },
    onError: (err) => toastError(err.detail || 'Failed to create staff member.'),
  });

  const updateStaffMutation = useMutation({
    mutationFn: ({ id, payload }) => api.put(`/api/staff/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-members'] });
      success('Staff member updated.');
      setStaffModalOpen(false);
    },
    onError: (err) => toastError(err.detail || 'Failed to update staff member.'),
  });

  const toggleStaffActiveMutation = useMutation({
    mutationFn: ({ id, is_active }) => api.put(`/api/staff/${id}`, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-members'] });
      success('Staff member status updated.');
    },
    onError: (err) => toastError(err.detail || 'Failed to update status.'),
  });

  const openCreateStaff = () => {
    setStaffFormData({
      full_name: '',
      email: '',
      password: '',
      is_active: true,
    });
    setEditingStaff(null);
    setStaffModalOpen(true);
  };

  const openEditStaff = (st) => {
    setEditingStaff(st);
    setStaffFormData({
      full_name: st.full_name,
      email: st.email,
      password: '',
      is_active: st.is_active,
    });
    setStaffModalOpen(true);
  };

  const handleStaffSubmit = (e) => {
    e.preventDefault();
    if (!staffFormData.full_name.trim()) {
      toastError('Staff member name is required.');
      return;
    }

    if (editingStaff) {
      const payload = {
        full_name: staffFormData.full_name.trim(),
        is_active: staffFormData.is_active,
      };
      if (staffFormData.password.trim()) {
        payload.password = staffFormData.password.trim();
      }
      updateStaffMutation.mutate({ id: editingStaff.id, payload });
    } else {
      if (!staffFormData.email.trim() || !staffFormData.password) {
        toastError('Email and initial password are required.');
        return;
      }
      createStaffMutation.mutate({
        full_name: staffFormData.full_name.trim(),
        email: staffFormData.email.trim().toLowerCase(),
        password: staffFormData.password,
        is_active: staffFormData.is_active,
      });
    }
  };

  const staffColumns = [
    {
      key: 'full_name',
      label: 'Staff Member',
      sortable: true,
      render: (val, row) => (
        <div>
          <div className="font-archivo font-extrabold text-ink">{val}</div>
          <div className="text-[11px] text-ink/70 flex items-center gap-1 mt-0.5">
            <Mail size={12} />
            <span>{row.email}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (val) => (
        <span
          className={`
            inline-flex items-center px-2 py-0.5 rounded-[3px] text-[10px] font-archivo font-extrabold uppercase border
            ${val ? 'bg-brand-teal/15 text-brand-teal border-brand-teal' : 'bg-zinc-200 text-zinc-600 border-zinc-400'}
          `}
        >
          {val ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'created_at',
      label: 'Joined',
      render: (val) => formatDate(val),
    },
  ];

  const staffActions = [
    {
      label: 'Edit Staff Details',
      icon: Edit2,
      onClick: (row) => openEditStaff(row),
    },
    {
      label: 'Toggle Active',
      icon: ShieldCheck,
      onClick: (row) =>
        toggleStaffActiveMutation.mutate({ id: row.id, is_active: !row.is_active }),
    },
  ];

  // Configure tabs
  const tabs = [
    { id: 'profile', label: 'My Profile' },
    ...(isAdmin
      ? [
          { id: 'taxes', label: 'Tax Rules', count: taxesData?.total || 0 },
          { id: 'staff', label: 'Staff Management', count: staffData?.total || 0 },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="font-anton text-3xl uppercase tracking-wider text-ink">
          SETTINGS & PREFERENCES
        </h1>
        <p className="font-archivo text-xs font-bold uppercase tracking-wide text-ink/70 mt-1">
          Profile security, tax rate policies, and organization team access
        </p>
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* TAB 1: PROFILE */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Identity Card */}
          <div className="bg-white border-2 border-ink rounded-[4px] p-6 shadow-neo">
            <h3 className="font-anton text-xl uppercase tracking-wider text-ink mb-4 pb-2 border-b-2 border-ink/10 flex items-center gap-2">
              <User size={20} className="text-brand-orange" />
              <span>User Profile</span>
            </h3>

            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-[4px] bg-brand-orange text-white border-2 border-ink shadow-neo font-anton text-3xl flex items-center justify-center">
                {user?.full_name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-anton text-2xl uppercase tracking-wide text-ink">
                  {user?.full_name}
                </div>
                <div className="text-xs text-ink/70 font-bold">{user?.email}</div>
                <div className="mt-1.5">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-[3px] text-[10px] font-archivo font-extrabold uppercase border bg-brand-teal/15 text-brand-teal border-brand-teal">
                    {user?.role}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-ink/10 text-xs">
              <div className="flex justify-between py-1">
                <span className="font-archivo font-extrabold uppercase text-ink/60">Account ID</span>
                <span className="font-mono font-bold text-ink">#{user?.id}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="font-archivo font-extrabold uppercase text-ink/60">Registered Role</span>
                <span className="font-bold text-ink uppercase">{user?.role}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="font-archivo font-extrabold uppercase text-ink/60">Joined Platform</span>
                <span className="font-bold text-ink">{formatDate(user?.created_at)}</span>
              </div>
            </div>
          </div>

          {/* Change Password Card with Live Rules */}
          <div className="bg-cream-light border-2 border-ink rounded-[4px] p-6 shadow-neo">
            <h3 className="font-anton text-xl uppercase tracking-wider text-ink mb-4 pb-2 border-b-2 border-ink/10 flex items-center gap-2">
              <KeyRound size={20} className="text-brand-teal" />
              <span>Change Password</span>
            </h3>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <Input
                label="Current Password"
                type="password"
                placeholder="••••••••••••"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                icon={Lock}
                required
              />

              <Input
                label="New Password"
                type="password"
                placeholder="••••••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                icon={Lock}
                required
              />

              <Input
                label="Confirm New Password"
                type="password"
                placeholder="••••••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                icon={Lock}
                required
              />

              {/* Password Rules Checklist */}
              <div className="p-3 bg-white border-2 border-ink rounded-[4px] shadow-neo-sm space-y-1.5">
                <div className="text-[11px] font-archivo font-extrabold uppercase tracking-wider text-ink mb-1">
                  Password Security Policy:
                </div>
                {[
                  passwordRules.length,
                  passwordRules.upper,
                  passwordRules.lower,
                  passwordRules.special,
                  passwordRules.match,
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    {item.passed ? (
                      <CheckCircle2 size={13} className="text-brand-teal shrink-0" />
                    ) : (
                      <Circle size={13} className="text-ink/40 shrink-0" />
                    )}
                    <span className={item.passed ? 'text-ink font-semibold' : 'text-ink/60'}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>

              <Button
                type="submit"
                variant="primary"
                disabled={passwordSubmitting || !passwordRules.allPassed || !oldPassword}
                className="w-full justify-center"
              >
                <span>{passwordSubmitting ? 'Updating...' : 'Update Password'}</span>
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: TAXES (ADMIN ONLY) */}
      {isAdmin && activeTab === 'taxes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-ink/70 font-archivo font-bold uppercase">
              Configure jurisdiction tax rates applied across customer invoices
            </p>
            <Button variant="primary" onClick={openCreateTax}>
              <Plus size={16} strokeWidth={3} />
              <span>Add Tax Rule</span>
            </Button>
          </div>

          <DataTable
            columns={taxColumns}
            data={taxesData?.items || []}
            loading={taxesLoading}
            rowActions={taxActions}
            emptyTitle="No Tax Rules Configured"
            emptyMessage="Create a tax rate rule to calculate GST / VAT on subscription invoices."
          />

          {/* Create / Edit Tax Modal */}
          <Modal
            isOpen={taxModalOpen}
            onClose={() => setTaxModalOpen(false)}
            title={editingTax ? 'Edit Tax Rule' : 'Create Tax Rule'}
            confirmText={editingTax ? 'Save Changes' : 'Create Tax Rule'}
            confirmVariant="primary"
            icon={Percent}
            loading={createTaxMutation.isPending || updateTaxMutation.isPending}
            onConfirm={handleTaxSubmit}
          >
            <form onSubmit={handleTaxSubmit} className="space-y-4">
              <Input
                label="Rule Name"
                placeholder="e.g. Standard GST 18%"
                value={taxFormData.name}
                onChange={(e) => setTaxFormData({ ...taxFormData, name: e.target.value })}
                required
              />

              <Input
                label="Tax Rate Percentage (%)"
                type="number"
                step="0.01"
                placeholder="18"
                value={taxFormData.rate_pct}
                onChange={(e) => setTaxFormData({ ...taxFormData, rate_pct: e.target.value })}
                required
              />

              <div>
                <label className="block text-xs font-archivo font-extrabold uppercase tracking-wider text-ink mb-1.5">
                  Application Scope
                </label>
                <select
                  value={taxFormData.scope}
                  onChange={(e) => setTaxFormData({ ...taxFormData, scope: e.target.value })}
                  className="w-full px-3 py-2 bg-white border-2 border-ink rounded-[4px] text-xs font-archivo font-bold text-ink shadow-neo-sm focus:outline-none"
                >
                  <option value="all">Global (All Products - Lowest Priority)</option>
                  <option value="product_type">By Product Type (Standard vs Add-on)</option>
                  <option value="product">By Specific Product (Highest Priority)</option>
                </select>
              </div>

              {taxFormData.scope === 'product_type' && (
                <div>
                  <label className="block text-xs font-archivo font-extrabold uppercase tracking-wider text-ink mb-1.5">
                    Target Product Type
                  </label>
                  <select
                    value={taxFormData.scope_value}
                    onChange={(e) => setTaxFormData({ ...taxFormData, scope_value: e.target.value })}
                    className="w-full px-3 py-2 bg-white border-2 border-ink rounded-[4px] text-xs font-archivo font-bold text-ink shadow-neo-sm focus:outline-none"
                  >
                    <option value="standard">Standard Products</option>
                    <option value="add_on">Add-ons</option>
                  </select>
                </div>
              )}

              {taxFormData.scope === 'product' && (
                <div>
                  <label className="block text-xs font-archivo font-extrabold uppercase tracking-wider text-ink mb-1.5">
                    Target Product
                  </label>
                  <select
                    value={taxFormData.scope_value}
                    onChange={(e) => setTaxFormData({ ...taxFormData, scope_value: e.target.value })}
                    className="w-full px-3 py-2 bg-white border-2 border-ink rounded-[4px] text-xs font-archivo font-bold text-ink shadow-neo-sm focus:outline-none"
                  >
                    <option value="">Select product...</option>
                    {productsData?.items?.map((p) => (
                      <option key={p.id} value={p.id.toString()}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </form>
          </Modal>

          {/* Deactivate Tax Modal */}
          <Modal
            isOpen={Boolean(deactivateTax)}
            onClose={() => setDeactivateTax(null)}
            title="Deactivate Tax Rule"
            description={`Are you sure you want to deactivate "${deactivateTax?.name}"?`}
            confirmText="Deactivate"
            confirmVariant="danger"
            loading={deactivateTaxMutation.isPending}
            onConfirm={() => deactivateTaxMutation.mutate(deactivateTax.id)}
          />
        </div>
      )}

      {/* TAB 3: STAFF (ADMIN ONLY) */}
      {isAdmin && activeTab === 'staff' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-ink/70 font-archivo font-bold uppercase">
              Manage organization staff credentials and workspace access
            </p>
            <Button variant="primary" onClick={openCreateStaff}>
              <Plus size={16} strokeWidth={3} />
              <span>Add Staff Member</span>
            </Button>
          </div>

          <DataTable
            columns={staffColumns}
            data={staffData?.items || []}
            loading={staffLoading}
            rowActions={staffActions}
            emptyTitle="No Staff Members Found"
            emptyMessage="Invite or add your first organization staff member."
          />

          {/* Create / Edit Staff Modal */}
          <Modal
            isOpen={staffModalOpen}
            onClose={() => setStaffModalOpen(false)}
            title={editingStaff ? 'Edit Staff Member' : 'Add Staff Member'}
            confirmText={editingStaff ? 'Save Changes' : 'Create Staff Member'}
            confirmVariant="primary"
            icon={Users}
            loading={createStaffMutation.isPending || updateStaffMutation.isPending}
            onConfirm={handleStaffSubmit}
          >
            <form onSubmit={handleStaffSubmit} className="space-y-4">
              <Input
                label="Full Name"
                placeholder="e.g. Priyanshu Sharma"
                value={staffFormData.full_name}
                onChange={(e) => setStaffFormData({ ...staffFormData, full_name: e.target.value })}
                required
              />

              {!editingStaff && (
                <Input
                  label="Email Address"
                  type="email"
                  placeholder="staff@company.com"
                  value={staffFormData.email}
                  onChange={(e) => setStaffFormData({ ...staffFormData, email: e.target.value })}
                  required
                />
              )}

              <Input
                label={editingStaff ? 'Change Password (leave blank to keep current)' : 'Initial Password'}
                type="password"
                placeholder="••••••••••••"
                value={staffFormData.password}
                onChange={(e) => setStaffFormData({ ...staffFormData, password: e.target.value })}
                required={!editingStaff}
              />

              <div className="flex items-center justify-between p-3 bg-cream-light border-2 border-ink rounded-[4px] shadow-neo-sm">
                <div>
                  <div className="text-xs font-archivo font-extrabold uppercase text-ink">
                    Active Account Status
                  </div>
                  <div className="text-[11px] text-ink/70">
                    Controls ability to sign in to the platform
                  </div>
                </div>
                <Toggle
                  checked={staffFormData.is_active}
                  onChange={(val) => setStaffFormData({ ...staffFormData, is_active: val })}
                />
              </div>
            </form>
          </Modal>
        </div>
      )}
    </div>
  );
}
