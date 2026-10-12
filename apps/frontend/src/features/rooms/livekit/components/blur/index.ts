import { ProcessorWrapper } from '@livekit/track-processors'
import type { Track, TrackProcessor } from 'livekit-client'
import { BackgroundCustomProcessor } from './BackgroundCustomProcessor'
import { UnifiedBackgroundTrackProcessor } from './UnifiedBackgroundTrackProcessor'
import { ProcessorType, type ProcessorConfig } from './types'

export { ProcessorType, type ProcessorConfig } from './types'

export interface BackgroundProcessorInterface extends TrackProcessor<Track.Kind> {
  update(opts: ProcessorConfig): Promise<void>
  options: ProcessorConfig
}

export class BackgroundProcessorFactory {
  static hasModernApiSupport() {
    return ProcessorWrapper.hasModernApiSupport
  }

  static isSupported() {
    return ProcessorWrapper.isSupported || BackgroundCustomProcessor.isSupported
  }

  static getProcessor(
    config: ProcessorConfig
  ): BackgroundProcessorInterface | undefined {
    const isBlur = config.type === ProcessorType.BLUR
    const isVirtual = config.type === ProcessorType.VIRTUAL

    if (!isBlur && !isVirtual) return undefined

    if (ProcessorWrapper.isSupported) {
      return new UnifiedBackgroundTrackProcessor(config)
    }

    if (BackgroundCustomProcessor.isSupported) {
      return new BackgroundCustomProcessor(config)
    }

    return undefined
  }

  static fromProcessorConfig(data?: ProcessorConfig) {
    if (data) {
      return BackgroundProcessorFactory.getProcessor(data)
    }
    return undefined
  }
}
