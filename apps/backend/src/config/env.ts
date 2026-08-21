import 'dotenv/config'
import { logger } from '../lib/logger'

function str(name: string, fallback?: string): string {
  const v = process.env[name]
  if (v === undefined || v === '') {
    if (fallback !== undefined) return fallback
    return ''
  }
  return v
}

function bool(name: string, fallback = false): boolean {
  const v = process.env[name]
  if (v === undefined) return fallback
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())
}

function int(name: string, fallback: number): number {
  const v = process.env[name]
  if (v === undefined || v === '') return fallback
  const n = parseInt(v, 10)
  return Number.isNaN(n) ? fallback : n
}

function list(name: string, fallback: string[] = []): string[] {
  const v = process.env[name]
  if (!v) return fallback
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

const NODE_ENV = str('NODE_ENV', 'development')
const isProd = NODE_ENV === 'production'

// Public host of the app (used for OIDC redirect URIs and absolute links).
const APP_BASE_URL = str('APP_BASE_URL', 'http://localhost:3000')

// Keycloak / SenID OIDC. We derive endpoints from host + realm, but allow overrides.
const KEYCLOAK_HOST = str('KEYCLOAK_HOST', 'senid.unchk.sn')
const REALM_NAME = str('REALM_NAME', 'UNCHK')
const OIDC_ISSUER = str(
  'OIDC_ISSUER',
  `https://${KEYCLOAK_HOST}/realms/${REALM_NAME}`
)

export const env = {
  NODE_ENV,
  isProd,
  PORT: int('PORT', 4000),
  // Bind to loopback only by default: the app is reached through the nginx reverse
  // proxy, never directly on the public IP. Set to 0.0.0.0 only if you must.
  BIND_HOST: str('BIND_HOST', '127.0.0.1'),
  APP_BASE_URL,
  TRUST_PROXY: bool('TRUST_PROXY', isProd),

  // Where the built frontend lives (served as static in production).
  FRONTEND_DIST: str('FRONTEND_DIST', '../frontend/dist'),
  SERVE_FRONTEND: bool('SERVE_FRONTEND', isProd),

  DATABASE_URL: str('DATABASE_URL', 'postgresql://terangameet:terangameet@localhost:5432/terangameet'),
  REDIS_URL: str('REDIS_URL', 'redis://localhost:6379/1'),

  SESSION_SECRET: str('SESSION_SECRET', 'change-me-in-production'),
  SESSION_COOKIE_NAME: str('SESSION_COOKIE_NAME', 'terangameet_sessionid'),
  SESSION_COOKIE_AGE_S: int('SESSION_COOKIE_AGE_S', 12 * 3600),

  // Bootstrap admins: these emails get isStaff=true on login. Promoted admins
  // (granted via the admin UI) keep their flag even if not listed here.
  adminEmails: list('ADMIN_EMAILS', []).map((e) => e.trim().toLowerCase()).filter(Boolean),

  oidc: {
    issuer: OIDC_ISSUER,
    clientId: str('OIDC_RP_CLIENT_ID', 'meet'),
    clientSecret: str('OIDC_RP_CLIENT_SECRET', ''),
    scopes: str('OIDC_RP_SCOPES', 'openid email profile'),
    usePkce: bool('OIDC_USE_PKCE', true),
    callbackPath: str('OIDC_CALLBACK_PATH', '/oidc/callback/'),
    redirectFieldName: str('OIDC_REDIRECT_FIELD_NAME', 'returnTo'),
    // Which userinfo claims map to full/short name.
    fullnameFields: list('OIDC_USERINFO_FULLNAME_FIELDS', ['given_name', 'family_name']),
    shortnameField: str('OIDC_USERINFO_SHORTNAME_FIELD', 'given_name'),
    createUser: bool('OIDC_CREATE_USER', true),
    fallbackToEmail: bool('OIDC_FALLBACK_TO_EMAIL_FOR_IDENTIFICATION', true),
  },

  livekit: {
    apiKey: str('LIVEKIT_API_KEY', 'devkey'),
    apiSecret: str('LIVEKIT_API_SECRET', 'secret'),
    // Server-side API URL (https), e.g. https://diisso-rtc.unchk.sn
    apiUrl: str('LIVEKIT_API_URL', 'http://localhost:7880'),
    // Public WS URL the browser connects to.
    wsUrl: str('LIVEKIT_WS_URL', str('LIVEKIT_API_URL', 'ws://localhost:7880')),
    forceWss: bool('LIVEKIT_FORCE_WSS_PROTOCOL', false),
    enableFirefoxProxyWorkaround: bool('LIVEKIT_ENABLE_FIREFOX_PROXY_WORKAROUND', false),
    defaultSources: list('LIVEKIT_DEFAULT_SOURCES', [
      'camera',
      'microphone',
      'screen_share',
      'screen_share_audio',
    ]),
    verifySsl: bool('LIVEKIT_VERIFY_SSL', true),
    webhookFilterRegex: str('LIVEKIT_WEBHOOK_EVENTS_FILTER_REGEX', ''),
  },

  rooms: {
    defaultAccessLevel: str('RESOURCE_DEFAULT_ACCESS_LEVEL', 'public'),
    allowUnregistered: bool('ALLOW_UNREGISTERED_ROOMS', true),
  },

  lobby: {
    keyPrefix: str('LOBBY_KEY_PREFIX', 'room_lobby'),
    waitingTimeout: int('LOBBY_WAITING_TIMEOUT', 3),
    deniedTimeout: int('LOBBY_DENIED_TIMEOUT', 5),
    acceptedTimeout: int('LOBBY_ACCEPTED_TIMEOUT', 6 * 3600),
    cookieName: str('LOBBY_COOKIE_NAME', 'lobbyParticipantId'),
  },

  recording: {
    enabled: bool('RECORDING_ENABLE', false),
    outputFolder: str('RECORDING_OUTPUT_FOLDER', 'recordings'),
    // Dedicated MinIO bucket for meeting recordings (kept private; the backend
    // streams files to authorized users instead of exposing the bucket).
    bucket: str('AWS_RECORDING_BUCKET_NAME', 'terangameetv2-recordings'),
    expirationDays: int('RECORDING_EXPIRATION_DAYS', 0) || null,
    maxDuration: int('RECORDING_MAX_DURATION', 0) || null,
    availableModes: list('RECORDING_AVAILABLE_MODES', ['screen_recording']),
  },

  // Automatic purge of old recordings. When disabled the whole feature (and its
  // admin UI) is hidden. Period is one of 1m | 3m | 6m | 1y (default 6m); the
  // admin can override it at runtime (persisted in Redis).
  purge: {
    enabled: bool('PURGE_RECORDINGS_ENABLED', false),
    defaultPeriod: str('PURGE_RECORDINGS_PERIOD', '6m'),
  },

  storage: {
    endpoint: str('AWS_S3_ENDPOINT_URL', ''),
    accessKeyId: str('AWS_S3_ACCESS_KEY_ID', ''),
    secretAccessKey: str('AWS_S3_SECRET_ACCESS_KEY', ''),
    region: str('AWS_S3_REGION_NAME', 'us-east-1'),
    bucket: str('AWS_STORAGE_BUCKET_NAME', 'terangameet-media-storage'),
    forcePathStyle: bool('AWS_S3_FORCE_PATH_STYLE', true),
  },

  files: {
    uploadEnabled: bool('FILE_UPLOAD_ENABLED', false),
    maxSize: int('FILE_UPLOAD_MAX_SIZE', 5 * 1024 * 1024),
    maxCountByUser: int('FILE_UPLOAD_MAX_COUNT_BY_USER', 10),
    allowedExtensions: list('FILE_UPLOAD_ALLOWED_EXTENSIONS', ['jpg', 'jpeg', 'png', 'webp']),
    allowedMimetypes: list('FILE_UPLOAD_ALLOWED_MIMETYPES', [
      'image/jpeg',
      'image/png',
      'image/webp',
    ]),
  },

  subtitle: {
    enabled: bool('ROOM_SUBTITLE_ENABLED', false),
    agentName: str('ROOM_SUBTITLE_AGENT_NAME', 'multi-user-transcriber'),
  },

  // Outbound email (SMTP) — used for participant invitations. Disabled when no
  // host is configured; the invite endpoint then returns 503 and the UI hides it.
  mail: {
    enabled: bool('SMTP_ENABLED', !!str('SMTP_HOST', '')),
    host: str('SMTP_HOST', ''),
    port: int('SMTP_PORT', 587),
    user: str('SMTP_USER', ''),
    password: str('SMTP_PASSWORD', ''),
    from: str('SMTP_FROM', str('SMTP_USER', 'noreply@unchk.sn')),
    fromName: str('SMTP_FROM_NAME', 'TerangaMeet'),
    // STARTTLS on 587 (useTls) vs implicit TLS on 465 (useSsl).
    useTls: bool('SMTP_USE_TLS', true),
    useSsl: bool('SMTP_USE_SSL', false),
  },

  telephony: {
    enabled: bool('ROOM_TELEPHONY_ENABLED', false),
    phoneNumber: str('ROOM_TELEPHONY_PHONE_NUMBER', ''),
    defaultCountry: str('ROOM_TELEPHONY_DEFAULT_COUNTRY', 'SN'),
    pinLength: int('ROOM_TELEPHONY_PIN_LENGTH', 10),
  },

  frontend: {
    silentLogin: bool('FRONTEND_IS_SILENT_LOGIN_ENABLED', true),
    useFrenchGovFooter: bool('FRONTEND_USE_FRENCH_GOV_FOOTER', false),
    useProConnectButton: bool('FRONTEND_USE_PROCONNECT_BUTTON', false),
    customCssUrl: str('FRONTEND_CUSTOM_CSS_URL', ''),
    externalHomeUrl: str('FRONTEND_EXTERNAL_HOME_URL', ''),
    manifestLink: str('FRONTEND_MANIFEST_LINK', ''),
    idleDisconnectWarningDelay: int('FRONTEND_IDLE_DISCONNECT_WARNING_DELAY', 0) || null,
    feedbackUrl: str('FRONTEND_FEEDBACK_URL', ''),
    silenceLivekitDebug: bool('FRONTEND_SILENCE_LIVEKIT_DEBUG', false),
  },

  language: {
    default: str('LANGUAGE_CODE', 'fr-fr'),
    timezone: str('TIME_ZONE', 'UTC'),
  },
}

export type Env = typeof env

/**
 * Fail fast on insecure/missing configuration. In production a default or empty
 * secret aborts startup; in development it is only a warning. Call once at boot.
 */
export function validateEnv(): void {
  const errors: string[] = []
  const warns: string[] = []

  const require = (cond: boolean, msg: string) => {
    if (!cond) errors.push(msg)
  }
  const warn = (cond: boolean, msg: string) => {
    if (!cond) warns.push(msg)
  }

  // Secrets that must never run on their default/empty value in production.
  require(env.SESSION_SECRET !== 'change-me-in-production' && env.SESSION_SECRET.length >= 32,
    'SESSION_SECRET must be set to a strong value (>= 32 chars).')
  require(!!env.livekit.apiKey, 'LIVEKIT_API_KEY is required.')
  require(env.livekit.apiSecret !== 'secret' && env.livekit.apiSecret.length > 0,
    'LIVEKIT_API_SECRET must be set (not the default "secret").')
  require(!env.DATABASE_URL.includes('terangameet:terangameet@localhost'),
    'DATABASE_URL still points to the development default.')

  // Feature-conditional requirements.
  if (env.recording.enabled) {
    require(!!env.storage.accessKeyId && !!env.storage.secretAccessKey && !!env.storage.endpoint,
      'Recording is enabled but S3/MinIO credentials (AWS_S3_*) are incomplete.')
  }
  warn(!!env.oidc.clientSecret || env.oidc.usePkce,
    'OIDC has no client secret and PKCE is disabled — login will likely fail.')

  for (const w of warns) logger.warn(`[config] ${w}`)

  if (errors.length) {
    const list = errors.map((e) => `  - ${e}`).join('\n')
    if (isProd) {
      throw new Error(`Insecure/invalid configuration in production:\n${list}`)
    }
    logger.warn(`[config] configuration issues (non-fatal in development):\n${list}`)
  }
}
