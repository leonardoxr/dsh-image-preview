import { describe, expect, it } from 'vitest'
import {
  basename,
  formatBytes,
  imageAttachmentFrom,
  normalizeImageAttachment,
  readImagePath,
  resultText,
} from '../src/client/model.js'
import { imageAttachment, runCodeWithNestedImage, runningImage, settledImage } from './fixtures.js'

describe('read_image view model', () => {
  it('extracts the durable image and display-only path from a direct result', () => {
    const block = settledImage()
    expect(imageAttachmentFrom(block)).toEqual(imageAttachment)
    expect(readImagePath(block)).toBe('C:/workspace/preview.png')
    expect(basename(readImagePath(block))).toBe('preview.png')
  })

  it('accepts the same child block when read_image is nested under run_code', () => {
    const root = runCodeWithNestedImage()
    expect(root.call?.name).toBe('run_code')
    expect(root.subCalls).toHaveLength(1)
    expect(root.subCalls[0] && imageAttachmentFrom(root.subCalls[0])).toEqual(imageAttachment)
  })

  it('does not expose an attachment for running, failed, malformed, or unsupported results', () => {
    expect(imageAttachmentFrom(runningImage())).toBeNull()
    expect(imageAttachmentFrom(settledImage({ isError: true }))).toBeNull()
    expect(imageAttachmentFrom(settledImage({ content: [{ type: 'text', text: 'legacy only' }] }))).toBeNull()
    expect(imageAttachmentFrom(settledImage({
      content: [{ type: 'image', attachment: { ...imageAttachment, mediaType: 'image/svg+xml' } } as never],
    }))).toBeNull()
    expect(normalizeImageAttachment({ ...imageAttachment, width: 0 })).toBeNull()
  })

  it('bounds persisted text and ignores invalid call arguments', () => {
    expect(readImagePath(runningImage('{not json'))).toBeNull()
    expect(resultText(settledImage({ content: [{ type: 'text', text: 'abcdef' }] }), 5)).toBe('abcd…')
    expect(formatBytes(2_048)).toBe('2.0 KB')
  })
})
