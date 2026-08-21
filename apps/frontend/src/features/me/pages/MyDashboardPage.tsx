import { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'wouter'
import { css } from '@/styled-system/css'
import {
  RiAddLine,
  RiVideoChatLine,
  RiTimeLine,
  RiTimerLine,
  RiFilmLine,
} from '@remixicon/react'
import { useUser } from '@/features/auth/api/useUser'
import { Badge, Table, Th, Td } from '@/components/console/ui'
import { formatDateTime, formatDuration, formatRelative } from '@/components/console/utils'
import { fetchMyDashboard } from '../api/meApi'

const TONES = {
  blue: { bg: '#EAF0FF', fg: '#3B5BDB' },
  green: { bg: '#E6F6EF', fg: '#1E9E6A' },
  orange: { bg: '#FFF1E2', fg: '#E8870B' },
}

/**
 * Same card as the admin dashboard, minus the week-over-week trend: a personal
 * history has no meaningful comparison baseline, so the footer carries a plain
 * hint instead.
 */
const StatCard = ({
  label,
  value,
  hint,
  Icon,
  tone,
}: {
  label: string
  value: ReactNode
  hint: string
  Icon: typeof RiVideoChatLine
  tone: keyof typeof TONES
}) => {
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
      <div className={css({ marginTop: '0.8rem', fontSize: '0.78rem', color: 'greyscale.500' })}>
        {hint}
      </div>
    </div>
  )
}

export const MyDashboardPage = () => {
  const { user } = useUser()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['me', 'dashboard'],
    queryFn: fetchMyDashboard,
  })

  if (isLoading) return <div className={css({ color: 'greyscale.500' })}>Chargement…</div>
  if (isError || !data)
    return (
      <div className={css({ color: 'danger.600' })}>Impossible de charger votre tableau de bord.</div>
    )

  // OIDC given_name is exposed as last_name by the API; prefer it over the first
  // token of the full name.
  const firstName = user?.last_name || (user?.full_name || '').split(' ')[0] || ''
  const t = data.totals

  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '1.5rem' })}>
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
            Bonjour{firstName ? `, ${firstName}` : ''} <span aria-hidden>👋</span>
          </h2>
          <p className={css({ color: 'greyscale.600', marginTop: '0.2rem' })}>
            {t.meetings > 0
              ? `Votre activité sur ${import.meta.env.VITE_APP_TITLE ?? 'la plateforme'}.`
              : 'Vos réunions apparaîtront ici dès votre première participation.'}
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

      <div
        className={css({
          display: 'grid',
          gridTemplateColumns: { base: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
          gap: '1rem',
        })}
      >
        <StatCard
          label="Réunions suivies"
          value={t.meetings}
          hint={
            t.last_meeting_at ? `dernière ${formatRelative(t.last_meeting_at)}` : 'aucune pour l’instant'
          }
          Icon={RiVideoChatLine}
          tone="blue"
        />
        <StatCard
          label="Temps en réunion"
          value={formatDuration(t.total_duration_sec)}
          hint="cumul de vos participations"
          Icon={RiTimeLine}
          tone="green"
        />
        <StatCard
          label="Durée moyenne"
          value={formatDuration(t.avg_duration_sec)}
          hint="par réunion terminée"
          Icon={RiTimerLine}
          tone="orange"
        />
        <StatCard
          label="Enregistrements"
          value={t.recordings}
          hint="accessibles depuis votre espace"
          Icon={RiFilmLine}
          tone="blue"
        />
      </div>

      <div>
        <div
          className={css({
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: '0.7rem',
          })}
        >
          <h3 className={css({ fontSize: '1.05rem', fontWeight: 700, color: 'greyscale.1000' })}>
            Vos dernières sessions
          </h3>
          <Link
            to="/mon-espace/meetings"
            className={css({ fontSize: '0.85rem', color: 'primary.800', fontWeight: 600 })}
          >
            Tout l’historique
          </Link>
        </div>

        <Table>
          <thead>
            <tr>
              <Th>Réunion</Th>
              <Th>Date</Th>
              <Th>Ma présence</Th>
              <Th>Participants</Th>
              <Th>Statut</Th>
            </tr>
          </thead>
          <tbody>
            {data.recent_meetings.map((m) => (
              <tr key={m.id}>
                <Td>
                  <span className={css({ fontWeight: 600 })}>{m.title}</span>
                  {m.has_recording && (
                    <span className={css({ marginLeft: '0.45rem' })}>
                      <Badge tone="info">Enregistrée</Badge>
                    </span>
                  )}
                </Td>
                <Td>{formatDateTime(m.started_at)}</Td>
                <Td>{m.me.duration_sec === null ? '—' : formatDuration(m.me.duration_sec)}</Td>
                <Td>{m.participants}</Td>
                <Td>
                  {m.is_active ? (
                    <Badge tone="success">En cours</Badge>
                  ) : (
                    <Badge tone="neutral">Terminée</Badge>
                  )}
                </Td>
              </tr>
            ))}
            {data.recent_meetings.length === 0 && (
              <tr>
                <Td>
                  <span className={css({ color: 'greyscale.500' })}>
                    Vous n’avez encore participé à aucune réunion.
                  </span>
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>
    </div>
  )
}
