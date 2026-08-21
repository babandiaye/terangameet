import { useState, ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'wouter'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
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
  RiAddLine,
  RiUserAddLine,
  RiRecordCircleLine,
  RiDoorOpenLine,
} from '@remixicon/react'
import { css } from '@/styled-system/css'
import { useUser } from '@/features/auth/api/useUser'
import { fetchAdminDashboard } from '../api/adminApi'
import type { SeriesPoint, ActivityItem } from '../api/types'
import { Badge } from '@/components/console/ui'
import { formatBucket, formatRelative, formatDuration, formatDateTime } from '@/components/console/utils'

type Gran = 'hour' | 'day' | 'month'

export const DashboardPage = () => {
  const { user } = useUser()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: fetchAdminDashboard,
  })

  if (isLoading) return <div className={css({ color: 'greyscale.500' })}>Chargement…</div>
  if (isError || !data)
    return <div className={css({ color: 'danger.600' })}>Impossible de charger le tableau de bord.</div>

  // Prefer the given name (OIDC given_name, exposed as last_name) over the first
  // token of the full name, so "Papa Amadou Baba NDIAYE" greets "Papa Amadou Baba".
  const firstName =
    user?.last_name || (user?.full_name || '').split(' ')[0] || 'Admin'
  const t = data.totals

  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '1.5rem' })}>
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
          <h2 className={css({ fontSize: '1.7rem', fontWeight: 700, color: 'greyscale.1000' })}>
            Bonjour, {firstName} <span aria-hidden>👋</span>
          </h2>
          <p className={css({ color: 'greyscale.600', marginTop: '0.2rem' })}>
            Voici ce qui se passe sur votre plateforme aujourd’hui.
          </p>
        </div>
        <Link
          to="/"
          className={css({
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            backgroundColor: 'primary.800',
            color: 'white',
            padding: '0.65rem 1.1rem',
            borderRadius: '10px',
            fontWeight: 600,
            fontSize: '0.92rem',
            textDecoration: 'none',
            _hover: { backgroundColor: 'primary.900' },
          })}
        >
          <RiAddLine size={18} /> Nouvelle réunion
        </Link>
      </div>

      {/* Stat cards */}
      <div
        className={css({
          display: 'grid',
          gridTemplateColumns: { base: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
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
          label="Salles créées"
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
          gridTemplateColumns: { base: '1fr', lg: '1fr 1fr', xl: '1fr 1fr 320px' },
          gap: '1rem',
          alignItems: 'stretch',
        })}
      >
        <TrendChart
          title="Réunions par"
          series={data.series.meetings}
          color="#5b6ef5"
          valueLabel="réunions"
        />
        <TrendChart
          title="Utilisateurs actifs par"
          series={data.series.active_users}
          color="#22b07d"
          valueLabel="utilisateurs"
        />
        <ActivityPanel items={data.recent_activity} />
      </div>

      {/* Recent meetings */}
      <RecentMeetings meetings={data.recent_meetings} />
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
      <div className={css({ display: 'flex', alignItems: 'center', gap: '0.8rem' })}>
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
          <div className={css({ fontSize: '0.82rem', color: 'greyscale.600' })}>{label}</div>
          <div className={css({ fontSize: '1.9rem', fontWeight: 700, lineHeight: 1.1, color: 'greyscale.1000' })}>
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
          className={css({ display: 'inline-flex', alignItems: 'center', gap: '0.15rem', fontWeight: 700 })}
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

const GRAN_LABEL: Record<Gran, string> = { hour: 'Jour', day: 'Semaine', month: 'Mois' }

const TrendChart = ({
  title,
  series,
  color,
  valueLabel,
}: {
  title: string
  series: { hour: SeriesPoint[]; day: SeriesPoint[]; month: SeriesPoint[] }
  color: string
  valueLabel: string
}) => {
  const [gran, setGran] = useState<Gran>('day')
  const gid = `grad-${valueLabel}`
  const data = series[gran].map((p) => ({ label: formatBucket(p.bucket, gran), count: p.count }))

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
          {title} {GRAN_LABEL[gran].toLowerCase()}
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
          {(['hour', 'day', 'month'] as Gran[]).map((g) => (
            <button
              key={g}
              onClick={() => setGran(g)}
              className={css({
                padding: '0.25rem 0.7rem',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                border: 'none',
                backgroundColor: gran === g ? 'white' : 'transparent',
                color: gran === g ? 'primary.800' : 'greyscale.600',
                boxShadow: gran === g ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
              })}
            >
              {GRAN_LABEL[g]}
            </button>
          ))}
        </div>
      </div>
      <div className={css({ width: '100%', height: '230px' })}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 8, left: -22, bottom: 0 }}>
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94969c' }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94969c' }} axisLine={false} tickLine={false} width={34} />
            <Tooltip content={<ChartTooltip valueLabel={valueLabel} />} cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: '4 4' }} />
            <Area
              type="monotone"
              dataKey="count"
              stroke={color}
              strokeWidth={2.5}
              fill={`url(#${gid})`}
              dot={false}
              activeDot={{ r: 5, fill: color, stroke: '#fff', strokeWidth: 2 }}
            />
          </AreaChart>
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
      <div className={css({ fontWeight: 700, textTransform: 'capitalize' })}>{p.payload.label}</div>
      <div className={css({ color: 'greyscale.600' })}>
        {p.value} {valueLabel}
      </div>
    </div>
  )
}

