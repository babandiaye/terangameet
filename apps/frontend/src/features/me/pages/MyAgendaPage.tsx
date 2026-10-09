import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { css } from '@/styled-system/css'
import { RiAddLine, RiTeamLine } from '@remixicon/react'
import { Button, Dialog } from '@/primitives'
import { Badge } from '@/components/console/ui'
import { cancelScheduledMeeting, fetchSchedule } from '../api/meApi'
import type { ScheduledMeeting } from '../api/types'
import { ScheduleMeetingDialog } from '../components/ScheduleMeetingDialog'
import { errorMessage } from '../components/roomAccessLevels'

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

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })

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

const MeetingRow = ({
  meeting: m,
  onEdit,
  onCancel,
  now,
}: {
  meeting: ScheduledMeeting
  onEdit: () => void
  onCancel: () => void
  now: number
}) => {
  const isLive =
    new Date(m.starts_at).getTime() - 10 * 60 * 1000 <= now &&
    now <= new Date(m.ends_at).getTime()
  const accepted = m.attendees.length

  return (
    <li
      className={css({
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '0.5rem 1rem',
        padding: '0.85rem 1rem',
        border: '1px solid',
        borderColor: isLive ? 'primary.800' : 'greyscale.200',
        borderRadius: '12px',
        backgroundColor: 'white',
      })}
    >
      <div
        className={css({
          minWidth: '6.5rem',
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
        })}
      >
        {time(m.starts_at)} – {time(m.ends_at)}
      </div>
      <div className={css({ flex: '1 1 14rem', minWidth: 0 })}>
        <div className={css({ fontWeight: 700, overflowWrap: 'anywhere' })}>
          {m.title}
          {isLive && (
            <span className={css({ marginLeft: '0.45rem' })}>
              <Badge tone="success">Maintenant</Badge>
            </span>
          )}
        </div>
        <div
          className={css({
            color: 'greyscale.600',
            fontSize: '0.82rem',
            overflowWrap: 'anywhere',
          })}
        >
          {m.is_organizer
            ? 'Vous organisez'
            : `Organisé par ${m.organizer.full_name || m.organizer.email}`}
          {' · '}
          <RiTeamLine
            size={13}
            aria-hidden="true"
            style={{ display: 'inline', verticalAlign: '-2px' }}
          />{' '}
          {accepted} invité(s) · {m.room.url.replace(/^https?:\/\//, '')}
        </div>
      </div>
      <div
        className={css({ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' })}
      >
        <a
          href={m.room.url}
          target="_blank"
          rel="noopener noreferrer"
          className={css({
            display: 'inline-flex',
            alignItems: 'center',
            padding: '0.4rem 0.85rem',
            borderRadius: '10px',
            backgroundColor: 'primary.800',
            color: 'white',
            fontWeight: 600,
            fontSize: '0.875rem',
            textDecoration: 'none',
            _hover: { backgroundColor: 'primary.action' },
          })}
        >
          Rejoindre
        </a>
        {m.is_organizer && (
          <>
            <Button size="sm" variant="secondary" onPress={onEdit}>
              Modifier
            </Button>
            <Button size="sm" variant="tertiaryText" onPress={onCancel}>
              Annuler
            </Button>
          </>
        )}
      </div>
    </li>
  )
}

const CancelDialog = ({
  meeting,
  onClose,
}: {
  meeting: ScheduledMeeting | null
  onClose: () => void
}) => {
  const queryClient = useQueryClient()
  const cancel = useMutation({
    mutationFn: (id: string) => cancelScheduledMeeting(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me', 'schedule'] })
      onClose()
    },
  })

  return (
    <Dialog
      isOpen={!!meeting}
      onOpenChange={(open) => {
        if (!open) {
          cancel.reset()
          onClose()
        }
      }}
      role="alertdialog"
      title="Annuler cette réunion ?"
    >
      {meeting && (
        <div>
          <p className={css({ marginBottom: '1rem' })}>
            <strong>{meeting.title}</strong> — les {meeting.attendees.length}{' '}
            invité(s) recevront une annulation, et la réunion disparaîtra de
            leur agenda. La salle et son lien sont conservés.
          </p>
          {cancel.isError && (
            <p
              role="alert"
              className={css({ color: 'danger.600', marginBottom: '0.75rem' })}
            >
              {errorMessage(
                cancel.error,
                'La réunion n’a pas pu être annulée.'
              )}
            </p>
          )}
          <div
            className={css({
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem',
            })}
          >
            <Button
              variant="primary"
              onPress={() => cancel.mutate(meeting.id)}
              isDisabled={cancel.isPending}
            >
              {cancel.isPending ? 'Annulation…' : 'Annuler la réunion'}
            </Button>
            <Button variant="secondary" onPress={onClose}>
              Garder
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  )
}
