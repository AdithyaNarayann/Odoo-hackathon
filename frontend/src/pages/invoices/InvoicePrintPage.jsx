import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Printer, ArrowLeft, AlertCircle } from 'lucide-react';
import { api } from '../../api/client';
import { formatPaise, formatDate } from '../../utils/format';
import Button from '../../components/ui/Button';
import Skeleton from '../../components/ui/Skeleton';

export default function InvoicePrintPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['invoice-print', id],
    queryFn: () => api.get(`/api/invoices/${id}/print`),
  });

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white p-8 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center p-4">
        <div className="bg-white border-2 border-ink p-8 rounded-[4px] shadow-neo text-center max-w-md">
          <AlertCircle size={32} className="text-red-600 mx-auto mb-3" />
          <h2 className="font-anton text-2xl uppercase tracking-wide text-ink mb-2">
            Invoice Not Found
          </h2>
          <p className="text-xs text-ink/70 mb-4">
            The printable invoice could not be loaded or you lack permission.
          </p>
          <Button variant="secondary" onClick={() => navigate(-1)}>
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const { company, invoice } = data;

  return (
    <div className="min-h-screen bg-zinc-100 py-6 px-4 print:p-0 print:bg-white text-zinc-900 font-inter">
      {/* Print Action Header (Hidden in Print) */}
      <div className="max-w-4xl mx-auto mb-6 flex items-center justify-between print:hidden">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs font-archivo font-extrabold uppercase text-ink hover:text-brand-orange transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>

        <Button variant="primary" onClick={handlePrint}>
          <Printer size={16} />
          <span>Print / Save as PDF</span>
        </Button>
      </div>

      {/* Invoice Sheet Page */}
      <div className="max-w-4xl mx-auto bg-white border border-zinc-300 shadow-md p-8 sm:p-12 print:border-0 print:shadow-none print:p-0 print:max-w-none">
        {/* Header: Company Info and Invoice Title */}
        <div className="flex justify-between items-start border-b-2 border-zinc-800 pb-6 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded bg-zinc-900 text-white flex items-center justify-center font-bold font-anton text-lg">
                BL
              </div>
              <span className="font-anton text-2xl uppercase tracking-wider text-zinc-900">
                {company.name}
              </span>
            </div>
            <div className="text-xs text-zinc-600 space-y-0.5">
              <div>{company.address}</div>
              <div>Email: {company.email} | Phone: {company.phone}</div>
              <div className="font-mono font-bold text-zinc-800">GSTIN: {company.tax_id}</div>
            </div>
          </div>

          <div className="text-right">
            <h1 className="font-anton text-3xl uppercase tracking-wide text-zinc-900 mb-1">
              TAX INVOICE
            </h1>
            <div className="font-mono font-bold text-sm text-zinc-800">{invoice.number}</div>
            <div className="text-xs text-zinc-500 uppercase font-semibold mt-1">
              Status: <span className="text-zinc-900 font-bold">{invoice.status}</span>
            </div>
          </div>
        </div>

        {/* Bill To & Invoice Info */}
        <div className="grid grid-cols-2 gap-8 mb-8 text-xs">
          <div>
            <h3 className="font-bold uppercase tracking-wider text-zinc-400 mb-1">Billed To</h3>
            <div className="font-bold text-sm text-zinc-900">{invoice.customer_name}</div>
            <div className="text-zinc-800 font-medium">{invoice.company_name}</div>
            <div className="text-zinc-600">{invoice.customer_email}</div>
            {invoice.billing_address_line1 && <div className="text-zinc-600">{invoice.billing_address_line1}</div>}
            {invoice.billing_address_line2 && <div className="text-zinc-600">{invoice.billing_address_line2}</div>}
            <div className="text-zinc-600">
              {[invoice.city, invoice.state, invoice.postal_code].filter(Boolean).join(', ')}
            </div>
            {invoice.country && <div className="text-zinc-600">{invoice.country}</div>}
            {invoice.tax_id && (
              <div className="font-mono font-bold text-zinc-800 mt-1">
                GSTIN: {invoice.tax_id}
              </div>
            )}
          </div>

          <div className="space-y-1.5 text-right">
            <div>
              <span className="text-zinc-500 mr-2">Invoice Date:</span>
              <strong className="text-zinc-900">{formatDate(invoice.invoice_date)}</strong>
            </div>
            <div>
              <span className="text-zinc-500 mr-2">Payment Due Date:</span>
              <strong className="text-zinc-900">{formatDate(invoice.due_date)}</strong>
            </div>
            <div>
              <span className="text-zinc-500 mr-2">Billing Period:</span>
              <span className="text-zinc-800">
                {formatDate(invoice.period_start)} – {formatDate(invoice.period_end)}
              </span>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <table className="w-full text-left border-collapse text-xs mb-8">
          <thead>
            <tr className="border-b-2 border-zinc-800 bg-zinc-50">
              <th className="py-2.5 px-3 font-bold uppercase text-zinc-700">Description</th>
              <th className="py-2.5 px-3 font-bold uppercase text-zinc-700 text-center">Qty</th>
              <th className="py-2.5 px-3 font-bold uppercase text-zinc-700 text-right">Unit Price</th>
              <th className="py-2.5 px-3 font-bold uppercase text-zinc-700 text-right">Discount</th>
              <th className="py-2.5 px-3 font-bold uppercase text-zinc-700 text-right">Tax Rate</th>
              <th className="py-2.5 px-3 font-bold uppercase text-zinc-700 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {invoice.lines?.map((line) => (
              <tr key={line.id}>
                <td className="py-3 px-3 font-medium text-zinc-900">{line.description}</td>
                <td className="py-3 px-3 text-center text-zinc-800">{line.quantity}</td>
                <td className="py-3 px-3 text-right tabular-nums text-zinc-800">{formatPaise(line.unit_price)}</td>
                <td className="py-3 px-3 text-right tabular-nums text-zinc-600">
                  {line.discount_amount > 0 ? `-${formatPaise(line.discount_amount)}` : '—'}
                </td>
                <td className="py-3 px-3 text-right text-zinc-600">
                  {line.tax_rate > 0 ? `${(line.tax_rate / 100).toFixed(0)}%` : '0%'}
                </td>
                <td className="py-3 px-3 text-right tabular-nums font-bold text-zinc-900">
                  {formatPaise(line.line_total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Calculation Totals */}
        <div className="flex justify-end mb-12">
          <div className="w-64 space-y-1.5 text-xs">
            <div className="flex justify-between py-1 border-b border-zinc-200">
              <span className="text-zinc-600">Subtotal:</span>
              <span className="font-semibold text-zinc-900">{formatPaise(invoice.subtotal)}</span>
            </div>
            {invoice.discount_total > 0 && (
              <div className="flex justify-between py-1 border-b border-zinc-200 text-teal-700">
                <span>Discount ({invoice.discount_name || 'Promo'}):</span>
                <span>-{formatPaise(invoice.discount_total)}</span>
              </div>
            )}
            <div className="flex justify-between py-1 border-b border-zinc-200">
              <span className="text-zinc-600">Tax Total:</span>
              <span className="font-semibold text-zinc-900">+{formatPaise(invoice.tax_total)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b-2 border-zinc-800 text-sm font-bold">
              <span>Total:</span>
              <span className="text-zinc-900">{formatPaise(invoice.total)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-zinc-200 text-zinc-600">
              <span>Amount Paid:</span>
              <span>{formatPaise(invoice.amount_paid)}</span>
            </div>
            <div className="flex justify-between py-2 text-sm font-bold bg-zinc-100 px-2 rounded">
              <span>Balance Due:</span>
              <span className="text-zinc-900">{formatPaise(invoice.balance)}</span>
            </div>
          </div>
        </div>

        {/* Terms & Payment Instructions */}
        <div className="border-t border-zinc-200 pt-6 text-[11px] text-zinc-500 space-y-1">
          <div className="font-bold text-zinc-700 uppercase">Payment Instructions:</div>
          <div>Please remit payment via NEFT/RTGS to Bank: HDFC Bank, A/C: 50200012345678, IFSC: HDFC0000123.</div>
          <div>For UPI transfers, scan your customer payment link or remit to brightloop@upi.</div>
          <div className="pt-2 text-zinc-400">Thank you for your business. For billing queries, contact {company.email}.</div>
        </div>
      </div>
    </div>
  );
}
