import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Label } from 'react-aria-components'
import { css } from '@/styled-system/css'
import { RiCloseLine } from '@remixicon/react'
import { Button, Dialog, Field, TextArea } from '@/primitives'
import { RoomLink } from '@/components/console/RoomLink'
import {
  createScheduledMeeting,
  fetchMyRooms,
  searchGuests,
  updateScheduledMeeting,
} from '../api/meApi'
import type { MailReport, ScheduledMeeting } from '../api/types'
import { InviteePicker } from './InviteePicker'
import { errorMessage } from './roomAccessLevels'

const pad = (n: number) => String(n).padStart(2, '0')
const toDateInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const toTimeInput = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

/** Next half hour from now, as Google Agenda proposes. */
const nextSlot = () => {
  const d = new Date()
  d.setSeconds(0, 0)
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60)
  return d
}

const nativeInput = css({
  width: 'full',
  marginTop: '0.25rem',
  paddingY: '0.45rem',
  paddingX: '0.6rem',
  border: '1px solid',
  borderColor: 'control.border',
  borderRadius: '10px',
  backgroundColor: 'white',
  fontSize: '0.95rem',
})
const fieldLabel = css({ display: 'block', fontSize: '0.875rem' })
const note = css({ color: 'greyscale.600', fontSize: '0.85rem' })

/**
 * Plan a meeting — or change one — Google Agenda style: title, date and
 * times, description, room, guests. Saving emails each guest a calendar
 * invitation (or its update), which their calendar adds with the link.
 */
export const ScheduleMeetingDialog = ({
  isOpen,
  meeting,
  onClose,
}: {
  isOpen: boolean
  /** The meeting to edit; absent to plan a new one. */
  meeting?: ScheduledMeeting | null
  onClose: () => void
}) => (
  <Dialog
    isOpen={isOpen}
    onOpenChange={(open) => !open && onClose()}
    type="flex"
    title={meeting ? 'Modifier la réunion' : 'Planifier une réunion'}
  >
    <div
      className={css({
        width: 'min(40rem, calc(100vw - 5rem))',
        maxHeight: 'calc(100dvh - 11rem)',
        overflowY: 'auto',
        overflowX: 'hidden',
        paddingRight: '0.25rem',
      })}
    >
      {/* Keyed so reopening starts from fresh values. */}
      {isOpen && (
        <ScheduleForm
          key={meeting?.id ?? 'new'}
          meeting={meeting}
          onClose={onClose}
        />
      )}
    </div>
  </Dialog>
)

