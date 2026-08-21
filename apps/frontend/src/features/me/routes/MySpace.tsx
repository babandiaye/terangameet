import { useParams } from 'wouter'
import { useTitle } from 'hoofd'
import { useUser } from '@/features/auth/api/useUser'
import { LoadingScreen } from '@/components/LoadingScreen'
import { ErrorScreen } from '@/components/ErrorScreen'
import { MySpaceLayout, type MySpaceSection } from '../components/MySpaceLayout'
import { MyDashboardPage } from '../pages/MyDashboardPage'
import { MyMeetingsPage } from '../pages/MyMeetingsPage'
import { MyRecordingsPage } from '../pages/MyRecordingsPage'

const APP_TITLE = import.meta.env.VITE_APP_TITLE ?? ''

// An empty title lets the page render its own header (the dashboard greets).
const SECTIONS: Record<MySpaceSection, { title: string; Component: () => JSX.Element }> = {
  dashboard: { title: '', Component: MyDashboardPage },
  meetings: { title: 'Historique des sessions', Component: MyMeetingsPage },
  recordings: { title: 'Enregistrements', Component: MyRecordingsPage },
}

/**
 * Personal space. Open to any signed-in user — unlike /admin there is no staff
 * check, because every endpoint behind it is already scoped to the caller.
 */
const MySpace = () => {
  const params = useParams()
  const raw = (params.section ?? 'dashboard') as MySpaceSection
  const section: MySpaceSection = raw in SECTIONS ? raw : 'dashboard'
  const { isLoggedIn, isLoading } = useUser()

  useTitle(`${APP_TITLE} - Mon espace`)

  if (isLoading || isLoggedIn === undefined) return <LoadingScreen />

  if (isLoggedIn === false) {
    return (
      <ErrorScreen
        title="Connexion requise"
        body="Vous devez être connecté pour accéder à votre espace."
      />
    )
  }

  const { title, Component } = SECTIONS[section]
  return (
    <MySpaceLayout section={section} title={title}>
      <Component />
    </MySpaceLayout>
  )
}

export default MySpace
