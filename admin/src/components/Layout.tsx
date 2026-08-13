import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getOverview } from '../api/adminApi';

const navItems = [
  { to: '/', label: 'Overview', icon: '◈' },
  { to: '/kyc', label: 'KYC Queue', icon: '◉' },
  { to: '/users', label: 'Users', icon: '◎' },
  { to: '/rides', label: 'Roadside & Tow', icon: '◐' },
  { to: '/orders', label: 'Orders', icon: '◑' },
  { to: '/revenue', label: 'Revenue', icon: '◆' }
];

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [pendingKyc, setPendingKyc] = useState<number | null>(null);

  useEffect(() => {
    getOverview()
      .then((data) => setPendingKyc(data.pendingKyc))
      .catch(() => {});
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex bg-base">
      <aside className="w-60 shrink-0 border-r border-border flex flex-col">
        <div className="px-5 py-6">
          <div className="font-display font-bold text-lg tracking-tight">
            <span className="text-brand-red">RevvUp</span>{' '}
            <span className="text-text-secondary font-normal">Admin</span>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-surface text-text-primary'
                    : 'text-text-secondary hover:bg-surface hover:text-text-primary'
                }`
              }
            >
              <span className="flex items-center gap-2.5">
                <span className="text-base opacity-70">{item.icon}</span>
                {item.label}
              </span>
              {item.to === '/kyc' && pendingKyc !== null && pendingKyc > 0 && (
                <span className="min-w-5 h-5 px-1.5 rounded-full bg-brand-red text-white text-[11px] font-mono font-medium flex items-center justify-center">
                  {pendingKyc}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-border">
          <div className="text-sm text-text-primary truncate">{user?.name}</div>
          <div className="text-xs text-text-secondary truncate mb-3">{user?.email}</div>
          <button
            onClick={handleLogout}
            className="text-sm text-text-secondary hover:text-brand-red transition-colors"
          >
            Log out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-8 py-8">{children}</div>
      </main>
    </div>
  );
};

export default Layout;
