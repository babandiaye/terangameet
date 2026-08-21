import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { css } from '@/styled-system/css'
import { RiDeleteBin6Line } from '@remixicon/react'
import { useConfig } from '@/api/useConfig'
import { Card } from '@/components/console/ui'
import { fetchPurgeConfig, setPurgePeriod, runPurge } from '../api/adminApi'

const Row = ({ label, value }: { label: string; value: string }) => (
  <div
    className={css({
      display: 'flex',
      justifyContent: 'space-between',
      padding: '0.6rem 0',
      borderBottom: '1px solid',
      borderColor: 'greyscale.100',
      fontSize: '0.9rem',
    })}
  >
    <span className={css({ color: 'greyscale.600' })}>{label}</span>
    <span className={css({ fontWeight: 600 })}>{value}</span>
  </div>
)

const PERIOD_LABELS: Record<string, string> = {
  '1m': '1 mois',
  '3m': '3 mois',
  '6m': '6 mois',
  '1y': '1 an',
}

export const SettingsPage = () => {
  const { data: config } = useConfig()

  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '1.2rem', maxWidth: '700px' })}>
      <Card>
        <h3 className={css({ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.5rem' })}>
          Configuration de la plateforme
        </h3>
        <Row label="Enregistrement des réunions" value={config?.recording?.is_enabled ? 'Activé' : 'Désactivé'} />
        <Row
          label="Modes d’enregistrement"
          value={config?.recording?.available_modes?.join(', ') || '—'}
        />
        <Row label="Sous-titres en direct" value={config?.subtitle?.enabled ? 'Activé' : 'Désactivé'} />
      </Card>

      {/* Hidden entirely when PURGE_RECORDINGS_ENABLED=false. */}
      <PurgeSection />

      <Card>
        <h3 className={css({ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.5rem' })}>
          Gestion des administrateurs
        </h3>
        <p className={css({ fontSize: '0.9rem', color: 'greyscale.700', lineHeight: 1.6 })}>
          Les administrateurs initiaux sont définis côté serveur (variable <code>ADMIN_EMAILS</code>). Tout
          administrateur peut ensuite promouvoir ou rétrograder d’autres comptes depuis l’onglet{' '}
          <strong>Utilisateurs</strong>. Un administrateur ne peut pas se retirer lui-même ses propres droits.
        </p>
      </Card>
    </div>
  )
}

const PurgeSection = () => {
  const qc = useQueryClient()
  const [confirming, setConfirming] = useState(false)

  const { data } = useQuery({ queryKey: ['admin', 'purge'], queryFn: fetchPurgeConfig })

  const periodMutation = useMutation({
    mutationFn: (period: string) => setPurgePeriod(period),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'purge'] }),
  })
  const runMutation = useMutation({
    mutationFn: runPurge,
    onSuccess: () => {
      setConfirming(false)
      qc.invalidateQueries({ queryKey: ['admin', 'purge'] })
      qc.invalidateQueries({ queryKey: ['admin', 'recordings'] })
      qc.invalidateQueries({ queryKey: ['admin', 'dashboard'] })
    },
  })

  // Feature disabled (PURGE_RECORDINGS_ENABLED=false) → render nothing.
  if (!data || !data.enabled) return null

  const periods = data.periods ?? ['1m', '3m', '6m', '1y']
  const eligible = data.eligible_count ?? 0

  return (
    <Card>
      <h3 className={css({ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.4rem' })}>
        Purge des enregistrements
      </h3>
      <p className={css({ fontSize: '0.9rem', color: 'greyscale.700', lineHeight: 1.6, marginBottom: '0.9rem' })}>
        Les enregistrements plus anciens que la période choisie sont supprimés automatiquement (fichier +
        base). La purge s’exécute chaque jour ; vous pouvez aussi la déclencher manuellement.
      </p>

      <div className={css({ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.8rem' })}>
        <label className={css({ fontSize: '0.9rem', color: 'greyscale.700' })}>Conserver pendant</label>
        <select
          value={data.period}
          disabled={periodMutation.isPending}
          onChange={(e) => periodMutation.mutate(e.target.value)}
          className={css({
            padding: '0.45rem 0.7rem',
            border: '1px solid',
            borderColor: 'greyscale.300',
            borderRadius: '8px',
            fontSize: '0.9rem',
            backgroundColor: 'white',
            cursor: 'pointer',
          })}
        >
          {periods.map((p) => (
            <option key={p} value={p}>
              {PERIOD_LABELS[p] ?? p}
            </option>
          ))}
        </select>
        {periodMutation.isPending && (
          <span className={css({ fontSize: '0.8rem', color: 'greyscale.500' })}>Enregistrement…</span>
        )}
      </div>

      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.8rem',
          flexWrap: 'wrap',
          padding: '0.7rem 0.9rem',
          borderRadius: '10px',
          backgroundColor: 'greyscale.50',
        })}
      >
        <span className={css({ fontSize: '0.9rem' })}>
          <strong>{eligible}</strong> enregistrement{eligible > 1 ? 's' : ''} éligible{eligible > 1 ? 's' : ''} à la
          purge.
        </span>
        {confirming ? (
          <div className={css({ display: 'flex', gap: '0.4rem' })}>
            <button
              onClick={() => runMutation.mutate()}
              disabled={runMutation.isPending}
              className={css({
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.45rem 0.8rem',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'danger.600',
                color: 'white',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                _disabled: { opacity: 0.5 },
              })}
            >
              <RiDeleteBin6Line size={15} />
              {runMutation.isPending ? 'Purge…' : `Confirmer la suppression`}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={runMutation.isPending}
              className={css({
                padding: '0.45rem 0.8rem',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: 'greyscale.300',
                backgroundColor: 'white',
                fontSize: '0.85rem',
                cursor: 'pointer',
              })}
            >
              Annuler
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            disabled={eligible === 0}
            className={css({
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.45rem 0.8rem',
              borderRadius: '8px',
              border: '1px solid',
              borderColor: 'danger.300',
              backgroundColor: 'white',
              color: 'danger.700',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              _disabled: { opacity: 0.4, cursor: 'not-allowed' },
            })}
          >
            <RiDeleteBin6Line size={15} />
            Purger maintenant
          </button>
        )}
      </div>

      {runMutation.data && (
        <p className={css({ fontSize: '0.82rem', color: 'greyscale.600', marginTop: '0.6rem' })}>
          {runMutation.data.deleted} enregistrement(s) supprimé(s).
        </p>
      )}
    </Card>
  )
}
