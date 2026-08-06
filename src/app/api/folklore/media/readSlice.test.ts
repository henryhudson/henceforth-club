import { describe, it, expect } from 'vitest'
import { readSlice } from './readSlice'

// FileHandle.read may legally return fewer bytes than asked; the loop must
// keep reading until the window is filled, and stop honestly at end of file
// — the single-read version served a zero-filled tail with a confident 206.

/** A fake file that answers each read with at most `atMost` bytes. */
const dribble = (file: Buffer, atMost: number) =>
  async (buffer: Buffer, offset: number, length: number, position: number) => {
    const bytesRead = Math.max(0, Math.min(length, atMost, file.length - position))
    if (bytesRead > 0) file.copy(buffer, offset, position, position + bytesRead)
    return { bytesRead }
  }

const file = Buffer.from('the chain remembers what X forgets', 'utf8')

describe('readSlice', () => {
  it('fills the window in one pass when the read is complete', async () => {
    const slice = await readSlice(dribble(file, file.length), { start: 4, end: 8 })
    expect(slice.toString('utf8')).toBe('chain')
  })

  it('assembles the window across short reads — no zero-filled tail', async () => {
    const slice = await readSlice(dribble(file, 3), { start: 4, end: 18 })
    expect(slice.toString('utf8')).toBe('chain remembers')
    expect(slice.length).toBe(15)
  })

  it('stops at end of file and returns only the bytes that exist', async () => {
    // The range was validated against a meta size the disk copy no longer
    // matches — serve the real bytes, not padding.
    const slice = await readSlice(dribble(file, 4), { start: 30, end: 40 })
    expect(slice.toString('utf8')).toBe('gets')
  })

  it('returns an empty slice when the window starts beyond the file', async () => {
    const slice = await readSlice(dribble(file, 4), { start: 100, end: 110 })
    expect(slice.length).toBe(0)
  })
})
