import { ReactNode } from 'react'
import { Link } from 'wouter'
import { css } from '@/styled-system/css'
import { RiDashboardLine, RiHistoryLine, RiFilmLine } from '@remixicon/react'
import { useHomePath } from '@/features/auth/utils/useHomePath'
import { Screen } from '@/layout/Screen'
import { ConsoleTopBar } from '@/components/console/TopBar'
import { ConsoleSidebarFooter } from '@/components/console/SidebarFooter'

export type MySpaceSection = 'dashboard' | 'meetings' | 'recordings'

const NAV: {
  key: MySpaceSection
  label: string
  Icon: typeof RiDashboardLine
}[] = [
  { key: 'dashboard', label: 'Tableau de bord', Icon: RiDashboardLine },
  { key: 'meetings', label: 'Historique des sessions', Icon: RiHistoryLine },
  { key: 'recordings', label: 'Enregistrements', Icon: RiFilmLine },
]

/**
 * Sidebar shell of the personal space. Deliberately the same visual language as
 * AdminLayout — same nav pattern, spacing and active-item treatment — so the two
 * consoles read as one product.
 */
export const MySpaceLayout = ({
  section,
  title,
  children,
}: {
  section: MySpaceSection
  title?: string
  children: ReactNode
}) => {
  const homePath = useHomePath()
  return (
    // These screens carry their own sidebar and account menu; the global
    // header would duplicate the logo. Declaring it here keeps visibility
    // deterministic — it used to depend on which page you came from.
    <Screen header={false} footer={false}>
      <div
        className={css({
          display: 'flex',
          flexDirection: { base: 'column', md: 'row' },
          gap: '0',
          width: '100%',
          flexGrow: 1,
          minHeight: 0,
          backgroundColor: 'greyscale.50',
        })}
      >
        <aside
          className={css({
            flexShrink: 0,
            width: { base: '100%', md: '256px' },
            backgroundColor: 'white',
            borderRight: { base: 'none', md: '1px solid' },
            borderColor: 'greyscale.200',
            padding: '1.25rem 0.9rem',
            display: 'flex',
            flexDirection: 'column',
          })}
        >
          <Link
            to={homePath}
            className={css({ display: 'block', padding: '0 0.6rem 1.1rem' })}
          >
            <img
              src="/assets/logo.svg"
              alt={`${import.meta.env.VITE_APP_TITLE}`}
              width={1297}
              height={280}
              className={css({ height: '34px', width: 'auto' })}
            />
          </Link>

          <nav
            className={css({
              display: 'flex',
              flexDirection: { base: 'row', md: 'column' },
              gap: '0.25rem',
              overflowX: { base: 'auto', md: 'visible' },
            })}
          >
            {NAV.map(({ key, label, Icon }) => {
              const active = section === key
              return (
                <Link
                  key={key}
                  to={`/mon-espace/${key}`}
                  className={css({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.7rem',
                    padding: '0.7rem 0.85rem',
                    borderRadius: '10px',
                    fontSize: '0.92rem',
                    fontWeight: active ? 700 : 500,
                    color: active ? 'white' : 'greyscale.700',
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                    transition: 'background 0.15s',
                    _hover: {
                      backgroundColor: active ? undefined : 'greyscale.100',
                    },
                  })}
                  style={
                    active
                      ? {
                          background:
                            'linear-gradient(135deg, #4d5fe0 0%, #3b49b8 100%)',
                          boxShadow: '0 6px 16px rgba(59,73,184,0.30)',
                        }
                      : undefined
                  }
                >
                  <Icon size={20} aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              )
            })}
          </nav>

          <ConsoleSidebarFooter />
        </aside>

        <main
          className={css({
            flexGrow: 1,
            minWidth: 0,
            padding: { base: '1rem', md: '1.75rem 2rem' },
            overflowY: 'auto',
          })}
        >
          <ConsoleTopBar current="mySpace" />
          {title && (
            <h1
              className={css({
                fontSize: '1.5rem',
                fontWeight: 700,
                marginBottom: '1.2rem',
                color: 'greyscale.1000',
              })}
            >
              {title}
            </h1>
          )}
          {children}
        </main>
      </div>
    </Screen>
  )
}
