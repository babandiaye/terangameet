import '@/styles/index.css'
import { Suspense, lazy } from 'react'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { QueryClientProvider } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useTitle } from 'hoofd'
import { Switch, Route } from 'wouter'
import { I18nProvider } from 'react-aria-components'
import { Layout } from './layout/Layout'
import { NotFoundScreen } from './components/NotFoundScreen'
import { routes } from './routes'
import './i18n/init'
import { queryClient } from '@/api/queryClient'
import { AppInitialization } from '@/components/AppInitialization'
import { UsernameOwnerGuard } from '@/features/auth/components/UsernameOwnerGuard'
import { useIsSdkContext } from '@/features/sdk/hooks/useIsSdkContext'
import { useApplyA11yFonts } from '@/hooks/useApplyA11yFonts'

const AdminRoute = lazy(() => import('@/features/admin/routes/Admin'))
const MySpaceRoute = lazy(() => import('@/features/me/routes/MySpace'))

function App() {
  const { i18n } = useTranslation()
  useTitle(import.meta.env.VITE_APP_TITLE ?? '')

  const isSDKContext = useIsSdkContext()
  useApplyA11yFonts()

  return (
    <QueryClientProvider client={queryClient}>
      {!isSDKContext && <AppInitialization />}
      {/* Unconditional: a stale display name is a browser-level problem, so it
          has to be caught in the embedded SDK context too. */}
      <UsernameOwnerGuard />
      <Suspense fallback={null}>
        <I18nProvider locale={i18n.language}>
          <Layout>
            <Switch>
              {/* Consoles — registered before the single-segment room regex
                  so "/admin" and "/mon-espace" aren't captured as room ids. */}
              <Route path="/admin" component={AdminRoute} />
              <Route path="/admin/:section" component={AdminRoute} />
              <Route path="/mon-espace" component={MySpaceRoute} />
              <Route path="/mon-espace/:section" component={MySpaceRoute} />
              {Object.entries(routes).map(([, route], i) => (
                <Route key={i} path={route.path} component={route.Component} />
              ))}
              <Route component={NotFoundScreen} />
            </Switch>
          </Layout>
          <ReactQueryDevtools
            initialIsOpen={false}
            buttonPosition="bottom-left"
          />
        </I18nProvider>
      </Suspense>
    </QueryClientProvider>
  )
}

export default App
