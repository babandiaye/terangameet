import { describe, expect, it } from 'vitest'
import { foldText, searchTerms } from './peopleSearch'

describe('foldText', () => {
  it('lowercases and strips accents, as the SQL side does', () => {
    expect(foldText('Aïssatou NDIAYE')).toBe('aissatou ndiaye')
    expect(foldText('Mamadou Lamine Diédhiou')).toBe('mamadou lamine diedhiou')
    expect(foldText('Ndèye Fatou Sène')).toBe('ndeye fatou sene')
  })
})

describe('searchTerms', () => {
  it('splits a query into folded words', () => {
    expect(searchTerms('Mouhamadou  Sow')).toEqual(['mouhamadou', 'sow'])
  })

  it('keeps an email whole', () => {
    expect(searchTerms('m.sow@unchk.edu.sn')).toEqual(['m.sow@unchk.edu.sn'])
  })

  it('needs at least two characters before searching', () => {
    expect(searchTerms('')).toEqual([])
    expect(searchTerms('  m ')).toEqual([])
    expect(searchTerms('mo')).toEqual(['mo'])
  })

  it('drops LIKE wildcards and other noise rather than passing them to SQL', () => {
    expect(searchTerms('mou%_hamadou')).toEqual(['mouhamadou'])
    expect(searchTerms("o'neil")).toEqual(['oneil'])
  })

  it('caps the number of words', () => {
    expect(searchTerms('a1 b2 c3 d4 e5 f6 g7')).toEqual(['a1', 'b2', 'c3', 'd4', 'e5'])
  })
})
