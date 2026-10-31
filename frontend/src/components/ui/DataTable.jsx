import React, { useState } from 'react';
import { ChevronUp, ChevronDown, MoreVertical } from 'lucide-react';
import Checkbox from './Checkbox';
import Skeleton from './Skeleton';
import EmptyState from './EmptyState';

export default function DataTable({
  columns = [],
  data = [],
  keyField = 'id',
  loading = false,
  sortColumn,
  sortDirection = 'asc',
  onSort,
  selectedIds = [],
  onSelectAll,
  onSelectRow,
  rowActions = [],
  emptyTitle = 'No records found',
  emptyMessage = 'There are no records matching your query.',
  className = '',
}) {
  const [openMenuRowId, setOpenMenuRowId] = useState(null);

  const hasSelection = Boolean(onSelectRow);
  const allSelected = data.length > 0 && data.every((row) => selectedIds.includes(row[keyField]));

  const handleHeaderSort = (col) => {
    if (!col.sortable || !onSort) return;
    const isCurrent = sortColumn === col.key;
    const newDir = isCurrent && sortDirection === 'asc' ? 'desc' : 'asc';
    onSort(col.key, newDir);
  };

  return (
    <div className={`w-full overflow-hidden border-2 border-ink rounded-[4px] shadow-neo bg-white ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-cream-light border-b-2 border-ink">
              {hasSelection && (
                <th className="p-3 w-10 text-center border-r border-ink/20">
                  <Checkbox
                    checked={allSelected}
                    onChange={(checked) => onSelectAll && onSelectAll(checked)}
                  />
                </th>
              )}

              {columns.map((col) => {
                const isSorted = sortColumn === col.key;
                return (
                  <th
                    key={col.key}
                    onClick={() => handleHeaderSort(col)}
                    className={`
                      p-3 text-xs font-archivo font-extrabold uppercase tracking-wider text-ink select-none
                      ${col.sortable ? 'cursor-pointer hover:bg-cream/70' : ''}
                      ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}
                    `}
                  >
                    <div
                      className={`inline-flex items-center gap-1.5 ${
                        col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : ''
                      }`}
                    >
                      <span>{col.label}</span>
                      {col.sortable && (
                        <div className="flex flex-col text-ink-muted">
                          {isSorted && sortDirection === 'asc' ? (
                            <ChevronUp size={14} className="text-brand-orange" strokeWidth={3} />
                          ) : isSorted && sortDirection === 'desc' ? (
                            <ChevronDown size={14} className="text-brand-orange" strokeWidth={3} />
                          ) : (
                            <ChevronDown size={12} className="opacity-40" />
                          )}
                        </div>
                      )}
                    </div>
                  </th>
                );
              })}

              {rowActions.length > 0 && <th className="p-3 w-12 text-center"></th>}
            </tr>
          </thead>

          <tbody className="divide-y-2 divide-ink/10 text-sm font-sans">
            {loading ? (
              Array.from({ length: 5 }).map((_, rIdx) => (
                <tr key={rIdx} className="hover:bg-cream/40">
                  {hasSelection && (
                    <td className="p-3 text-center border-r border-ink/10">
                      <Skeleton className="w-5 h-5 mx-auto" />
                    </td>
                  )}
                  {columns.map((col, cIdx) => (
                    <td key={cIdx} className="p-3">
                      <Skeleton className="h-4 w-3/4" />
                    </td>
                  ))}
                  {rowActions.length > 0 && <td className="p-3"><Skeleton className="w-6 h-6 ml-auto" /></td>}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (hasSelection ? 1 : 0) + (rowActions.length > 0 ? 1 : 0)}
                  className="p-8 text-center"
                >
                  <EmptyState title={emptyTitle} description={emptyMessage} compact />
                </td>
              </tr>
            ) : (
              data.map((row) => {
                const rowId = row[keyField];
                const isSelected = selectedIds.includes(rowId);

                return (
                  <tr
                    key={rowId}
                    className={`
                      transition-colors
                      ${isSelected ? 'bg-brand-orange/5' : 'hover:bg-cream-light/60'}
                    `}
                  >
                    {hasSelection && (
                      <td className="p-3 text-center border-r border-ink/10">
                        <Checkbox
                          checked={isSelected}
                          onChange={(checked) => onSelectRow && onSelectRow(rowId, checked)}
                        />
                      </td>
                    )}

                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`
                          p-3 font-medium
                          ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}
                        `}
                      >
                        {col.render ? col.render(row[col.key], row) : row[col.key]}
                      </td>
                    ))}

                    {rowActions.length > 0 && (
                      <td className="p-3 text-right relative">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuRowId(openMenuRowId === rowId ? null : rowId);
                          }}
                          className="p-1 rounded-[4px] border border-transparent hover:border-ink hover:bg-cream shadow-none hover:shadow-neo-sm transition-all"
                        >
                          <MoreVertical size={16} />
                        </button>

                        {openMenuRowId === rowId && (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => setOpenMenuRowId(null)}
                            />
                            <div className="absolute right-3 top-10 z-50 min-w-36 bg-white border-2 border-ink rounded-[4px] shadow-neo-lg py-1 text-left">
                              {rowActions.map((action, aIdx) => (
                                <button
                                  key={aIdx}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenuRowId(null);
                                    action.onClick(row);
                                  }}
                                  className={`
                                    w-full text-left px-3 py-1.5 text-xs font-bold transition-colors flex items-center gap-2
                                    ${action.danger ? 'text-[#FF453A] hover:bg-[#FF453A]/10' : 'text-ink hover:bg-cream-light'}
                                  `}
                                >
                                  {action.icon && <action.icon size={14} />}
                                  {action.label}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
