import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getOverview } from '../api/adminApi';
import { Overview } from '../types/admin';

const StatCard: React.FC<{ label: string; value: number | string; accent?: 'red' | 'green' | 'none' }> = ({
  label,
  value,
  accent = 'none'
}) => (
  <div className="bg-surface border border-border rounded-xl p-5">
    <div className="text-xs text-text-secondary mb-2">{label}</div>
    <div
      className={`font-display font-bold text-3xl ${
        accent === 'red' ? 'text-brand-red' : accent === 'green' ? 'text-brand-green' : 'text-text-primary'
      }`}
    >
      {value}
    </div>
  </div>
);

const OverviewPage: React.FC = () => {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getOverview()
      .then(setData)
      .catch(() => setError("Couldn't load the overview. Try refreshing."));
  }, []);

  return (
    <div>
      <h1 className="font-display font-bold text-2xl mb-1">Overview</h1>
      <p className="text-sm text-text-secondary mb-8">What needs attention right now.</p>

      {error && <div className="text-sm text-brand-red mb-6">{error}</div>}

      {!data && !error && <div className="text-sm text-text-secondary">Loading…</div>}

      {data && (
        <>
          {data.pendingKyc > 0 && (
            <Link
              to="/kyc"
              className="block bg-brand-red-dim border border-brand-red/30 rounded-xl p-4 mb-6 hover:border-brand-red/60 transition-colors"
            >
              <span className="text-sm text-brand-red font-medium">
                {data.pendingKyc} account{data.pendingKyc === 1 ? '' : 's'} waiting on KYC review →
              </span>
            </Link>
          )}

          <div className="grid grid-cols-3 gap-4 mb-4">
            <StatCard label="Pending KYC" value={data.pendingKyc} accent={data.pendingKyc > 0 ? 'red' : 'none'} />
            <StatCard label="Active roadside/tow requests" value={data.activeRides} />
            <StatCard label="Active deliveries" value={data.activeDeliveries} />
          </div>

          <div className="grid grid-cols-3 gap-4 mb-8">
            <StatCard label="Pending orders" value={data.pendingOrders} />
            <StatCard label="Active products" value={data.totalProducts} />
            <StatCard label="Active services" value={data.totalServices} />
          </div>

          <h2 className="font-display font-semibold text-lg mb-3">Accounts</h2>
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Clients" value={data.users.clients} />
            <StatCard label="Shops" value={data.users.shops} />
            <StatCard label="Service providers" value={data.users.serviceProviders} />
          </div>
        </>
      )}
    </div>
  );
};

export default OverviewPage;
