import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'
import type { ClientContext, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { normalizeImageAttachment } from './model.js'

export interface LoadedSessionImage {
  url: string
  attachment: ImageAttachmentRef
  release(): void
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof btoa !== 'function') throw new Error('This browser cannot create an image preview URL.')
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

/**
 * Read an authenticated historical attachment from its owning session.
 * No path or arbitrary URL is accepted at this boundary.
 */
export async function loadSessionImage(
  ctx: Pick<ClientContext, 'sessions'>,
  sessionId: SessionId,
  expected: ImageAttachmentRef,
): Promise<LoadedSessionImage> {
  const session = ctx.sessions.binding(sessionId)?.session
  if (session === undefined) throw new Error('The image preview session is no longer available.')

  const result = await session.readAttachment(expected.attachmentId)
  if (!result.ok) throw new Error(result.error.code + ': ' + result.error.message)

  const attachment = normalizeImageAttachment(result.value.attachment)
  if (attachment === null) throw new Error('The attachment service returned unsupported image metadata.')
  if (attachment.attachmentId !== expected.attachmentId) {
    throw new Error('The attachment service returned a different image than requested.')
  }

  const bytes = Uint8Array.from(result.value.data)
  if (typeof URL.createObjectURL !== 'function') {
    return {
      url: 'data:' + attachment.mediaType + ';base64,' + bytesToBase64(bytes),
      attachment,
      release() {},
    }
  }

  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  const url = URL.createObjectURL(new Blob([buffer], { type: attachment.mediaType }))
  let active = true
  return {
    url,
    attachment,
    release() {
      if (!active) return
      active = false
      URL.revokeObjectURL(url)
    },
  }
}
