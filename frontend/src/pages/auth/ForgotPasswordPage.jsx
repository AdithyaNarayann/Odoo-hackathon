import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Send, CheckCircle2 } from 'lucide-react';
import { api } from '../../api/client';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      setErrorMsg('Please enter your email address.');
      return;
    }
    setErrorMsg('');
    setSubmitting(true);
    try {
      await api.post('/api/auth/forgot-password', { email: email.trim().toLowerCase() });
      setSubmitted(true);
    } catch (err) {
      // In accordance with standard security practices and backend design, show success or error
      setErrorMsg(err.detail || 'Failed to process request.');
    } finally {
      setSubmitting(false);
    }
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
        </div>

        {/* Card */}
        <div className="bg-cream-light border-2 border-ink rounded-[4px] p-6 sm:p-8 shadow-neo-md">
          {submitted ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 bg-brand-teal text-white border-2 border-ink rounded-full flex items-center justify-center mx-auto mb-4 shadow-neo-sm">
                <CheckCircle2 size={32} />
              </div>
              <h2 className="font-anton text-2xl uppercase tracking-wide text-ink mb-2">
                CHECK YOUR INBOX
              </h2>
              <p className="text-xs text-ink/80 font-inter mb-6">
                If an account exists for <strong className="text-ink">{email}</strong>, we've sent instructions to reset your password.
              </p>
              <Link to="/login">
                <Button variant="secondary" className="w-full justify-center">
                  <ArrowLeft size={16} />
                  <span>Return to Sign In</span>
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="font-anton text-2xl uppercase tracking-wide text-ink">
                  RESET PASSWORD
                </h2>
                <p className="text-xs text-ink/70 mt-1 font-inter">
                  Enter your email address and we'll send you a password reset link.
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

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full justify-center mt-2"
                  disabled={submitting}
                >
                  <span>{submitting ? 'Sending Link...' : 'Send Reset Link'}</span>
                  <Send size={16} />
                </Button>
              </form>

              <div className="mt-6 text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-xs font-archivo font-extrabold uppercase text-ink hover:text-brand-orange transition-colors"
                >
                  <ArrowLeft size={14} />
                  <span>Back to Sign In</span>
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
