import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getRides } from '../api/adminApi';
import { RideListItem, Pagination } from '../types/admin';
import StatusBadge from '../components/StatusBadge';

const STATUS_TABS = ['all', 'pending', 'accepted', 'in_progress', 'completed', 'cancelled'];

const clientName = (client: RideListItem['client']) =>
  typeof client === 'string' ? client : client?.name || 'Unknown';

const RidesPage: React.FC = () => {
  const [status, setStatus] = useState('all');
  const [rides, setRides] = useState<RideListItem[] | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    getRides({ status, page })
      .then((res) => {
        setRides(res.rides);
        setPagination(res.pagination);
      })
      .catch(() => setError("Couldn't load rides."));
  }, [status, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [status]);

  return (
    <div>
      <h1 className="font-display font-bold text-2xl mb-1">Roadside & Tow Requests</h1>
      <p className="text-sm text-text-secondary mb-6">Every request across the marketplace.</p>

      <div className="flex gap-1 bg-surface border border-border rounded-lg p-1 mb-5 w-fit">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setStatus(tab)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${
              status === tab ? 'bg-base text-text-primary' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.replace('_', ' ')}
          </button>
        ))}
      </div>

      {error && <div className="text-sm text-brand-red">{error}</div>}

      <div className="space-y-2">
        {rides?.map((ride) => (
          <Link
            key={ride._id}
            to={`/rides/${ride._id}`}
            className="flex items-center justify-between bg-surface border border-border rounded-xl px-5 py-3.5 hover:border-brand-green/40 transition-colors"
          >
            <div>
              <div className="text-sm font-medium text-text-primary">
                {ride.serviceType.replace('_', ' ')} · {clientName(ride.client)}
              </div>
              <div className="text-xs text-text-secondary font-mono mt-0.5 truncate max-w-md">
                {ride.location.address}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {ride.fare != null && <span className="text-sm font-mono text-text-secondary">R{ride.fare}</span>}
              <StatusBadge status={ride.status} />
            </div>
          </Link>
        ))}
        {rides && rides.length === 0 && (
          <div className="border border-dashed border-border rounded-xl p-10 text-center text-sm text-text-secondary">
            No requests with this status.
          </div>
        )}
      </div>

      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="text-sm text-text-secondary hover:text-text-primary disabled:opacity-30"
          >
            ← Previous
          </button>
          <span className="text-xs text-text-secondary font-mono">
            {pagination.page} / {pagination.pages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
            disabled={page === pagination.pages}
            className="text-sm text-text-secondary hover:text-text-primary disabled:opacity-30"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};

export default RidesPage;
