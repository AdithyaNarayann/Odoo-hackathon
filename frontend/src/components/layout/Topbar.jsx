import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Menu,
  ChevronDown,
  User,
  KeyRound,
  LogOut,
  Search,
  Bell,
  Layers,
  Receipt,
  Users,
  AlertTriangle,
  ArrowRight,
  X,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { formatPaise, formatDate } from '../../utils/format';
import { useAuth } from '../../context/AuthContext';
import Badge from '../ui/Badge';

export default function Topbar({ onToggleSidebar }) {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const isCustomer = role === 'customer';

  const [menuOpen, setMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const searchInputRef = useRef(null);
  const dropdownRef = useRef(null);
  const bellRef = useRef(null);
  const searchContainerRef = useRef(null);

  // 1. Debounce Search (300 ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // 2. Global Ctrl+K Shortcut
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        searchInputRef.current?.focus();
        setSearchFocused(true);
      } else if (e.key === 'Escape') {
        setSearchFocused(false);
        setBellOpen(false);
        setMenuOpen(false);
        searchInputRef.current?.blur();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 3. Click outside handler
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
      if (bellRef.current && !bellRef.current.contains(e.target)) {
        setBellOpen(false);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setSearchFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 4. Query Search Results
  const { data: searchResults, isFetching: searchLoading } = useQuery({
    queryKey: ['global-search', debouncedQuery],
    queryFn: () => api.get(`/api/search?q=${encodeURIComponent(debouncedQuery)}`),
    enabled: Boolean(debouncedQuery.length > 0 && searchFocused),
  });

  // 5. Query Overdue Invoices for Notification Bell
  const { data: overdueInvoices } = useQuery({
    queryKey: ['bell-overdue-invoices'],
    queryFn: () => api.get('/api/invoices?overdue=true&page=1&page_size=5&sort_by=due_date&sort_order=asc'),
    refetchInterval: 60000, // refresh every minute
  });

  const overdueCount = overdueInvoices?.total || 0;

  // Flatten search results for keyboard navigation
  const flatItems = useMemo(() => {
    if (!searchResults) return [];
    const items = [];
    (searchResults.customers || []).forEach((c) => {
      items.push({
        type: 'customer',
        id: c.id,
        title: c.name,
        subtitle: c.company_name,
        link: isCustomer ? '/portal/profile' : `/customers/${c.id}`,
      });
    });
    (searchResults.subscriptions || []).forEach((s) => {
      items.push({
        type: 'subscription',
        id: s.id,
        title: `${s.number} — ${s.customer_name}`,
        subtitle: `${s.plan_name} (${formatPaise(s.recurring_subtotal)}/mo)`,
        status: s.status,
        link: isCustomer ? '/portal/subscriptions' : `/subscriptions/${s.id}`,
      });
    });
    (searchResults.invoices || []).forEach((inv) => {
      items.push({
        type: 'invoice',
        id: inv.id,
        title: `${inv.number} — ${inv.customer_name}`,
        subtitle: `Balance: ${formatPaise(inv.balance)}`,
        status: inv.status,
        is_overdue: inv.is_overdue,
        link: isCustomer ? `/portal/invoices/${inv.id}` : `/invoices/${inv.id}`,
      });
    });
    return items;
  }, [searchResults, isCustomer]);

  // Handle keyboard navigation in search results
  const handleSearchKeyDown = (e) => {
    if (!flatItems.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < flatItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : flatItems.length - 1));
    } else if (e.key === 'Enter' && highlightedIndex >= 0 && flatItems[highlightedIndex]) {
      e.preventDefault();
      navigate(flatItems[highlightedIndex].link);
      setSearchFocused(false);
      setSearchQuery('');
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const profileLink = isCustomer ? '/portal/profile' : '/settings';
  const overdueViewLink = isCustomer ? '/portal/invoices' : '/invoices?tab=overdue';

  return (
    <header className="h-16 bg-cream border-b-2 border-ink px-4 md:px-6 flex items-center justify-between z-30 sticky top-0">
      {/* Left: Mobile Toggle & Global Search Box from sheet */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="md:hidden p-2 rounded-[4px] border-2 border-ink bg-white shadow-neo-sm active:translate-y-0.5 active:shadow-none shrink-0"
          aria-label="Toggle Navigation"
        >
          <Menu size={20} className="text-ink" />
        </button>

        {/* Global Search Input Box */}
        <div className="relative w-full" ref={searchContainerRef}>
          <div className="relative flex items-center">
            <Search
              size={16}
              className="absolute left-3 text-ink/60 pointer-events-none"
            />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search customers, subscriptions, invoices..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchFocused(true);
                setHighlightedIndex(-1);
              }}
              onFocus={() => setSearchFocused(true)}
              onKeyDown={handleSearchKeyDown}
              className="w-full pl-9 pr-14 py-2 bg-white border-2 border-ink rounded-[4px] text-xs font-archivo font-bold text-ink placeholder:text-ink/40 shadow-neo-sm focus:outline-none focus:ring-1 focus:ring-brand-orange"
            />
            <kbd className="hidden sm:inline-flex items-center gap-0.5 absolute right-2.5 px-1.5 py-0.5 bg-cream border border-ink/40 rounded text-[10px] font-archivo font-extrabold text-ink/70">
              <span>Ctrl</span>
              <span>K</span>
            </kbd>
          </div>

          {/* Search Results Dropdown */}
          {searchFocused && debouncedQuery && (
            <div className="absolute left-0 right-0 mt-2 bg-white border-2 border-ink rounded-[4px] shadow-neo-lg max-h-96 overflow-y-auto py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
              {searchLoading ? (
                <div className="p-4 text-center text-xs font-bold text-ink/50 uppercase">
                  Searching records...
                </div>
              ) : flatItems.length > 0 ? (
                <div className="space-y-3">
                  {/* Customers Group */}
                  {searchResults?.customers && searchResults.customers.length > 0 && (
                    <div>
                      <div className="px-3 py-1 text-[10px] font-archivo font-extrabold uppercase tracking-wider text-ink/50 flex items-center gap-1.5">
                        <Users size={12} />
                        <span>Customers</span>
                      </div>
                      {searchResults.customers.map((c) => {
                        const itemIndex = flatItems.findIndex((it) => it.type === 'customer' && it.id === c.id);
                        const isHighlighted = itemIndex === highlightedIndex;
                        return (
                          <div
                            key={c.id}
                            onClick={() => {
                              navigate(isCustomer ? '/portal/profile' : `/customers/${c.id}`);
                              setSearchFocused(false);
                              setSearchQuery('');
                            }}
                            className={`px-3 py-2 flex items-center justify-between cursor-pointer transition-colors ${
                              isHighlighted ? 'bg-brand-orange/10 border-l-4 border-brand-orange' : 'hover:bg-cream'
                            }`}
                          >
                            <div>
                              <div className="text-xs font-bold text-ink">{c.name}</div>
                              <div className="text-[11px] text-ink/70">{c.company_name}</div>
                            </div>
                            <span className="text-[10px] text-ink/50">{c.email}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Subscriptions Group */}
                  {searchResults?.subscriptions && searchResults.subscriptions.length > 0 && (
                    <div className="border-t border-ink/10 pt-2">
                      <div className="px-3 py-1 text-[10px] font-archivo font-extrabold uppercase tracking-wider text-ink/50 flex items-center gap-1.5">
                        <Layers size={12} />
                        <span>Subscriptions</span>
                      </div>
                      {searchResults.subscriptions.map((s) => {
                        const itemIndex = flatItems.findIndex((it) => it.type === 'subscription' && it.id === s.id);
                        const isHighlighted = itemIndex === highlightedIndex;
                        return (
                          <div
                            key={s.id}
                            onClick={() => {
                              navigate(isCustomer ? '/portal/subscriptions' : `/subscriptions/${s.id}`);
                              setSearchFocused(false);
                              setSearchQuery('');
                            }}
                            className={`px-3 py-2 flex items-center justify-between cursor-pointer transition-colors ${
                              isHighlighted ? 'bg-brand-orange/10 border-l-4 border-brand-orange' : 'hover:bg-cream'
                            }`}
                          >
                            <div>
                              <div className="text-xs font-bold text-ink">{s.number} — {s.customer_name}</div>
                              <div className="text-[11px] text-ink/70">{s.plan_name} ({formatPaise(s.recurring_subtotal)}/mo)</div>
                            </div>
                            <Badge status={s.status} isSubscription />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Invoices Group */}
                  {searchResults?.invoices && searchResults.invoices.length > 0 && (
                    <div className="border-t border-ink/10 pt-2">
                      <div className="px-3 py-1 text-[10px] font-archivo font-extrabold uppercase tracking-wider text-ink/50 flex items-center gap-1.5">
                        <Receipt size={12} />
                        <span>Invoices</span>
                      </div>
                      {searchResults.invoices.map((inv) => {
                        const itemIndex = flatItems.findIndex((it) => it.type === 'invoice' && it.id === inv.id);
                        const isHighlighted = itemIndex === highlightedIndex;
                        return (
                          <div
                            key={inv.id}
                            onClick={() => {
                              navigate(isCustomer ? `/portal/invoices/${inv.id}` : `/invoices/${inv.id}`);
                              setSearchFocused(false);
                              setSearchQuery('');
                            }}
                            className={`px-3 py-2 flex items-center justify-between cursor-pointer transition-colors ${
                              isHighlighted ? 'bg-brand-orange/10 border-l-4 border-brand-orange' : 'hover:bg-cream'
                            }`}
                          >
                            <div>
                              <div className="text-xs font-bold text-ink">{inv.number} — {inv.customer_name}</div>
                              <div className="text-[11px] text-ink/70">Balance: {formatPaise(inv.balance)}</div>
                            </div>
                            <Badge status={inv.is_overdue ? 'overdue' : inv.status} isInvoice />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 text-center text-xs font-bold text-ink/50 uppercase">
                  No records match "{debouncedQuery}"
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right User Controls: Notification Bell & Profile Dropdown */}
      <div className="flex items-center gap-3 ml-4">
        {/* Notification Bell */}
        <div className="relative" ref={bellRef}>
          <button
            type="button"
            onClick={() => setBellOpen((prev) => !prev)}
            className="relative p-2 rounded-[4px] border-2 border-ink bg-white shadow-neo-sm hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none transition-all"
            aria-label="Overdue Notifications"
          >
            <Bell size={18} className="text-ink" />
            {overdueCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 bg-brand-orange text-white text-[10px] font-archivo font-extrabold rounded-full border-2 border-ink flex items-center justify-center shadow-neo-sm animate-pulse">
                {overdueCount > 99 ? '99+' : overdueCount}
              </span>
            )}
          </button>

          {/* Bell Notifications Dropdown */}
          {bellOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white border-2 border-ink rounded-[4px] shadow-neo-lg py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-2 border-b-2 border-ink/10 flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-archivo font-extrabold uppercase text-xs text-ink">
                  <AlertTriangle size={14} className="text-brand-orange" />
                  <span>Overdue Invoices ({overdueCount})</span>
                </div>
                {overdueCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded bg-red-100 text-red-700 text-[10px] font-extrabold uppercase">
                    Needs Action
                  </span>
                )}
              </div>

              <div className="divide-y divide-ink/10 max-h-72 overflow-y-auto">
                {overdueInvoices?.items && overdueInvoices.items.length > 0 ? (
                  overdueInvoices.items.map((inv) => (
                    <div
                      key={inv.id}
                      onClick={() => {
                        setBellOpen(false);
                        navigate(isCustomer ? `/portal/invoices/${inv.id}` : `/invoices/${inv.id}`);
                      }}
                      className="p-3 hover:bg-cream cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs mb-0.5">
                        <span className="font-bold text-ink">{inv.number}</span>
                        <span className="font-anton text-red-600 tabular-nums">
                          {formatPaise(inv.balance)}
                        </span>
                      </div>
                      <div className="text-[11px] text-ink/70 truncate">{inv.customer_name}</div>
                      <div className="text-[10px] text-red-600 font-bold mt-1">
                        Due {formatDate(inv.due_date)} (+{inv.days_overdue} days overdue)
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center text-xs font-bold text-ink/50 uppercase">
                    No overdue invoices! Ledger is clean.
                  </div>
                )}
              </div>

              <div className="p-2 border-t-2 border-ink/10 bg-cream-light">
                <Link
                  to={overdueViewLink}
                  onClick={() => setBellOpen(false)}
                  className="flex items-center justify-center gap-1 text-xs font-archivo font-extrabold uppercase text-brand-orange hover:underline py-1"
                >
                  <span>View All Overdue Invoices</span>
                  <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-[4px] border-2 border-ink bg-cream-light shadow-neo-sm hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none transition-all"
          >
            <div className="w-8 h-8 rounded-full bg-brand-orange text-white border-2 border-ink flex items-center justify-center font-archivo font-extrabold text-xs">
              {getInitials(user?.full_name)}
            </div>

            <div className="text-left hidden sm:block">
              <div className="text-xs font-archivo font-bold text-ink leading-tight">
                {user?.full_name || 'User'}
              </div>
              <div className="text-[10px] font-archivo font-extrabold tracking-wider uppercase text-ink/70">
                {role || 'staff'}
              </div>
            </div>

            <ChevronDown
              size={16}
              className={`text-ink transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white border-2 border-ink rounded-[4px] shadow-neo-md py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-2 border-b-2 border-ink/10 sm:hidden">
                <p className="text-xs font-bold text-ink truncate">{user?.full_name}</p>
                <p className="text-[10px] text-ink/60 capitalize">{role}</p>
              </div>

              <Link
                to={profileLink}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-xs font-archivo font-bold text-ink hover:bg-cream transition-colors"
              >
                <User size={15} />
                <span>View Profile</span>
              </Link>

              <Link
                to={profileLink}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-xs font-archivo font-bold text-ink hover:bg-cream transition-colors"
              >
                <KeyRound size={15} />
                <span>Change Password</span>
              </Link>

              <div className="my-1 border-t-2 border-ink/10" />

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  logout();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-archivo font-bold text-red-600 hover:bg-red-50 transition-colors text-left"
              >
                <LogOut size={15} />
                <span>Log Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
