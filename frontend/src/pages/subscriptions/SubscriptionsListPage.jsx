import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Layers,
  Plus,
  Search,
  LayoutGrid,
  List,
  Eye,
  Edit2,
  Calendar,
  AlertCircle,
  Building,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { api } from '../../api/client';
import { formatPaise, formatDate } from '../../utils/format';
import { useAuth } from '../../context/AuthContext';
import DataTable from '../../components/ui/DataTable';
import Pagination from '../../components/ui/Pagination';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import Skeleton from '../../components/ui/Skeleton';

export default function SubscriptionsListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { role } = useAuth();
  const isCustomer = role === 'customer';

  // Read URL params
  const viewMode = searchParams.get('view') || 'table'; // 'table' | 'board'
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = 15;
  const statusFilter = searchParams.get('status') || '';
  const planFilter = searchParams.get('plan') || '';
  const searchQuery = searchParams.get('q') || '';
  const expiringFilter = searchParams.get('expiring_within_days') === '30';
  const sortColumn = searchParams.get('sort_by') || 'id';
  const sortDirection = searchParams.get('sort_order') || 'desc';

  // Update URL params helper
  const updateParams = (newParams) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(newParams).forEach(([k, v]) => {
      if (v === null || v === undefined || v === '') {
        next.delete(k);
      } else {
        next.set(k, v.toString());
      }
    });
    setSearchParams(next);
  };

  // Query plans for filter dropdown
  const { data: plansData } = useQuery({
    queryKey: ['plans-dropdown'],
    queryFn: () => api.get('/api/plans?is_active=true&page_size=100'),
  });

  // Query subscriptions table
  const tableQueryParams = new URLSearchParams({
    page: page.toString(),
    page_size: pageSize.toString(),
    sort_by: sortColumn,
    sort_order: sortDirection,
  });
  if (statusFilter) tableQueryParams.set('status', statusFilter);
  if (planFilter) tableQueryParams.set('plan', planFilter);
  if (searchQuery.trim()) tableQueryParams.set('q', searchQuery.trim());
  if (expiringFilter) tableQueryParams.set('expiring_within_days', '30');

  const { data: tableData, isLoading: tableLoading } = useQuery({
    queryKey: ['subscriptions-list', tableQueryParams.toString()],
    queryFn: () => api.get(`/api/subscriptions?${tableQueryParams.toString()}`),
    enabled: viewMode === 'table',
  });

  // Query pipeline board
  const { data: boardData, isLoading: boardLoading } = useQuery({
    queryKey: ['subscriptions-board'],
    queryFn: () => api.get('/api/subscriptions/board'),
    enabled: viewMode === 'board',
  });

  // Columns for DataTable
  const columns = [
    {
      key: 'number',
      label: 'Subscription #',
      sortable: true,
      render: (val, row) => (
        <div>
          <span
            onClick={() => navigate(`/subscriptions/${row.id}`)}
            className="font-archivo font-extrabold text-ink hover:text-brand-orange cursor-pointer"
          >
            {val}
          </span>
          <div className="text-[11px] text-ink/60 font-medium">
            Created {formatDate(row.created_at)}
          </div>
        </div>
      ),
    },
    {
      key: 'customer_name',
      label: 'Customer',
      sortable: true,
      render: (val, row) => (
        <div>
          <div className="font-bold text-ink">{val}</div>
          <div className="text-xs text-ink/70 flex items-center gap-1">
            <Building size={12} />
            <span>{row.customer_company}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'plan_name',
      label: 'Plan',
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
      label: 'Subtotal / Period',
      align: 'right',
      sortable: true,
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
      sortable: true,
      render: (val, row) => (
        <Badge status={row.is_paused ? 'paused' : val} isSubscription />
      ),
    },
    {
      key: 'next_billing_date',
      label: 'Next Billing',
      sortable: true,
      render: (val) => (
        <span className="text-xs font-semibold text-ink">
          {formatDate(val)}
        </span>
      ),
    },
    {
      key: 'expiry_date',
      label: 'Expiry Date',
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
      onClick: (row) => navigate(`/subscriptions/${row.id}`),
    },
    {
      label: 'Edit Contract',
      icon: Edit2,
      onClick: (row) => navigate(`/subscriptions/${row.id}/edit`),
    },
  ];

  // Pipeline board column configs
  const boardColumns = [
    { id: 'draft', title: 'Draft', color: 'bg-zinc-200 border-zinc-400 text-zinc-800' },
    { id: 'quotation', title: 'Quotation', color: 'bg-[#5C768D]/20 border-[#5C768D] text-[#5C768D]' },
    { id: 'confirmed', title: 'Confirmed', color: 'bg-[#F59E0B]/20 border-[#F59E0B] text-[#D97706]' },
    { id: 'active', title: 'Active', color: 'bg-brand-teal/20 border-brand-teal text-brand-teal' },
    { id: 'closed', title: 'Closed', color: 'bg-zinc-800 border-zinc-900 text-white' },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-anton text-3xl uppercase tracking-wider text-ink">
            SUBSCRIPTIONS
          </h1>
          <p className="font-archivo text-xs font-bold uppercase tracking-wide text-ink/70 mt-1">
            Active contracts, billing schedules, and sales pipeline lifecycle
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="inline-flex border-2 border-ink rounded-[4px] shadow-neo-sm overflow-hidden bg-white p-0.5">
            <button
              type="button"
              onClick={() => updateParams({ view: 'table' })}
              className={`px-2.5 py-1.5 rounded-[2px] text-xs font-archivo font-extrabold uppercase flex items-center gap-1.5 transition-all ${
                viewMode === 'table' ? 'bg-brand-orange text-white shadow-neo-sm' : 'text-ink hover:bg-cream'
              }`}
            >
              <List size={14} />
              <span className="hidden sm:inline">Table</span>
            </button>
            <button
              type="button"
              onClick={() => updateParams({ view: 'board' })}
              className={`px-2.5 py-1.5 rounded-[2px] text-xs font-archivo font-extrabold uppercase flex items-center gap-1.5 transition-all ${
                viewMode === 'board' ? 'bg-brand-orange text-white shadow-neo-sm' : 'text-ink hover:bg-cream'
              }`}
            >
              <LayoutGrid size={14} />
              <span className="hidden sm:inline">Pipeline Board</span>
            </button>
          </div>

          <Link to="/subscriptions/new">
            <Button variant="primary">
              <Plus size={16} strokeWidth={3} />
              <span>New Subscription</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter Bar (Only for Table View) */}
      {viewMode === 'table' && (
        <div className="bg-cream-light border-2 border-ink rounded-[4px] p-4 shadow-neo-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <div className="w-full lg:max-w-xs">
            <Input
              placeholder="Search by BL#, customer, company..."
              value={searchQuery}
              onChange={(e) => updateParams({ q: e.target.value, page: 1 })}
              icon={Search}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => updateParams({ status: e.target.value, page: 1 })}
              className="px-3 py-2 bg-white border-2 border-ink rounded-[4px] text-xs font-archivo font-bold text-ink shadow-neo-sm focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="quotation">Quotation</option>
              <option value="confirmed">Confirmed</option>
              <option value="active">Active</option>
              <option value="closed">Closed</option>
            </select>

            {/* Plan Filter */}
            <select
              value={planFilter}
              onChange={(e) => updateParams({ plan: e.target.value, page: 1 })}
              className="px-3 py-2 bg-white border-2 border-ink rounded-[4px] text-xs font-archivo font-bold text-ink shadow-neo-sm focus:outline-none"
            >
              <option value="">All Plans</option>
              {plansData?.items?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            {/* Quick Filter: Expiring in 30 days */}
            <button
              type="button"
              onClick={() =>
                updateParams({
                  expiring_within_days: expiringFilter ? null : '30',
                  page: 1,
                })
              }
              className={`
                px-3 py-2 border-2 border-ink rounded-[4px] text-xs font-archivo font-extrabold uppercase shadow-neo-sm transition-all flex items-center gap-1.5
                ${
                  expiringFilter
                    ? 'bg-brand-orange text-white'
                    : 'bg-white text-ink hover:bg-cream'
                }
              `}
            >
              <Clock size={14} />
              <span>Expiring in 30d</span>
            </button>
          </div>
        </div>
      )}

      {/* VIEW 1: DATA TABLE */}
      {viewMode === 'table' && (
        <div className="space-y-4">
          <DataTable
            columns={columns}
            data={tableData?.items || []}
            loading={tableLoading}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={(col, dir) => updateParams({ sort_by: col, sort_order: dir })}
            rowActions={rowActions}
            emptyTitle="No Subscriptions Found"
            emptyMessage="Try adjusting your search criteria or create a new subscription."
          />

          {tableData && tableData.total > pageSize && (
            <Pagination
              currentPage={page}
              totalItems={tableData.total}
              pageSize={pageSize}
              onPageChange={(p) => updateParams({ page: p })}
            />
          )}
        </div>
      )}

      {/* VIEW 2: PIPELINE BOARD (KANBAN) */}
      {viewMode === 'board' && (
        <div className="overflow-x-auto pb-4">
          <div className="grid grid-cols-5 gap-4 min-w-[1000px]">
            {boardColumns.map((col) => {
              const colData = boardData ? boardData[col.id] : null;
              const total = colData?.total_count || 0;
              const cards = colData?.cards || [];

              return (
                <div
                  key={col.id}
                  className="bg-cream-light border-2 border-ink rounded-[4px] p-3 shadow-neo flex flex-col max-h-[75vh]"
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between pb-3 mb-3 border-b-2 border-ink">
                    <div className="flex items-center gap-2">
                      <span className="font-anton text-lg uppercase tracking-wider text-ink">
                        {col.title}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-[4px] border-2 border-ink bg-white font-archivo font-extrabold text-xs shadow-neo-sm">
                      {total}
                    </span>
                  </div>

                  {/* Cards List */}
                  <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                    {boardLoading ? (
                      <>
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                      </>
                    ) : cards.length > 0 ? (
                      cards.map((card) => (
                        <div
                          key={card.id}
                          onClick={() => navigate(`/subscriptions/${card.id}`)}
                          className="p-3 bg-white border-2 border-ink rounded-[4px] shadow-neo-sm hover:-translate-y-0.5 active:translate-y-0.5 cursor-pointer transition-all"
                        >
                          <div className="flex items-center justify-between gap-1 mb-1.5">
                            <span className="font-archivo font-extrabold text-xs text-ink truncate">
                              {card.number}
                            </span>
                            <Badge status={card.is_paused ? 'paused' : card.status} isSubscription />
                          </div>

                          <div className="font-bold text-xs text-ink truncate">
                            {card.customer_name}
                          </div>
                          <div className="text-[11px] text-ink/60 truncate mb-2">
                            {card.company_name}
                          </div>

                          <div className="pt-2 border-t border-ink/10 flex items-center justify-between">
                            <span className="text-[11px] font-archivo font-bold text-ink truncate">
                              {card.plan_name}
                            </span>
                            <span className="font-anton text-xs text-ink">
                              {formatPaise(card.recurring_subtotal)}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-8 text-center text-xs font-bold text-ink/40 uppercase">
                        No cards
                      </div>
                    )}
                  </div>

                  {/* Column Footer: View all N */}
                  <div className="pt-3 mt-2 border-t-2 border-ink">
                    <button
                      type="button"
                      onClick={() => {
                        updateParams({ view: 'table', status: col.id, page: 1 });
                      }}
                      className="w-full py-1.5 bg-white border-2 border-ink rounded-[4px] text-xs font-archivo font-extrabold uppercase text-ink shadow-neo-sm hover:bg-cream flex items-center justify-center gap-1 transition-all"
                    >
                      <span>View all {total}</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
