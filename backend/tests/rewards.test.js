const { pointsForAmount, pointsToRand, isRewardsActive, PROGRAMME_FEE_RAND } = require('../src/config/rewards');
const { applyCommission } = require('../src/config/commission');
const { splitBySeller } = require('../src/utils/rewardsRanking');
const { rankedPage } = require('../src/utils/rewardsRanking');

describe('rewards maths', () => {
  test('2% back, 10 points = R1', () => {
    expect(pointsForAmount(100)).toBe(20); // R2 back
    expect(pointsForAmount(500)).toBe(100); // R10 back
    expect(pointsToRand(100)).toBe(10);
  });
  test('never over-credits (rounds down)', () => {
    expect(pointsForAmount(54)).toBe(10); // 2% of 54 = 1.08 -> 10 points (R1.00)
    expect(pointsForAmount(4)).toBe(0);
  });
  test('programme fee is R150', () => {
    expect(PROGRAMME_FEE_RAND).toBe(150);
  });
  test('isRewardsActive honours expiry', () => {
    expect(isRewardsActive({})).toBe(false);
    expect(isRewardsActive({ rewardsProgram: { activeUntil: new Date(Date.now() - 1000) } })).toBe(false);
    expect(isRewardsActive({ rewardsProgram: { activeUntil: new Date(Date.now() + 86400000) } })).toBe(true);
  });
});

describe('cash settlement maths (provider holds the cash)', () => {
  // Mirrors utils/payouts.createPayoutEntry's arithmetic.
  const net = (gross, cashHeld) => {
    const { payoutAmount } = applyCommission(gross);
    return Math.round((payoutAmount - cashHeld) * 100) / 100;
  };
  test('card job: provider is owed 92%', () => expect(net(1000, 0)).toBe(920));
  test('cash job: provider holds all the cash and owes the 8%', () => expect(net(1000, 1000)).toBe(-80));
  test('cash + points job: RevvUp owes the points value less its 8%', () => {
    // R1000 job, client used R200 of points and paid R800 cash
    expect(net(1000, 800)).toBe(120);
  });
});

describe('ranking helpers', () => {
  test('splitBySeller partitions ids', () => {
    const q = { isActive: true, shop: { $in: ['a', 'b', 'c'] } };
    const { filterA, filterB } = splitBySeller(q, 'shop', ['b']);
    expect(filterA.shop.$in).toEqual(['b']);
    expect(filterB.shop.$in).toEqual(['a', 'c']);
  });

  test('participants come first and pagination crosses the boundary correctly', async () => {
    const A = ['A1', 'A2', 'A3'];
    const B = ['B1', 'B2', 'B3', 'B4'];
    const make = (list) => ({
      runFind: async (f, skip, lim) => (f === 'A' ? A : B).slice(skip, skip + lim),
      runCount: async (f) => (f === 'A' ? A : B).length
    });
    const page = async (skip, limit) =>
      (await rankedPage({ ...make(), filterA: 'A', filterB: 'B', skip, limit })).items.map((i) => i.doc);
    expect(await page(0, 2)).toEqual(['A1', 'A2']);
    expect(await page(2, 2)).toEqual(['A3', 'B1']);
    expect(await page(4, 2)).toEqual(['B2', 'B3']);
    expect(await page(6, 2)).toEqual(['B4']);
  });
});
