import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getKycDetail, reviewKyc } from '../api/adminApi';
import { KycQueueItem } from '../types/admin';

const KycDetailPage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<(KycQueueItem & { kycStatus: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    getKycDetail(userId)
      .then(setUser)
      .catch(() => setError("Couldn't load this submission."));
  }, [userId]);

  const handleReview = async (status: 'approved' | 'rejected') => {
    if (!userId) return;
    setIsSubmitting(true);
    try {
      await reviewKyc(userId, status, note.trim() || undefined);
      navigate('/kyc');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not save this review. Try again.');
      setIsSubmitting(false);
    }
  };

  if (error) return <div className="text-sm text-brand-red">{error}</div>;
  if (!user) return <div className="text-sm text-text-secondary">Loading…</div>;

  return (
    <div>
      <Link to="/kyc" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
        ← Back to queue
      </Link>

      <div className="mt-4 mb-8">
        <h1 className="font-display font-bold text-2xl">{user.name}</h1>
        <p className="text-sm text-text-secondary font-mono mt-1">
          {user.role}
          {user.businessName ? ` · ${user.businessName}` : ''} · {user.email} · {user.phone}
        </p>
        {user.businessAddress && <p className="text-sm text-text-secondary mt-0.5">{user.businessAddress}</p>}
      </div>

      <div className="space-y-6 mb-8">
        {user.kycDocuments.map((doc, i) => (
          <div key={i} className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border">
              <span className="text-sm font-medium text-text-primary">{doc.label}</span>
            </div>
            <button onClick={() => setZoomedImage(doc.image)} className="block w-full bg-base">
              <img src={doc.image} alt={doc.label} className="max-h-96 mx-auto object-contain" />
            </button>
          </div>
        ))}
      </div>

      <div className="mb-4">
        <label className="block text-xs font-medium text-text-secondary mb-1.5">Note (optional)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Visible in this account's review history — e.g. why it was rejected"
          className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-brand-green/50 focus:border-brand-green resize-none"
        />
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => handleReview('approved')}
          disabled={isSubmitting}
          className="flex-1 bg-brand-green text-[#14151A] font-semibold text-sm rounded-lg py-3 hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          Approve
        </button>
        <button
          onClick={() => handleReview('rejected')}
          disabled={isSubmitting}
          className="flex-1 bg-brand-red-dim border border-brand-red/40 text-brand-red font-semibold text-sm rounded-lg py-3 hover:bg-brand-red/10 transition-colors disabled:opacity-50"
        >
          Reject
        </button>
      </div>

      {zoomedImage && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center p-8 z-50 cursor-zoom-out"
          onClick={() => setZoomedImage(null)}
        >
          <img src={zoomedImage} alt="Zoomed document" className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}
    </div>
  );
};

export default KycDetailPage;
