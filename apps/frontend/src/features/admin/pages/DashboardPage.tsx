import { useQuery } from '@tanstack/react-query'
import { token } from '@/styled-system/tokens'
import {
  RiVideoChatLine,
  RiGroupLine,
  RiLayoutGridLine,
  RiFilmLine,
} from '@remixicon/react'
import { css } from '@/styled-system/css'
import { useUser } from '@/features/auth/api/useUser'
import { fetchAdminDashboard } from '../api/adminApi'
import { StatCard } from '@/components/console/ui'
import { useTranslation } from 'react-i18next'
import { DialogTrigger } from 'react-aria-components'
import { Button } from '@/primitives'
import { CreateMeetingMenu } from '@/features/home/components/CreateMeetingMenu'
import { JoinMeetingDialog } from '@/features/home/components/JoinMeetingDialog'
import { TrendChart } from '../components/dashboard/TrendChart'
import { ActivityPanel } from '../components/dashboard/ActivityPanel'
import { RecentMeetings } from '../components/dashboard/RecentMeetings'
import { SystemBand } from '../components/dashboard/SystemBand'

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
          color={token('colors.landing.blue-bright')}
          valueLabel="réunions"
        />
        <TrendChart
          title="Utilisateurs actifs"
          series={data.series.active_users}
          color={token('colors.landing.icon-green')}
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

/* ------------------------------------------------------------- trend chart -- */
