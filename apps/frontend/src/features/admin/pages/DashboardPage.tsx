import { useState, ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'wouter'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import {
  RiVideoChatLine,
  RiGroupLine,
  RiLayoutGridLine,
  RiFilmLine,
  RiArrowUpLine,
  RiArrowDownLine,
  RiUserAddLine,
  RiRecordCircleLine,
  RiDoorOpenLine,
  RiShieldCheckLine,
  RiErrorWarningLine,
  RiUserFollowLine,
  RiTimeLine,
} from '@remixicon/react'
import { css } from '@/styled-system/css'
import { useUser } from '@/features/auth/api/useUser'
import { fetchAdminDashboard, fetchAdminStatus } from '../api/adminApi'
import { MeetingDetailModal } from '../components/MeetingDetailModal'
import type {
  AdminDashboard,
  SeriesRange,
  SeriesPoint,
  ActivityItem,
} from '../api/types'
import { Badge } from '@/components/console/ui'
import {
  formatBucket,
  formatRelative,
  formatDuration,
  formatDateTime,
} from '@/components/console/utils'
import { useTranslation } from 'react-i18next'
import { DialogTrigger } from 'react-aria-components'
import { Button } from '@/primitives'
import { CreateMeetingMenu } from '@/features/home/components/CreateMeetingMenu'
import { JoinMeetingDialog } from '@/features/home/components/JoinMeetingDialog'

export const DashboardPage = () => {
  const { user } = useUser()
  const { t: tHome } = useTranslation('home')
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: fetchAdminDashboard,
  })

  if (isLoading)
    return <div className={css({ color: 'greyscale.500' })}>Chargement…</div>
  if (isError || !data)
    return (
      <div className={css({ color: 'danger.600' })}>
        Impossible de charger le tableau de bord.
      </div>
    )

  // Prefer the given name (OIDC given_name, exposed as last_name) over the first
  // token of the full name, so "Papa Amadou Baba NDIAYE" greets "Papa Amadou Baba".
  const firstName =
    user?.last_name || (user?.full_name || '').split(' ')[0] || 'Admin'
  const t = data.totals

  return (
    <div
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
      })}
    >
      {/* Greeting */}
      <div
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        })}
      >
        <div>
          <h2
            className={css({
              fontSize: '1.7rem',
              fontWeight: 700,
              color: 'greyscale.1000',
            })}
          >
            Bonjour, {firstName} <span aria-hidden>👋</span>
          </h2>
          <p className={css({ color: 'greyscale.600', marginTop: '0.2rem' })}>
            Voici ce qui se passe sur votre plateforme aujourd’hui.
          </p>
        </div>
        {/* Same components as everywhere else: creating or joining a meeting
            must behave identically wherever it is triggered from. */}
        <div
          className={css({ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' })}
        >
          <CreateMeetingMenu />
          <DialogTrigger>
            <Button variant="secondary">{tHome('joinMeeting')}</Button>
            <JoinMeetingDialog />
          </DialogTrigger>
        </div>
      </div>

      {/* Stat cards */}
      <div
        className={css({
          display: 'grid',
          gridTemplateColumns: {
            base: '1fr',
            sm: 'repeat(2, 1fr)',
            lg: 'repeat(4, 1fr)',
          },
          gap: '1rem',
        })}
      >
        <StatCard
          label="Réunions tenues"
          value={t.sessions}
          trend={data.trends.sessions_pct}
          trendHint="par rapport à la semaine dernière"
          Icon={RiVideoChatLine}
          tone="blue"
        />
        <StatCard
          label="Utilisateurs"
          value={t.users}
          trend={data.trends.active_users_pct}
          trendHint="actifs cette semaine"
          Icon={RiGroupLine}
          tone="green"
        />
        <StatCard
          label="Réunions créées"
          value={t.rooms}
          trend={data.trends.rooms_pct}
          trendHint="ce mois-ci"
          Icon={RiLayoutGridLine}
          tone="orange"
        />
        <StatCard
          label="Enregistrements"
          value={t.recordings}
          trend={data.trends.recordings_pct}
          trendHint="ce mois-ci"
          Icon={RiFilmLine}
          tone="blue"
        />
      </div>

      {/* Charts + activity */}
      <div
        className={css({
          display: 'grid',
          gridTemplateColumns: {
            base: '1fr',
            lg: '1fr 1fr',
            xl: '1fr 1fr 320px',
          },
          gap: '1rem',
          alignItems: 'stretch',
        })}
      >
        <TrendChart
          title="Réunions"
          series={data.series.meetings}
          color="#2563EB"
          valueLabel="réunions"
        />
        <TrendChart
          title="Utilisateurs actifs"
          series={data.series.active_users}
          color="#16A34A"
          valueLabel="utilisateurs"
        />
        <ActivityPanel items={data.recent_activity} />
      </div>

      {/* Recent meetings */}
      <RecentMeetings meetings={data.recent_meetings} />

      <SystemBand live={data.live} totalDurationSec={t.total_duration_sec} />
    </div>
  )
}

/* --------------------------------------------------------------- stat card -- */

const TONES = {
  blue: { bg: '#EAF0FF', fg: '#3B5BDB' },
  green: { bg: '#E6F6EF', fg: '#1E9E6A' },
  orange: { bg: '#FFF1E2', fg: '#E8870B' },
}

const StatCard = ({
  label,
  value,
  trend,
  trendHint,
  Icon,
  tone,
}: {
  label: string
  value: ReactNode
  trend: number
  trendHint: string
  Icon: typeof RiGroupLine
  tone: keyof typeof TONES
}) => {
  const up = trend >= 0
  const colors = TONES[tone]
  return (
    <div
      className={css({
        backgroundColor: 'white',
        border: '1px solid',
        borderColor: 'greyscale.200',
        borderRadius: '16px',
        padding: '1.2rem',
      })}
    >
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '0.8rem',
        })}
      >
        <div
          className={css({
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          })}
          style={{ backgroundColor: colors.bg, color: colors.fg }}
        >
          <Icon size={24} />
        </div>
        <div>
          <div className={css({ fontSize: '0.82rem', color: 'greyscale.600' })}>
            {label}
          </div>
          <div
            className={css({
              fontSize: '1.9rem',
              fontWeight: 700,
              lineHeight: 1.1,
              color: 'greyscale.1000',
            })}
          >
            {value}
          </div>
        </div>
      </div>
      <div
        className={css({
          marginTop: '0.8rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.3rem',
          fontSize: '0.78rem',
        })}
      >
        <span
          className={css({
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.15rem',
            fontWeight: 700,
          })}
          style={{ color: up ? '#1E9E6A' : '#D6453D' }}
        >
          {up ? <RiArrowUpLine size={15} /> : <RiArrowDownLine size={15} />}
          {Math.abs(trend)}%
        </span>
        <span className={css({ color: 'greyscale.500' })}>{trendHint}</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- trend chart -- */

