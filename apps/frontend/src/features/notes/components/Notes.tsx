import { useEffect, useRef, useState } from 'react'
import { css } from '@/styled-system/css'
import { RiDownloadLine } from '@remixicon/react'
import { Button } from '@/primitives'
import { useRoomData } from '@/features/rooms/livekit/hooks/useRoomData'
import { useUser } from '@/features/auth/api/useUser'
import { fetchNotes, saveNotes } from '../api/notesApi'

const LS_PREFIX = 'tm-notes:'
type Status = 'idle' | 'saving' | 'saved'

/**
 * Private per-participant notes panel. Persisted server-side for authenticated
 * users, with a localStorage fallback for guests. Auto-saves (debounced).
 */
export const Notes = () => {
  const room = useRoomData()
  const roomId = room?.id
  const { isLoggedIn } = useUser()
  const [content, setContent] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const loadedRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load existing notes once we know the room and auth state.
  useEffect(() => {
    if (!roomId || isLoggedIn === undefined || loadedRef.current) return
    loadedRef.current = true
    const local = localStorage.getItem(LS_PREFIX + roomId)
    if (isLoggedIn) {
      fetchNotes(roomId)
        .then((r) => setContent(r.content ?? local ?? ''))
        .catch(() => local && setContent(local))
    } else if (local) {
      setContent(local)
    }
  }, [roomId, isLoggedIn])

  const persist = (value: string) => {
    if (!roomId) return
    if (isLoggedIn) {
      saveNotes(roomId, value)
        .then(() => setStatus('saved'))
        .catch(() => {
          localStorage.setItem(LS_PREFIX + roomId, value)
          setStatus('saved')
        })
    } else {
      localStorage.setItem(LS_PREFIX + roomId, value)
      setStatus('saved')
    }
  }

  const onChange = (value: string) => {
    setContent(value)
    setStatus('saving')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => persist(value), 800)
  }

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    []
  )

  // Export the current notes as a plain-text (.txt) file.
  const download = () => {
    const slug =
      (room?.slug || room?.name || roomId || 'notes')
        .toString()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-zA-Z0-9-_]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase() || 'notes'
    const stamp = new Date().toISOString().slice(0, 10)
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `notes-${slug}-${stamp}.txt`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const statusText =
    status === 'saving'
      ? 'Enregistrement…'
      : status === 'saved'
        ? isLoggedIn
          ? 'Enregistré'
          : 'Enregistré sur cet appareil'
        : isLoggedIn
          ? 'Notes privées'
          : 'Notes privées · stockées sur cet appareil'

  return (
    <div
      className={css({
        display: 'flex',
        flexDirection: 'column',
        flexGrow: 1,
        padding: '0 1rem 1rem',
        gap: '0.5rem',
        minHeight: 0,
      })}
    >
      <div
        className={css({
          display: 'flex',
          justifyContent: 'flex-end',
        })}
      >
        <Button
          variant="tertiaryText"
          size="sm"
          onPress={download}
          isDisabled={content.trim().length === 0}
          aria-label="Télécharger les notes au format texte (.txt)"
        >
          <RiDownloadLine size={18} aria-hidden="true" />
          Télécharger (.txt)
        </Button>
      </div>
      <textarea
        value={content}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Prenez vos notes pendant la réunion…"
        className={css({
          flexGrow: 1,
          width: '100%',
          resize: 'none',
          border: '1px solid',
          borderColor: 'box.border',
          borderRadius: '8px',
          padding: '0.75rem',
          fontSize: '0.95rem',
          lineHeight: 1.5,
          backgroundColor: 'box.bg',
          color: 'box.text',
          outline: 'none',
          _focus: { borderColor: 'primary' },
        })}
      />
      <div className={css({ fontSize: '0.75rem', color: 'greyscale.500', textAlign: 'right' })}>
        {statusText}
      </div>
    </div>
  )
}
