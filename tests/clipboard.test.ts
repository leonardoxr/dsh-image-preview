import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { copyImageToClipboard, imageElementToPng } from '../src/client/clipboard.js'

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
const originalClipboardItem = Object.getOwnPropertyDescriptor(globalThis, 'ClipboardItem')
const originalGetContext = HTMLCanvasElement.prototype.getContext
const originalToBlob = HTMLCanvasElement.prototype.toBlob

let writtenPayloads: Array<Record<string, Blob | Promise<Blob>>>
let write: ReturnType<typeof vi.fn>

class TestClipboardItem {
  static supports = vi.fn((type: string) => type === 'image/png')
  constructor(public readonly payload: Record<string, Blob | Promise<Blob>>) {
    writtenPayloads.push(payload)
  }
}

function decodedImage(width = 32, height = 24): HTMLImageElement {
  const image = document.createElement('img')
  Object.defineProperties(image, {
    complete: { configurable: true, value: true },
    naturalWidth: { configurable: true, value: width },
    naturalHeight: { configurable: true, value: height },
  })
  return image
}

beforeEach(() => {
  writtenPayloads = []
  write = vi.fn(async () => undefined)
  TestClipboardItem.supports.mockClear()
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write } })
  Object.defineProperty(globalThis, 'ClipboardItem', { configurable: true, value: TestClipboardItem })
})

afterEach(() => {
  if (originalClipboard === undefined) delete (navigator as { clipboard?: Clipboard }).clipboard
  else Object.defineProperty(navigator, 'clipboard', originalClipboard)
  if (originalClipboardItem === undefined) delete (globalThis as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem
  else Object.defineProperty(globalThis, 'ClipboardItem', originalClipboardItem)
  HTMLCanvasElement.prototype.getContext = originalGetContext
  HTMLCanvasElement.prototype.toBlob = originalToBlob
  vi.restoreAllMocks()
})

describe('copyImageToClipboard', () => {
  it('copies PNG bytes directly during the clipboard write', async () => {
    const source = new Blob([Uint8Array.from([1, 2, 3])], { type: 'image/png' })
    await copyImageToClipboard(source, decodedImage())

    expect(write).toHaveBeenCalledOnce()
    expect(writtenPayloads).toHaveLength(1)
    expect(writtenPayloads[0]?.['image/png']).toBe(source)
  })

  it('converts unsupported image formats to PNG in-browser', async () => {
    const drawImage = vi.fn()
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage }) as unknown as CanvasRenderingContext2D)
    HTMLCanvasElement.prototype.toBlob = vi.fn((callback: BlobCallback) => {
      callback(new Blob([Uint8Array.from([9])], { type: 'image/png' }))
    })

    await copyImageToClipboard(new Blob([Uint8Array.from([4])], { type: 'image/jpeg' }), decodedImage())

    expect(TestClipboardItem.supports).toHaveBeenCalledWith('image/jpeg')
    expect(drawImage).toHaveBeenCalledOnce()
    const converted = await writtenPayloads[0]?.['image/png']
    expect(converted).toBeInstanceOf(Blob)
    expect(converted?.type).toBe('image/png')
  })

  it('fails closed when image clipboard access is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
    await expect(copyImageToClipboard(new Blob([], { type: 'image/png' }), decodedImage()))
      .rejects.toThrow('not available')
    expect(write).not.toHaveBeenCalled()
  })

  it('bounds canvas conversion size', async () => {
    await expect(imageElementToPng(decodedImage(20_000, 20_000))).rejects.toThrow('too large')
  })
})
