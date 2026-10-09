import { Link } from 'wouter'
import { token } from '@/styled-system/tokens'
import {
  RiVideoChatLine,
  RiUserAddLine,
  RiRecordCircleLine,
  RiDoorOpenLine,
} from '@remixicon/react'
import { css } from '@/styled-system/css'
import type { ActivityItem } from '../../api/types'
import { formatRelative } from '@/components/console/utils'

const ACTIVITY_ICON: Record<
  string,
  { Icon: typeof RiUserAddLine; bg: string; fg: string }
> = {
  meeting_started: {
    Icon: RiUserAddLine,
    bg: token('colors.brand.blue-subtle'),
    fg: token('colors.brand.blue'),
  },
  meeting_ended: {
    Icon: RiVideoChatLine,
    bg: token('colors.brand.blue-subtle'),
    fg: token('colors.brand.blue'),
  },
  recording: {
    Icon: RiRecordCircleLine,
    bg: token('colors.brand.orange-subtle'),
    fg: token('colors.brand.orange'),
  },
  room: {
    Icon: RiDoorOpenLine,
    bg: token('colors.brand.green-subtle'),
    fg: token('colors.brand.green'),
  },
}

export const ActivityPanel = ({ items }: { items: ActivityItem[] }) => (
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
        alignItems: 'baseline',
        gap: '0.5rem',
        marginBottom: '0.9rem',
      })}
    >
      <h3 className={css({ fontSize: '1rem', fontWeight: 700 })}>
        Activité récente
      </h3>
      <Link
        to="/admin/meetings"
        className={css({
          fontSize: '0.85rem',
          color: 'primary.800',
          fontWeight: 600,
          whiteSpace: 'nowrap',
        })}
      >
        Voir tout
      </Link>
    </div>
    {items.length === 0 ? (
      <div className={css({ color: 'greyscale.500', fontSize: '0.88rem' })}>
        Aucune activité récente.
      </div>
    ) : (
      <div
        className={css({
          display: 'flex',
          flexDirection: 'column',
          gap: '0.9rem',
          flexGrow: 1,
        })}
      >
        {items.map((a) => {
          const ic = ACTIVITY_ICON[a.type] ?? ACTIVITY_ICON.meeting_ended
          return (
            <div
              key={a.id}
              className={css({
                display: 'flex',
                gap: '0.65rem',
                alignItems: 'flex-start',
              })}
            >
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
                <div
                  className={css({
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: 'greyscale.900',
                  })}
                >
                  {a.title}
                </div>
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
                <div
                  className={css({
                    fontSize: '0.72rem',
                    color: 'greyscale.400',
                    marginTop: '0.1rem',
                  })}
                >
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
