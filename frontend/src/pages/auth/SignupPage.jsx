import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Lock, User, Building, ArrowRight, CheckCircle2, Circle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export default function SignupPage() {
  const { signup } = useAuth();
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [generalError, setGeneralError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Live checklist evaluation
  const checklist = useMemo(() => {
    const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    const isLengthValid = password.length > 8; // >8 chars means length >= 9
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);

    return {
      email: { label: 'Valid email format', passed: isEmailValid },
      length: { label: 'More than 8 characters (at least 9)', passed: isLengthValid },
      upper: { label: 'At least one uppercase letter', passed: hasUpper },
      lower: { label: 'At least one lowercase letter', passed: hasLower },
      special: { label: 'At least one special character', passed: hasSpecial },
      allPassed: isEmailValid && isLengthValid && hasUpper && hasLower && hasSpecial,
    };
  }, [email, password]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setEmailError('');
    setGeneralError('');

    if (!checklist.allPassed) {
      setGeneralError('Please satisfy all password and email requirements.');
      return;
    }

    setSubmitting(true);
    try {
      await signup({
        full_name: fullName.trim(),
        company_name: companyName.trim(),
        email: email.trim().toLowerCase(),
        password: password,
      });
    } catch (err) {
      if (err.status === 409 || err.code === 'EMAIL_ALREADY_EXISTS' || err.code === 'CUSTOMER_ALREADY_LINKED') {
        setEmailError(err.detail || 'This email address is already registered.');
      } else {
        setGeneralError(err.detail || 'Failed to create account. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream flex flex-col justify-center items-center p-4 py-8">
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
            Create Customer Account
          </p>
        </div>

        {/* Card */}
        <div className="bg-cream-light border-2 border-ink rounded-[4px] p-6 sm:p-8 shadow-neo-md">
          <div className="mb-6">
            <h2 className="font-anton text-2xl uppercase tracking-wide text-ink">
              GET STARTED
            </h2>
            <p className="text-xs text-ink/70 mt-1 font-inter">
              Register your company to manage subscriptions and invoices.
            </p>
          </div>

          {generalError && (
            <div className="mb-4 p-3 bg-red-100 border-2 border-ink text-ink text-xs font-bold rounded-[4px] shadow-neo-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-600 shrink-0" />
              <span>{generalError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Full Name"
              type="text"
              placeholder="e.g. Adithya Narayan"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              icon={User}
              required
            />

            <Input
              label="Company Name"
              type="text"
              placeholder="e.g. Acme Corporation"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              icon={Building}
              required
            />

            <Input
              label="Work Email"
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError('');
                if (generalError) setGeneralError('');
              }}
              error={emailError}
              icon={Mail}
              required
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (generalError) setGeneralError('');
              }}
              icon={Lock}
              required
            />

            {/* Live Password Checklist */}
            <div className="p-3 bg-white border-2 border-ink rounded-[4px] shadow-neo-sm space-y-1.5">
              <div className="text-[11px] font-archivo font-extrabold uppercase tracking-wider text-ink mb-1">
                Security Checklist:
              </div>

              {[
                checklist.email,
                checklist.length,
                checklist.upper,
                checklist.lower,
                checklist.special,
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
              <span>{submitting ? 'Creating account...' : 'Create Account'}</span>
              <ArrowRight size={16} />
            </Button>
          </form>

          <div className="mt-6 text-center text-xs text-ink/80 font-inter">
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-archivo font-extrabold uppercase text-brand-orange hover:underline ml-1"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
