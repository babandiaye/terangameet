import { css } from '@/styled-system/css'
import { RiCloseLine, RiStarFill, RiStarLine } from '@remixicon/react'

/**
 * The guests of a meeting as pills: name (or address), a star to make them
 * co-host when the organiser owns the room, a cross to remove them.
 */
export const GuestChips = ({
  guests,
  names,
  coHosts,
  canManageCoHosts,
  onToggleCoHost,
  onRemove,
}: {
  guests: string[]
  /** Account names of the guests who are members, by address. */
  names: Record<string, string>
  coHosts: string[]
  canManageCoHosts: boolean
  onToggleCoHost: (email: string) => void
  onRemove: (email: string) => void
}) => (
  <ul
    aria-label="Invités"
    className={css({
      display: 'flex',
      flexWrap: 'wrap',
      gap: '0.4rem',
      listStyle: 'none',
      padding: 0,
      margin: '0.6rem 0 0',
    })}
  >
    {guests.map((email) => {
      const isCoHost = coHosts.includes(email)
      const who = names[email] || email
      return (
        <li
          key={email}
          className={css({
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            padding: '0.2rem 0.3rem 0.2rem 0.65rem',
            borderRadius: '999px',
            backgroundColor: isCoHost ? 'primary.800' : 'primary.100',
            color: isCoHost ? 'white' : 'primary.800',
            fontSize: '0.85rem',
            maxWidth: '100%',
          })}
        >
          <span className={css({ overflowWrap: 'anywhere' })}>
            {who}
            {isCoHost && (
              <span className={css({ fontWeight: 600 })}> · co-animateur</span>
            )}
          </span>
          {canManageCoHosts && (
            <button
              type="button"
              aria-pressed={isCoHost}
              aria-label={`${who} co-animateur`}
              title={
                isCoHost
                  ? 'Retirer le rôle de co-animateur'
                  : 'Désigner co-animateur'
              }
              onClick={() => onToggleCoHost(email)}
              className={css({
                display: 'inline-flex',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'inherit',
                padding: '0.1rem',
                borderRadius: '50%',
                _hover: {
                  backgroundColor: 'primary.200',
                  color: 'primary.800',
                },
              })}
            >
              {isCoHost ? (
                <RiStarFill size={16} aria-hidden="true" />
              ) : (
                <RiStarLine size={16} aria-hidden="true" />
              )}
            </button>
          )}
          <button
            type="button"
            aria-label={`Retirer ${who}`}
            onClick={() => onRemove(email)}
            className={css({
              display: 'inline-flex',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'inherit',
              padding: '0.1rem',
              borderRadius: '50%',
              _hover: { backgroundColor: 'primary.200' },
            })}
          >
            <RiCloseLine size={16} aria-hidden="true" />
          </button>
        </li>
      )
    })}
  </ul>
)
