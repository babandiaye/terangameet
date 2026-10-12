import { proxy, subscribe } from 'valtio'
// Type-only imports: this store is loaded on every page (via
// UsernameOwnerGuard), so any runtime import from livekit-client,
// @livekit/components-core or the blur processors would pull the whole
// conference stack (livekit-client, track-processors, posthog) into the
// initial bundle of the home, mon espace and admin pages.
import type { LocalUserChoices as LocalUserChoicesLK } from '@livekit/components-core'
import type { VideoQuality } from 'livekit-client'
import {
  ProcessorType,
  type ProcessorConfig,
} from '@/features/rooms/livekit/components/blur/types'

export type VideoResolution = 'h720' | 'h360' | 'h180'

export type LocalUserChoices = LocalUserChoicesLK & {
  processorConfig?: ProcessorConfig
  noiseReductionEnabled?: boolean
  audioOutputDeviceId?: string
  videoPublishResolution?: VideoResolution
  videoSubscribeQuality?: VideoQuality
}

/**
 * Mirrors `VideoQuality.HIGH` from livekit-client (LOW = 0, MEDIUM = 1,
 * HIGH = 2). Duplicated so the enum's runtime value is not imported here;
 * keep in sync if livekit-client ever renumbers it.
 */
const VIDEO_QUALITY_HIGH = 2 as VideoQuality

/*
 * Local equivalents of `loadUserChoices` / `saveUserChoices` from
 * @livekit/components-core, same storage key and format, so existing
 * preferences keep loading and LiveKit components stay compatible.
 */
const USER_CHOICES_KEY = 'lk-user-choices'

const DEFAULT_LK_CHOICES: LocalUserChoicesLK = {
  videoEnabled: true,
  audioEnabled: true,
  videoDeviceId: 'default',
  audioDeviceId: 'default',
  username: '',
}

function loadStoredChoices(): Partial<LocalUserChoices> {
  try {
    const raw = localStorage.getItem(USER_CHOICES_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === 'object'
      ? (parsed as Partial<LocalUserChoices>)
      : {}
  } catch {
    return {}
  }
}

function saveStoredChoices(choices: LocalUserChoices) {
  try {
    // Same filtering as LiveKit: empty strings are not persisted.
    const nonEmpty = Object.fromEntries(
      Object.entries(choices).filter(([, value]) => value !== '')
    )
    localStorage.setItem(USER_CHOICES_KEY, JSON.stringify(nonEmpty))
  } catch {
    /* storage unavailable (private mode, quota): best effort */
  }
}

function getUserChoicesState(): LocalUserChoices {
  return {
    noiseReductionEnabled: false,
    audioOutputDeviceId: 'default', // Use 'default' to match LiveKit's standard device selection behavior
    videoPublishResolution: 'h720',
    videoSubscribeQuality: VIDEO_QUALITY_HIGH,
    ...DEFAULT_LK_CHOICES,
    ...loadStoredChoices(),
  }
}

export const userChoicesStore = proxy<LocalUserChoices>(getUserChoicesState())
subscribe(userChoicesStore, () => {
  saveStoredChoices(userChoicesStore)
})

// we run some logic on store loading to check if the processor config is still valid
if (userChoicesStore.processorConfig?.type === ProcessorType.VIRTUAL) {
  if (userChoicesStore.processorConfig.imagePath.startsWith('blob:')) {
    // this happens when a not authenticated user had changed their background image
    // we restore clear the processor config to avoid displaying a black screen.
    userChoicesStore.processorConfig = undefined
  } else if (userChoicesStore.processorConfig.fileId) {
    // Checking if the image is still available / accessible
    await fetch(userChoicesStore.processorConfig.imagePath, {
      // We bypass the cache to ensure we have access
      cache: 'reload',
    })
      .then((response) => {
        // if we cannot fetch the image (likely a 401 from the backend because
        // the user is not logged in anymore, etc.),
        // we clear the processor config to avoid displaying a black screen.
        // This can happen when the user logs out for instance, etc.
        if (!response.ok) {
          userChoicesStore.processorConfig = undefined
        }
      })
      .catch(() => {
        userChoicesStore.processorConfig = undefined
      })
  }
}

export const saveAudioInputEnabled = (isEnabled: boolean) => {
  userChoicesStore.audioEnabled = isEnabled
}

export const saveVideoInputEnabled = (isEnabled: boolean) => {
  userChoicesStore.videoEnabled = isEnabled
}

export const saveAudioInputDeviceId = (deviceId: string) => {
  userChoicesStore.audioDeviceId = deviceId
}

export const saveAudioOutputDeviceId = (deviceId: string) => {
  userChoicesStore.audioOutputDeviceId = deviceId
}

export const saveVideoInputDeviceId = (deviceId: string) => {
  userChoicesStore.videoDeviceId = deviceId
}

export const saveVideoPublishResolution = (resolution: VideoResolution) => {
  userChoicesStore.videoPublishResolution = resolution
}

export const saveVideoSubscribeQuality = (quality: VideoQuality) => {
  userChoicesStore.videoSubscribeQuality = quality
}

export const saveUsername = (username: string) => {
  userChoicesStore.username = username
}

/**
 * localStorage key holding the account the stored display name belongs to.
 * Kept separate from LiveKit's own blob so their format stays theirs.
 */
const USERNAME_OWNER_KEY = 'terangameet.username-owner'

/**
 * Drop a display name inherited from somebody else.
 *
 * The chosen name is persisted in localStorage, so it outlives the session that
 * set it: on a shared browser the next person to sign in would create and join
 * meetings under the previous user's name. Binding the name to the account that
 * chose it, and resetting it the moment the account changes, fixes that without
 * touching the in-session rename — that one is a deliberate act, this only
 * rejects a name nobody in this session ever typed.
 *
 * `ownerId` is null for anonymous visitors, whose typed name is theirs to keep.
 */
export const reconcileUsernameOwner = (
  ownerId: string | null,
  ownerName: string
) => {
  let stored: string | null
  try {
    stored = localStorage.getItem(USERNAME_OWNER_KEY)
  } catch {
    return // storage unavailable (private mode): nothing persisted, nothing to fix
  }
  if (stored === ownerId) return

  // Prefill with who they actually are rather than blanking: the waiting-room
  // field requires a name, and an empty one would just make them retype it.
  userChoicesStore.username = ownerName
  try {
    if (ownerId === null) localStorage.removeItem(USERNAME_OWNER_KEY)
    else localStorage.setItem(USERNAME_OWNER_KEY, ownerId)
  } catch {
    /* best effort */
  }
}

export const saveNoiseReductionEnabled = (enabled: boolean) => {
  userChoicesStore.noiseReductionEnabled = enabled
}

export const saveProcessorConfig = (
  processorConfig: ProcessorConfig | undefined
) => {
  userChoicesStore.processorConfig = processorConfig
}
