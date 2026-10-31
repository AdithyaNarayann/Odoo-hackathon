import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  User,
  Building,
  Mail,
  Phone,
  MapPin,
  KeyRound,
  Save,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { api } from '../../api/client';
import { formatDate } from '../../utils/format';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Skeleton from '../../components/ui/Skeleton';

export default function CustomerProfilePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  // 1. Fetch own customer profile
  const { data: profile, isLoading } = useQuery({
    queryKey: ['portal-profile'],
    queryFn: () => api.get('/api/portal/me'),
  });

  // Contact & Billing Address form state
  const [formData, setFormData] = useState({
    name: '',
    company_name: '',
    phone: '',
    tax_id: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'India',
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || '',
        company_name: profile.company_name || '',
        phone: profile.phone || '',
        tax_id: profile.tax_id || '',
        address_line1: profile.address_line1 || '',
        address_line2: profile.address_line2 || '',
        city: profile.city || '',
        state: profile.state || '',
        postal_code: profile.postal_code || '',
        country: profile.country || 'India',
      });
    }
  }, [profile]);

  // Update Profile Mutation
  const updateProfileMutation = useMutation({
    mutationFn: (payload) => api.put('/api/portal/me', payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(['portal-profile'], updated);
      success('Contact and billing address updated.');
    },
    onError: (err) => toastError(err.detail || 'Failed to update profile.'),
  });

  // Change Password State
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
      match: { label: 'Passwords match', passed: matches },
      allPassed: isLengthValid && hasUpper && hasLower && hasSpecial && matches,
    };
  }, [newPassword, confirmPassword]);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!passwordRules.allPassed) {
      toastError('Please satisfy all password security requirements.');
      return;
    }
    setPasswordSubmitting(true);
    try {
      await api.post('/api/auth/change-password', {
        old_password: oldPassword,
        new_password: newPassword,
      });
      success('Password updated successfully.');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toastError(err.detail || 'Failed to update password.');
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const handleProfileSubmit = (e) => {
    e.preventDefault();
    updateProfileMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="font-anton text-3xl uppercase tracking-wider text-ink">
          MY PROFILE & BILLING
        </h1>
        <p className="font-archivo text-xs font-bold uppercase tracking-wide text-ink/70 mt-1">
          Company identity, billing address for tax invoices, and account security
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contact & Billing Information Form */}
        <div className="bg-white border-2 border-ink rounded-[4px] p-6 shadow-neo">
          <h2 className="font-anton text-xl uppercase tracking-wider text-ink pb-2 mb-4 border-b-2 border-ink/10 flex items-center gap-2">
            <Building size={20} className="text-brand-orange" />
            <span>Company & Billing Address</span>
          </h2>

          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <Input
              label="Contact Person Name *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />

            <Input
              label="Company Name *"
              value={formData.company_name}
              onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Registered Email"
                value={profile?.email || user?.email || ''}
                disabled
              />

              <Input
                label="Phone Number"
                placeholder="+91 98765 43210"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <Input
              label="GSTIN / Tax ID"
              placeholder="e.g. 29ABCDE1234F1Z5"
              value={formData.tax_id}
              onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
            />

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

            <div className="grid grid-cols-3 gap-2">
              <Input
                label="City"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />
              <Input
                label="State"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              />
              <Input
                label="Postal Code"
                value={formData.postal_code}
                onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              loading={updateProfileMutation.isPending}
              className="w-full justify-center mt-2"
            >
              <Save size={16} />
              <span>Save Contact Details</span>
            </Button>
          </form>
        </div>

        {/* Change Password Card */}
        <div className="bg-cream-light border-2 border-ink rounded-[4px] p-6 shadow-neo flex flex-col justify-between">
          <div>
            <h2 className="font-anton text-xl uppercase tracking-wider text-ink pb-2 mb-4 border-b-2 border-ink/10 flex items-center gap-2">
              <KeyRound size={20} className="text-brand-teal" />
              <span>Change Portal Password</span>
            </h2>

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

          <div className="mt-6 pt-4 border-t border-ink/10 text-xs text-ink/60">
            Account created on {formatDate(profile?.created_at)}. Your account is secured with single-tenant isolation.
          </div>
        </div>
      </div>
    </div>
  );
}
