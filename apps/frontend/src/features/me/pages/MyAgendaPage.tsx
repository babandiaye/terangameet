import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { css } from '@/styled-system/css'
import { RiAddLine } from '@remixicon/react'
import { Button } from '@/primitives'
import { fetchSchedule } from '../api/meApi'
import type { ScheduledMeeting } from '../api/types'
import { ScheduleMeetingDialog } from '../components/ScheduleMeetingDialog'
import { MeetingRow } from '../components/agenda/MeetingRow'
import { CancelDialog } from '../components/agenda/CancelDialog'
import { GoogleCalendarCard } from '../components/agenda/GoogleCalendarCard'

const dayLabel = (iso: string) => {
  const d = new Date(iso)
  const today = new Date()
  const tomorrow = new Date()
  tomorrow.setDate(today.getDate() + 1)
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  const full = d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  if (same(d, today)) return `Aujourd’hui · ${full}`
  if (same(d, tomorrow)) return `Demain · ${full}`
  return full.charAt(0).toUpperCase() + full.slice(1)
}

/**
 * "Agenda" — upcoming meetings I organise or am invited to, by day, like the
 * Schedule view of Google Agenda. Planning one emails calendar invitations.
 */
export const MyAgendaPage = () => {
  const [editing, setEditing] = useState<ScheduledMeeting | null>(null)
  const [isPlanning, setIsPlanning] = useState(false)
  const [cancelling, setCancelling] = useState<ScheduledMeeting | null>(null)
  // "Maintenant" badges follow the clock without a reload.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['me', 'schedule'],
    queryFn: fetchSchedule,
    refetchInterval: 60_000,
  })

  const days = useMemo(() => {
    const groups = new Map<string, ScheduledMeeting[]>()
    for (const m of data?.results ?? []) {
      const key = new Date(m.starts_at).toDateString()
      groups.set(key, [...(groups.get(key) ?? []), m])
    }
    return [...groups.values()]
  }, [data])

  return (
    <div
      className={css({ display: 'flex', flexDirection: 'column', gap: '1rem' })}
    >
      <div
        className={css({
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          marginTop: '-0.5rem',
        })}
      >
        <p
          className={css({
            color: 'greyscale.600',
            fontSize: '0.9rem',
            maxWidth: '36rem',
          })}
        >
          Vos prochaines réunions, organisées ou auxquelles vous êtes invité.
          Les invités reçoivent une invitation qui s’ajoute à leur Google
          Agenda.
        </p>
        <Button variant="primary" size="sm" onPress={() => setIsPlanning(true)}>
          <RiAddLine size={18} aria-hidden="true" />
          Planifier une réunion
        </Button>
      </div>

      <GoogleCalendarCard />

      {isLoading ? (
        <div className={css({ color: 'greyscale.500' })}>Chargement…</div>
      ) : isError ? (
        <div role="alert" className={css({ color: 'danger.600' })}>
          Impossible de charger l’agenda. Rechargez la page.
        </div>
      ) : days.length === 0 ? (
        <div className={css({ color: 'greyscale.600' })}>
          Aucune réunion à venir.
        </div>
      ) : (
        days.map((meetings) => (
          <section key={meetings[0].starts_at}>
            <h3
              className={css({
                fontSize: '0.95rem',
                fontWeight: 700,
                marginBottom: '0.5rem',
                color: 'greyscale.1000',
              })}
            >
              {dayLabel(meetings[0].starts_at)}
            </h3>
            <ul
              className={css({
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'grid',
                gap: '0.5rem',
              })}
            >
              {meetings.map((m) => (
                <MeetingRow
                  key={m.id}
                  meeting={m}
                  onEdit={() => setEditing(m)}
                  onCancel={() => setCancelling(m)}
                  now={now}
                />
              ))}
            </ul>
          </section>
        ))
      )}

      <ScheduleMeetingDialog
        isOpen={isPlanning}
        onClose={() => setIsPlanning(false)}
      />
      <ScheduleMeetingDialog
        isOpen={!!editing}
        meeting={editing}
        onClose={() => setEditing(null)}
      />
      <CancelDialog meeting={cancelling} onClose={() => setCancelling(null)} />
    </div>
  )
}
