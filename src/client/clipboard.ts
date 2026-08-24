const MAX_CONVERSION_DIMENSION = 16_384
const MAX_CONVERSION_PIXELS = 40_000_000

class ImageClipboardError extends Error {}

function clipboardError(message: string): ImageClipboardError {
  return new ImageClipboardError(message)
}

async function waitForDecodedImage(image: HTMLImageElement): Promise<void> {
  if (image.complete && image.naturalWidth > 0 && image.naturalHeight > 0) return
  if (typeof image.decode === 'function') {
    await image.decode()
    return
  }
  await new Promise<void>((resolve, reject) => {
    image.addEventListener('load', () => resolve(), { once: true })
    image.addEventListener('error', () => reject(clipboardError('The image could not be decoded for copying.')), { once: true })
  })
}

export async function imageElementToPng(image: HTMLImageElement): Promise<Blob> {
  await waitForDecodedImage(image)
  const width = image.naturalWidth
  const height = image.naturalHeight
  if (
    width < 1
    || height < 1
    || width > MAX_CONVERSION_DIMENSION
    || height > MAX_CONVERSION_DIMENSION
    || width * height > MAX_CONVERSION_PIXELS
  ) {
    throw clipboardError('This image is too large to convert safely for the clipboard.')
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (context === null) throw clipboardError('This browser cannot convert the image for the clipboard.')
  context.drawImage(image, 0, 0, width, height)
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob === null) reject(clipboardError('The browser could not encode the clipboard image.'))
      else resolve(blob)
    }, 'image/png')
  })
}

export async function imageBlobToPng(source: Blob): Promise<Blob> {
  if (typeof URL.createObjectURL !== 'function' || typeof URL.revokeObjectURL !== 'function') {
    throw clipboardError('This browser cannot decode the image for clipboard conversion.')
  }

  const url = URL.createObjectURL(source)
  const image = document.createElement('img')
  image.decoding = 'async'
  try {
    if (typeof image.decode === 'function') {
      image.src = url
      await image.decode()
    } else {
      await new Promise<void>((resolve, reject) => {
        image.addEventListener('load', () => resolve(), { once: true })
        image.addEventListener('error', () => reject(clipboardError('The image could not be decoded for copying.')), { once: true })
        image.src = url
      })
    }
    return await imageElementToPng(image)
  } catch (error) {
    if (error instanceof ImageClipboardError) throw error
    throw clipboardError('The image could not be decoded for copying.')
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function copyImageToClipboard(source: Blob): Promise<void> {
  const clipboard = globalThis.navigator?.clipboard
  const ClipboardItemConstructor = globalThis.ClipboardItem
  if (clipboard?.write === undefined || ClipboardItemConstructor === undefined) {
    throw clipboardError('Image copying is not available in this browser or context.')
  }

  const supports = ClipboardItemConstructor.supports
  const canCopySource = source.type === 'image/png'
    || (typeof supports === 'function' && supports.call(ClipboardItemConstructor, source.type))
  const type = canCopySource ? source.type : 'image/png'
  const value: Blob | Promise<Blob> = canCopySource ? source : imageBlobToPng(source)
  await clipboard.write([new ClipboardItemConstructor({ [type]: value })])
}

export function clipboardFailureMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    const message = error.message.trim()
    if (message !== '') return message.slice(0, 240)
  }
  return 'The image could not be copied to the clipboard.'
}