// The toggle names the window you are looking at; the chart title names the
// bucket inside it. Saying both removes the old ambiguity of a control labelled
// "Jour" that actually drew one bar per hour.
const RANGE_LABEL: Record<SeriesRange, string> = {
  h24: '24 h',
  d7: '7 jours',
  d30: '1 mois',
  m12: '12 mois',
}
// The bucket the title names. d7 and d30 share it: both are counted per day,
// they differ only in how far back they reach.
const RANGE_BUCKET: Record<SeriesRange, string> = {
  h24: 'heure',
  d7: 'jour',
  d30: 'jour',
  m12: 'mois',
}
const RANGES: SeriesRange[] = ['h24', 'd7', 'd30', 'm12']

const TrendChart = ({
  title,
  series,
  color,
  valueLabel,
}: {
  title: string
  series: Record<SeriesRange, SeriesPoint[]>
  color: string
  valueLabel: string
}) => {
  const [range, setRange] = useState<SeriesRange>('d7')
  const data = series[range].map((p) => ({
    label: formatBucket(p.bucket, range),
    count: p.count,
  }))
  const total = data.reduce((n, p) => n + p.count, 0)

  return (
    <div
      className={css({
        backgroundColor: 'white',
        border: '1px solid',
        borderColor: 'greyscale.200',
        borderRadius: '16px',
        padding: '1.2rem',
        display: 'flex',
        flexDirection: 'column',
      })}
    >
      <div
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.8rem',
          gap: '0.5rem',
          flexWrap: 'wrap',
        })}
      >
        <h3 className={css({ fontSize: '1rem', fontWeight: 700 })}>
          {title} par {RANGE_BUCKET[range]}
        </h3>
        <div
          className={css({
            display: 'flex',
            gap: '0.15rem',
            backgroundColor: 'greyscale.100',
            borderRadius: '8px',
            padding: '0.15rem',
          })}
        >
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={range === r}
              onClick={() => setRange(r)}
              className={css({
                // Tighter than before: four options have to sit on one row.
                padding: '0.25rem 0.55rem',
                borderRadius: '4px',
                fontSize: '0.8rem',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                border: 'none',
                backgroundColor: range === r ? 'white' : 'transparent',
                color: range === r ? 'primary.800' : 'greyscale.600',
                boxShadow: range === r ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
              })}
            >
              {RANGE_LABEL[r]}
            </button>
          ))}
        </div>
      </div>
      {/* The SVG carries no text a screen reader can use, so the region states
          the shape of the series; the tooltip stays for pointer users. */}
      <div
        role="img"
        aria-label={`${title} par ${RANGE_BUCKET[range]} sur ${RANGE_LABEL[range]} — ${total} ${valueLabel} au total`}
        className={css({ width: '100%', height: '230px' })}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 5, right: 8, left: -22, bottom: 0 }}
            barCategoryGap="30%"
          >
            {/* Solid hairline: dashed rules read as data next to bars. */}
            <CartesianGrid stroke="#EEF0F4" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#94969c' }}
              axisLine={false}
              tickLine={false}
              // Over 30 buckets every label cannot fit; let recharts drop the
              // ones that would collide rather than overlap them.
              minTickGap={12}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: '#94969c' }}
              axisLine={false}
              tickLine={false}
              width={34}
            />
            <Tooltip
              content={<ChartTooltip valueLabel={valueLabel} />}
              cursor={{ fill: 'rgba(15,23,42,0.04)' }}
            />
            {/* Square caps: a rounded top eats into the bar's height, which
                makes short bars read lower than they are. */}
            <Bar dataKey="count" fill={color} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

