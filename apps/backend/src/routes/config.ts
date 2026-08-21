import { Router } from 'express'
import { env } from '../config/env'

export const configRouter = Router()

/** GET /api/v1.0/config/ — frontend bootstrap configuration (ApiConfig). */
configRouter.get('/', (_req, res) => {
  res.json({
    feedback: { url: env.frontend.feedbackUrl },
    external_home_url: env.frontend.externalHomeUrl || undefined,
    silence_livekit_debug_logs: env.frontend.silenceLivekitDebug,
    is_silent_login_enabled: env.frontend.silentLogin,
    custom_css_url: env.frontend.customCssUrl || undefined,
    use_french_gov_footer: env.frontend.useFrenchGovFooter,
    use_proconnect_button: env.frontend.useProConnectButton,
    idle_disconnect_warning_delay: env.frontend.idleDisconnectWarningDelay ?? undefined,
    manifest_link: env.frontend.manifestLink || undefined,
    recording: {
      is_enabled: env.recording.enabled,
      available_modes: env.recording.availableModes,
      expiration_days: env.recording.expirationDays ?? undefined,
      max_duration: env.recording.maxDuration ?? undefined,
    },
    background_image: {
      upload_is_enabled: env.files.uploadEnabled,
      max_size: env.files.maxSize,
      max_count_by_user: env.files.maxCountByUser,
      allowed_extensions: env.files.allowedExtensions,
      allowed_mimetypes: env.files.allowedMimetypes,
    },
    subtitle: { enabled: env.subtitle.enabled },
    email_invite: { enabled: env.mail.enabled },
    telephony: {
      enabled: env.telephony.enabled,
      international_phone_number: env.telephony.phoneNumber || undefined,
      default_country: env.telephony.defaultCountry,
    },
    livekit: {
      url: env.livekit.wsUrl,
      force_wss_protocol: env.livekit.forceWss,
      enable_firefox_proxy_workaround: env.livekit.enableFirefoxProxyWorkaround,
      default_sources: env.livekit.defaultSources,
    },
  })
})
