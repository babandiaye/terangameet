import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  ComboBox,
  Input,
  Label,
  ListBox,
  ListBoxItem,
} from 'react-aria-components'
import { css } from '@/styled-system/css'
import { RiMailAddLine } from '@remixicon/react'
import { Box, Button } from '@/primitives'
import { StyledPopover } from '@/primitives/StyledPopover'

/** Same shape the server accepts; the server re-checks anyway. */
const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/

type Suggestion =
  | { key: string; kind: 'member'; email: string; name: string | null }
  | { key: string; kind: 'email'; email: string }

const initials = (name: string | null, email: string) =>
  (name || email)
    .split(/[\s.@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')

/**
 * "Ajouter des participants", Google Agenda style: type a name or an address,
 * pick a member of the platform among the suggestions, and they join the list
 * at once — the field clears for the next one. A full address of someone not
 * registered yet is offered too, so they can be listed before their first
 * sign-in.
 */
export const InviteePicker = ({
  id,
  search,
  exclude = [],
  label = 'Ajouter des participants',
  isAdding = false,
  onPick,
}: {
  /** Unique per picker instance (cache key and hint id). */
  id: string
  /** Server-side member search for this context (room list, meeting guests). */
  search: (q: string) => Promise<{
    results: { id: string; full_name: string | null; email: string }[]
  }>
  /** Addresses already chosen: not suggested again. */
  exclude?: string[]
  label?: string
  isAdding?: boolean
  /** Called with the address, and the account name when a member was picked. */
  onPick: (email: string, name?: string | null) => void
}) => {
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')

  // Debounced: one request per pause in typing, not one per key.
  useEffect(() => {
    const timeout = setTimeout(() => setQuery(input.trim()), 250)
    return () => clearTimeout(timeout)
  }, [input])

  const { data, isFetching } = useQuery({
    queryKey: ['people', id, query],
    queryFn: () => search(query),
    enabled: query.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })

  const typed = input.trim().toLowerCase()
  const suggestions = useMemo<Suggestion[]>(() => {
    const members: Suggestion[] =
      input.trim().length >= 2
        ? (data?.results ?? [])
            .filter((m) => !exclude.includes(m.email))
            .map((m) => ({
              key: `member:${m.id}`,
              kind: 'member',
              email: m.email,
              name: m.full_name,
            }))
        : []
    const isNewAddress =
      EMAIL_RE.test(typed) &&
      !exclude.includes(typed) &&
      !members.some((m) => m.email === typed)
    return isNewAddress
      ? [...members, { key: `email:${typed}`, kind: 'email', email: typed }]
      : members
  }, [data, input, typed, exclude])

  const pick = (s: Suggestion | undefined) => {
    if (!s) return
    onPick(s.email, s.kind === 'member' ? s.name : undefined)
    setInput('')
    setQuery('')
  }

  // The button adds what is unambiguous: a typed address, or the only match.
  const buttonTarget =
    suggestions.find((s) => s.kind === 'email') ??
    (suggestions.length === 1 ? suggestions[0] : undefined)

  return (
    <div
      className={css({
        display: 'grid',
        gridTemplateColumns: { base: '1fr', sm: 'minmax(0, 1fr) auto' },
        alignItems: 'end',
        gap: '0.5rem',
      })}
    >
      <ComboBox
        aria-describedby={`invitee-hint-${id}`}
        inputValue={input}
        onInputChange={setInput}
        selectedKey={null}
        onSelectionChange={(key) =>
          pick(suggestions.find((s) => s.key === key))
        }
        items={suggestions}
        menuTrigger="input"
        allowsEmptyCollection
        className={css({ minWidth: 0 })}
      >
        <Label className={css({ display: 'block', fontSize: '0.875rem' })}>
          {label}
        </Label>
        <Input
          placeholder="Nom ou adresse email"
          className={css({
            width: 'full',
            marginTop: '0.25rem',
            paddingY: '0.5rem',
            paddingX: '0.75rem',
            border: '1px solid',
            borderColor: 'control.border',
            borderRadius: '10px',
            _focusVisible: {
              outline: '2px solid',
              outlineColor: 'primary.800',
              outlineOffset: '1px',
            },
          })}
        />
        <StyledPopover placement="bottom start">
          <Box
            size="sm"
            type="popover"
            variant="light"
            className={css({ maxHeight: '18rem', overflowY: 'auto' })}
          >
            <ListBox<Suggestion>
              renderEmptyState={() => (
                <div
                  className={css({
                    padding: '0.5rem 0.75rem',
                    color: 'greyscale.600',
                    fontSize: '0.875rem',
                  })}
                >
                  {query.length < 2 || isFetching
                    ? 'Recherche…'
                    : 'Aucun membre trouvé. Saisissez l’adresse email complète pour l’ajouter.'}
                </div>
              )}
            >
              {(s) => (
                <ListBoxItem
                  id={s.key}
                  textValue={
                    s.kind === 'member' ? (s.name ?? s.email) : s.email
                  }
                  className={css({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    padding: '0.45rem 0.6rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    outline: 'none',
                    color: 'box.text',
                    '&[data-focused], &[data-hovered]': {
                      backgroundColor: 'primary.800',
                      color: 'white',
                    },
                  })}
                >
                  <span
                    aria-hidden="true"
                    className={css({
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      width: '2rem',
                      height: '2rem',
                      borderRadius: '50%',
                      backgroundColor: 'primary.100',
                      color: 'primary.800',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                    })}
                  >
                    {s.kind === 'member' ? (
                      initials(s.name, s.email)
                    ) : (
                      <RiMailAddLine size={16} />
                    )}
                  </span>
                  <span className={css({ minWidth: 0 })}>
                    <span
                      className={css({
                        display: 'block',
                        fontWeight: 600,
                        overflowWrap: 'anywhere',
                      })}
                    >
                      {s.kind === 'member'
                        ? (s.name ?? s.email)
                        : `Ajouter ${s.email}`}
                    </span>
                    <span
                      className={css({
                        display: 'block',
                        fontSize: '0.8rem',
                        opacity: 0.8,
                        overflowWrap: 'anywhere',
                      })}
                    >
                      {s.kind === 'member'
                        ? s.email
                        : 'Pas encore inscrit sur la plateforme'}
                    </span>
                  </span>
                </ListBoxItem>
              )}
            </ListBox>
          </Box>
        </StyledPopover>
      </ComboBox>
      <Button
        variant="secondary"
        isDisabled={!buttonTarget || isAdding}
        onPress={() => pick(buttonTarget)}
      >
        Ajouter
      </Button>
      <p
        id={`invitee-hint-${id}`}
        className={css({
          gridColumn: '1 / -1',
          color: 'greyscale.600',
          fontSize: '0.85rem',
        })}
      >
        Tapez au moins deux lettres d’un nom ou d’une adresse, puis choisissez
        dans la liste ; la personne est ajoutée aussitôt.
      </p>
    </div>
  )
}
