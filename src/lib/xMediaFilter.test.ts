import { describe, it, expect } from 'vitest'
import { postsWithMedia } from './xMediaFilter'

const post = (id: string, media?: Array<{ type: string }>) => ({ id, media })

describe('postsWithMedia', () => {
  const posts = [
    post('text'),
    post('photo', [{ type: 'photo' }]),
    post('video', [{ type: 'video' }]),
    post('mixed', [{ type: 'photo' }, { type: 'video' }]),
    post('empty-media', []),
  ]

  it('finds every post carrying a video, including mixed posts', () => {
    expect(postsWithMedia(posts, 'video').map((p) => p.id)).toEqual(['video', 'mixed'])
  })

  it('finds every post carrying a photo, including mixed posts', () => {
    expect(postsWithMedia(posts, 'photo').map((p) => p.id)).toEqual(['photo', 'mixed'])
  })

  it('keeps the given order and ignores medialess posts', () => {
    expect(postsWithMedia([post('a'), post('b', [{ type: 'video' }])], 'video').map((p) => p.id)).toEqual(['b'])
  })
})
