import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getOrderDetail } from '../api/adminApi';
import { OrderListItem } from '../types/admin';
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

const clientName = (client: OrderListItem['client']) =>
  typeof client === 'string' ? client : client?.name || 'Unknown';
const clientPhone = (client: OrderListItem['client']) => (typeof client === 'string' ? '' : client?.phone || '');

const OrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderListItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getOrderDetail(id)
      .then(setOrder)
      .catch(() => setError("Couldn't load this order."));
  }, [id]);

  if (error) return <div className="text-sm text-brand-red">{error}</div>;
  if (!order) return <div className="text-sm text-text-secondary">Loading…</div>;

  return (
    <div>
      <Link to="/orders" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
        ← Back to orders
      </Link>

      <div className="mt-4 mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl">{clientName(order.client)}</h1>
          <p className="text-sm text-text-secondary mt-1">
            {clientPhone(order.client)} · R{order.totalAmount}
          </p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div className="bg-surface border border-border rounded-xl p-5 mb-4">
        <h2 className="text-sm font-semibold mb-2">Delivery</h2>
        <InfoRow label="Address" value={order.deliveryAddress} />
        <InfoRow label="Contact phone" value={order.contactPhone} />
        <InfoRow label="Payment" value={order.paymentStatus} />
        <InfoRow label="Delivery fee" value={order.deliveryFee ? `R${order.deliveryFee}` : undefined} />
        <InfoRow label="Placed" value={new Date(order.createdAt).toLocaleString()} />
      </div>

      <div className="bg-surface border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold mb-3">Items</h2>
        <div className="space-y-2">
          {order.items.map((item, i) => (
            <div key={i} className="flex justify-between text-sm py-2 border-b border-border last:border-0">
              <div>
                <span className="text-text-primary">{item.nameSnapshot}</span>
                <span className="text-text-secondary font-mono"> × {item.quantity}</span>
              </div>
              <span className="text-text-secondary font-mono">R{item.lineTotal}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default OrderDetailPage;
