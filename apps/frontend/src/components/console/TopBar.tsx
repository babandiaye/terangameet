import { useLocation } from 'wouter'
import { useTranslation } from 'react-i18next'
import { RiArrowDownSLine } from '@remixicon/react'
import { css } from '@/styled-system/css'
import { Button } from '@/primitives'
import { Menu } from '@/primitives/Menu'
import { MenuList } from '@/primitives/MenuList'
import { useUser } from '@/features/auth/api/useUser'
import { logout } from '@/features/auth/utils/logout'

/**
 * Account menu for the console screens (personal space and administration).
 *
 * These screens render their own chrome and hide the global Header, which is
 * where the sign-out entry used to live — without this bar there is simply no
 * way to sign out once you land on them. That became reachable on every login
 * as soon as the post-login redirect started dropping users straight here.
 */

/** Up to two initials, from the full name when available, else the email. */
function initials(fullName?: string, email?: string): string {
  const source = (fullName || '').trim()
  if (source) {
    const parts = source.split(/\s+/).filter(Boolean)
    const first = parts[0]?.[0] ?? ''
    const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
    return (first + last).toUpperCase()
  }
  return (email || '?').slice(0, 2).toUpperCase()
}

export const ConsoleTopBar = ({
  current,
}: {
  current: 'mySpace' | 'admin'
}) => {
  const { t } = useTranslation()
  const { user } = useUser()
  const [, navigate] = useLocation()

  if (!user) return null

  const name = user.full_name || user.email || ''
  const role = user.is_admin ? 'Administrateur' : 'Utilisateur'

  const items = [
    ...(current !== 'mySpace'
      ? [{ value: 'mySpace', label: 'Mon espace' }]
      : []),
    ...(user.is_admin && current !== 'admin'
      ? [{ value: 'admin', label: 'Administration' }]
      : []),
    { value: 'logout', label: t('logout') },
  ]

  return (
    <div
      className={css({
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: '0.5rem',
        paddingBottom: '1rem',
        marginBottom: '0.5rem',
        borderBottom: '1px solid',
        borderColor: 'greyscale.200',
      })}
    >
      <Menu>
        <Button
          size="sm"
          variant="secondaryText"
          aria-label={`${name} — ${role}`}
        >
          <span
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
            })}
          >
            <span
              className={css({
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                borderRadius: '999px',
                backgroundColor: 'primary.800',
                color: 'white',
                fontSize: '0.8rem',
                fontWeight: 700,
                flexShrink: 0,
              })}
              aria-hidden="true"
            >
              {initials(user.full_name, user.email)}
            </span>
            <span
              className={css({
                display: { base: 'none', sm: 'flex' },
                flexDirection: 'column',
                alignItems: 'flex-start',
                lineHeight: 1.25,
              })}
            >
              <span
                className={css({
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  maxWidth: '260px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                })}
              >
                {name}
              </span>
              <span
                className={css({ fontSize: '0.75rem', color: 'greyscale.600' })}
              >
                {role}
              </span>
            </span>
            <RiArrowDownSLine size={18} aria-hidden="true" />
          </span>
        </Button>
        <MenuList
          variant="light"
          items={items}
          onAction={(value) => {
            if (value === 'mySpace') navigate('/mon-espace')
            else if (value === 'admin') navigate('/admin')
            else if (value === 'logout') logout()
          }}
        />
      </Menu>
    </div>
  )
}
