import { describe, it, expect } from 'vitest'
import { playableMediaUrl } from './mediaProxy'

describe('playableMediaUrl', () => {
  it('rewrites a gateway outpoint url onto the range-honouring media route', () => {
    const txid = 'a'.repeat(64)
    expect(playableMediaUrl(`https://ordfs.network/${txid}_3`)).toBe(`/api/folklore/media/${txid}_3`)
  })

  it('passes anything else through untouched', () => {
    expect(playableMediaUrl('https://example.com/clip.mp4')).toBe('https://example.com/clip.mp4')
    expect(playableMediaUrl('https://ordfs.network/not-an-outpoint')).toBe(
      'https://ordfs.network/not-an-outpoint',
    )
  })
})