/* ----------------------------------------------------------- activity feed -- */

const ACTIVITY_ICON: Record<string, { Icon: typeof RiUserAddLine; bg: string; fg: string }> = {
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
    <h3 className={css({ fontSize: '1rem', fontWeight: 700, marginBottom: '0.9rem' })}>Activité récente</h3>
    {items.length === 0 ? (
      <div className={css({ color: 'greyscale.500', fontSize: '0.88rem' })}>Aucune activité récente.</div>
    ) : (
      <div className={css({ display: 'flex', flexDirection: 'column', gap: '0.9rem', flexGrow: 1 })}>
        {items.map((a) => {
          const ic = ACTIVITY_ICON[a.type] ?? ACTIVITY_ICON.meeting_ended
          return (
            <div key={a.id} className={css({ display: 'flex', gap: '0.65rem', alignItems: 'flex-start' })}>
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
                <div className={css({ fontSize: '0.85rem', fontWeight: 600, color: 'greyscale.900' })}>{a.title}</div>
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
                <div className={css({ fontSize: '0.72rem', color: 'greyscale.400', marginTop: '0.1rem' })}>
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

const AvatarStack = ({ count }: { count: number }) => {
  const shown = Math.min(count, 3)
  const palette = ['#5b6ef5', '#22b07d', '#e8870b', '#d6453d']
  return (
    <div className={css({ display: 'flex', alignItems: 'center' })}>
      {Array.from({ length: shown }).map((_, i) => (
        <div
          key={i}
          className={css({
            width: '26px',
            height: '26px',
            borderRadius: '50%',
            border: '2px solid white',
            marginLeft: i === 0 ? 0 : '-8px',
          })}
          style={{ backgroundColor: palette[i % palette.length] }}
        />
      ))}
      {count > shown && (
        <span
          className={css({
            marginLeft: '0.35rem',
            fontSize: '0.78rem',
            color: 'greyscale.600',
            fontWeight: 600,
          })}
        >
          +{count - shown}
        </span>
      )}
      {count === 0 && <span className={css({ fontSize: '0.8rem', color: 'greyscale.400' })}>—</span>}
    </div>
  )
}

const RecentMeetings = ({ meetings }: { meetings: DashboardMeetingT[] }) => (
  <div
    className={css({
      backgroundColor: 'white',
      border: '1px solid',
      borderColor: 'greyscale.200',
      borderRadius: '16px',
      padding: '1.2rem',
    })}
  >
    <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9rem' })}>
      <h3 className={css({ fontSize: '1rem', fontWeight: 700 })}>Réunions récentes</h3>
      <Link to="/admin/meetings" className={css({ fontSize: '0.85rem', color: 'primary.800', fontWeight: 600 })}>
        Voir toutes les réunions
      </Link>
    </div>
    {meetings.length === 0 ? (
      <div className={css({ color: 'greyscale.500', fontSize: '0.9rem' })}>
        Aucune réunion enregistrée pour l’instant. Les sessions apparaîtront ici dès qu’une réunion démarrera.
      </div>
    ) : (
      <div className={css({ overflowX: 'auto' })}>
        <table className={css({ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' })}>
          <thead>
            <tr className={css({ color: 'greyscale.500', textAlign: 'left' })}>
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
              <tr key={m.id} className={css({ borderTop: '1px solid', borderColor: 'greyscale.100' })}>
                <td className={td}>
                  <span className={css({ fontWeight: 600 })}>{m.title}</span>
                </td>
                <td className={td}>{m.creator?.full_name || m.creator?.email || '—'}</td>
                <td className={td}>{formatDateTime(m.started_at)}</td>
                <td className={td}>{m.is_active ? '—' : formatDuration(m.duration_sec)}</td>
                <td className={td}>
                  {m.is_active ? <Badge tone="success">En cours</Badge> : <Badge tone="neutral">Terminée</Badge>}
                </td>
                <td className={td}>
                  <AvatarStack count={m.max_participants} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
)

type DashboardMeetingT = {
  id: string
  title: string
  creator: { full_name: string; email: string } | null
  started_at: string
  duration_sec: number | null
  max_participants: number
  is_active: boolean
}

const th = css({ padding: '0.6rem 0.8rem', fontWeight: 600, fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap' })
const td = css({ padding: '0.7rem 0.8rem', color: 'greyscale.800', verticalAlign: 'middle', whiteSpace: 'nowrap' })
