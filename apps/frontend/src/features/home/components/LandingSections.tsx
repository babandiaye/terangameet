import { useTranslation } from 'react-i18next'
import {
  RiBarChartBoxLine,
  RiComputerLine,
  RiShieldCheckLine,
  RiTeamLine,
} from '@remixicon/react'
import { css } from '@/styled-system/css'

/**
 * Landing sections for signed-out visitors.
 */

// Each tone is a literal css() call: Panda extracts styles statically, so
// passing token names through variables (`backgroundColor: tint`) produced no
// CSS at all in production builds.

const PILLARS = [
  {
    key: 'meetings',
    Icon: RiTeamLine,
    tone: css({
      backgroundColor: 'landing.blue-subtle',
      color: 'landing.blue-bright',
    }),
  },
  {
    key: 'collab',
    Icon: RiComputerLine,
    tone: css({
      backgroundColor: 'landing.tint-green',
      color: 'landing.icon-green',
    }),
  },
  {
    key: 'security',
    Icon: RiShieldCheckLine,
    tone: css({
      backgroundColor: 'landing.tint-orange',
      color: 'landing.icon-orange',
    }),
  },
  {
    key: 'performance',
    Icon: RiBarChartBoxLine,
    tone: css({
      backgroundColor: 'landing.tint-purple',
      color: 'landing.icon-purple',
    }),
  },
] as const

const shell = css({ width: '100%', paddingX: { base: '1rem', sm: '1.5rem' } })
const inner = css({ maxWidth: '76rem', margin: '0 auto', width: '100%' })

export const LandingSections = () => {
  const { t } = useTranslation('home', { keyPrefix: 'landing' })

  return (
    <div
      className={`${shell} ${css({ paddingBottom: { base: '2.5rem', md: '3.5rem' } })}`}
    >
      <div
        className={`${inner} ${css({ display: 'flex', flexDirection: 'column', gap: '1.5rem' })}`}
      >
        {/* ------------------------------------------------------- pillars */}
        <ul
          className={css({
            listStyle: 'none',
            display: 'grid',
            gridTemplateColumns: {
              base: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
              lg: 'repeat(4, minmax(0, 1fr))',
            },
            gap: '1.1rem',
          })}
        >
          {PILLARS.map(({ key, Icon, tone }) => (
            <li
              key={key}
              className={css({
                backgroundColor: 'landing.surface',
                border: '1px solid',
                borderColor: 'landing.border',
                borderRadius: '14px',
                padding: '1.4rem',
                display: 'flex',
                gap: '1rem',
                alignItems: 'flex-start',
              })}
            >
              <span
                className={`${css({
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '46px',
                  height: '46px',
                  borderRadius: '12px',
                  flexShrink: 0,
                })} ${tone}`}
              >
                <Icon size={23} aria-hidden="true" />
              </span>
              <div className={css({ minWidth: 0 })}>
                <h2
                  className={css({
                    fontSize: '1.02rem',
                    fontWeight: 700,
                    color: 'landing.ink',
                    marginBottom: '0.4rem',
                    textWrap: 'balance',
                  })}
                >
                  {t(`pillars.${key}.title`)}
                </h2>
                <p
                  className={css({
                    color: 'landing.muted',
                    lineHeight: 1.6,
                    fontSize: '0.9rem',
                  })}
                >
                  {t(`pillars.${key}.body`)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
