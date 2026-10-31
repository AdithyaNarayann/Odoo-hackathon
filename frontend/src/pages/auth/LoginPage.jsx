import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Lock, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }
    setErrorMsg('');
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setErrorMsg(err.detail || 'Invalid email or password.');
    } finally {
      setSubmitting(false);
    }
  };

  const fillQuickAccount = (quickEmail) => {
    setEmail(quickEmail);
    setPassword('BrightLoop2026!');
    setErrorMsg('');
  };

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
          <p className="font-archivo text-xs font-bold uppercase tracking-wider text-ink/70 mt-1">
            Subscription Management System
          </p>
        </div>

        {/* Card */}
        <div className="bg-cream-light border-2 border-ink rounded-[4px] p-6 sm:p-8 shadow-neo-md">
          <div className="mb-6">
            <h2 className="font-anton text-2xl uppercase tracking-wide text-ink">
              SIGN IN
            </h2>
            <p className="text-xs text-ink/70 mt-1 font-inter">
              Enter your credentials to access your portal.
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
              label="Email Address"
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errorMsg) setErrorMsg('');
              }}
              icon={Mail}
              required
            />

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-archivo font-extrabold uppercase tracking-wider text-ink">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-[11px] font-bold text-brand-orange hover:underline"
                >
                  Forgot Password?
                </Link>
              </div>
              <Input
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
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full justify-center mt-2"
              disabled={submitting}
            >
              <span>{submitting ? 'Signing in...' : 'Sign In'}</span>
              <ArrowRight size={16} />
            </Button>
          </form>

          {/* Quick login shortcuts for developer / review convenience */}
          <div className="mt-6 pt-5 border-t-2 border-ink/10">
            <div className="flex items-center gap-1.5 text-[11px] font-archivo font-bold uppercase text-ink/60 mb-2">
              <ShieldCheck size={14} />
              <span>Quick Login Credentials</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => fillQuickAccount('admin@brightloop.io')}
                className="px-2 py-1.5 bg-white border border-ink rounded-[4px] text-[10px] font-bold text-ink hover:bg-cream active:translate-y-0.5 transition-all"
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => fillQuickAccount('staff@brightloop.io')}
                className="px-2 py-1.5 bg-white border border-ink rounded-[4px] text-[10px] font-bold text-ink hover:bg-cream active:translate-y-0.5 transition-all"
              >
                Staff
              </button>
              <button
                type="button"
                onClick={() => fillQuickAccount('customer@example.com')}
                className="px-2 py-1.5 bg-white border border-ink rounded-[4px] text-[10px] font-bold text-ink hover:bg-cream active:translate-y-0.5 transition-all"
              >
                Customer
              </button>
            </div>
          </div>

          <div className="mt-6 text-center text-xs text-ink/80 font-inter">
            Don't have an account?{' '}
            <Link
              to="/signup"
              className="font-archivo font-extrabold uppercase text-brand-orange hover:underline ml-1"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
