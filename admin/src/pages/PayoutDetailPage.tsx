import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getPayoutDetail, markPayoutsPaid } from '../api/adminApi';
import { PayoutDetail } from '../types/admin';

const SOURCE_LABELS: Record<string, string> = {
  ride_fare: 'Roadside / tow job',
  order_seller_share: 'Order (seller share)',
  delivery_fee: 'Delivery'
};

const PayoutDetailPage: React.FC = () => {
  const { recipientId } = useParams<{ recipientId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<PayoutDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [isMarking, setIsMarking] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = () => {
    if (!recipientId) return;
    getPayoutDetail(recipientId)
      .then(setData)
      .catch(() => setError("Couldn't load this payout record."));
  };

  useEffect(load, [recipientId]);

  const handleMarkPaid = async () => {
    if (!recipientId) return;
    setIsMarking(true);
    try {
      await markPayoutsPaid(recipientId, note.trim() || undefined);
      setConfirmOpen(false);
      setNote('');
      load();
    } catch {
      setError("Couldn't mark these entries as paid. Please try again.");
    } finally {
      setIsMarking(false);
    }
  };

  if (error) return <div className="text-sm text-brand-red">{error}</div>;
  if (!data) return <div className="text-sm text-text-secondary">Loading…</div>;

  const { recipient, entries } = data;
  const owedEntries = entries.filter((e) => e.status === 'owed');
  const owedTotal = owedEntries.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div>
      <Link to="/payouts" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
        ← Back to payouts
      </Link>

      <div className="mt-4 mb-6">
        <h1 className="font-display font-bold text-2xl">{recipient.businessName || recipient.name}</h1>
        <p className="text-sm text-text-secondary mt-1 capitalize">
          {recipient.role.replace('_', ' ')} · {recipient.email} · {recipient.phone}
        </p>
      </div>

      <div className="bg-surface border border-border rounded-xl p-5 mb-6 flex items-center justify-between">
        <div>
          <div className="text-xs text-text-secondary mb-2">Currently owed</div>
          <div className="font-display font-bold text-3xl text-brand-green">R{owedTotal.toLocaleString()}</div>
        </div>
        {owedEntries.length > 0 && (
          <button
            onClick={() => setConfirmOpen(true)}
            className="bg-brand-green text-black font-semibold text-sm px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity"
          >
            Mark all as paid
          </button>
        )}
      </div>

      {confirmOpen && (
        <div className="bg-surface border border-brand-green/40 rounded-xl p-5 mb-6">
          <p className="text-sm text-text-primary mb-3">
            This records that you've already paid <strong>{recipient.name}</strong> R{owedTotal.toLocaleString()}{' '}
            outside the app (EFT, cash, etc.) — it does not send any money. Confirm you've actually made this
            payment before continuing.
          </p>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note (e.g. EFT reference)"
            className="w-full bg-base border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-brand-green/50 focus:border-brand-green mb-3"
          />
          <div className="flex gap-3">
            <button
              onClick={handleMarkPaid}
              disabled={isMarking}
              className="bg-brand-green text-black font-semibold text-sm px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isMarking ? 'Saving…' : 'Confirm — I\'ve paid this'}
            </button>
            <button
              onClick={() => setConfirmOpen(false)}
              className="text-sm text-text-secondary hover:text-text-primary transition-colors px-3"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-text-secondary text-left">
              <th className="px-5 py-3 font-medium">Source</th>
              <th className="px-5 py-3 font-medium">Date</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e._id} className="border-b border-border last:border-0">
                <td className="px-5 py-3 text-text-primary">{SOURCE_LABELS[e.sourceType] || e.sourceType}</td>
                <td className="px-5 py-3 text-text-secondary">{new Date(e.createdAt).toLocaleDateString()}</td>
                <td className="px-5 py-3">
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      e.status === 'paid' ? 'bg-brand-green/15 text-brand-green' : 'bg-brand-red/15 text-brand-red'
                    }`}
                  >
                    {e.status}
                  </span>
                </td>
                <td className="px-5 py-3 text-right font-mono text-text-primary">R{e.amount.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PayoutDetailPage;
