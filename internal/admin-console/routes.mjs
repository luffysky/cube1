// These routes are relative to the protected Worker mount.
export const panelRoutes = Object.freeze({
  overview: 'overview',
  trends: 'analytics/overview',
  players: 'players',
  games: 'games',
  matches: 'games/matches',
  wallets: 'economy/wallets',
  ledger: 'economy/ledger',
  integrations: 'system/integrations',
  audit: 'system/audit',
  compliance: 'system/compliance',
});
export const pageRoutes = new Set(Object.values(panelRoutes));

export const playerPage = /^players\/([A-Za-z0-9_-]{8,128})$/;
