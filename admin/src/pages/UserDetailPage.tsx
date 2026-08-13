import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getUserDetail } from '../api/adminApi';
import { UserDetail } from '../types/admin';
import StatusBadge from '../components/StatusBadge';

const InfoRow: React.FC<{ label: string; value?: string | number | null }> = ({ label, value }) => {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="flex justify-between py-2 border-b border-border last:border-0">
      <span className="text-xs text-text-secondary">{label}</span>
      <span className="text-sm text-text-primary font-mono">{value}</span>
    </div>
  );
};

const UserDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{ user: UserDetail; rideCount: number; orderCount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getUserDetail(id)
      .then(setData)
      .catch(() => setError("Couldn't load this account."));
  }, [id]);

  if (error) return <div className="text-sm text-brand-red">{error}</div>;
  if (!data) return <div className="text-sm text-text-secondary">Loading…</div>;

  const { user, rideCount, orderCount } = data;

  return (
    <div>
      <Link to="/users" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
        ← Back to users
      </Link>

      <div className="mt-4 mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl">{user.name}</h1>
          <p className="text-sm text-text-secondary mt-1">{user.businessName || user.email}</p>
        </div>
        {user.kycStatus && <StatusBadge status={user.kycStatus} />}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-xs text-text-secondary mb-1">Roadside/tow requests</div>
          <div className="font-display font-bold text-2xl">{rideCount}</div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-xs text-text-secondary mb-1">Orders</div>
          <div className="font-display font-bold text-2xl">{orderCount}</div>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl p-5 mb-4">
        <h2 className="text-sm font-semibold mb-2">Account</h2>
        <InfoRow label="Role" value={user.role} />
        <InfoRow label="Email" value={user.email} />
        <InfoRow label="Phone" value={user.phone} />
        <InfoRow label="Business name" value={user.businessName} />
        <InfoRow label="Business address" value={user.businessAddress} />
        <InfoRow label="Category" value={user.category} />
        <InfoRow label="Joined" value={new Date(user.createdAt).toLocaleDateString()} />
      </div>

      {(user.isDriver || (user.roadsideServices && user.roadsideServices.length > 0)) && (
        <div className="bg-surface border border-border rounded-xl p-5 mb-4">
          <h2 className="text-sm font-semibold mb-2">Dispatch capability</h2>
          <InfoRow label="Delivers shop orders" value={user.isDriver ? 'Yes' : 'No'} />
          <InfoRow label="Roadside services" value={user.roadsideServices?.join(', ') || '—'} />
          {user.vehicleDetails && (
            <InfoRow
              label="Vehicle"
              value={`${user.vehicleDetails.make} ${user.vehicleDetails.model} · ${user.vehicleDetails.licensePlate}`}
            />
          )}
        </div>
      )}

      {user.kycDocuments && user.kycDocuments.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-3">KYC documents</h2>
          {user.kycReviewNote && (
            <p className="text-xs text-text-secondary mb-3 italic">Review note: {user.kycReviewNote}</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            {user.kycDocuments.map((doc, i) => (
              <a key={i} href={doc.image} target="_blank" rel="noreferrer" className="block">
                <img src={doc.image} alt={doc.label} className="rounded-lg border border-border w-full h-32 object-cover" />
                <div className="text-xs text-text-secondary mt-1">{doc.label}</div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserDetailPage;
