import { useEffect, useRef, useState } from 'react'
import { css } from '@/styled-system/css'
import { RiDownloadLine } from '@remixicon/react'
import { Button } from '@/primitives'
import { useRoomData } from '@/features/rooms/livekit/hooks/useRoomData'
import { useUser } from '@/features/auth/api/useUser'
import { fetchNotes, saveNotes } from '../api/notesApi'

const LS_PREFIX = 'tm-notes:'
const SAVE_DELAY_MS = 800
type Status = 'idle' | 'saving' | 'saved' | 'local-only'

// localStorage can be unavailable (private window, blocked site data).
const readLocal = (key: string) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
const writeLocal = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

/**
 * Private per-participant notes panel. Persisted server-side for authenticated
 * users, with a localStorage fallback for guests. Auto-saves (debounced), and
 * saves what is pending when the panel closes or the page goes away.
 */
export const Notes = () => {
  const room = useRoomData()
  const roomId = room?.id
  const { isLoggedIn } = useUser()
  const [content, setContent] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const loadedRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Typed but not saved yet: flushed on close instead of being lost.
  const pendingRef = useRef<string | null>(null)
  // Once the participant typed, the server's answer must not overwrite it.
  const typedRef = useRef(false)
  const mountedRef = useRef(true)

  // Load existing notes once we know the room and auth state.
  useEffect(() => {
    if (!roomId || isLoggedIn === undefined || loadedRef.current) return
    loadedRef.current = true
    const local = readLocal(LS_PREFIX + roomId)
    if (isLoggedIn) {
      fetchNotes(roomId)
        .then((r) => {
          if (!typedRef.current) setContent(r.content || local || '')
        })
        .catch(() => {
          if (!typedRef.current && local) setContent(local)
        })
    } else if (local) {
      setContent(local)
    }
  }, [roomId, isLoggedIn])

  const persist = (value: string, opts: { keepalive?: boolean } = {}) => {
    if (!roomId) return
    pendingRef.current = null
    const setIfMounted = (next: Status) => mountedRef.current && setStatus(next)
    if (isLoggedIn) {
      saveNotes(roomId, value, opts)
        .then(() => setIfMounted('saved'))
        .catch(() => {
          // Not on the server: keep a copy here and say so, rather than
          // claiming it was saved.
          writeLocal(LS_PREFIX + roomId, value)
          setIfMounted('local-only')
        })
    } else {
      setIfMounted(writeLocal(LS_PREFIX + roomId, value) ? 'saved' : 'local-only')
    }
  }

  const onChange = (value: string) => {
    typedRef.current = true
    pendingRef.current = value
    setContent(value)
    setStatus('saving')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => persist(value), SAVE_DELAY_MS)
  }

  // Save what is still pending when the panel closes or the tab goes away.
  const flushRef = useRef<() => void>(() => {})
  flushRef.current = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (pendingRef.current !== null) persist(pendingRef.current, { keepalive: true })
  }
  useEffect(() => {
    mountedRef.current = true
    const onPageHide = () => flushRef.current()
    window.addEventListener('pagehide', onPageHide)
    return () => {
      window.removeEventListener('pagehide', onPageHide)
      mountedRef.current = false
      flushRef.current()
    }
  }, [])

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
      : status === 'local-only'
        ? isLoggedIn
          ? 'Non enregistré sur le serveur : une copie est gardée sur cet appareil. Nouvel essai à la prochaine frappe.'
          : 'Impossible d’enregistrer sur cet appareil (stockage du navigateur bloqué).'
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
        aria-label="Notes privées"
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
      <div
        role="status"
        aria-live="polite"
        className={css({
          fontSize: '0.75rem',
          color: status === 'local-only' ? 'danger.600' : 'greyscale.500',
          textAlign: 'right',
        })}
      >
        {statusText}
      </div>
    </div>
  )
}
