import { useParams } from 'wouter'
import { useTitle } from 'hoofd'
import { useUser } from '@/features/auth/api/useUser'
import { LoadingScreen } from '@/components/LoadingScreen'
import { ErrorScreen } from '@/components/ErrorScreen'
import { AdminLayout, type AdminSection } from '../components/AdminLayout'
import { DashboardPage } from '../pages/DashboardPage'
import { UsersPage } from '../pages/UsersPage'
import { MeetingsPage } from '../pages/MeetingsPage'
import { RecordingsPage } from '../pages/RecordingsPage'
import { RoomsPage } from '../pages/RoomsPage'
import { StatusPage } from '../pages/StatusPage'
import { SettingsPage } from '../pages/SettingsPage'

const APP_TITLE = import.meta.env.VITE_APP_TITLE ?? ''

// An empty title lets the page render its own header (the dashboard has a greeting).
const SECTIONS: Record<AdminSection, { title: string; Component: () => JSX.Element }> = {
  dashboard: { title: '', Component: DashboardPage },
  users: { title: 'Utilisateurs', Component: UsersPage },
  meetings: { title: 'Historique des réunions', Component: MeetingsPage },
  recordings: { title: 'Enregistrements', Component: RecordingsPage },
  rooms: { title: 'Salles de réunion', Component: RoomsPage },
  status: { title: 'État des services', Component: StatusPage },
  settings: { title: 'Paramètres', Component: SettingsPage },
}

const Admin = () => {
  const params = useParams()
  const raw = (params.section ?? 'dashboard') as AdminSection
  const section: AdminSection = raw in SECTIONS ? raw : 'dashboard'
  const { user, isLoggedIn, isLoading } = useUser()

  useTitle(`${APP_TITLE} - Administration`)

  if (isLoading || isLoggedIn === undefined) return <LoadingScreen />

  if (isLoggedIn === false) {
    return (
      <ErrorScreen
        title="Connexion requise"
        body="Vous devez être connecté pour accéder à l’administration."
      />
    )
  }

  if (!user?.is_admin) {
    return (
      <ErrorScreen
        title="Accès refusé"
        body="Cette section est réservée aux administrateurs de la plateforme."
      />
    )
  }

  const { title, Component } = SECTIONS[section]
  return (
    <AdminLayout section={section} title={title}>
      <Component />
    </AdminLayout>
  )
}

export default Admin
