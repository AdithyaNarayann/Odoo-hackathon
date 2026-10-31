import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  Calendar,
  Layers,
  Receipt,
  CreditCard,
  AlertTriangle,
  Send,
  Eye,
  TrendingUp,
  Filter,
  DollarSign,
  PieChart,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts';
import { api } from '../../api/client';
import { formatPaise, formatPaiseCompact, formatDate } from '../../utils/format';
import { useToast } from '../../context/ToastContext';
import StatCard from '../../components/ui/StatCard';
import Tabs from '../../components/ui/Tabs';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Skeleton from '../../components/ui/Skeleton';

export default function ReportsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const [activeTab, setActiveTab] = useState('subscriptions');
  const [months, setMonths] = useState(8);

  // Filters State
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  // 1. Fetch Customers and Plans for Filter Dropdowns
  const { data: customersData } = useQuery({
    queryKey: ['customers-dropdown'],
    queryFn: () => api.get('/api/customers?is_active=true&page_size=100'),
  });

  const { data: plansData } = useQuery({
    queryKey: ['plans-dropdown'],
    queryFn: () => api.get('/api/plans?is_active=true&page_size=100'),
  });

  // 2. Fetch Summary Report with Filters
  const summaryParams = new URLSearchParams();
  if (fromDate) summaryParams.set('from', fromDate);
  if (toDate) summaryParams.set('to', toDate);
  if (selectedPlanId) summaryParams.set('plan_id', selectedPlanId);
  if (selectedCustomerId) summaryParams.set('customer_id', selectedCustomerId);

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['reports-summary', summaryParams.toString()],
    queryFn: () => api.get(`/api/reports/summary?${summaryParams.toString()}`),
  });

  // 3. Fetch Monthly Revenue History
  const { data: revenueData, isLoading: revenueLoading } = useQuery({
    queryKey: ['reports-revenue', months],
    queryFn: () => api.get(`/api/reports/revenue-by-month?months=${months}`),
  });

  // 4. Tab Data Queries
  const { data: subsData, isLoading: subsLoading } = useQuery({
    queryKey: ['reports-tab-subs', selectedCustomerId, selectedPlanId],
    queryFn: () => {
      const q = new URLSearchParams({ page_size: '25' });
      if (selectedCustomerId) q.set('customer', selectedCustomerId);
      if (selectedPlanId) q.set('plan', selectedPlanId);
      return api.get(`/api/subscriptions?${q.toString()}`);
    },
    enabled: activeTab === 'subscriptions',
  });

  const { data: invoicesData, isLoading: invoicesLoading } = useQuery({
    queryKey: ['reports-tab-invoices', selectedCustomerId, fromDate, toDate],
    queryFn: () => {
      const q = new URLSearchParams({ page_size: '25' });
      if (selectedCustomerId) q.set('customer', selectedCustomerId);
      if (fromDate) q.set('start_date', fromDate);
      if (toDate) q.set('end_date', toDate);
      return api.get(`/api/invoices?${q.toString()}`);
    },
    enabled: activeTab === 'invoices',
  });

  const { data: paymentsData, isLoading: paymentsLoading } = useQuery({
    queryKey: ['reports-tab-payments', selectedCustomerId, fromDate, toDate],
    queryFn: () => {
      const q = new URLSearchParams({ page_size: '25' });
      if (selectedCustomerId) q.set('customer_id', selectedCustomerId);
      if (fromDate) q.set('from_date', fromDate);
      if (toDate) q.set('to_date', toDate);
      return api.get(`/api/payments?${q.toString()}`);
    },
    enabled: activeTab === 'payments',
  });

  const { data: overdueData, isLoading: overdueLoading } = useQuery({
    queryKey: ['reports-tab-overdue', selectedCustomerId],
    queryFn: () => {
      const q = new URLSearchParams({
        overdue: 'true',
        sort_by: 'due_date',
        sort_order: 'asc',
        page_size: '50',
      });
      if (selectedCustomerId) q.set('customer', selectedCustomerId);
      return api.get(`/api/invoices?${q.toString()}`);
    },
    enabled: activeTab === 'overdue',
  });

  // Send Reminder Mutation
  const sendReminderMutation = useMutation({
    mutationFn: (invoiceId) => api.post(`/api/invoices/${invoiceId}/send`),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['reports-tab-overdue'] });
      success(`Payment reminder sent to ${updated.customer_email}.`);
    },
    onError: (err) => toastError(err.detail || 'Failed to send reminder email.'),
  });

  // Calculate revenue collected comparison
  const revDiff = useMemo(() => {
    if (!summary?.previous_period) return null;
    const current = summary.revenue_collected;
    const prev = summary.previous_period.revenue_collected;
    if (prev === 0) {
      return current > 0 ? { value: '+100%', positive: true, label: 'vs last period' } : null;
    }
    const pct = Math.round(((current - prev) / prev) * 100);
    return {
      value: `${pct >= 0 ? '+' : ''}${pct}%`,
      positive: pct >= 0,
      label: 'vs last period',
    };
  }, [summary]);

  const resetFilters = () => {
    setFromDate('');
    setToDate('');
    setSelectedPlanId('');
    setSelectedCustomerId('');
  };

  // Table Columns
  const subColumns = [
    {
      key: 'number',
      label: 'Subscription #',
      render: (val, row) => (
        <Link to={`/subscriptions/${row.id}`} className="font-archivo font-extrabold text-ink hover:text-brand-orange">
          {val}
        </Link>
      ),
    },
    { key: 'customer_name', label: 'Customer' },
    { key: 'plan_name', label: 'Plan' },
    {
      key: 'status',
      label: 'Status',
      render: (val, row) => <Badge status={row.is_paused ? 'paused' : val} isSubscription />,
    },
    {
      key: 'recurring_subtotal',
      label: 'Subtotal / Mo',
      align: 'right',
      render: (val) => <span className="font-anton tabular-nums text-ink">{formatPaise(val)}</span>,
    },
  ];

  const invColumns = [
    {
      key: 'number',
      label: 'Invoice #',
      render: (val, row) => (
        <Link to={`/invoices/${row.id}`} className="font-archivo font-extrabold text-ink hover:text-brand-orange">
          {val}
        </Link>
      ),
    },
    { key: 'customer_name', label: 'Customer' },
    { key: 'invoice_date', label: 'Date', render: (val) => formatDate(val) },
    {
      key: 'status',
      label: 'Status',
      render: (val, row) => <Badge status={row.is_overdue ? 'overdue' : val} isInvoice />,
    },
    {
      key: 'total',
      label: 'Total Amount',
      align: 'right',
      render: (val) => <span className="font-anton tabular-nums text-ink">{formatPaise(val)}</span>,
    },
    {
      key: 'balance',
      label: 'Balance',
      align: 'right',
      render: (val) => (
        <span className={`font-anton tabular-nums ${val > 0 ? 'text-brand-orange' : 'text-brand-teal'}`}>
          {formatPaise(val)}
        </span>
      ),
    },
  ];

  const payColumns = [
    { key: 'payment_date', label: 'Date', render: (val) => formatDate(val) },
    {
      key: 'invoice_number',
      label: 'Invoice #',
      render: (val, row) => (
        <Link to={`/invoices/${row.invoice_id}`} className="font-archivo font-extrabold text-ink hover:text-brand-orange">
          {val}
        </Link>
      ),
    },
    { key: 'customer_name', label: 'Customer' },
    {
      key: 'method',
      label: 'Method',
      render: (val) => (
        <span className="px-1.5 py-0.5 rounded-[2px] bg-cream border border-ink/40 text-[10px] font-archivo font-extrabold uppercase">
          {val?.replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      key: 'amount',
      label: 'Amount Paid',
      align: 'right',
      render: (val) => <span className="font-anton text-brand-teal tabular-nums">+{formatPaise(val)}</span>,
    },
  ];

  const overdueColumns = [
    {
      key: 'number',
      label: 'Invoice #',
      render: (val, row) => (
        <Link to={`/invoices/${row.id}`} className="font-archivo font-extrabold text-ink hover:text-brand-orange">
          {val}
        </Link>
      ),
    },
    { key: 'customer_name', label: 'Customer' },
    {
      key: 'due_date',
      label: 'Due Date',
      render: (val, row) => (
        <div className="text-red-600 font-bold">
          {formatDate(val)}
          <span className="ml-1 text-[10px] font-archivo font-extrabold uppercase">
            ({row.days_overdue}d overdue)
          </span>
        </div>
      ),
    },
    {
      key: 'balance',
      label: 'Overdue Amount',
      align: 'right',
      render: (val) => <span className="font-anton text-red-600 tabular-nums">{formatPaise(val)}</span>,
    },
    {
      key: 'actions',
      label: 'Action',
      align: 'right',
      render: (_, row) => (
        <Button
          variant="secondary"
          className="text-xs py-1"
          loading={sendReminderMutation.isPending}
          onClick={() => sendReminderMutation.mutate(row.id)}
        >
          <Send size={13} />
          <span>Send Reminder</span>
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-anton text-3xl uppercase tracking-wider text-ink">
          REPORTS & ANALYTICS
        </h1>
        <p className="font-archivo text-xs font-bold uppercase tracking-wide text-ink/70 mt-1">
          Revenue reconciliation, active portfolio metrics, and overdue receivables
        </p>
      </div>

      {/* Filter Bar */}
      <div className="bg-cream-light border-2 border-ink rounded-[4px] p-4 shadow-neo-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Plan Filter */}
          <select
            value={selectedPlanId}
            onChange={(e) => setSelectedPlanId(e.target.value)}
            className="px-3 py-2 bg-white border-2 border-ink rounded-[4px] text-xs font-archivo font-bold text-ink shadow-neo-sm focus:outline-none"
          >
            <option value="">All Subscription Plans</option>
            {plansData?.items?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {/* Customer Filter */}
          <select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="px-3 py-2 bg-white border-2 border-ink rounded-[4px] text-xs font-archivo font-bold text-ink shadow-neo-sm focus:outline-none"
          >
            <option value="">All Customers</option>
            {customersData?.items?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.company_name})
              </option>
            ))}
          </select>

          {/* Date range filters */}
          <div className="flex items-center gap-1.5 text-xs font-archivo font-bold text-ink">
            <span>From:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-2 py-1.5 bg-white border border-ink rounded text-xs font-semibold"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs font-archivo font-bold text-ink">
            <span>To:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-2 py-1.5 bg-white border border-ink rounded text-xs font-semibold"
            />
          </div>
        </div>

        {(fromDate || toDate || selectedPlanId || selectedCustomerId) && (
          <button
            type="button"
            onClick={resetFilters}
            className="text-xs font-bold text-brand-orange underline"
          >
            Reset All Filters
          </button>
        )}
      </div>

      {/* 6 StatCards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {summaryLoading ? (
          <>
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </>
        ) : (
          <>
            <StatCard
              title="Active Subs"
              value={summary?.active_subscriptions?.toLocaleString() ?? '0'}
              icon={Layers}
            />
            <StatCard
              highlight
              title="Monthly MRR"
              value={formatPaiseCompact(summary?.mrr ?? 0)}
              subvalue={`${formatPaise(summary?.mrr ?? 0)}`}
            />
            <StatCard
              title="Collected"
              value={formatPaiseCompact(summary?.revenue_collected ?? 0)}
              subvalue="In period"
              trend={revDiff || { value: '0%', positive: true }}
            />
            <StatCard
              title="Invoiced Total"
              value={formatPaiseCompact(summary?.invoiced_total ?? 0)}
              subvalue="Gross invoices"
            />
            <StatCard
              title="Outstanding"
              value={formatPaiseCompact(summary?.outstanding_amount ?? 0)}
              subvalue={`${summary?.outstanding_count ?? 0} invoices due`}
            />
            <StatCard
              title="Overdue Balance"
              value={formatPaiseCompact(summary?.overdue_amount ?? 0)}
              subvalue={`${summary?.overdue_count ?? 0} overdue`}
              trend={
                summary?.overdue_count > 0
                  ? { value: `${summary.overdue_count} overdue`, positive: false }
                  : { value: 'Clean', positive: true }
              }
            />
          </>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stacked Bar Chart */}
        <div className="lg:col-span-2 bg-cream-light border-2 border-ink rounded-[4px] p-5 shadow-neo flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="font-anton text-xl uppercase tracking-wider text-ink">
                REVENUE HISTORY
              </h2>
              <p className="text-xs text-ink/70 font-archivo uppercase">
                Historical monthly billing split by subscription plans vs add-on items
              </p>
            </div>

            <div className="flex items-center gap-1.5 bg-white border-2 border-ink rounded-[4px] p-1 shadow-neo-sm">
              {[6, 8, 12].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMonths(m)}
                  className={`px-2.5 py-1 text-xs font-archivo font-extrabold uppercase rounded-[2px] transition-all ${
                    months === m ? 'bg-brand-orange text-white shadow-neo-sm' : 'text-ink hover:bg-cream'
                  }`}
                >
                  Last {m}m
                </button>
              ))}
            </div>
          </div>

          <div className="h-64 w-full pt-2">
            {revenueLoading ? (
              <Skeleton className="h-full w-full" />
            ) : revenueData?.items && revenueData.items.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueData.items} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" strokeOpacity={0.15} />
                  <XAxis dataKey="month" tick={{ fill: '#1A1A1A', fontSize: 11, fontWeight: 700 }} />
                  <YAxis tickFormatter={(val) => formatPaiseCompact(val)} tick={{ fill: '#1A1A1A', fontSize: 11, fontWeight: 700 }} />
                  <RechartsTooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const subVal = payload.find((p) => p.dataKey === 'subscription')?.value || 0;
                        const addonVal = payload.find((p) => p.dataKey === 'addons')?.value || 0;
                        return (
                          <div className="bg-white border-2 border-ink rounded-[4px] p-3 shadow-neo-md text-xs font-archivo">
                            <div className="font-extrabold uppercase text-ink mb-1 border-b border-ink/20 pb-1">
                              Month: {label}
                            </div>
                            <div className="text-brand-orange font-bold">Subscription: {formatPaise(subVal)}</div>
                            <div className="text-brand-teal font-bold">Add-ons: {formatPaise(addonVal)}</div>
                            <div className="mt-1 pt-1 border-t border-ink/20 font-extrabold text-ink">
                              Total: {formatPaise(subVal + addonVal)}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend verticalAlign="bottom" height={36} />
                  <Bar dataKey="subscription" name="Subscription" stackId="rev" fill="#FF5B26" stroke="#1A1A1A" strokeWidth={1.5} />
                  <Bar dataKey="addons" name="Add-ons" stackId="rev" fill="#008080" stroke="#1A1A1A" strokeWidth={1.5} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs font-bold text-ink/50 uppercase">
                No revenue recorded
              </div>
            )}
          </div>
        </div>

        {/* Payments by Method Breakdown Card */}
        <div className="bg-cream-light border-2 border-ink rounded-[4px] p-5 shadow-neo flex flex-col justify-between">
          <div className="mb-4">
            <h2 className="font-anton text-xl uppercase tracking-wider text-ink">
              PAYMENTS BY METHOD
            </h2>
            <p className="text-xs text-ink/70 font-archivo uppercase">
              Distribution of collection channels
            </p>
          </div>

          <div className="space-y-3 flex-1 flex flex-col justify-center">
            {summary?.payments_by_method && Object.keys(summary.payments_by_method).length > 0 ? (
              Object.entries(summary.payments_by_method).map(([method, amount]) => {
                const totalCol = summary.revenue_collected || 1;
                const pct = Math.round((amount / totalCol) * 100);
                return (
                  <div key={method} className="p-2.5 bg-white border border-ink/30 rounded-[4px] shadow-neo-sm">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-archivo font-extrabold uppercase text-ink">
                        {method.replace(/_/g, ' ')}
                      </span>
                      <span className="font-anton text-brand-teal tabular-nums">
                        {formatPaise(amount)} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden border border-ink/20">
                      <div className="h-full bg-brand-orange" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-8 text-center text-xs font-bold text-ink/40 uppercase">
                No payments recorded in selected period
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs with detailed tables */}
      <div className="space-y-4">
        <Tabs
          tabs={[
            { id: 'subscriptions', label: 'Subscriptions', count: subsData?.total || 0 },
            { id: 'invoices', label: 'Invoices', count: invoicesData?.total || 0 },
            { id: 'payments', label: 'Payments', count: paymentsData?.total || 0 },
            { id: 'overdue', label: 'Overdue Invoices', count: overdueData?.total || 0 },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />

        {activeTab === 'subscriptions' && (
          <DataTable
            columns={subColumns}
            data={subsData?.items || []}
            loading={subsLoading}
            emptyTitle="No Subscriptions Found"
            emptyMessage="No subscriptions match current filters."
          />
        )}

        {activeTab === 'invoices' && (
          <DataTable
            columns={invColumns}
            data={invoicesData?.items || []}
            loading={invoicesLoading}
            emptyTitle="No Invoices Found"
            emptyMessage="No invoices match current filters."
          />
        )}

        {activeTab === 'payments' && (
          <DataTable
            columns={payColumns}
            data={paymentsData?.items || []}
            loading={paymentsLoading}
            emptyTitle="No Payments Recorded"
            emptyMessage="No payments match current filters."
          />
        )}

        {activeTab === 'overdue' && (
          <DataTable
            columns={overdueColumns}
            data={overdueData?.items || []}
            loading={overdueLoading}
            emptyTitle="No Overdue Invoices"
            emptyMessage="All invoices are paid or within their payment terms."
          />
        )}
      </div>
    </div>
  );
}
