import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPayoutSummary } from '../api/adminApi';
import { PayoutSummaryItem } from '../types/admin';

// Previously the backend fully implemented these endpoints
// (GET /admin/payouts, mark-paid, etc.) but there was no admin screen
// anywhere to actually view or act on them — an admin doing a real
// payout run would have had to hit the raw API directly. This is that
// missing screen.
const PayoutsPage: React.FC = () => {
  const [payouts, setPayouts] = useState<PayoutSummaryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPayoutSummary()
      .then(setPayouts)
      .catch(() => setError("Couldn't load payouts."));
  }, []);

  if (error) return <div className="text-sm text-brand-red">{error}</div>;
  if (!payouts) return <div className="text-sm text-text-secondary">Loading…</div>;

  const totalOwed = payouts.reduce((sum, p) => sum + p.totalOwed, 0);

  return (
    <div>
      <h1 className="font-display font-bold text-2xl mb-1">Payouts</h1>
      <p className="text-sm text-text-secondary mb-6">
        Who the platform currently owes money to, from completed rides and orders. This is a ledger, not an
        automated payment — marking someone paid here is a record that you've already sent them their money
        outside the app (EFT, etc.), not a trigger for a transfer.
      </p>

      <div className="bg-surface border border-border rounded-xl p-5 mb-6">
        <div className="text-xs text-text-secondary mb-2">Total currently owed</div>
        <div className="font-display font-bold text-3xl text-brand-green">R{totalOwed.toLocaleString()}</div>
      </div>

      {payouts.length === 0 ? (
        <div className="text-sm text-text-secondary">Nothing currently owed to anyone.</div>
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-text-secondary text-left">
                <th className="px-5 py-3 font-medium">Recipient</th>
                <th className="px-5 py-3 font-medium">Role</th>
                <th className="px-5 py-3 font-medium">Entries owed</th>
                <th className="px-5 py-3 font-medium text-right">Total owed</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.recipientId} className="border-b border-border last:border-0 hover:bg-base transition-colors">
                  <td className="px-5 py-3">
                    <Link to={`/payouts/${p.recipientId}`} className="text-text-primary hover:text-brand-green transition-colors">
                      {p.recipient?.businessName || p.recipient?.name || 'Unknown'}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-text-secondary capitalize">
                    {p.recipient?.role?.replace('_', ' ') || '—'}
                  </td>
                  <td className="px-5 py-3 text-text-secondary">{p.entryCount}</td>
                  <td className="px-5 py-3 text-right font-mono text-text-primary">R{p.totalOwed.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PayoutsPage;
