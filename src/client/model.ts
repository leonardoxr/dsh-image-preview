import type { ImageAttachmentRef, ImageMediaType } from '@deepseek-ai/dsh-attachment'
import type { ToolCallBlock, ToolResultNode } from '@deepseek-ai/dsh-client-runtime/client'

const SUPPORTED_MEDIA_TYPES = new Set<ImageMediaType>([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSafeWhole(value: unknown, minimum: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum
}

export function isSupportedImageMediaType(value: unknown): value is ImageMediaType {
  return typeof value === 'string' && SUPPORTED_MEDIA_TYPES.has(value as ImageMediaType)
}

/** Validate and copy one persisted attachment reference before using its opaque id. */
export function normalizeImageAttachment(value: unknown): ImageAttachmentRef | null {
  if (!isRecord(value)) return null
  if (typeof value.attachmentId !== 'string' || value.attachmentId.trim() === '') return null
  if (!isSupportedImageMediaType(value.mediaType)) return null
  if (!isSafeWhole(value.bytes, 0) || !isSafeWhole(value.width, 1) || !isSafeWhole(value.height, 1)) return null

  const normalized: ImageAttachmentRef = {
    attachmentId: value.attachmentId as ImageAttachmentRef['attachmentId'],
    mediaType: value.mediaType,
    bytes: value.bytes,
    width: value.width,
    height: value.height,
  }
  if (typeof value.name === 'string' && value.name.trim() !== '') {
    normalized.name = value.name.slice(0, 500)
  }
  if (isRecord(value.originalDimensions)
    && isSafeWhole(value.originalDimensions.width, 1)
    && isSafeWhole(value.originalDimensions.height, 1)) {
    normalized.originalDimensions = {
      width: value.originalDimensions.width,
      height: value.originalDimensions.height,
    }
  }
  return normalized
}

export function isSettledToolBlock(block: ToolCallBlock): block is ToolResultNode {
  return 'kind' in block && block.kind === 'tool-result'
}

/** Select the first valid durable image block from a successful result. */
export function imageAttachmentFrom(block: ToolCallBlock): ImageAttachmentRef | null {
  if (!isSettledToolBlock(block) || block.isError) return null
  const content = (block as { content?: unknown }).content
  if (!Array.isArray(content)) return null
  for (const item of content) {
    if (!isRecord(item) || item.type !== 'image') continue
    const attachment = normalizeImageAttachment(item.attachment)
    if (attachment !== null) return attachment
  }
  return null
}

/** Parse the call path only for labeling/navigation, never as the preview byte source. */
export function readImagePath(block: ToolCallBlock): string | null {
  const argsRaw = isSettledToolBlock(block) ? block.call?.argsRaw : block.argsRaw
  if (typeof argsRaw !== 'string' || argsRaw === '') return null
  try {
    const parsed: unknown = JSON.parse(argsRaw)
    if (!isRecord(parsed) || typeof parsed.file_path !== 'string') return null
    const path = parsed.file_path.trim()
    return path === '' ? null : path.slice(0, 2_000)
  } catch {
    return null
  }
}

export function resultText(block: ToolCallBlock, limit = 500): string | null {
  if (!isSettledToolBlock(block)) return null
  const content = (block as { content?: unknown }).content
  if (!Array.isArray(content)) return null
  for (const item of content) {
    if (!isRecord(item) || item.type !== 'text' || typeof item.text !== 'string') continue
    const text = item.text.trim()
    if (text === '') continue
    return text.length <= limit ? text : text.slice(0, limit - 1) + '…'
  }
  return null
}

export function toolErrorSummary(block: ToolCallBlock): string {
  if (!isSettledToolBlock(block)) return 'Reading image…'
  const text = resultText(block, 500)
  if (text !== null) return text
  if (block.error !== undefined) return block.error.code + ': ' + block.error.name
  return 'The image tool failed without a recorded error message.'
}

export function basename(path: string | null): string | null {
  if (path === null) return null
  const index = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return (index === -1 ? path : path.slice(index + 1)) || path
}

export function formatBytes(bytes: number): string {
  if (bytes < 1_024) return bytes + ' B'
  if (bytes < 1_048_576) return (bytes / 1_024).toFixed(bytes < 10_240 ? 1 : 0) + ' KB'
  return (bytes / 1_048_576).toFixed(bytes < 10_485_760 ? 1 : 0) + ' MB'
}
