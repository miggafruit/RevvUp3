import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from './AuthContext';
import { useEHailingSocketConnection } from './EHailingSocketContext';
import { getRewardsSummary, markRewardsSeen, RewardsSummary } from '../api/rewardsApi';
import RewardCelebration from '../components/RewardCelebration';

interface Celebration {
  transactionId?: string;
  points: number;
  valueRand: number;
  balance?: number;
  sellerName?: string;
}

interface RewardsContextValue {
  summary: RewardsSummary | null;
  refresh: () => Promise<void>;
}

const RewardsContext = createContext<RewardsContextValue>({ summary: null, refresh: async () => {} });

/**
 * Keeps the client's points balance live and plays the celebration whenever
 * points are earned. Three layers so a celebration is never missed:
 *   1. the live socket event 'points_earned' (instant),
 *   2. a refresh whenever the app returns to the foreground,
 *   3. a 30s poll that also picks up any 'unseen' earn the server still has.
 */
export const RewardsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { socket } = useEHailingSocketConnection();
  const [summary, setSummary] = useState<RewardsSummary | null>(null);
  const [queue, setQueue] = useState<Celebration[]>([]);
  const shownIds = useRef<Set<string>>(new Set());

  const isClient = user?.role === 'client';

  const enqueue = useCallback((c: Celebration) => {
    if (c.transactionId) {
      if (shownIds.current.has(c.transactionId)) return;
      shownIds.current.add(c.transactionId);
    }
    setQueue((q) => [...q, c]);
  }, []);

  const refresh = useCallback(async () => {
    if (!isClient) return;
    try {
      const data = await getRewardsSummary();
      setSummary(data);
      data.unseen.forEach((tx) =>
        enqueue({ transactionId: tx._id, points: tx.points, valueRand: tx.valueRand, balance: data.points, sellerName: tx.sellerName })
      );
    } catch (error) {
      console.warn('Failed to load rewards summary', error);
    }
  }, [isClient, enqueue]);

  useEffect(() => {
    if (!isClient) {
      setSummary(null);
      return;
    }
    refresh();
    const interval = setInterval(refresh, 30000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [isClient, refresh]);

  useEffect(() => {
    if (!socket || !isClient) return;
    const onEarned = (data: any) => {
      enqueue({
        transactionId: data.transactionId,
        points: data.points,
        valueRand: data.valueRand,
        balance: data.balance,
        sellerName: data.sellerName
      });
      refresh();
    };
    const onFinal = () => refresh();
    socket.on('points_earned', onEarned);
    socket.on('order_finalized', onFinal);
    return () => {
      socket.off('points_earned', onEarned);
      socket.off('order_finalized', onFinal);
    };
  }, [socket, isClient, enqueue, refresh]);

  const current = queue[0];
  const close = () => {
    if (current?.transactionId) markRewardsSeen([current.transactionId]).catch(() => {});
    setQueue((q) => q.slice(1));
  };

  return (
    <RewardsContext.Provider value={{ summary, refresh }}>
      {children}
      <RewardCelebration
        visible={!!current}
        points={current?.points ?? 0}
        valueRand={current?.valueRand ?? 0}
        balance={current?.balance}
        sellerName={current?.sellerName}
        onClose={close}
      />
    </RewardsContext.Provider>
  );
};

export const useRewards = () => useContext(RewardsContext);
