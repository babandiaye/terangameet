import { ReactNode } from 'react'
import { css } from '@/styled-system/css'
import {
  RiArrowUpSLine,
  RiArrowDownSLine,
  RiArrowUpLine,
  RiArrowDownLine,
  type RemixiconComponentType,
} from '@remixicon/react'

export const Card = ({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) => (
  <div
    className={
      css({
        backgroundColor: 'white',
        border: '1px solid',
        borderColor: 'greyscale.200',
        borderRadius: '12px',
        padding: '1.1rem 1.2rem',
      }) + (className ? ` ${className}` : '')
    }
  >
    {children}
  </div>
)

/** Icon tile colours of a stat card, from the brand tokens (no raw hex). */
const STAT_TONES = {
  blue: css({ backgroundColor: 'brand.blue-subtle', color: 'brand.blue' }),
  green: css({ backgroundColor: 'brand.green-subtle', color: 'brand.green' }),
  orange: css({
    backgroundColor: 'brand.orange-subtle',
    color: 'brand.orange',
  }),
}

/**
 * Headline figure of a console dashboard (admin and Mon espace): icon tile,
 * label, value, and a footer — either a trend against the previous period
 * (admin) or a plain hint (personal history has no baseline to compare to).
 */
export const StatCard = ({
  label,
  value,
  Icon,
  tone,
  ...footer
}: {
  label: string
  value: ReactNode
  Icon: RemixiconComponentType
  tone: keyof typeof STAT_TONES
} & ({ trend: number; trendHint: string } | { hint: string })) => (
  <div
    className={css({
      backgroundColor: 'white',
      border: '1px solid',
      borderColor: 'greyscale.200',
      borderRadius: '16px',
      padding: '1.2rem',
    })}
  >
    <div
      className={css({ display: 'flex', alignItems: 'center', gap: '0.8rem' })}
    >
      <div
        className={`${css({
          width: '48px',
          height: '48px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        })} ${STAT_TONES[tone]}`}
      >
        <Icon size={24} />
      </div>
      <div>
        <div className={css({ fontSize: '0.82rem', color: 'greyscale.600' })}>
          {label}
        </div>
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
    {'trend' in footer ? (
      <div
        className={css({
          marginTop: '0.8rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.3rem',
          fontSize: '0.78rem',
        })}
      >
        <span
          className={css({
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.15rem',
            fontWeight: 700,
            color: footer.trend >= 0 ? 'brand.green' : 'danger.600',
          })}
        >
          {footer.trend >= 0 ? (
            <RiArrowUpLine size={15} />
          ) : (
            <RiArrowDownLine size={15} />
          )}
          {Math.abs(footer.trend)}%
        </span>
        <span className={css({ color: 'greyscale.500' })}>
          {footer.trendHint}
        </span>
      </div>
    ) : (
      <div
        className={css({
          marginTop: '0.8rem',
          fontSize: '0.78rem',
          color: 'greyscale.500',
        })}
      >
        {footer.hint}
      </div>
    )}
  </div>
)

/**
 * Badge colours, one static class per tone. They used to be picked at render
 * time (css({ backgroundColor: tones.bg })), which Panda cannot see at build
 * time: no rule was generated, and every coloured badge showed as plain text.
 */
const BADGE_TONES = {
  neutral: css({ backgroundColor: 'greyscale.100', color: 'greyscale.700' }),
  success: css({
    backgroundColor: 'console.badge-success-bg',
    color: 'console.badge-success-text',
  }),
  warning: css({
    backgroundColor: 'console.badge-warning-bg',
    color: 'console.badge-warning-text',
  }),
  danger: css({
    backgroundColor: 'console.down-bg',
    color: 'console.down-text',
  }),
  info: css({ backgroundColor: 'primary.100', color: 'primary.800' }),
}

export const Badge = ({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: keyof typeof BADGE_TONES
}) => (
  <span
    className={`${css({
      display: 'inline-block',
      padding: '0.15rem 0.55rem',
      borderRadius: '999px',
      fontSize: '0.75rem',
      fontWeight: 600,
    })} ${BADGE_TONES[tone]}`}
  >
    {children}
  </span>
)

export const Pagination = ({
  page,
  pageSize,
  count,
  onPage,
}: {
  page: number
  pageSize: number
  count: number
  onPage: (p: number) => void
}) => {
  const pages = Math.max(1, Math.ceil(count / pageSize))
  if (count === 0) return null
  return (
    <div
      className={css({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: '1rem',
        fontSize: '0.85rem',
        color: 'greyscale.600',
      })}
    >
      <span>
        {count} résultat{count > 1 ? 's' : ''} · page {page}/{pages}
      </span>
      <div className={css({ display: 'flex', gap: '0.4rem' })}>
        <PagerButton disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Précédent
        </PagerButton>
        <PagerButton disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Suivant
        </PagerButton>
      </div>
    </div>
  )
}

const PagerButton = ({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode
  disabled?: boolean
  onClick: () => void
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={css({
      padding: '0.35rem 0.8rem',
      borderRadius: '7px',
      border: '1px solid',
      borderColor: 'greyscale.300',
      backgroundColor: 'white',
      cursor: 'pointer',
      fontSize: '0.85rem',
      _disabled: { opacity: 0.4, cursor: 'not-allowed' },
      _hover: { backgroundColor: 'greyscale.50' },
    })}
  >
    {children}
  </button>
)

/* Minimal table primitives sharing a consistent look. */
export const Table = ({ children }: { children: ReactNode }) => (
  <div
    className={css({
      overflowX: 'auto',
      border: '1px solid',
      borderColor: 'greyscale.200',
      borderRadius: '12px',
    })}
  >
    <table
      className={css({
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '0.88rem',
      })}
    >
      {children}
    </table>
  </div>
)

export const Th = ({ children }: { children: ReactNode }) => (
  <th
    className={css({
      textAlign: 'left',
      padding: '0.7rem 0.9rem',
      backgroundColor: 'greyscale.50',
      color: 'greyscale.600',
      fontWeight: 600,
      fontSize: '0.78rem',
      textTransform: 'uppercase',
      letterSpacing: '0.03em',
      borderBottom: '1px solid',
      borderColor: 'greyscale.200',
      whiteSpace: 'nowrap',
    })}
  >
    {children}
  </th>
)

export const SortableTh = ({
  children,
  active,
  order,
  onClick,
}: {
  children: ReactNode
  active: boolean
  order: 'asc' | 'desc'
  onClick: () => void
}) => (
  <Th>
    <button
      onClick={onClick}
      className={css({
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.15rem',
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        font: 'inherit',
        textTransform: 'inherit',
        letterSpacing: 'inherit',
        color: active ? 'primary.800' : 'inherit',
        fontWeight: active ? 700 : 'inherit',
      })}
    >
      {children}
      {active ? (
        order === 'asc' ? (
          <RiArrowUpSLine size={15} />
        ) : (
          <RiArrowDownSLine size={15} />
        )
      ) : (
        <span
          className={css({
            width: '15px',
            display: 'inline-block',
            opacity: 0.3,
          })}
        >
          <RiArrowDownSLine size={15} />
        </span>
      )}
    </button>
  </Th>
)

export const Td = ({ children }: { children: ReactNode }) => (
  <td
    className={css({
      padding: '0.65rem 0.9rem',
      borderBottom: '1px solid',
      borderColor: 'greyscale.100',
      color: 'greyscale.800',
      verticalAlign: 'middle',
    })}
  >
    {children}
  </td>
)

/**
 * What a list or a detail shows when its data could not be loaded — instead
 * of an empty table or an endless « Chargement… ». The retry reruns the query.
 */
export const LoadError = ({
  what,
  onRetry,
}: {
  what: string
  onRetry: () => void
}) => (
  <div
    role="alert"
    className={css({
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: '0.5rem 0.9rem',
      padding: '0.8rem 1rem',
      borderRadius: '10px',
      backgroundColor: 'danger.subtle',
      color: 'danger.subtle-text',
      fontSize: '0.9rem',
    })}
  >
    <span>
      Impossible de charger {what}. Vérifiez votre connexion, puis réessayez.
    </span>
    <button
      type="button"
      onClick={onRetry}
      className={css({
        padding: '0.3rem 0.8rem',
        borderRadius: '8px',
        border: '1px solid currentColor',
        background: 'transparent',
        color: 'inherit',
        fontWeight: 600,
        cursor: 'pointer',
      })}
    >
      Réessayer
    </button>
  </div>
)
