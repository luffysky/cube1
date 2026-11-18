// Shared, original SnowRealm economy. The server is the source of ownership.
export const CATALOG_VERSION = '2026-11-18.1';
export const ECONOMY = Object.freeze({ initialCoins: 250, dailyCoins: 50, rankedWin: 30, rankedDraw: 20, rankedLoss: 10, minimumRewardMs: 30000, rewardedMatchesPerDay: 20, rewardedSameOpponentPerDay: 3 });
export const DEFAULT_APPEARANCE = Object.freeze({ theme: 'obsidian', blocks: 'classic', board: 'grid', background: 'solid', boardOverlay: 0.72, customBackgroundEnabled: false, customTarget: 'background' });
const cosmetic = (category, value, price) => Object.freeze({ id: `${category}:${value}`, kind: 'cosmetic', category, value, price, currency: 'coins', free: price === 0 });
export const CATALOG = Object.freeze([
  cosmetic('theme', 'obsidian', 0), cosmetic('theme', 'snow', 0), cosmetic('theme', 'aurora', 200), cosmetic('theme', 'sakura', 240), cosmetic('theme', 'cyber', 280), cosmetic('theme', 'ocean', 200),
  cosmetic('blocks', 'classic', 0), cosmetic('blocks', 'flat', 0), cosmetic('blocks', 'bevel', 120), cosmetic('blocks', 'neon', 220), cosmetic('blocks', 'glass', 180),
  cosmetic('board', 'grid', 0), cosmetic('board', 'plain', 0), cosmetic('board', 'stars', 160),
  cosmetic('background', 'solid', 0), cosmetic('background', 'aurora', 180), cosmetic('background', 'dusk', 160), cosmetic('background', 'snowfield', 180), cosmetic('background', 'ocean', 180),
  Object.freeze({ id: 'shield', kind: 'consumable', price: 20, currency: 'coins', mode: 'party', effect: 'cancel_pending_4', quantity: 1 }),
  Object.freeze({ id: 'cleanse', kind: 'consumable', price: 35, currency: 'coins', mode: 'party', effect: 'remove_bottom_2', quantity: 1 }),
  Object.freeze({ id: 'pulse', kind: 'consumable', price: 25, currency: 'coins', mode: 'party', effect: 'send_2', quantity: 1 }),
]);
export const CATALOG_BY_ID = Object.freeze(Object.fromEntries(CATALOG.map(item => [item.id, item])));
export const FREE_COSMETICS = Object.freeze(CATALOG.filter(item => item.kind === 'cosmetic' && item.free).map(item => item.id));
export const RANK_TIERS = Object.freeze([{ id: 'bronze', min: 0 }, { id: 'silver', min: 1000 }, { id: 'gold', min: 1200 }, { id: 'platinum', min: 1400 }, { id: 'diamond', min: 1600 }, { id: 'master', min: 1800 }]);
export function rankTier(rating) { return [...RANK_TIERS].reverse().find(tier => rating >= tier.min)?.id || 'bronze'; }
export const MEMBERSHIP = Object.freeze({ id: 'snowrealm_plus', activeBilling: false, customImages: true, rankedAdvantage: false, proposedMonthlyUsd: 4.99, proposedYearlyUsd: 39.99, pricingStatus: 'hypothesis_not_for_sale' });
