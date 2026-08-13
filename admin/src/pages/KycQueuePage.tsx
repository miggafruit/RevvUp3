import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getKycQueue } from '../api/adminApi';
import { KycQueueItem } from '../types/admin';

const timeAgo = (dateStr: string) => {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
};

const KycQueuePage: React.FC = () => {
  const [items, setItems] = useState<KycQueueItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getKycQueue()
      .then(setItems)
      .catch(() => setError("Couldn't load the KYC queue. Try refreshing."));
  }, []);

  return (
    <div>
      <h1 className="font-display font-bold text-2xl mb-1">KYC Queue</h1>
      <p className="text-sm text-text-secondary mb-8">
        {items ? `${items.length} account${items.length === 1 ? '' : 's'} waiting for review` : 'Loading…'}
      </p>

      {error && <div className="text-sm text-brand-red">{error}</div>}

      {items && items.length === 0 && (
        <div className="border border-dashed border-border rounded-xl p-10 text-center">
          <div className="text-text-secondary text-sm">Nothing waiting on review right now.</div>
        </div>
      )}

      <div className="space-y-2">
        {items?.map((item) => (
          <Link
            key={item._id}
            to={`/kyc/${item._id}`}
            className="flex items-center justify-between bg-surface border border-border rounded-xl px-5 py-4 hover:border-brand-green/40 transition-colors"
          >
            <div>
              <div className="text-sm font-medium text-text-primary">
                {item.name}
                {item.businessName && <span className="text-text-secondary"> · {item.businessName}</span>}
              </div>
              <div className="text-xs text-text-secondary mt-0.5 font-mono">
                {item.role} · {item.kycDocuments.length} document{item.kycDocuments.length === 1 ? '' : 's'} ·
                submitted {timeAgo(item.createdAt)}
              </div>
            </div>
            <span className="text-text-secondary">→</span>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default KycQueuePage;
