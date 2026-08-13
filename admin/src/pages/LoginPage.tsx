import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Could not log in. Check your details and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-base px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="font-display font-bold text-2xl tracking-tight mb-1">
            <span className="text-brand-red">RevvUp</span>{' '}
            <span className="text-text-secondary font-normal">Admin</span>
          </div>
          <p className="text-sm text-text-secondary">Sign in to manage the marketplace</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-xl p-6 space-y-4">
          {error && (
            <div className="text-sm text-brand-red bg-brand-red-dim border border-brand-red/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-base border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-brand-green/50 focus:border-brand-green"
              placeholder="you@revvup.com"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-base border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-green/50 focus:border-brand-green"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-brand-green text-[#14151A] font-semibold text-sm rounded-lg py-2.5 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
