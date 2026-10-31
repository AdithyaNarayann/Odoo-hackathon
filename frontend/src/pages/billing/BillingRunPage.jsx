import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Calendar,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Layers,
  Clock,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { api } from '../../api/client';
import { formatPaise, formatDate } from '../../utils/format';
import { useToast } from '../../context/ToastContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import ProgressBar from '../../components/ui/ProgressBar';
import StatCard from '../../components/ui/StatCard';

export default function BillingRunPage() {
  const { success, error: toastError } = useToast();

  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [previewResult, setPreviewResult] = useState(null);
  const [runResult, setRunResult] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [progressVal, setProgressVal] = useState(0);

  // 1. Preview Dry-Run Mutation
  const previewMutation = useMutation({
    mutationFn: () =>
      api.post('/api/billing/run', {
        as_of_date: asOfDate,
        dry_run: true,
      }),
    onSuccess: (data) => {
      setPreviewResult(data);
      success(`Preview completed: ${data.created} invoice(s) due.`);
    },
    onError: (err) => {
      toastError(err.detail || 'Failed to generate dry run preview.');
    },
  });

  // 2. Real Billing Run Mutation
  const runMutation = useMutation({
    mutationFn: () => {
      setProgressVal(35);
      return api.post('/api/billing/run', {
        as_of_date: asOfDate,
        dry_run: false,
      });
    },
    onSuccess: (data) => {
      setProgressVal(100);
      setRunResult(data);
      setPreviewResult(null);
      setConfirmModalOpen(false);
      success(`Billing run completed! ${data.created} invoice(s) generated.`);
    },
    onError: (err) => {
      setProgressVal(0);
      setConfirmModalOpen(false);
      toastError(err.detail || 'Billing run encountered an error.');
    },
  });

  const handleStartRun = () => {
    setProgressVal(15);
    runMutation.mutate();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="font-anton text-3xl uppercase tracking-wider text-ink">
          ADVANCE BILLING RUN
        </h1>
        <p className="font-archivo text-xs font-bold uppercase tracking-wide text-ink/70 mt-1">
          Automated batch engine for recurring subscriptions due for billing
        </p>
      </div>

      {/* Control Card */}
      <div className="bg-white border-2 border-ink rounded-[4px] p-6 shadow-neo space-y-4">
        <h2 className="font-anton text-xl uppercase tracking-wider text-ink pb-2 border-b-2 border-ink/10 flex items-center gap-2">
          <Clock size={20} className="text-brand-orange" />
          <span>Billing Parameters</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
          <Input
            label="As-of Date"
            type="date"
            value={asOfDate}
            onChange={(e) => {
              setAsOfDate(e.target.value);
              setPreviewResult(null);
            }}
            required
          />

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => previewMutation.mutate()}
              loading={previewMutation.isPending}
              className="flex-1 justify-center"
            >
              <Sparkles size={16} />
              <span>Dry Run Preview</span>
            </Button>

            <Button
              type="button"
              variant="primary"
              onClick={() => setConfirmModalOpen(true)}
              disabled={runMutation.isPending}
              className="flex-1 justify-center"
            >
              <Play size={16} />
              <span>Execute Run</span>
            </Button>
          </div>
        </div>

        <p className="text-xs text-ink/60 font-medium">
          The engine checks all active, unpaused subscriptions. Advance periods are calculated using relative delta math to avoid month-end drift. Idempotency prevents duplicate billing.
        </p>
      </div>

      {/* Dry Run Preview Result Card */}
      {previewResult && (
        <div className="bg-cream-light border-2 border-ink rounded-[4px] p-6 shadow-neo space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-2 border-b-2 border-ink/10">
            <div className="flex items-center gap-2">
              <Sparkles size={20} className="text-brand-teal" />
              <h2 className="font-anton text-xl uppercase tracking-wider text-ink">
                Dry Run Simulation Results
              </h2>
            </div>
            <span className="px-2 py-0.5 rounded-[3px] text-[10px] font-archivo font-extrabold uppercase bg-brand-teal/20 text-brand-teal border border-brand-teal">
              No database changes saved
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              highlight
              title="Invoices Due to Create"
              value={previewResult.created.toString()}
              subvalue={`${previewResult.due} total due period(s)`}
            />
            <StatCard
              title="Estimated Invoiced Total"
              value={formatPaise(previewResult.total_amount)}
              subvalue="Gross billing projected"
            />
            <StatCard
              title="Already Billed Periods"
              value={previewResult.already_billed.toString()}
              subvalue="Previously invoiced & skipped"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <p className="text-xs font-bold text-ink">
              Ready to generate these {previewResult.created} invoice(s)?
            </p>
            <Button variant="primary" onClick={() => setConfirmModalOpen(true)}>
              <Play size={15} />
              <span>Execute Real Run Now</span>
            </Button>
          </div>
        </div>
      )}

      {/* Run Progress Bar */}
      {runMutation.isPending && (
        <div className="bg-white border-2 border-ink rounded-[4px] p-6 shadow-neo space-y-3">
          <ProgressBar
            value={progressVal}
            max={100}
            label="Processing Batch Subscriptions..."
            sublabel="Generating line items, applying discount rules, resolving tax snapshots"
            color="orange"
          />
        </div>
      )}

      {/* Final Run Results Panel */}
      {runResult && (
        <div className="bg-white border-2 border-ink rounded-[4px] p-6 shadow-neo space-y-5 animate-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-3 border-b-2 border-ink/10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-brand-teal text-white border-2 border-ink flex items-center justify-center font-anton">
                ✓
              </div>
              <div>
                <h2 className="font-anton text-xl uppercase tracking-wider text-ink">
                  Billing Run Execution Results
                </h2>
                <p className="text-xs text-ink/70 font-semibold">
                  Processed as of {formatDate(asOfDate)}
                </p>
              </div>
            </div>

            <Button
              variant="secondary"
              onClick={() => {
                setRunResult(null);
                setPreviewResult(null);
              }}
            >
              <RotateCcw size={15} />
              <span>Clear Results</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <StatCard
              highlight
              title="Invoices Created"
              value={runResult.created.toString()}
              subvalue="Generated successfully"
            />
            <StatCard
              title="Total Billed"
              value={formatPaise(runResult.total_amount)}
              subvalue="Invoiced gross amount"
            />
            <StatCard
              title="Already Billed"
              value={runResult.already_billed.toString()}
              subvalue="Skipped cleanly"
            />
            <StatCard
              title="Failures"
              value={runResult.failed?.length.toString() || '0'}
              subvalue="Errors encountered"
              trend={
                runResult.failed?.length > 0
                  ? { value: `${runResult.failed.length} failed`, positive: false }
                  : { value: '0 errors', positive: true }
              }
            />
          </div>

          {/* If 0 created on second run */}
          {runResult.created === 0 && (
            <div className="p-3 bg-cream-light border-2 border-ink rounded-[4px] text-xs font-bold text-ink flex items-center gap-2">
              <CheckCircle2 size={16} className="text-brand-teal shrink-0" />
              <span>
                Zero invoices created. All eligible subscriptions up to {formatDate(asOfDate)} are already fully billed.
              </span>
            </div>
          )}

          {/* Failure reasons if any */}
          {runResult.failed && runResult.failed.length > 0 && (
            <div className="p-4 bg-red-50 border-2 border-red-500 rounded-[4px] space-y-2">
              <h4 className="font-archivo font-extrabold uppercase text-xs text-red-800">
                Failed Subscriptions ({runResult.failed.length})
              </h4>
              <div className="space-y-1 text-xs text-red-700 max-h-40 overflow-y-auto">
                {runResult.failed.map((f, fIdx) => (
                  <div key={fIdx} className="flex justify-between py-0.5 border-b border-red-200">
                    <span className="font-bold">{f.subscription}</span>
                    <span>{f.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      <Modal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        title="Execute Real Billing Run"
        description={`Are you sure you want to run the billing engine for As-of Date: ${formatDate(asOfDate)}? This will generate actual invoices in Draft/Confirmed status and lock period sequences.`}
        confirmText="Confirm & Run"
        confirmVariant="primary"
        loading={runMutation.isPending}
        onConfirm={handleStartRun}
      />
    </div>
  );
}
