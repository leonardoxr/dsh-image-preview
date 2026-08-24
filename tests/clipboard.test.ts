import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { copyImageToClipboard, imageElementToPng } from '../src/client/clipboard.js'

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
const originalClipboardItem = Object.getOwnPropertyDescriptor(globalThis, 'ClipboardItem')
const originalCreateObjectURL = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
const originalRevokeObjectURL = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL')
const originalDecode = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'decode')
const originalComplete = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'complete')
const originalNaturalWidth = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'naturalWidth')
const originalNaturalHeight = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'naturalHeight')
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

function restoreProperty(target: object, key: PropertyKey, descriptor: PropertyDescriptor | undefined): void {
  if (descriptor === undefined) Reflect.deleteProperty(target, key)
  else Object.defineProperty(target, key, descriptor)
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

function mockCanvas(blob: Blob | null = new Blob([Uint8Array.from([9])], { type: 'image/png' })) {
  const drawImage = vi.fn()
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage }) as unknown as CanvasRenderingContext2D)
  HTMLCanvasElement.prototype.toBlob = vi.fn((callback: BlobCallback) => callback(blob))
  return { drawImage }
}

beforeEach(() => {
  writtenPayloads = []
  write = vi.fn(async (items: TestClipboardItem[]) => {
    for (const item of items) await Promise.all(Object.values(item.payload))
  })
  TestClipboardItem.supports.mockClear()
  TestClipboardItem.supports.mockImplementation((type: string) => type === 'image/png')
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write } })
  Object.defineProperty(globalThis, 'ClipboardItem', { configurable: true, value: TestClipboardItem })
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:clipboard-source') })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
  Object.defineProperty(HTMLImageElement.prototype, 'decode', { configurable: true, value: vi.fn(async () => undefined) })
  Object.defineProperty(HTMLImageElement.prototype, 'complete', { configurable: true, get: () => true })
  Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', { configurable: true, get: () => 32 })
  Object.defineProperty(HTMLImageElement.prototype, 'naturalHeight', { configurable: true, get: () => 24 })
})

afterEach(() => {
  restoreProperty(navigator, 'clipboard', originalClipboard)
  restoreProperty(globalThis, 'ClipboardItem', originalClipboardItem)
  restoreProperty(URL, 'createObjectURL', originalCreateObjectURL)
  restoreProperty(URL, 'revokeObjectURL', originalRevokeObjectURL)
  restoreProperty(HTMLImageElement.prototype, 'decode', originalDecode)
  restoreProperty(HTMLImageElement.prototype, 'complete', originalComplete)
  restoreProperty(HTMLImageElement.prototype, 'naturalWidth', originalNaturalWidth)
  restoreProperty(HTMLImageElement.prototype, 'naturalHeight', originalNaturalHeight)
  HTMLCanvasElement.prototype.getContext = originalGetContext
  HTMLCanvasElement.prototype.toBlob = originalToBlob
  vi.restoreAllMocks()
})

describe('copyImageToClipboard', () => {
  it('copies PNG bytes directly during the clipboard write', async () => {
    const source = new Blob([Uint8Array.from([1, 2, 3])], { type: 'image/png' })
    await copyImageToClipboard(source)

    expect(write).toHaveBeenCalledOnce()
    expect(writtenPayloads).toHaveLength(1)
    expect(writtenPayloads[0]?.['image/png']).toBe(source)
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('starts clipboard.write synchronously before detached-blob conversion settles', async () => {
    let finishDecode: (() => void) | undefined
    Object.defineProperty(HTMLImageElement.prototype, 'decode', {
      configurable: true,
      value: vi.fn(() => new Promise<void>(resolve => { finishDecode = resolve })),
    })
    const { drawImage } = mockCanvas()

    const copying = copyImageToClipboard(new Blob([Uint8Array.from([4])], { type: 'image/jpeg' }))
    expect(write).toHaveBeenCalledOnce()
    expect(HTMLCanvasElement.prototype.toBlob).not.toHaveBeenCalled()

    finishDecode?.()
    await copying
    expect(drawImage).toHaveBeenCalledOnce()
    expect((await writtenPayloads[0]?.['image/png'])?.type).toBe('image/png')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:clipboard-source')
  })

  it('propagates clipboard rejection', async () => {
    write.mockRejectedValueOnce(new DOMException('Permission denied', 'NotAllowedError'))
    await expect(copyImageToClipboard(new Blob([], { type: 'image/png' }))).rejects.toThrow('Permission denied')
  })

  it('fails closed and revokes the detached URL when decoding fails', async () => {
    Object.defineProperty(HTMLImageElement.prototype, 'decode', {
      configurable: true,
      value: vi.fn(async () => { throw new DOMException('bad bytes') }),
    })
    await expect(copyImageToClipboard(new Blob([], { type: 'image/jpeg' }))).rejects.toThrow('could not be decoded')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:clipboard-source')
  })

  it('fails closed when image clipboard access is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
    await expect(copyImageToClipboard(new Blob([], { type: 'image/png' }))).rejects.toThrow('not available')
    expect(write).not.toHaveBeenCalled()
  })

  it('reports unavailable canvas and encoding failures', async () => {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => null)
    await expect(imageElementToPng(decodedImage())).rejects.toThrow('cannot convert')

    mockCanvas(null)
    await expect(imageElementToPng(decodedImage())).rejects.toThrow('could not encode')
  })

  it('bounds canvas conversion size', async () => {
    await expect(imageElementToPng(decodedImage(20_000, 20_000))).rejects.toThrow('too large')
  })
})
