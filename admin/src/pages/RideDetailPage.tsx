import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getRideDetail, adminCancelRide } from '../api/adminApi';
import { RideListItem } from '../types/admin';
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

const clientName = (client: RideListItem['client']) =>
  typeof client === 'string' ? client : client?.name || 'Unknown';
const clientPhone = (client: RideListItem['client']) => (typeof client === 'string' ? '' : client?.phone || '');

const RideDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [ride, setRide] = useState<RideListItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelForm, setShowCancelForm] = useState(false);

  useEffect(() => {
    if (!id) return;
    getRideDetail(id)
      .then(setRide)
      .catch(() => setError("Couldn't load this request."));
  }, [id]);

  const handleCancel = async () => {
    if (!id) return;
    setIsCancelling(true);
    try {
      await adminCancelRide(id, reason.trim() || undefined);
      const updated = await getRideDetail(id);
      setRide(updated);
      setShowCancelForm(false);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not cancel this request.');
    } finally {
      setIsCancelling(false);
    }
  };

  if (error && !ride) return <div className="text-sm text-brand-red">{error}</div>;
  if (!ride) return <div className="text-sm text-text-secondary">Loading…</div>;

  const canCancel = !['completed', 'cancelled'].includes(ride.status);

  return (
    <div>
      <Link to="/rides" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
        ← Back to requests
      </Link>

      <div className="mt-4 mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl capitalize">{ride.serviceType.replace('_', ' ')}</h1>
          <p className="text-sm text-text-secondary mt-1">
            {clientName(ride.client)}
            {clientPhone(ride.client) && ` · ${clientPhone(ride.client)}`}
          </p>
        </div>
        <StatusBadge status={ride.status} />
      </div>

      {error && <div className="text-sm text-brand-red mb-4">{error}</div>}

      <div className="bg-surface border border-border rounded-xl p-5 mb-4">
        <h2 className="text-sm font-semibold mb-2">Request</h2>
        <InfoRow label="Location" value={ride.location.address} />
        {ride.destination && <InfoRow label="Delivery point" value={ride.destination.address} />}
        {ride.vehicleDetails && (
          <InfoRow
            label="Vehicle"
            value={`${ride.vehicleDetails.make} ${ride.vehicleDetails.model} · ${ride.vehicleDetails.licensePlate}`}
          />
        )}
        <InfoRow label="Fare" value={ride.fare != null ? `R${ride.fare}` : undefined} />
        <InfoRow label="Payment" value={ride.paymentStatus} />
        <InfoRow label="Payment method" value={ride.paymentMethod} />
        <InfoRow label="Requested" value={new Date(ride.createdAt).toLocaleString()} />
      </div>

      {ride.driver && (
        <div className="bg-surface border border-border rounded-xl p-5 mb-4">
          <h2 className="text-sm font-semibold mb-2">Driver</h2>
          <InfoRow label="Name" value={ride.driver.driver_name} />
          <InfoRow label="Phone" value={ride.driver.driver_phone} />
          <InfoRow label="Vehicle" value={ride.driver.driver_vehicle} />
        </div>
      )}

      {ride.status === 'cancelled' && (
        <div className="bg-surface border border-border rounded-xl p-5 mb-4">
          <h2 className="text-sm font-semibold mb-2">Cancellation</h2>
          <InfoRow label="Cancelled by" value={ride.cancelledBy} />
          <InfoRow label="Reason" value={ride.cancelReason} />
        </div>
      )}

      {canCancel && (
        <div className="bg-surface border border-border rounded-xl p-5">
          {!showCancelForm ? (
            <button
              onClick={() => setShowCancelForm(true)}
              className="text-sm text-brand-red font-medium hover:opacity-80 transition-opacity"
            >
              Cancel this request
            </button>
          ) : (
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">
                Reason (shown to the client)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                className="w-full bg-base border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-red/50 focus:border-brand-red resize-none mb-3"
                placeholder="e.g. Duplicate request, client contacted support…"
              />
              <div className="flex gap-3">
                <button
                  onClick={handleCancel}
                  disabled={isCancelling}
                  className="bg-brand-red text-white text-sm font-semibold rounded-lg px-4 py-2 hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isCancelling ? 'Cancelling…' : 'Confirm cancellation'}
                </button>
                <button
                  onClick={() => setShowCancelForm(false)}
                  className="text-sm text-text-secondary hover:text-text-primary"
                >
                  Never mind
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RideDetailPage;
