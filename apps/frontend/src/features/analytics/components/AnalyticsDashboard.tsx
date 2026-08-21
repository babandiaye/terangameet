import { useSnapshot } from 'valtio'
import { ModalOverlay, Modal, Dialog } from 'react-aria-components'
import {
  RiLineChartLine,
  RiTimeLine,
  RiGroupLine,
  RiChat3Line,
  RiMicLine,
  RiHand,
  RiPulseLine,
  RiMedalLine,
  RiDownloadLine,
  RiCloseLine,
} from '@remixicon/react'
import { css } from '@/styled-system/css'
import { useRoomData } from '@/features/rooms/livekit/hooks/useRoomData'
import { analyticsStore, type ParticipantStat } from '../store'
import { computeMetrics, formatDuration, formatTime, type DashboardMetrics } from '../metrics'
import { exportDashboardPdf } from '../exportPdf'

const overlayCss = css({
  position: 'fixed',
  inset: 0,
  zIndex: 1200,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  padding: '2.5rem 1rem',
  overflowY: 'auto',
  backgroundColor: 'rgba(2, 6, 23, 0.72)',
  backdropFilter: 'blur(4px)',
})

const dialogCss = css({
  width: 'min(1120px, 100%)',
  color: '#e2e8f0',
  background: 'linear-gradient(180deg, #122244 0%, #0c1730 100%)',
  border: '1px solid rgba(148, 163, 184, 0.18)',
  borderRadius: '22px',
  boxShadow: '0 30px 80px rgba(0,0,0,0.55)',
  padding: '1.75rem',
  outline: 'none',
})

const labelCss = css({
  fontSize: '0.7rem',
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: '#94a3b8',
})

const scoreColors = {
  low: '#f87171',
  medium: '#fbbf24',
  high: '#34d399',
} as const

function StatCard({
  icon,
  tint,
  label,
  value,
  note,
}: {
  icon: React.ReactNode
  tint: string
  label: string
  value: string
  note?: string
}) {
  return (
    <div
      className={css({
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(148,163,184,0.14)',
        borderRadius: '16px',
        padding: '1.1rem 1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
      })}
    >
      <div className={css({ display: 'flex', alignItems: 'center', gap: '0.6rem' })}>
        <span
          className={css({
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '2.1rem',
            height: '2.1rem',
            borderRadius: '10px',
          })}
          style={{ background: `${tint}22`, color: tint }}
        >
          {icon}
        </span>
        <span className={labelCss}>{label}</span>
      </div>
      <div className={css({ fontSize: '1.9rem', fontWeight: 800, color: 'white', lineHeight: 1.1 })}>
        {value}
      </div>
      {note && <div className={css({ fontSize: '0.8rem', color: '#7c8aa5' })}>{note}</div>}
    </div>
  )
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div
      className={css({
        flex: 1,
        height: '0.6rem',
        borderRadius: '999px',
        background: 'rgba(255,255,255,0.08)',
        overflow: 'hidden',
      })}
    >
      <div
        className={css({ height: '100%', borderRadius: '999px', transition: 'width 0.4s' })}
        style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }}
      />
    </div>
  )
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      className={css({
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        margin: '1.75rem 0 0.9rem',
        color: '#94a3b8',
      })}
    >
      <span className={css({ color: '#60a5fa', display: 'inline-flex' })}>{icon}</span>
      <span className={labelCss}>{children}</span>
    </div>
  )
}

function PerformanceBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className={css({
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(148,163,184,0.14)',
        borderRadius: '14px',
        padding: '1rem 1.1rem',
      })}
    >
      <div
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '0.6rem',
          fontSize: '0.9rem',
        })}
      >
        <span className={css({ color: '#cbd5e1' })}>{label}</span>
        <span className={css({ fontWeight: 700 })} style={{ color }}>
          {value}%
        </span>
      </div>
      <Bar pct={value} color={color} />
    </div>
  )
}

