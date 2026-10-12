import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { css } from '@/styled-system/css'
import { Button, H, Text } from '@/primitives'

type ErrorBoundaryVariant = 'page' | 'panel' | 'silent'

type ErrorBoundaryProps = {
  children: ReactNode
  /**
   * - `page`: full-area message with a « Recharger la page » button.
   * - `panel`: compact message with « Réessayer », for parts of a screen
   *   (e.g. a meeting side panel) whose crash must not take the rest down.
   * - `silent`: renders nothing, for non-essential widgets.
   */
  variant?: ErrorBoundaryVariant
  /**
   * When this value changes, a caught error is cleared and the children are
   * rendered again (e.g. pass the current location so navigating away from a
   * crashed page recovers without a reload).
   */
  resetKey?: unknown
}

type ErrorBoundaryState = { error: Error | null }

/**
 * React has no hook equivalent for error boundaries, hence the class.
 *
 * The fallbacks deliberately avoid `Screen`/`Layout`: if the crash came from
 * the header or a shared hook, rendering them again would crash the fallback
 * too.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.reset()
    }
  }

  reset = () => {
    this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children
    switch (this.props.variant ?? 'page') {
      case 'silent':
        return null
      case 'panel':
        return <PanelFallback onRetry={this.reset} />
      default:
        return <PageFallback />
    }
  }
}

const PageFallback = () => {
  const { t } = useTranslation('global', { keyPrefix: 'errorBoundary' })
  return (
    <div
      role="alert"
      className={css({
        flexGrow: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        padding: '2rem 1rem',
        textAlign: 'center',
      })}
    >
      <H lvl={1} centered>
        {t('title')}
      </H>
      <Text as="p" centered>
        {t('body')}
      </Text>
      <Button variant="primary" onPress={() => window.location.reload()}>
        {t('reload')}
      </Button>
    </div>
  )
}

const PanelFallback = ({ onRetry }: { onRetry: () => void }) => {
  const { t } = useTranslation('global', { keyPrefix: 'errorBoundary' })
  return (
    <div
      role="alert"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '0.75rem',
        padding: '1rem 1.5rem',
      })}
    >
      <Text as="p">{t('panelBody')}</Text>
      <Button variant="secondary" size="sm" onPress={onRetry}>
        {t('retry')}
      </Button>
    </div>
  )
}
