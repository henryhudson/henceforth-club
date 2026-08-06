import { describe, it, expect } from 'vitest'
import { FALLBACK_MEDIA_TYPE, MAX_MEDIA_BYTES, readCapped, safeMediaType } from './safety'

// The contract the paid public caches depend on: nothing enters or leaves
// them wearing a type a browser would execute from this origin, and nothing
// larger than the cap enters them at all.
describe('safeMediaType', () => {
  it('passes each enumerated image and video type through unchanged', () => {
    for (const type of [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/avif',
      'video/mp4',
      'video/webm',
      'video/quicktime',
    ]) {
      expect(safeMediaType(type)).toBe(type)
    }
  })

  it('normalises case and drops parameters before matching', () => {
    expect(safeMediaType('Video/MP4')).toBe('video/mp4')
    expect(safeMediaType('video/mp4; codecs="avc1.42E01E"')).toBe('video/mp4')
    expect(safeMediaType('  image/png ')).toBe('image/png')
  })

  it('clamps executable and unknown types to an opaque download', () => {
    expect(safeMediaType('text/html')).toBe(FALLBACK_MEDIA_TYPE)
    expect(safeMediaType('image/svg+xml')).toBe(FALLBACK_MEDIA_TYPE)
    expect(safeMediaType('application/javascript')).toBe(FALLBACK_MEDIA_TYPE)
    expect(safeMediaType('text/html; charset=utf-8')).toBe(FALLBACK_MEDIA_TYPE)
  })

  it('clamps a missing claim, and is idempotent on its own fallback', () => {
    expect(safeMediaType(null)).toBe(FALLBACK_MEDIA_TYPE)
    expect(safeMediaType(undefined)).toBe(FALLBACK_MEDIA_TYPE)
    expect(safeMediaType('')).toBe(FALLBACK_MEDIA_TYPE)
    expect(safeMediaType(FALLBACK_MEDIA_TYPE)).toBe(FALLBACK_MEDIA_TYPE)
  })
})

describe('readCapped', () => {
  it('returns the whole body when it fits the cap', async () => {
    const body = Buffer.from('a small inscription')
    const bytes = await readCapped(new Response(body), 1024)
    expect(bytes).not.toBe('too-large')
    expect(Buffer.from(bytes as Buffer).toString()).toBe('a small inscription')
  })

  it('accepts a body of exactly the cap', async () => {
    const bytes = await readCapped(new Response(Buffer.alloc(16)), 16)
    expect(bytes).not.toBe('too-large')
    expect((bytes as Buffer).length).toBe(16)
  })

  it('refuses a body one byte over the cap', async () => {
    expect(await readCapped(new Response(Buffer.alloc(17)), 16)).toBe('too-large')
  })

  it('refuses on a declared Content-Length past the cap without reading the body', async () => {
    let pulled = false
    const stream = new ReadableStream<Uint8Array>({
      pull() {
        pulled = true
      },
    })
    const upstream = new Response(stream, {
      headers: { 'content-length': String(MAX_MEDIA_BYTES + 1) },
    })
    expect(await readCapped(upstream, MAX_MEDIA_BYTES)).toBe('too-large')
    expect(pulled).toBe(false)
  })

  it('abandons a lying stream the moment it exceeds the cap', async () => {
    // Declares nothing, then streams forever — the cap must stop the read.
    let chunksServed = 0
    const chunk = new Uint8Array(1024)
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        chunksServed++
        controller.enqueue(chunk)
      },
    })
    expect(await readCapped(new Response(stream), 4 * 1024)).toBe('too-large')
    expect(chunksServed).toBeLessThan(10)
  })
})
