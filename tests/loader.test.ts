import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadSessionImage } from '../src/client/loader.js'
import { imageAttachment } from './fixtures.js'

const originalCreateObjectURL = URL.createObjectURL
const originalRevokeObjectURL = URL.revokeObjectURL

beforeEach(() => {
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:preview') })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
})

afterEach(() => {
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectURL })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: originalRevokeObjectURL })
})

function contextWith(result: unknown) {
  const readAttachment = vi.fn(async () => result)
  const binding = vi.fn(() => ({ session: { readAttachment } }))
  return { ctx: { sessions: { binding } } as never, binding, readAttachment }
}

describe('loadSessionImage', () => {
  it('loads only the opaque id through the owning session and revokes its URL once', async () => {
    const { ctx, binding, readAttachment } = contextWith({
      ok: true,
      value: { attachment: imageAttachment, data: Uint8Array.from([1, 2, 3]) },
    })
    const loaded = await loadSessionImage(ctx, 'session-1' as never, imageAttachment)

    expect(binding).toHaveBeenCalledWith('session-1')
    expect(readAttachment).toHaveBeenCalledWith(imageAttachment.attachmentId)
    expect(loaded.url).toBe('blob:preview')
    expect(URL.createObjectURL).toHaveBeenCalledOnce()

    loaded.release()
    loaded.release()
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview')
  })

  it('fails closed on unknown sessions, RPC failures, and mismatched references', async () => {
    await expect(loadSessionImage({ sessions: { binding: () => undefined } } as never, 'missing' as never, imageAttachment))
      .rejects.toThrow('session is no longer available')

    const denied = contextWith({ ok: false, error: { code: 'FORBIDDEN', message: 'Not in session' } })
    await expect(loadSessionImage(denied.ctx, 'session-1' as never, imageAttachment))
      .rejects.toThrow('FORBIDDEN: Not in session')

    const mismatch = contextWith({
      ok: true,
      value: { attachment: { ...imageAttachment, attachmentId: 'sha256:other' }, data: Uint8Array.from([1]) },
    })
    await expect(loadSessionImage(mismatch.ctx, 'session-1' as never, imageAttachment))
      .rejects.toThrow('different image')
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('uses a data URL fallback when object URLs are unavailable', async () => {
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: undefined })
    const { ctx } = contextWith({
      ok: true,
      value: { attachment: imageAttachment, data: Uint8Array.from([65, 66]) },
    })
    const loaded = await loadSessionImage(ctx, 'session-1' as never, imageAttachment)
    expect(loaded.url).toBe('data:image/png;base64,QUI=')
    expect(() => loaded.release()).not.toThrow()
  })
})