interface TooltipProps {
  active?: boolean
  payload?: { value: number; payload: { label: string } }[]
  valueLabel: string
}
const ChartTooltip = ({ active, payload, valueLabel }: TooltipProps) => {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div
      className={css({
        backgroundColor: 'white',
        border: '1px solid',
        borderColor: 'greyscale.200',
        borderRadius: '10px',
        padding: '0.5rem 0.75rem',
        boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
        fontSize: '0.82rem',
      })}
    >
      <div className={css({ fontWeight: 700, textTransform: 'capitalize' })}>
        {p.payload.label}
      </div>
      <div className={css({ color: 'greyscale.600' })}>
        {p.value} {valueLabel}
      </div>
    </div>
  )
}

/* ----------------------------------------------------------- activity feed -- */

const ACTIVITY_ICON: Record<
  string,
  { Icon: typeof RiUserAddLine; bg: string; fg: string }
> = {
  meeting_started: { Icon: RiUserAddLine, bg: '#EAF0FF', fg: '#3B5BDB' },
  meeting_ended: { Icon: RiVideoChatLine, bg: '#EAF0FF', fg: '#3B5BDB' },
  recording: { Icon: RiRecordCircleLine, bg: '#FFF1E2', fg: '#E8870B' },
  room: { Icon: RiDoorOpenLine, bg: '#E6F6EF', fg: '#1E9E6A' },
}

