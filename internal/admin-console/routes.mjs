// These routes are relative to the protected Worker mount.
export const panelRoutes = Object.freeze({
  overview: 'overview',
  trends: 'analytics/overview',
  players: 'players',
  matches: 'games/matches',
  ledger: 'economy/ledger',
  integrations: 'system/integrations',
  compliance: 'system/compliance',
});
export const pageRoutes = new Set(Object.values(panelRoutes));
