import { useQuery } from '@tanstack/react-query'
import { css } from '@/styled-system/css'
import { RiRefreshLine } from '@remixicon/react'
import { fetchAdminStatus } from '../api/adminApi'
import type { ComponentHealth, HealthStatus } from '../api/types'
import { Card } from '@/components/console/ui'

const STATUS_META: Record<HealthStatus, { label: string; dot: string; fg: string; bg: string }> = {
  ok: { label: 'Opérationnel', dot: '#1E9E6A', fg: '#1E7E4F', bg: '#E6F6EF' },
  down: { label: 'Hors service', dot: '#D6453D', fg: '#B42318', bg: '#FDE2E1' },
  disabled: { label: 'Désactivé', dot: '#98A2B3', fg: '#667085', bg: '#F2F4F7' },
  unknown: { label: 'En attente', dot: '#E8870B', fg: '#B25E00', bg: '#FFF1E2' },
}

export const StatusPage = () => {
  const { data, isLoading, isError, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['admin', 'status'],
    queryFn: fetchAdminStatus,
    refetchInterval: 10000, // live polling every 10s
    refetchOnWindowFocus: true,
  })

  const allOk = data?.components.every((c) => c.status === 'ok' || c.status === 'disabled')
  const anyDown = data?.components.some((c) => c.status === 'down')

  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '1.2rem' })}>
      {/* Global banner */}
      {data && (
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
            padding: '0.9rem 1.1rem',
            borderRadius: '12px',
            border: '1px solid',
            borderColor: anyDown ? 'danger.200' : 'greyscale.200',
          })}
          style={{ backgroundColor: anyDown ? '#FDECEA' : allOk ? '#E6F6EF' : '#FFF8EC' }}
        >
          <div className={css({ fontWeight: 700, fontSize: '1rem' })}>
            {anyDown
              ? '⚠️ Un ou plusieurs services sont hors service'
              : allOk
                ? '✓ Tous les services sont opérationnels'
                : 'Services en cours de vérification'}
          </div>
          <div className={css({ display: 'flex', alignItems: 'center', gap: '0.8rem' })}>
            <span className={css({ fontSize: '0.8rem', color: 'greyscale.600' })}>
              Vérifié à {new Date(dataUpdatedAt).toLocaleTimeString('fr-FR')}
            </span>
            <button
              onClick={() => refetch()}
              className={css({
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.4rem 0.7rem',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: 'greyscale.300',
                backgroundColor: 'white',
                cursor: 'pointer',
                fontSize: '0.82rem',
                fontWeight: 600,
              })}
            >
              <RiRefreshLine
                size={15}
                className={isFetching ? css({ animation: 'spin 1s linear infinite' }) : undefined}
              />
              Actualiser
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className={css({ color: 'greyscale.500' })}>Vérification des services…</div>
      ) : isError || !data ? (
        <div className={css({ color: 'danger.600' })}>Impossible de récupérer l’état des services.</div>
      ) : (
        <div
          className={css({
            display: 'grid',
            gridTemplateColumns: { base: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
            gap: '1rem',
          })}
        >
          {data.components.map((c) => (
            <ComponentCard key={c.key} c={c} />
          ))}
        </div>
      )}
    </div>
  )
}

const ComponentCard = ({ c }: { c: ComponentHealth }) => {
  const meta = STATUS_META[c.status]
  return (
    <Card>
      <div className={css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between' })}>
        <span className={css({ fontWeight: 700, fontSize: '0.98rem' })}>{c.label}</span>
        <span
          className={css({
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.2rem 0.55rem',
            borderRadius: '999px',
            fontSize: '0.74rem',
            fontWeight: 700,
          })}
          style={{ backgroundColor: meta.bg, color: meta.fg }}
        >
          <span
            className={css({ width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block' })}
            style={{ backgroundColor: meta.dot }}
          />
          {meta.label}
        </span>
      </div>
      <div className={css({ fontSize: '0.85rem', color: 'greyscale.600', marginTop: '0.6rem', minHeight: '2.2em' })}>
        {c.detail}
      </div>
      {c.latencyMs != null && (
        <div className={css({ fontSize: '0.74rem', color: 'greyscale.400', marginTop: '0.4rem' })}>
          Latence {c.latencyMs} ms
        </div>
      )}
    </Card>
  )
}
