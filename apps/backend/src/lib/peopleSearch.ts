/**
 * Accent-insensitive people search, without the `unaccent` extension (not
 * installed on the shared Postgres). Both sides are folded the same way: the
 * query here in JS, the stored names in SQL through translate() with the same
 * character map — so "aissatou" finds "Aïssatou" and "sene" finds "Sène".
 */
export const FOLD_FROM = 'àáâãäåçèéêëìíîïñòóôõöùúûüýÿ'
export const FOLD_TO = 'aaaaaaceeeeiiiinooooouuuuyy'

export function foldText(text: string): string {
  let out = ''
  for (const ch of text.toLowerCase()) {
    const i = FOLD_FROM.indexOf(ch)
    out += i >= 0 ? FOLD_TO[i] : ch
  }
  return out
}

const MAX_TERMS = 5

/**
 * Words of a search query, folded. Only letters, digits and the characters of
 * an email address survive: LIKE wildcards (% _) and quotes never reach SQL.
 * Empty when the query is too short to be worth a lookup (under 2 characters).
 */
export function searchTerms(query: string): string[] {
  const words = foldText(query)
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9@.-]/g, ''))
    .filter(Boolean)
  if (words.join('').length < 2) return []
  return words.slice(0, MAX_TERMS)
}
