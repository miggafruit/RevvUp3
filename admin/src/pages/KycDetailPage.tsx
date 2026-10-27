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
  const [clearanceChecked, setClearanceChecked] = useState(false);

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
      await reviewKyc(userId, status, note.trim() || undefined, clearanceChecked);
      navigate('/kyc');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not save this review. Try again.');
      setIsSubmitting(false);
    }
  };

  if (error) return <div className="text-sm text-brand-red">{error}</div>;
  if (!user) return <div className="text-sm text-text-secondary">Loading…</div>;

  const hasBankingDetails = !!(
    user.bankingDetails?.accountHolder &&
    user.bankingDetails?.bankName &&
    user.bankingDetails?.branchCode
  );

  // Mirrors backend config/clearance.js: individuals and every driver need one.
  const needsClearance =
    user.role === 'service_provider' &&
    (user.providerType !== 'business' || !!user.isDriver || (user.roadsideServices?.length ?? 0) > 0);
  const clearanceDoc = user.kycDocuments.find((d) => d.type === 'police_clearance');
  const clearanceIssued = user.policeClearance?.issuedOn ? new Date(user.policeClearance.issuedOn) : null;
  const approveBlocked = needsClearance && (!clearanceDoc || !clearanceIssued || !clearanceChecked);

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

      {needsClearance && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-text-primary mb-2">Police clearance (criminal record check)</h2>
          <div className="bg-surface border border-border rounded-xl p-4 text-sm text-text-secondary space-y-2">
            <p>
              Required because this account is {user.providerType === 'business' ? '' : 'an individual provider and/or '}
              a driver. Open the certificate above, check it is genuine, in their name, and shows no disqualifying record.
            </p>
            <p><span className="text-text-primary font-medium">Certificate uploaded:</span> {clearanceDoc ? 'Yes' : 'NO — cannot approve'}</p>
            <p><span className="text-text-primary font-medium">Issue date:</span> {clearanceIssued ? clearanceIssued.toLocaleDateString() : 'Not provided'}</p>
            <p><span className="text-text-primary font-medium">Reference no.:</span> {user.policeClearance?.referenceNumber || '—'}</p>
            <label className="flex items-start gap-2 pt-2 text-text-primary">
              <input type="checkbox" checked={clearanceChecked} onChange={(e) => setClearanceChecked(e.target.checked)} className="mt-1" />
              <span>I have personally checked this police clearance certificate and it is acceptable.</span>
            </label>
          </div>
        </div>
      )}

      <div className="mb-8">
        <h2 className="text-sm font-semibold text-text-primary mb-2">Banking Details</h2>
        {user.bankingDetails?.accountHolder && user.bankingDetails?.bankName && user.bankingDetails?.branchCode ? (
          <div className="bg-surface border border-border rounded-xl p-4 text-sm text-text-secondary space-y-1">
            <p><span className="text-text-primary font-medium">Account holder:</span> {user.bankingDetails.accountHolder}</p>
            <p><span className="text-text-primary font-medium">Bank:</span> {user.bankingDetails.bankName}</p>
            <p><span className="text-text-primary font-medium">Account number:</span> {user.bankingDetails.accountNumber || '—'}</p>
            <p><span className="text-text-primary font-medium">Branch code:</span> {user.bankingDetails.branchCode}</p>
            {user.bankingDetails.accountType && (
              <p><span className="text-text-primary font-medium">Account type:</span> {user.bankingDetails.accountType}</p>
            )}
          </div>
        ) : (
          <div className="bg-brand-red-dim border border-brand-red/40 rounded-xl p-4 text-sm text-brand-red">
            No banking details on file yet — this account can't be approved until they add banking details from their profile.
          </div>
        )}
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
          disabled={isSubmitting || approveBlocked}
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
