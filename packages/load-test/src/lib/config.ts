const env = (name: string, fallback: string): string => __ENV[name] || fallback;

const numberEnv = (name: string, fallback: number): number => {
  const value = Number(__ENV[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

export type Profile = 'smoke' | 'load' | 'stress' | 'spike' | 'soak';

const PROFILES: readonly Profile[] = [
  'smoke',
  'load',
  'stress',
  'spike',
  'soak',
];

const profile = env('PROFILE', 'smoke') as Profile;
if (!PROFILES.includes(profile)) {
  throw new Error(`Unknown PROFILE "${profile}" (use ${PROFILES.join(', ')})`);
}

export const API_URL = env('API_URL', 'http://localhost:8080').replace(
  /\/$/,
  '',
);

/** Frontend base URL. When set, the page scenario renders SSR pages too. */
export const WEB_URL = env('WEB_URL', '').replace(/\/$/, '');

/** Better Auth prefixes the cookie with `__Secure-` when served over https. */
export const SESSION_COOKIE_NAME = env(
  'SESSION_COOKIE_NAME',
  API_URL.startsWith('https://')
    ? '__Secure-better-auth.session_token'
    : 'better-auth.session_token',
);

export const LOCALE = env('LOCALE', 'de');

export const config = {
  profile,
  /** Peak concurrent users for load and soak. */
  targetUsers: numberEnv('TARGET_USERS', 200),
  /** Highest step the stress profile climbs to. */
  stressMaxUsers: numberEnv('STRESS_MAX_USERS', 1600),
  /** Volunteers hitting the call-out shifts within 30 s in the spike profile. */
  spikeUsers: numberEnv('SPIKE_USERS', 300),
  /** How long the load profile holds at TARGET_USERS. */
  loadHold: env('LOAD_HOLD', '20m'),
  soakDuration: env('SOAK_DURATION', '2h'),
  /** Seconds between user actions, as `min-max`. */
  thinkTime: env('THINK_TIME', profile === 'smoke' ? '0.5-1' : '5-15')
    .split('-')
    .map(Number) as [number, number],
};
