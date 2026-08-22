import { css } from '@/styled-system/css'

/**
 * Foot of the console sidebars. Hidden on small screens, where the sidebar
 * collapses into a horizontal nav strip and a copyright line would push the
 * content down for nothing.
 */
export const ConsoleSidebarFooter = () => (
  <div
    className={css({
      display: { base: 'none', md: 'block' },
      marginTop: 'auto',
      paddingTop: '1.5rem',
      paddingX: '0.6rem',
      fontSize: '0.72rem',
      lineHeight: 1.5,
      color: 'greyscale.500',
    })}
  >
    <div
      className={css({
        width: '28px',
        height: '3px',
        borderRadius: '2px',
        backgroundColor: 'primary.800',
        marginBottom: '0.7rem',
      })}
    />
    © {new Date().getFullYear()} {import.meta.env.VITE_APP_TITLE}
    <br />
    Tous droits réservés.
  </div>
)