const ScheduleForm = ({
  meeting,
  onClose,
}: {
  meeting?: ScheduledMeeting | null
  onClose: () => void
}) => {
  const queryClient = useQueryClient()
  const initialStart = meeting ? new Date(meeting.starts_at) : nextSlot()
  const initialEnd = meeting
    ? new Date(meeting.ends_at)
    : new Date(initialStart.getTime() + 60 * 60 * 1000)

  const [title, setTitle] = useState(meeting?.title ?? '')
  const [date, setDate] = useState(toDateInput(initialStart))
  const [startTime, setStartTime] = useState(toTimeInput(initialStart))
  const [endTime, setEndTime] = useState(toTimeInput(initialEnd))
  const [description, setDescription] = useState(meeting?.description ?? '')
  const [roomId, setRoomId] = useState<string>('new')
  const [guests, setGuests] = useState<string[]>(
    meeting?.attendees.map((a) => a.email) ?? []
  )
  const [report, setReport] = useState<MailReport | null>(null)

  const { data: rooms } = useQuery({
    queryKey: ['me', 'rooms', 'all'],
    queryFn: () => fetchMyRooms({ page: 1, pageSize: 100 }),
    enabled: !meeting,
  })

  // Moving the start keeps the duration, as calendars do.
  const durationMs = useMemo(
    () => initialEnd.getTime() - initialStart.getTime(),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the initial duration only
    []
  )
  const onStartChange = (value: string) => {
    setStartTime(value)
    const start = new Date(`${date}T${value}`)
    if (!Number.isNaN(start.getTime())) {
      const end = new Date(start.getTime() + durationMs)
      if (toDateInput(end) === date) setEndTime(toTimeInput(end))
    }
  }

  const start = new Date(`${date}T${startTime}`)
  const end = new Date(`${date}T${endTime}`)
  const slotError =
    Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())
      ? 'Indiquez une date et des heures valides.'
      : end <= start
        ? 'L’heure de fin doit suivre l’heure de début.'
        : null

  const save = useMutation({
    mutationFn: () => {
      const body = {
        title: title.trim(),
        description: description.trim(),
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        attendees: guests,
      }
      return meeting
        ? updateScheduledMeeting(meeting.id, body)
        : createScheduledMeeting({
            ...body,
            ...(roomId !== 'new' ? { room_id: roomId } : {}),
          })
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['me', 'schedule'] })
      queryClient.invalidateQueries({ queryKey: ['me', 'rooms'] })
      if (result.mail.failed.length) setReport(result.mail)
      else onClose()
    },
  })

  if (report) {
    return (
      <div>
        <p className={css({ marginBottom: '0.75rem' })}>
          Réunion enregistrée. {report.sent} invitation(s) envoyée(s), mais
          l’envoi a échoué pour :
        </p>
        <ul
          className={css({
            paddingLeft: '1.2rem',
            listStyle: 'disc',
            marginBottom: '1rem',
          })}
        >
          {report.failed.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
        <Button variant="primary" onPress={onClose}>
          Fermer
        </Button>
      </div>
    )
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!slotError && title.trim()) save.mutate()
      }}
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        marginTop: '0.5rem',
      })}
    >
      {/* eslint-disable jsx-a11y/no-autofocus -- the title is the first thing asked */}
      <Field
        type="text"
        label="Titre"
        value={title}
        onChange={setTitle}
        isRequired
        autoFocus={!meeting}
        maxLength={120}
        wrapperProps={{ noMargin: true, fullWidth: true }}
      />

      <div
        className={css({
          display: 'grid',
          gridTemplateColumns: { base: '1fr', sm: '1.4fr 1fr 1fr' },
          gap: '0.75rem',
        })}
      >
        <div>
          <label className={fieldLabel} htmlFor="schedule-date">
            Date
          </label>
          <input
            id="schedule-date"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={nativeInput}
          />
        </div>
        <div>
          <label className={fieldLabel} htmlFor="schedule-start">
            Début
          </label>
          <input
            id="schedule-start"
            type="time"
            required
            step={300}
            value={startTime}
            onChange={(e) => onStartChange(e.target.value)}
            className={nativeInput}
          />
        </div>
        <div>
          <label className={fieldLabel} htmlFor="schedule-end">
            Fin
          </label>
          <input
            id="schedule-end"
            type="time"
            required
            step={300}
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className={nativeInput}
          />
        </div>
      </div>
      {slotError && (
        <p
          role="alert"
          className={css({
            color: 'danger.600',
            fontSize: '0.85rem',
            marginTop: '-0.5rem',
          })}
        >
          {slotError}
        </p>
      )}

      <div>
        <Label className={fieldLabel} htmlFor="schedule-description">
          Description (facultatif)
        </Label>
        <TextArea
          id="schedule-description"
          rows={3}
          maxLength={5000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ordre du jour, documents à préparer…"
          className={css({ marginTop: '0.25rem' })}
        />
      </div>

      <div>
        {meeting ? (
          <>
            <span className={fieldLabel}>Salle</span>
            <RoomLink slug={meeting.room.slug} />
          </>
        ) : (
          <>
            <label className={fieldLabel} htmlFor="schedule-room">
              Salle
            </label>
            <select
              id="schedule-room"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className={nativeInput}
            >
              <option value="new">
                Nouvelle salle (lien généré automatiquement)
              </option>
              {rooms?.results.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name === r.slug ? r.slug : `${r.name} — ${r.slug}`}
                </option>
              ))}
            </select>
            <p className={note}>
              Une salle existante garde son lien : pratique pour une réunion qui
              revient.
            </p>
          </>
        )}
      </div>

      <div>
        <InviteePicker
          id="schedule-guests"
          label="Invités"
          search={searchGuests}
          exclude={guests}
          onPick={(email) =>
            setGuests((g) => (g.includes(email) ? g : [...g, email]))
          }
        />
        {guests.length > 0 && (
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
            {guests.map((email) => (
              <li
                key={email}
                className={css({
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.2rem 0.3rem 0.2rem 0.65rem',
                  borderRadius: '999px',
                  backgroundColor: 'primary.100',
                  color: 'primary.800',
                  fontSize: '0.85rem',
                  maxWidth: '100%',
                })}
              >
                <span className={css({ overflowWrap: 'anywhere' })}>
                  {meeting?.attendees.find((a) => a.email === email)
                    ?.full_name || email}
                </span>
                <button
                  type="button"
                  aria-label={`Retirer ${email}`}
                  onClick={() => setGuests((g) => g.filter((x) => x !== email))}
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
            ))}
          </ul>
        )}
      </div>

      {save.isError && (
        <p
          role="alert"
          className={css({ color: 'danger.600', fontSize: '0.9rem' })}
        >
          {errorMessage(save.error, 'La réunion n’a pas pu être enregistrée.')}
        </p>
      )}

      <div
        className={css({ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' })}
      >
        <Button
          type="submit"
          variant="primary"
          isDisabled={save.isPending || !!slotError || !title.trim()}
        >
          {save.isPending
            ? 'Envoi des invitations…'
            : meeting
              ? 'Enregistrer et prévenir les invités'
              : guests.length
                ? 'Planifier et inviter'
                : 'Planifier'}
        </Button>
        <Button variant="secondary" onPress={onClose}>
          Annuler
        </Button>
      </div>
      <p className={note}>
        Chaque invité reçoit une invitation d’agenda par email ; vous la recevez
        aussi, pour avoir la réunion dans votre propre agenda.
      </p>
    </form>
  )
}
