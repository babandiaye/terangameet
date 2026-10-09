import { env } from '../config/env'

/**
 * Object key of a recording inside the recordings bucket. The egress writes it
 * there (recording.ts) and the streaming, deletion and purge paths read it
 * back, so they must all derive it the same way.
 */
export function recordingObjectKey(r: { id: string; mode: string }): string {
  const ext = r.mode === 'TRANSCRIPT' ? 'ogg' : 'mp4'
  return `${env.recording.outputFolder}/${r.id}.${ext}`
}
