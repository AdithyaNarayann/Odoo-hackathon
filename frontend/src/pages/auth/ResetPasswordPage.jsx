import React, { useState, useMemo } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Lock, ArrowRight, CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { success } = useToast();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Password checklist
  const checklist = useMemo(() => {
    const isLengthValid = password.length > 8;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    const matches = password.length > 0 && password === confirmPassword;

    return {
      length: { label: 'More than 8 characters (at least 9)', passed: isLengthValid },
      upper: { label: 'At least one uppercase letter', passed: hasUpper },
      lower: { label: 'At least one lowercase letter', passed: hasLower },
      special: { label: 'At least one special character', passed: hasSpecial },
      match: { label: 'Passwords match', passed: matches },
      allPassed: isLengthValid && hasUpper && hasLower && hasSpecial && matches,
    };
  }, [password, confirmPassword]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      setErrorMsg('Missing or invalid reset token. Please request a new link.');
      return;
    }

    if (!checklist.allPassed) {
      setErrorMsg('Please satisfy all password security requirements.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      await api.post('/api/auth/reset-password', {
        token: token,
        new_password: password,
      });
      success('Password reset successfully! You can now sign in.');
      navigate('/login');
    } catch (err) {
      setErrorMsg(err.detail || 'Failed to reset password. The token may be expired or invalid.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-cream flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-md bg-cream-light border-2 border-ink rounded-[4px] p-8 shadow-neo-md text-center">
          <div className="w-12 h-12 bg-amber-400 text-ink border-2 border-ink rounded-full flex items-center justify-center mx-auto mb-4 shadow-neo-sm">
            <AlertCircle size={28} />
          </div>
          <h2 className="font-anton text-2xl uppercase tracking-wide text-ink mb-2">
            INVALID RESET LINK
          </h2>
          <p className="text-xs text-ink/70 font-inter mb-6">
            No reset token was found in your URL. Please request a new password reset link.
          </p>
          <Link to="/forgot-password">
            <Button variant="primary" className="w-full justify-center">
              Request Reset Link
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-[4px] border-2 border-ink bg-brand-orange text-white shadow-neo font-anton text-2xl mb-3">
            BL
          </div>
          <h1 className="font-anton text-3xl uppercase tracking-wider text-ink">
            BRIGHTLOOP
          </h1>
        </div>

        {/* Card */}
        <div className="bg-cream-light border-2 border-ink rounded-[4px] p-6 sm:p-8 shadow-neo-md">
          <div className="mb-6">
            <h2 className="font-anton text-2xl uppercase tracking-wide text-ink">
              SET NEW PASSWORD
            </h2>
            <p className="text-xs text-ink/70 mt-1 font-inter">
              Please enter your new strong password below.
            </p>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 bg-red-100 border-2 border-ink text-ink text-xs font-bold rounded-[4px] shadow-neo-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="New Password"
              type="password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errorMsg) setErrorMsg('');
              }}
              icon={Lock}
              required
            />

            <Input
              label="Confirm New Password"
              type="password"
              placeholder="••••••••••••"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (errorMsg) setErrorMsg('');
              }}
              icon={Lock}
              required
            />

            {/* Checklist */}
            <div className="p-3 bg-white border-2 border-ink rounded-[4px] shadow-neo-sm space-y-1.5">
              <div className="text-[11px] font-archivo font-extrabold uppercase tracking-wider text-ink mb-1">
                Password Rules:
              </div>

              {[
                checklist.length,
                checklist.upper,
                checklist.lower,
                checklist.special,
                checklist.match,
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs">
                  {item.passed ? (
                    <CheckCircle2 size={14} className="text-brand-teal shrink-0" />
                  ) : (
                    <Circle size={14} className="text-ink/40 shrink-0" />
                  )}
                  <span
                    className={
                      item.passed
                        ? 'text-ink font-medium'
                        : 'text-ink/60'
                    }
                  >
                    {item.label}
                  </span>
                </div>
              ))}
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full justify-center mt-3"
              disabled={submitting || !checklist.allPassed}
            >
              <span>{submitting ? 'Resetting Password...' : 'Reset Password'}</span>
              <ArrowRight size={16} />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
