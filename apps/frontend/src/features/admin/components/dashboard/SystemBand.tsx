import { useQuery } from '@tanstack/react-query'
import { token } from '@/styled-system/tokens'
import { Link } from 'wouter'
import {
  RiShieldCheckLine,
  RiErrorWarningLine,
  RiUserFollowLine,
  RiTimeLine,
} from '@remixicon/react'
import { css } from '@/styled-system/css'
import { fetchAdminStatus } from '../../api/adminApi'
import type { AdminDashboard } from '../../api/types'
import { formatRelative, formatDuration } from '@/components/console/utils'

const BAND_TONES = {
  green: {
    bg: token('colors.landing.tint-green'),
    fg: token('colors.landing.icon-green'),
  },
  blue: {
    bg: token('colors.landing.blue-subtle'),
    fg: token('colors.landing.blue-bright'),
  },
  orange: {
    bg: token('colors.landing.tint-orange'),
    fg: token('colors.landing.icon-orange'),
  },
  red: { bg: token('colors.red.100'), fg: token('colors.red.600') },
}

/** French plural: 0 and 1 both take the singular. */
const plural = (n: number, one: string, many: string) =>
  `${n} ${n > 1 ? many : one}`

const bandCell = css({
  display: 'flex',
  alignItems: 'center',
  gap: '0.9rem',
  padding: '1.1rem 1.3rem',
  minWidth: 0,
  textDecoration: 'none',
})

// Cells are separated by a rule, which runs horizontally once they stack.
const bandDivider = css({
  borderTop: '1px solid',
  borderTopColor: 'greyscale.200',
  md: {
    borderTopWidth: 0,
    borderLeft: '1px solid',
    borderLeftColor: 'greyscale.200',
  },
})

export const BandTile = ({
  Icon,
  tone,
  title,
  subtitle,
  divider,
  to,
}: {
  Icon: typeof RiShieldCheckLine
  tone: keyof typeof BAND_TONES
  title: string
  subtitle: string
  divider?: boolean
  to?: string
}) => {
  const colors = BAND_TONES[tone]
  const className = `${bandCell}${divider ? ` ${bandDivider}` : ''}`
  const body = (
    <>
      <span
        className={css({
          width: '44px',
          height: '44px',
          borderRadius: '12px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        })}
        style={{ backgroundColor: colors.bg, color: colors.fg }}
      >
        <Icon size={22} aria-hidden="true" />
      </span>
      <span className={css({ minWidth: 0 })}>
        <span
          className={css({
            display: 'block',
            fontWeight: 700,
            fontSize: '0.95rem',
            color: 'greyscale.1000',
          })}
        >
          {title}
        </span>
        <span
          className={css({
            display: 'block',
            fontSize: '0.8rem',
            color: 'greyscale.600',
          })}
        >
          {subtitle}
        </span>
      </span>
    </>
  )

  if (!to) return <div className={className}>{body}</div>
  return (
    <Link
      to={to}
      className={`${className} ${css({ _hover: { backgroundColor: 'greyscale.50' } })}`}
    >
      {body}
    </Link>
  )
}

/**
 * Live state of the platform, read straight from the probes and the session
 * table. Two tiles from the mock-up are deliberately absent: storage volume,
 * which is not measured yet, and a 30-day uptime percentage, which we cannot
 * compute because no history of the health checks is kept.
 */
export const SystemBand = ({
  live,
  totalDurationSec,
}: {
  live: AdminDashboard['live']
  totalDurationSec: number
}) => {
  const { data: status } = useQuery({
    queryKey: ['admin', 'status'],
    queryFn: fetchAdminStatus,
    // The probe reaches Postgres, Redis, LiveKit, S3 and SMTP; a minute of cache
    // is cheaper than a full sweep on every visit and every tab focus.
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })

  // 'disabled' and 'unknown' are deliberate states, not failures.
  const down = status?.components.filter((c) => c.status === 'down') ?? []
  const healthy = down.length === 0

  return (
    <div
      className={css({
        backgroundColor: 'white',
        border: '1px solid',
        borderColor: 'greyscale.200',
        borderRadius: '16px',
        display: 'grid',
        gridTemplateColumns: { base: '1fr', md: 'repeat(3, 1fr)' },
        overflow: 'hidden',
      })}
    >
      <BandTile
        to="/admin/status"
        Icon={healthy ? RiShieldCheckLine : RiErrorWarningLine}
        tone={healthy ? 'green' : 'red'}
        title={
          !status
            ? 'Vérification des services…'
            : healthy
              ? 'Tous les services opérationnels'
              : plural(
                  down.length,
                  'service en incident',
                  'services en incident'
                )
        }
        subtitle={
          status
            ? `Dernière vérification : ${formatRelative(status.checked_at)}`
            : 'Sonde en cours'
        }
      />
      <BandTile
        divider
        Icon={RiUserFollowLine}
        tone="blue"
        title={plural(
          live.participants,
          'participant en ligne',
          'participants en ligne'
        )}
        subtitle={
          live.meetings === 0
            ? 'Aucune réunion en cours'
            : `Dans ${plural(live.meetings, 'réunion en cours', 'réunions en cours')}`
        }
      />
      <BandTile
        divider
        Icon={RiTimeLine}
        tone="orange"
        title={`${formatDuration(totalDurationSec)} de visioconférence`}
        subtitle="Cumul depuis l’ouverture de la plateforme"
      />
    </div>
  )
}
