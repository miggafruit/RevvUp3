import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getUsers } from '../api/adminApi';
import { UserListItem, Pagination } from '../types/admin';
import StatusBadge from '../components/StatusBadge';

const ROLE_TABS = [
  { value: 'all', label: 'All' },
  { value: 'client', label: 'Clients' },
  { value: 'shop', label: 'Shops' },
  { value: 'service_provider', label: 'Service providers' }
];

const UsersPage: React.FC = () => {
  const [role, setRole] = useState('all');
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<UserListItem[] | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    getUsers({ role, search: search || undefined, page })
      .then((res) => {
        setUsers(res.users);
        setPagination(res.pagination);
      })
      .catch(() => setError("Couldn't load users."));
  }, [role, search, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [role, search]);

  return (
    <div>
      <h1 className="font-display font-bold text-2xl mb-1">Users</h1>
      <p className="text-sm text-text-secondary mb-6">Every account on the marketplace.</p>

      <div className="flex items-center gap-4 mb-5">
        <div className="flex gap-1 bg-surface border border-border rounded-lg p-1">
          {ROLE_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setRole(tab.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                role === tab.value ? 'bg-base text-text-primary' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, business, phone…"
          className="flex-1 bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-brand-green/50 focus:border-brand-green"
        />
      </div>

      {error && <div className="text-sm text-brand-red">{error}</div>}

      <div className="space-y-2">
        {users?.map((u) => (
          <Link
            key={u._id}
            to={`/users/${u._id}`}
            className="flex items-center justify-between bg-surface border border-border rounded-xl px-5 py-3.5 hover:border-brand-green/40 transition-colors"
          >
            <div>
              <div className="text-sm font-medium text-text-primary">
                {u.name}
                {u.businessName && <span className="text-text-secondary"> · {u.businessName}</span>}
              </div>
              <div className="text-xs text-text-secondary font-mono mt-0.5">
                {u.role} · {u.email} · {u.phone}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {u.kycStatus && u.kycStatus !== 'not_submitted' && <StatusBadge status={u.kycStatus} />}
              {u.role === 'service_provider' && u.isDriver && (
                <span className="text-[11px] font-mono text-text-secondary">delivery</span>
              )}
            </div>
          </Link>
        ))}
        {users && users.length === 0 && (
          <div className="border border-dashed border-border rounded-xl p-10 text-center text-sm text-text-secondary">
            No users match this search.
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

export default UsersPage;
