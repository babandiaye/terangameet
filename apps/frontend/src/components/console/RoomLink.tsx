import { useEffect, useState } from 'react'
import { css } from '@/styled-system/css'
import { RiCheckLine, RiFileCopyLine, RiLink } from '@remixicon/react'
import { getRouteUrl } from '@/navigation/getRouteUrl'

/**
 * The room's permanent link, under a past session's title: clicking it opens
 * the room in a new tab — a new session, under the room's usual access rules —
 * so the history stays where it was. The copy button makes it easy to send the
 * link again to the next session's participants.
 */
export const RoomLink = ({ slug }: { slug: string }) => {
  const url = getRouteUrl('room', slug)
  const [isCopied, setIsCopied] = useState(false)

  useEffect(() => {
    if (!isCopied) return
    const timeout = setTimeout(() => setIsCopied(false), 2500)
    return () => clearTimeout(timeout)
  }, [isCopied])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setIsCopied(true)
    } catch {
      /* clipboard refused (insecure context, permission): the link stays visible */
    }
  }

  return (
    <div
      className={css({
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.35rem 0.6rem',
        marginTop: '0.35rem',
        fontSize: '0.9rem',
      })}
    >
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title="Rejoindre la salle (nouvel onglet)"
        className={css({
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.3rem',
          minWidth: 0,
          color: 'primary.800',
          fontWeight: 600,
          textDecoration: 'underline',
          overflowWrap: 'anywhere',
          _hover: { color: 'primary.action' },
        })}
      >
        <RiLink size={16} aria-hidden="true" />
        {url.replace(/^https?:\/\//, '')}
      </a>
      <button
        type="button"
        onClick={copy}
        aria-label="Copier le lien de la salle"
        className={css({
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.15rem 0.45rem',
          border: '1px solid',
          borderColor: 'greyscale.300',
          borderRadius: '8px',
          background: 'white',
          color: isCopied ? 'brand.green' : 'greyscale.700',
          fontSize: '0.8rem',
          cursor: 'pointer',
          _hover: { borderColor: 'primary.800' },
        })}
      >
        {isCopied ? (
          <RiCheckLine size={14} aria-hidden="true" />
        ) : (
          <RiFileCopyLine size={14} aria-hidden="true" />
        )}
        {isCopied ? 'Copié' : 'Copier le lien'}
      </button>
      <span role="status" aria-live="polite" className={css({ srOnly: true })}>
        {isCopied ? 'Lien copié dans le presse-papiers' : ''}
      </span>
    </div>
  )
}
