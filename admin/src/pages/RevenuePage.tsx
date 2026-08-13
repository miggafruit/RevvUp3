import React, { useEffect, useState } from 'react';
import { getRevenue } from '../api/adminApi';
import { Revenue } from '../types/admin';

const StatCard: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="bg-surface border border-border rounded-xl p-5">
    <div className="text-xs text-text-secondary mb-2">{label}</div>
    <div className="font-display font-bold text-2xl text-brand-green">R{value.toLocaleString()}</div>
  </div>
);

// Fills in every day of the last 30 days, defaulting to 0 — the API
// only returns days that actually had revenue, but a bar chart with
// gaps silently missing reads as broken data, not "nothing happened
// that day."
const buildFullSeries = (sparse: { date: string; total: number }[]) => {
  const map = new Map(sparse.map((d) => [d.date, d.total]));
  const days: { date: string; total: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ date: key, total: map.get(key) || 0 });
  }
  return days;
};

const RevenuePage: React.FC = () => {
  const [data, setData] = useState<Revenue | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getRevenue()
      .then(setData)
      .catch(() => setError("Couldn't load revenue data."));
  }, []);

  if (error) return <div className="text-sm text-brand-red">{error}</div>;
  if (!data) return <div className="text-sm text-text-secondary">Loading…</div>;

  const series = buildFullSeries(data.dailySeries);
  const maxDay = Math.max(...series.map((d) => d.total), 1);
  const sourceTotal = data.bySource.rides + data.bySource.orders + data.bySource.promotions || 1;

  return (
    <div>
      <h1 className="font-display font-bold text-2xl mb-1">Revenue</h1>
      <p className="text-sm text-text-secondary mb-6">
        Ride fares, order payments, and promotion payments — combined.
      </p>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="All time" value={data.total} />
        <StatCard label="Today" value={data.today} />
        <StatCard label="Last 7 days" value={data.week} />
        <StatCard label="This month" value={data.month} />
      </div>

      <div className="bg-surface border border-border rounded-xl p-5 mb-8">
        <h2 className="text-sm font-semibold mb-4">Last 30 days</h2>
        <div className="flex items-end gap-1 h-32">
          {series.map((day) => (
            <div
              key={day.date}
              className="flex-1 bg-brand-green/70 hover:bg-brand-green rounded-t transition-colors"
              style={{ height: `${Math.max((day.total / maxDay) * 100, day.total > 0 ? 4 : 1)}%` }}
              title={`${day.date}: R${day.total}`}
            />
          ))}
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold mb-4">By source</h2>
        <div className="space-y-3">
          {[
            { label: 'Roadside & tow', value: data.bySource.rides },
            { label: 'Orders', value: data.bySource.orders },
            { label: 'Promotions', value: data.bySource.promotions }
          ].map((row) => (
            <div key={row.label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-text-secondary">{row.label}</span>
                <span className="text-text-primary font-mono">R{row.value.toLocaleString()}</span>
              </div>
              <div className="h-1.5 bg-base rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-green rounded-full"
                  style={{ width: `${(row.value / sourceTotal) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RevenuePage;
