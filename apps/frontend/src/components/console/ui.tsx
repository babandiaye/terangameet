import { ReactNode } from 'react'
import { css } from '@/styled-system/css'
import { RiArrowUpSLine, RiArrowDownSLine } from '@remixicon/react'

export const Card = ({ children, className }: { children: ReactNode; className?: string }) => (
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

export const StatCard = ({
  label,
  value,
  hint,
}: {
  label: string
  value: ReactNode
  hint?: string
}) => (
  <Card>
    <div className={css({ fontSize: '0.8rem', color: 'greyscale.600', fontWeight: 500 })}>
      {label}
    </div>
    <div
      className={css({
        fontSize: '1.9rem',
        fontWeight: 700,
        color: 'primary.800',
        lineHeight: 1.1,
        marginTop: '0.3rem',
      })}
    >
      {value}
    </div>
    {hint && (
      <div className={css({ fontSize: '0.75rem', color: 'greyscale.500', marginTop: '0.25rem' })}>
        {hint}
      </div>
    )}
  </Card>
)

export const Badge = ({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'
}) => {
  const tones = {
    neutral: { bg: 'greyscale.100', fg: 'greyscale.700' },
    success: { bg: '#E6F4EA', fg: '#1E7E34' },
    warning: { bg: '#FFF3CD', fg: '#8A6D00' },
    danger: { bg: '#FDE2E1', fg: '#B42318' },
    info: { bg: 'primary.100', fg: 'primary.800' },
  }[tone]
  return (
    <span
      className={css({
        display: 'inline-block',
        padding: '0.15rem 0.55rem',
        borderRadius: '999px',
        fontSize: '0.75rem',
        fontWeight: 600,
        backgroundColor: tones.bg,
        color: tones.fg,
      })}
    >
      {children}
    </span>
  )
}

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
  <div className={css({ overflowX: 'auto', border: '1px solid', borderColor: 'greyscale.200', borderRadius: '12px' })}>
    <table className={css({ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' })}>
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
        <span className={css({ width: '15px', display: 'inline-block', opacity: 0.3 })}>
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