const ActivityPanel = ({ items }: { items: ActivityItem[] }) => (
  <div
    className={css({
      backgroundColor: 'white',
      border: '1px solid',
      borderColor: 'greyscale.200',
      borderRadius: '16px',
      padding: '1.2rem',
      display: 'flex',
      flexDirection: 'column',
    })}
  >
    <div
      className={css({
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: '0.5rem',
        marginBottom: '0.9rem',
      })}
    >
      <h3 className={css({ fontSize: '1rem', fontWeight: 700 })}>
        Activité récente
      </h3>
      <Link
        to="/admin/meetings"
        className={css({
          fontSize: '0.85rem',
          color: 'primary.800',
          fontWeight: 600,
          whiteSpace: 'nowrap',
        })}
      >
        Voir tout
      </Link>
    </div>
    {items.length === 0 ? (
      <div className={css({ color: 'greyscale.500', fontSize: '0.88rem' })}>
        Aucune activité récente.
      </div>
    ) : (
      <div
        className={css({
          display: 'flex',
          flexDirection: 'column',
          gap: '0.9rem',
          flexGrow: 1,
        })}
      >
        {items.map((a) => {
          const ic = ACTIVITY_ICON[a.type] ?? ACTIVITY_ICON.meeting_ended
          return (
            <div
              key={a.id}
              className={css({
                display: 'flex',
                gap: '0.65rem',
                alignItems: 'flex-start',
              })}
            >
              <div
                className={css({
                  width: '34px',
                  height: '34px',
                  borderRadius: '9px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                })}
                style={{ backgroundColor: ic.bg, color: ic.fg }}
              >
                <ic.Icon size={18} />
              </div>
              <div className={css({ minWidth: 0 })}>
                <div
                  className={css({
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: 'greyscale.900',
                  })}
                >
                  {a.title}
                </div>
                <div
                  className={css({
                    fontSize: '0.8rem',
                    color: 'greyscale.600',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  })}
                >
                  « {a.subtitle} »
                </div>
                <div
                  className={css({
                    fontSize: '0.72rem',
                    color: 'greyscale.400',
                    marginTop: '0.1rem',
                  })}
                >
                  {formatRelative(a.at)}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )}
  </div>
)

/* --------------------------------------------------------- recent meetings -- */

const RecentMeetings = ({ meetings }: { meetings: DashboardMeetingT[] }) => {
  const [detailId, setDetailId] = useState<string | null>(null)
  return (
    <div
      className={css({
        backgroundColor: 'white',
        border: '1px solid',
        borderColor: 'greyscale.200',
        borderRadius: '16px',
        padding: '1.2rem',
      })}
    >
      <div
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.9rem',
        })}
      >
        <h3 className={css({ fontSize: '1rem', fontWeight: 700 })}>
          Réunions récentes
        </h3>
        <Link
          to="/admin/meetings"
          className={css({
            fontSize: '0.85rem',
            color: 'primary.800',
            fontWeight: 600,
          })}
        >
          Voir toutes les réunions
        </Link>
      </div>
      {meetings.length === 0 ? (
        <div className={css({ color: 'greyscale.500', fontSize: '0.9rem' })}>
          Aucune réunion enregistrée pour l’instant. Les sessions apparaîtront
          ici dès qu’une réunion démarrera.
        </div>
      ) : (
        <div className={css({ overflowX: 'auto' })}>
          <table
            className={css({
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.88rem',
            })}
          >
            <thead>
              <tr
                className={css({ color: 'greyscale.500', textAlign: 'left' })}
              >
                <th className={th}>Réunion</th>
                <th className={th}>Organisateur</th>
                <th className={th}>Date et heure</th>
                <th className={th}>Durée</th>
                <th className={th}>Statut</th>
                <th className={th}>Participants</th>
              </tr>
            </thead>
            <tbody>
              {meetings.map((m) => (
                <tr
                  key={m.id}
                  className={css({
                    borderTop: '1px solid',
                    borderColor: 'greyscale.100',
                  })}
                >
                  <td className={td}>
                    <button
                      type="button"
                      onClick={() => setDetailId(m.id)}
                      className={css({
                        fontWeight: 600,
                        color: 'primary.800',
                        cursor: 'pointer',
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        textAlign: 'left',
                        font: 'inherit',
                        _hover: { textDecoration: 'underline' },
                      })}
                    >
                      {m.title}
                    </button>
                  </td>
                  <td className={td}>
                    {m.creator?.full_name || m.creator?.email || '—'}
                  </td>
                  <td className={td}>{formatDateTime(m.started_at)}</td>
                  <td className={td}>
                    {m.is_active ? '—' : formatDuration(m.duration_sec)}
                  </td>
                  <td className={td}>
                    {m.is_active ? (
                      <Badge tone="success">En cours</Badge>
                    ) : (
                      <Badge tone="neutral">Terminée</Badge>
                    )}
                  </td>
                  <td className={td}>{m.max_participants}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {detailId && (
        <MeetingDetailModal id={detailId} onClose={() => setDetailId(null)} />
      )}
    </div>
  )
}

type DashboardMeetingT = {
  id: string
  title: string
  creator: { full_name: string; email: string } | null
  started_at: string
  duration_sec: number | null
  max_participants: number
  is_active: boolean
}

const th = css({
  padding: '0.6rem 0.8rem',
  fontWeight: 600,
  fontSize: '0.76rem',
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
  whiteSpace: 'nowrap',
})
const td = css({
  padding: '0.7rem 0.8rem',
  color: 'greyscale.800',
  verticalAlign: 'middle',
  whiteSpace: 'nowrap',
})

/* ------------------------------------------------------------ system band -- */

const BAND_TONES = {
  green: { bg: '#DCFCE7', fg: '#16A34A' },
  blue: { bg: '#DBEAFE', fg: '#2563EB' },
  orange: { bg: '#FFEDD5', fg: '#EA580C' },
  red: { bg: '#FEE2E2', fg: '#DC2626' },
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

const BandTile = ({
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
const SystemBand = ({
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
            ? `Dernière vérification : ${formatRelative(status.checkedAt)}`
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
