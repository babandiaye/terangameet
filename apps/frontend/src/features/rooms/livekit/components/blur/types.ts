import type { FaceLandmarksOptions } from './FaceLandmarksProcessor'

/*
 * Kept free of runtime imports on purpose: the user-choices store reads these
 * on every page, and pulling them from ./index would drag
 * @livekit/track-processors, livekit-client and posthog into the initial
 * bundle of pages that never open a call.
 */

export enum ProcessorType {
  BLUR = 'blur',
  VIRTUAL = 'virtual',
  FACE_LANDMARKS = 'faceLandmarks',
}

export type ProcessorConfig =
  | { type: ProcessorType.BLUR; blurRadius: number }
  | { type: ProcessorType.VIRTUAL; imagePath: string; fileId?: string }
  | ({ type: ProcessorType.FACE_LANDMARKS } & FaceLandmarksOptions)
