import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Layers,
  Eye,
  CheckCircle2,
  Pause,
  Play,
  XCircle,
  RefreshCw,
  Building,
  Clock,
  Calendar,
  AlertCircle,
  FolderOpen,
} from 'lucide-react';
import { api } from '../../api/client';
import { formatPaise, formatDate } from '../../utils/format';
import { useToast } from '../../context/ToastContext';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';

export default function CustomerSubscriptionsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const [renewModalOpen, setRenewModalOpen] = useState(false);
  const [selectedSub, setSelectedSub] = useState(null);
  const [renewPeriods, setRenewPeriods] = useState(1);
  const [closeModalOpen, setCloseModalOpen] = useState(false);

  // Fetch customer subscriptions (backend automatically excludes draft status)
  const { data, isLoading } = useQuery({
    queryKey: ['portal-subscriptions'],
    queryFn: () => api.get('/api/subscriptions?page_size=50'),
  });

  // Action Mutations
  const confirmMutation = useMutation({
    mutationFn: (subId) => api.post(`/api/subscriptions/${subId}/status`, { status: 'confirmed', note: 'Customer accepted quotation.' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-subscriptions'] });
      success('Quotation accepted and order confirmed!');
    },
    onError: (err) => toastError(err.detail || 'Failed to accept quotation.'),
  });

  const pauseMutation = useMutation({
    mutationFn: (subId) => api.post(`/api/subscriptions/${subId}/pause`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-subscriptions'] });
      success('Subscription has been paused.');
    },
    onError: (err) => toastError(err.detail || 'Failed to pause subscription.'),
  });

  const resumeMutation = useMutation({
    mutationFn: (subId) => api.post(`/api/subscriptions/${subId}/resume`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-subscriptions'] });
      success('Subscription resumed.');
    },
    onError: (err) => toastError(err.detail || 'Failed to resume subscription.'),
  });

  const renewMutation = useMutation({
    mutationFn: ({ subId, periods }) => api.post(`/api/subscriptions/${subId}/renew`, { periods }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-subscriptions'] });
      success('Subscription renewed.');
      setRenewModalOpen(false);
      setSelectedSub(null);
    },
    onError: (err) => toastError(err.detail || 'Failed to renew subscription.'),
  });

  const closeMutation = useMutation({
    mutationFn: (subId) => api.post(`/api/subscriptions/${subId}/status`, { status: 'closed', note: 'Closed by customer.' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-subscriptions'] });
      success('Subscription closed.');
      setCloseModalOpen(false);
      setSelectedSub(null);
    },
    onError: (err) => toastError(err.detail || 'Failed to close subscription.'),
  });

  const columns = [
    {
      key: 'number',
      label: 'Subscription #',
      render: (val, row) => (
        <span
          onClick={() => navigate(`/subscriptions/${row.id}`)}
          className="font-archivo font-extrabold text-ink hover:text-brand-orange cursor-pointer"
        >
          {val}
        </span>
      ),
    },
    {
      key: 'plan_name',
      label: 'Subscription Plan',
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
      key: 'recurring_subtotal',
      label: 'Recurring Fee',
      align: 'right',
      render: (val, row) => (
        <div className="text-right">
          <div className="font-anton text-ink tabular-nums text-sm">
            {formatPaise(val)}
          </div>
          <div className="text-[10px] text-ink/60 uppercase font-bold">
            per {row.plan_billing_period}
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
      key: 'next_billing_date',
      label: 'Next Billing',
      render: (val) => formatDate(val),
    },
    {
      key: 'expiry_date',
      label: 'Expiry Date',
      render: (val) => formatDate(val),
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1.5">
          {row.status === 'quotation' && (
            <Button
              variant="success"
              className="py-1 px-2 text-[11px]"
              loading={confirmMutation.isPending}
              onClick={() => confirmMutation.mutate(row.id)}
            >
              <CheckCircle2 size={13} />
              <span>Accept</span>
            </Button>
          )}

          {row.status === 'active' && !row.is_paused && (
            <Button
              variant="secondary"
              className="py-1 px-2 text-[11px]"
              loading={pauseMutation.isPending}
              onClick={() => pauseMutation.mutate(row.id)}
            >
              <Pause size={13} />
              <span>Pause</span>
            </Button>
          )}

          {row.status === 'active' && row.is_paused && (
            <Button
              variant="primary"
              className="py-1 px-2 text-[11px]"
              loading={resumeMutation.isPending}
              onClick={() => resumeMutation.mutate(row.id)}
            >
              <Play size={13} />
              <span>Resume</span>
            </Button>
          )}

          {(row.status === 'active' || row.status === 'closed') && (
            <Button
              variant="secondary"
              className="py-1 px-2 text-[11px]"
              onClick={() => {
                setSelectedSub(row);
                setRenewModalOpen(true);
              }}
            >
              <RefreshCw size={13} />
              <span>Renew</span>
            </Button>
          )}

          {row.status === 'active' && (
            <Button
              variant="ghost"
              className="py-1 px-2 text-[11px] text-red-600 hover:bg-red-50"
              onClick={() => {
                setSelectedSub(row);
                setCloseModalOpen(true);
              }}
            >
              <XCircle size={13} />
              <span>Close</span>
            </Button>
          )}

          <Button
            variant="ghost"
            className="py-1 px-2 text-[11px]"
            onClick={() => navigate(`/subscriptions/${row.id}`)}
          >
            <Eye size={13} />
            <span>Details</span>
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-anton text-3xl uppercase tracking-wider text-ink">
          MY SUBSCRIPTIONS
        </h1>
        <p className="font-archivo text-xs font-bold uppercase tracking-wide text-ink/70 mt-1">
          Active contracts, service packages, and recurring billing schedules
        </p>
      </div>

      {/* Main Content */}
      {!isLoading && (!data?.items || data.items.length === 0) ? (
        <EmptyState
          title="No Active Subscriptions"
          description="Your dedicated account manager will set up your subscription shortly. Check back soon or contact support for assistance."
        />
      ) : (
        <DataTable
          columns={columns}
          data={data?.items || []}
          loading={isLoading}
          emptyTitle="No Subscriptions Found"
        />
      )}

      {/* Renew Modal */}
      <Modal
        isOpen={renewModalOpen}
        onClose={() => setRenewModalOpen(false)}
        title="Renew Subscription"
        confirmText="Confirm Renewal"
        confirmVariant="primary"
        icon={RefreshCw}
        loading={renewMutation.isPending}
        onConfirm={() => {
          if (selectedSub) {
            renewMutation.mutate({
              subId: selectedSub.id,
              periods: parseInt(renewPeriods, 10) || 1,
            });
          }
        }}
      >
        <div className="space-y-4">
          <p className="text-xs text-ink/80">
            Extend contract term for <strong>{selectedSub?.number}</strong> ({selectedSub?.plan_name}):
          </p>
          <Input
            label="Number of Billing Cycles"
            type="number"
            min="1"
            max="36"
            value={renewPeriods}
            onChange={(e) => setRenewPeriods(e.target.value)}
            required
          />
        </div>
      </Modal>

      {/* Close Confirm Modal */}
      <Modal
        isOpen={closeModalOpen}
        onClose={() => setCloseModalOpen(false)}
        title="Close Subscription Contract"
        description={`Are you sure you want to cancel subscription ${selectedSub?.number}? Recurring billing will cease at the end of the current term.`}
        confirmText="Confirm Close"
        confirmVariant="danger"
        loading={closeMutation.isPending}
        onConfirm={() => {
          if (selectedSub) closeMutation.mutate(selectedSub.id);
        }}
      />
    </div>
  );
}
