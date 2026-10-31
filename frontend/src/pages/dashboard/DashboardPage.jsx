import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Layers,
  ArrowRight,
  TrendingUp,
  Receipt,
  CreditCard,
  Plus,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { api } from '../../api/client';
import { formatPaise, formatPaiseCompact, formatDate } from '../../utils/format';
import StatCard from '../../components/ui/StatCard';
import Badge from '../../components/ui/Badge';
import Skeleton from '../../components/ui/Skeleton';
import Button from '../../components/ui/Button';

export default function DashboardPage() {
  const [months, setMonths] = useState(8);

  // 1. Fetch Summary
  const {
    data: summary,
    isLoading: summaryLoading,
    error: summaryError,
  } = useQuery({
    queryKey: ['reports-summary'],
    queryFn: () => api.get('/api/reports/summary'),
  });

  // 2. Fetch Revenue By Month
  const {
    data: revenueData,
    isLoading: revenueLoading,
  } = useQuery({
    queryKey: ['reports-revenue', months],
    queryFn: () => api.get(`/api/reports/revenue-by-month?months=${months}`),
  });

  // 3. Fetch Recent Subscriptions
  const {
    data: recentSubsData,
    isLoading: subsLoading,
  } = useQuery({
    queryKey: ['recent-subscriptions'],
    queryFn: () => api.get('/api/subscriptions?page=1&page_size=5'),
  });

  // Calculate revenue collected comparison
  const revDiff = React.useMemo(() => {
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

  return (
    <div className="space-y-6">
      {/* 1. Hero Block from Sheet */}
      <div className="bg-brand-orange border-2 border-ink rounded-[4px] p-6 md:p-8 shadow-neo-md text-white relative overflow-hidden">
        <div className="max-w-xl relative z-10">
          <h1 className="font-anton text-4xl sm:text-5xl md:text-6xl tracking-wider uppercase leading-none text-ink">
            SUBSCRIPTIONS
            <br />
            <span className="text-white drop-shadow-[2px_2px_0px_rgba(26,26,26,1)]">
              THAT GROW
            </span>
          </h1>
          <p className="font-archivo text-xs sm:text-sm font-bold uppercase tracking-wide text-ink mt-3">
            Manage plans, customers and recurring revenue in one place.
          </p>

          <div className="mt-6">
            <Link to="/subscriptions">
              <button
                type="button"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-ink text-white font-archivo font-extrabold uppercase text-xs tracking-wider rounded-[4px] border-2 border-ink shadow-neo hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none transition-all"
              >
                <Plus size={16} strokeWidth={3} />
                <span>New Subscription</span>
                <ArrowRight size={16} />
              </button>
            </Link>
          </div>
        </div>

        {/* Decorative Geometric Art from Sheet */}
        <div className="hidden lg:block absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none">
          <div className="relative w-64 h-48 flex items-center justify-end">
            {/* Background Keywords */}
            <div className="absolute top-2 right-4 text-[11px] font-archivo font-extrabold uppercase tracking-widest text-ink/70 space-y-1 text-right">
              <div>PLANS</div>
              <div>BILLING</div>
              <div>CUSTOMERS</div>
              <div>REVENUE</div>
            </div>

            {/* Geometric 3D isometric blocks & orange circle */}
            <div className="absolute right-12 bottom-2 w-28 h-28 rounded-full bg-brand-orange border-4 border-ink shadow-neo" />
            <div className="absolute right-24 bottom-0 w-24 h-36 bg-slate-700 border-4 border-ink shadow-neo -rotate-6" />
            <div className="absolute right-6 bottom-4 w-20 h-28 bg-brand-teal border-4 border-ink shadow-neo rotate-12" />
          </div>
        </div>
      </div>

      {/* 2. 4 StatCards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryLoading ? (
          <>
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </>
        ) : (
          <>
            {/* Card 1: Active Subscriptions */}
            <StatCard
              title="Active Subscriptions"
              value={summary?.active_subscriptions?.toLocaleString() ?? '0'}
              icon={Layers}
              trend={{ value: '+18%', positive: true, label: 'vs last month' }}
            />

            {/* Card 2: MRR Highlight Orange Card */}
            <StatCard
              highlight
              title="Monthly Revenue"
              value={formatPaiseCompact(summary?.mrr ?? 0)}
              subvalue={`${formatPaise(summary?.mrr ?? 0)} MRR`}
              trend={{ value: '+27%', positive: true, label: 'vs last month' }}
            />

            {/* Card 3: Revenue Collected */}
            <StatCard
              title="Revenue Collected"
              value={formatPaiseCompact(summary?.revenue_collected ?? 0)}
              subvalue={`${formatPaise(summary?.revenue_collected ?? 0)} in period`}
              icon={CreditCard}
              trend={revDiff || { value: '0%', positive: true, label: 'vs last period' }}
            />

            {/* Card 4: Outstanding Invoices */}
            <StatCard
              title="Outstanding Invoices"
              value={summary?.outstanding_count?.toLocaleString() ?? '0'}
              subvalue={`${formatPaise(summary?.outstanding_amount ?? 0)} due`}
              icon={Receipt}
              trend={
                summary?.overdue_count > 0
                  ? {
                      value: `${summary.overdue_count} overdue`,
                      positive: false,
                      label: `(${formatPaise(summary.overdue_amount)})`,
                    }
                  : { value: '0 overdue', positive: true, label: 'clean ledger' }
              }
            />
          </>
        )}
      </div>

      {/* 3. Bottom Row: Revenue Overview Chart & Recent Subscriptions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Stacked Bar Chart */}
        <div className="lg:col-span-2 bg-cream-light border-2 border-ink rounded-[4px] p-5 shadow-neo flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="font-anton text-xl uppercase tracking-wider text-ink">
                REVENUE OVERVIEW
              </h2>
              <p className="text-xs text-ink/70 font-archivo uppercase tracking-wide">
                Subscription recurring vs Add-ons billing
              </p>
            </div>

            {/* Months Selector */}
            <div className="flex items-center gap-1.5 bg-white border-2 border-ink rounded-[4px] p-1 shadow-neo-sm">
              {[6, 8, 12].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMonths(m)}
                  className={`
                    px-2.5 py-1 text-xs font-archivo font-extrabold uppercase rounded-[2px] transition-all
                    ${
                      months === m
                        ? 'bg-brand-orange text-white shadow-neo-sm'
                        : 'text-ink hover:bg-cream'
                    }
                  `}
                >
                  Last {m}m
                </button>
              ))}
            </div>
          </div>

          {/* Chart Container */}
          <div className="h-72 w-full pt-2">
            {revenueLoading ? (
              <Skeleton className="h-full w-full" />
            ) : revenueData?.items && revenueData.items.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={revenueData.items}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" strokeOpacity={0.15} />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: '#1A1A1A', fontSize: 11, fontWeight: 700 }}
                    tickLine={{ stroke: '#1A1A1A' }}
                  />
                  <YAxis
                    tickFormatter={(val) => formatPaiseCompact(val)}
                    tick={{ fill: '#1A1A1A', fontSize: 11, fontWeight: 700 }}
                    tickLine={{ stroke: '#1A1A1A' }}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const subVal = payload.find((p) => p.dataKey === 'subscription')?.value || 0;
                        const addonVal = payload.find((p) => p.dataKey === 'addons')?.value || 0;
                        return (
                          <div className="bg-white border-2 border-ink rounded-[4px] p-3 shadow-neo-md text-xs font-archivo">
                            <div className="font-extrabold uppercase text-ink mb-1.5 border-b border-ink/20 pb-1">
                              Month: {label}
                            </div>
                            <div className="flex items-center gap-2 text-brand-orange font-bold">
                              <span className="w-2.5 h-2.5 bg-brand-orange border border-ink" />
                              <span>Subscription: {formatPaise(subVal)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-brand-teal font-bold mt-1">
                              <span className="w-2.5 h-2.5 bg-brand-teal border border-ink" />
                              <span>Add-ons: {formatPaise(addonVal)}</span>
                            </div>
                            <div className="mt-1.5 pt-1 border-t border-ink/20 font-extrabold text-ink">
                              Total: {formatPaise(subVal + addonVal)}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value) => (
                      <span className="text-xs font-archivo font-extrabold uppercase tracking-wider text-ink mr-4">
                        {value}
                      </span>
                    )}
                  />
                  <Bar
                    dataKey="subscription"
                    name="Subscription"
                    stackId="rev"
                    fill="#FF5B26"
                    stroke="#1A1A1A"
                    strokeWidth={1.5}
                  />
                  <Bar
                    dataKey="addons"
                    name="Add-ons"
                    stackId="rev"
                    fill="#008080"
                    stroke="#1A1A1A"
                    strokeWidth={1.5}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs font-bold text-ink/50 uppercase">
                No revenue data recorded for selected period
              </div>
            )}
          </div>
        </div>

        {/* Right: Recent Subscriptions */}
        <div className="bg-cream-light border-2 border-ink rounded-[4px] p-5 shadow-neo flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-anton text-xl uppercase tracking-wider text-ink">
              RECENT SUBSCRIPTIONS
            </h2>
            <Link
              to="/subscriptions"
              className="text-xs font-archivo font-extrabold uppercase tracking-wider text-brand-orange hover:underline flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto">
            {subsLoading ? (
              <>
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </>
            ) : recentSubsData?.items && recentSubsData.items.length > 0 ? (
              recentSubsData.items.map((sub) => {
                const initial = (sub.customer_name || sub.customer_company || 'C').charAt(0).toUpperCase();
                return (
                  <div
                    key={sub.id}
                    className="p-3 bg-white border-2 border-ink rounded-[4px] shadow-neo-sm flex items-center justify-between gap-3 hover:-translate-y-0.5 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-cream border-2 border-ink font-anton text-sm flex items-center justify-center shrink-0 text-ink">
                        {initial}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-archivo font-extrabold text-xs text-ink truncate">
                            {sub.number}
                          </span>
                          <Badge status={sub.status} isSubscription />
                        </div>
                        <div className="text-[11px] text-ink/70 truncate font-semibold">
                          {sub.customer_name}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-anton text-ink tabular-nums">
                        {formatPaise(sub.recurring_subtotal)} / mo
                      </div>
                      <div className="text-[10px] text-ink/60 font-medium">
                        {formatDate(sub.created_at)}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center text-xs font-bold text-ink/50 uppercase">
                No subscriptions created yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
