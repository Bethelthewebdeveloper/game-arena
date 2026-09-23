/**
 * Feature access — payment is NOT connected in this phase.
 * Backend is the authority. Browser isPro=true is ignored.
 */
const FREE_MP_CAP = 4;
const PRO_MP_CAP = 10;
const FREE_BATTLE_ATTEMPTS = 1;

const FEATURES = {
  canCreateBasicMultiplayer: true,
  canJoinMultiplayer: true,
  canCreateAdvancedMultiplayer: false,
  canCreateBasicBattle: true,
  canCreateAdvancedBattle: false,
  canUsePrivateRooms: false,
  canUseCustomTimers: false
};

function planOf() {
  return 'free';
}

function canUseCapacity(maxPlayers) {
  const n = parseInt(maxPlayers, 10);
  if (![2, 4, 6, 8, 10].includes(n)) return { ok: false, code: 'BAD_CAPACITY' };
  if (n <= FREE_MP_CAP) return { ok: true, plan: 'free', feature: 'canCreateBasicMultiplayer' };
  return {
    ok: false,
    code: 'PRO_REQUIRED',
    plan: 'free',
    feature: 'canCreateAdvancedMultiplayer',
    message: 'Larger rooms are a Pro feature. PRO COMING SOON — payment is not connected.'
  };
}

const FREE_TIMERS = [5, 10, 15];
const FREE_BATTLE_TIMERS = [5, 10, 15, 20];

function canUseTimer(minutes, kind) {
  const n = parseInt(minutes, 10);
  const allowed = kind === 'battle' ? FREE_BATTLE_TIMERS : FREE_TIMERS;
  if (allowed.includes(n)) return { ok: true, minutes: n, plan: 'free' };
  if (n >= 5 && n <= 30) {
    return {
      ok: false,
      code: 'PRO_REQUIRED',
      plan: 'free',
      feature: 'canUseCustomTimers',
      message: 'Custom timer is a Pro feature. PRO COMING SOON — payment is not connected.',
      fallbackMinutes: 10
    };
  }
  return { ok: false, code: 'BAD_TIMER', fallbackMinutes: 10 };
}

function snapshot() {
  return {
    plan: planOf(),
    paymentIntegration: 'NOT_IMPLEMENTED',
    purchases: 'Not connected',
    freeMaxPlayers: FREE_MP_CAP,
    proMaxPlayers: PRO_MP_CAP,
    features: FEATURES
  };
}

module.exports = {
  FREE_MP_CAP,
  PRO_MP_CAP,
  FREE_BATTLE_ATTEMPTS,
  FEATURES,
  canUseCapacity,
  canUseTimer,
  FREE_TIMERS,
  FREE_BATTLE_TIMERS,
  snapshot
};