export function AnalyticsDashboard() {
  const snap = useSnapshot(analyticsStore)
  const room = useRoomData()
  const metrics: DashboardMetrics = computeMetrics({
    startedAt: snap.startedAt,
    now: snap.now,
    totalMessages: snap.totalMessages,
    totalHandRaises: snap.totalHandRaises,
    participants: snap.participants as unknown as Record<string, ParticipantStat>,
  })

  const roomName = room?.name || room?.slug || 'Réunion'
  const close = () => {
    analyticsStore.isOpen = false
  }
  const speakingTotal = metrics.totalSpeakingMs || 1
  const engagementLabelText =
    metrics.engagementLabel === 'high'
      ? 'Élevé'
      : metrics.engagementLabel === 'medium'
        ? 'Moyen'
        : 'Faible'

  return (
    <ModalOverlay
      isOpen={snap.isOpen}
      onOpenChange={(o) => {
        analyticsStore.isOpen = o
      }}
      isDismissable
      className={overlayCss}
    >
      <Modal className={css({ outline: 'none' })}>
        <Dialog aria-label="Tableau de bord" className={dialogCss}>
          {/* Header */}
          <div
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '0.9rem',
              marginBottom: '1.5rem',
            })}
          >
            <span
              className={css({
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '2.8rem',
                height: '2.8rem',
                borderRadius: '14px',
                background: 'rgba(59,130,246,0.18)',
                color: '#60a5fa',
              })}
            >
              <RiLineChartLine size={24} />
            </span>
            <div className={css({ flex: 1 })}>
              <div className={css({ fontSize: '1.3rem', fontWeight: 800, color: 'white' })}>
                Tableau de bord
              </div>
              <div className={css({ fontSize: '0.85rem', color: '#7c8aa5' })}>
                Analytique en temps réel · {roomName}
              </div>
            </div>
            <button
              onClick={() => exportDashboardPdf(metrics, roomName)}
              className={css({
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                background: 'rgba(59,130,246,0.9)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                padding: '0.6rem 1rem',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
                _hover: { background: '#3b82f6' },
              })}
            >
              <RiDownloadLine size={18} /> Exporter PDF
            </button>
            <button
              onClick={close}
              aria-label="Fermer"
              className={css({
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '2.5rem',
                height: '2.5rem',
                borderRadius: '12px',
                background: 'rgba(255,255,255,0.06)',
                color: '#cbd5e1',
                border: 'none',
                cursor: 'pointer',
                _hover: { background: 'rgba(255,255,255,0.12)' },
              })}
            >
              <RiCloseLine size={20} />
            </button>
          </div>

          {/* Stat cards */}
          <div
            className={css({
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
              gap: '1rem',
            })}
          >
            <StatCard
              icon={<RiTimeLine size={18} />}
              tint="#60a5fa"
              label="Durée"
              value={formatDuration(metrics.durationMs)}
              note={snap.startedAt ? `Début ${formatTime(snap.startedAt)}` : undefined}
            />
            <StatCard
              icon={<RiGroupLine size={18} />}
              tint="#38bdf8"
              label="Participants"
              value={String(metrics.participantsTotal)}
              note={`${metrics.participantsOnline} actifs`}
            />
            <StatCard
              icon={<RiChat3Line size={18} />}
              tint="#34d399"
              label="Messages"
              value={String(metrics.totalMessages)}
              note="dans le chat"
            />
            <StatCard
              icon={<RiMicLine size={18} />}
              tint="#a78bfa"
              label="Tps parole"
              value={formatDuration(metrics.totalSpeakingMs)}
              note="total cumulé"
            />
            <StatCard
              icon={<RiHand size={18} />}
              tint="#fb923c"
              label="Mains levées"
              value={String(metrics.totalHandRaises)}
              note="total réunion"
            />
            <StatCard
              icon={<RiPulseLine size={18} />}
              tint={scoreColors[metrics.engagementLabel]}
              label="Engagement"
              value={`${metrics.engagementScore}/100`}
              note={engagementLabelText}
            />
          </div>

          {/* Speaking time per participant */}
          <SectionTitle icon={<RiMicLine size={16} />}>
            Temps de parole par participant
          </SectionTitle>
          <div className={css({ display: 'flex', flexDirection: 'column', gap: '0.75rem' })}>
            {metrics.participants.length === 0 && (
              <div className={css({ color: '#7c8aa5', fontSize: '0.9rem' })}>
                Aucune donnée pour l'instant.
              </div>
            )}
            {metrics.participants.map((p, i) => {
              const share = Math.round((p.speakingMs / speakingTotal) * 100)
              return (
                <div
                  key={p.identity}
                  className={css({ display: 'flex', alignItems: 'center', gap: '0.75rem' })}
                >
                  {i === 0 && p.speakingMs > 0 ? (
                    <RiMedalLine size={18} className={css({ color: '#f59e0b' })} />
                  ) : (
                    <span className={css({ width: '18px' })} />
                  )}
                  <span
                    className={css({
                      width: '8.5rem',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      fontSize: '0.9rem',
                      color: '#e2e8f0',
                    })}
                  >
                    {p.name}
                    {p.isLocal ? ' (vous)' : ''}
                  </span>
                  <Bar pct={share} color="#3b82f6" />
                  <span
                    className={css({ width: '3rem', textAlign: 'right', fontSize: '0.85rem' })}
                  >
                    {formatDuration(p.speakingMs)}
                  </span>
                  <span
                    className={css({
                      width: '3rem',
                      textAlign: 'right',
                      fontSize: '0.85rem',
                      color: '#60a5fa',
                      fontWeight: 700,
                    })}
                  >
                    {share}%
                  </span>
                </div>
              )
            })}
          </div>

          {/* Presence history */}
          <SectionTitle icon={<RiTimeLine size={16} />}>
            Historique de présence (connexions / déconnexions)
          </SectionTitle>
          <div className={css({ display: 'flex', flexDirection: 'column', gap: '0.6rem' })}>
            {metrics.participants.map((p) => {
              const online = p.online
              const lastSession = p.sessions[p.sessions.length - 1]
              const totalMs = p.sessions.reduce(
                (a, s) => a + ((s.leave ?? snap.now) - s.join),
                0
              )
              return (
                <div
                  key={p.identity}
                  className={css({
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(148,163,184,0.14)',
                    borderRadius: '14px',
                    padding: '0.85rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                  })}
                >
                  <span className={css({ fontWeight: 700, color: 'white' })}>{p.name}</span>
                  <span className={css({ fontSize: '0.8rem', color: '#7c8aa5' })}>
                    {p.sessions
                      .map(
                        (s) =>
                          `${formatTime(s.join)} → ${s.leave ? formatTime(s.leave) : 'en cours'}`
                      )
                      .join(' · ')}
                  </span>
                  <span className={css({ flex: 1 })} />
                  <span
                    className={css({
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      padding: '0.2rem 0.6rem',
                      borderRadius: '999px',
                    })}
                    style={{
                      color: online ? '#34d399' : '#94a3b8',
                      background: online ? 'rgba(52,211,153,0.14)' : 'rgba(148,163,184,0.14)',
                    }}
                  >
                    {online ? '● En ligne' : '○ Parti'}
                  </span>
                  <span className={css({ fontSize: '0.8rem', color: '#cbd5e1' })}>
                    {formatDuration(totalMs)}
                  </span>
                  {lastSession ? null : null}
                </div>
              )
            })}
          </div>

          {/* Meeting performance */}
          <SectionTitle icon={<RiPulseLine size={16} />}>Performance de la réunion</SectionTitle>
          <div
            className={css({
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '0.9rem',
            })}
          >
            <PerformanceBar
              label="Participation vocale"
              value={metrics.participationVocale}
              color="#3b82f6"
            />
            <PerformanceBar
              label="Répartition équitable"
              value={metrics.repartitionEquitable}
              color="#34d399"
            />
            <PerformanceBar
              label="Interactivité chat"
              value={metrics.chatInteractivite}
              color="#22d3ee"
            />
            <PerformanceBar
              label="Score global"
              value={metrics.scoreGlobal}
              color={scoreColors[metrics.engagementLabel]}
            />
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  )
}
