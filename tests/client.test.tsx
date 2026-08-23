import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ReadImageToolView } from '../src/client/ImageToolView.js'
import { apply, PLUGIN_ID } from '../src/client/index.js'
import type { LoadedSessionImage } from '../src/client/loader.js'
import { imageAttachment, runCodeWithNestedImage, runningImage, settledImage } from './fixtures.js'

interface Mounted {
  container: HTMLDivElement
  root: Root
  disposed: boolean
}

const mounted: Mounted[] = []
globalThis.IS_REACT_ACT_ENVIRONMENT = true

afterEach(() => {
  for (const item of mounted.splice(0)) {
    if (!item.disposed) act(() => item.root.unmount())
    item.container.remove()
  }
  document.head.querySelectorAll('style[data-plugin="dsh-image-preview"]').forEach(node => node.remove())
})

function mountView(block: ReturnType<typeof settledImage> | ReturnType<typeof runningImage>, loadImage: (attachment: typeof imageAttachment) => Promise<LoadedSessionImage>) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const item: Mounted = { container, root, disposed: false }
  mounted.push(item)
  const openFile = vi.fn()
  const inspect = vi.fn()
  act(() => {
    root.render(<ReadImageToolView {...({
      block,
      callId: block.callId,
      toolName: 'read_image',
      loadImage,
      openFile,
      inspect,
    } as never)} />)
  })
  return {
    container,
    openFile,
    inspect,
    async dispose() {
      if (item.disposed) return
      item.disposed = true
      await act(async () => root.unmount())
      container.remove()
    },
  }
}

describe('client registration', () => {
  it('registers one lifecycle-owned read_image view and package-owned styles', () => {
    const registrations: Array<{ descriptor: Record<string, unknown>; component: unknown; active: boolean }> = []
    const cleanups: Array<() => void> = []
    const ctx = {
      effect(effect: () => void | (() => void)) {
        const cleanup = effect()
        if (typeof cleanup === 'function') cleanups.push(cleanup)
      },
      sessions: { binding: vi.fn() },
      slots: {
        inject: (name: string, register: () => unknown) => {
          expect(name).toBe('tool.call.toolview')
          const cleanup = register()
          return typeof cleanup === 'function' ? cleanup : () => {}
        },
        register: (descriptor: Record<string, unknown>, component: unknown) => {
          const entry = { descriptor, component, active: true }
          registrations.push(entry)
          return () => { entry.active = false }
        },
      },
    }

    apply(ctx as never)
    expect(registrations).toHaveLength(1)
    expect(registrations[0]?.descriptor).toMatchObject({
      name: 'tool.call.toolview',
      key: 'read_image',
      registrant: PLUGIN_ID,
    })
    expect(typeof registrations[0]?.descriptor.inject).toBe('function')
    expect(document.head.querySelector('style[data-plugin-css="dsh-image-preview/styles"]')).not.toBeNull()

    cleanups.reverse().forEach(cleanup => cleanup())
    expect(registrations[0]?.active).toBe(false)
    expect(document.head.querySelector('style[data-plugin-css="dsh-image-preview/styles"]')).toBeNull()
  })
})

describe('ReadImageToolView', () => {
  it('renders a visible inline preview, metadata, navigation, expansion, and cleanup', async () => {
    const release = vi.fn()
    const loadImage = vi.fn(async () => ({ url: 'blob:inline-preview', attachment: imageAttachment, release }))
    const view = mountView(settledImage(), loadImage)

    await act(async () => { await Promise.resolve() })
    const image = view.container.querySelector<HTMLImageElement>('img.dsh-image-preview-image')
    expect(image?.src).toContain('blob:inline-preview')
    expect(view.container.textContent).toContain('640×360 · 2.0 KB · PNG')
    expect(view.container.querySelector('[data-dsh-image-preview="tool-view"]')).not.toBeNull()

    act(() => view.container.querySelector<HTMLButtonElement>('.dsh-image-preview-path')?.click())
    expect(view.openFile).toHaveBeenCalledWith('C:/workspace/preview.png')

    const canvas = view.container.querySelector<HTMLButtonElement>('.dsh-image-preview-canvas')
    act(() => canvas?.click())
    expect(canvas?.getAttribute('aria-pressed')).toBe('true')

    await view.dispose()
    expect(release).toHaveBeenCalledOnce()
  })

  it('renders the same inline preview for the nested read_image child of run_code', async () => {
    const nested = runCodeWithNestedImage().subCalls[0]
    if (nested === undefined || !('kind' in nested)) throw new Error('nested fixture missing')
    const loadImage = vi.fn(async () => ({ url: 'blob:nested-preview', attachment: imageAttachment, release: vi.fn() }))
    const view = mountView(nested, loadImage)

    await act(async () => { await Promise.resolve() })
    expect(view.container.querySelector<HTMLImageElement>('img')?.src).toContain('blob:nested-preview')
    expect(loadImage).toHaveBeenCalledWith(imageAttachment)
  })

  it('does not request bytes for running, failed, or legacy text-only blocks', async () => {
    const loadImage = vi.fn()
    const running = mountView(runningImage(), loadImage)
    expect(running.container.textContent).toContain('Waiting for the image attachment')
    expect(loadImage).not.toHaveBeenCalled()
    await running.dispose()

    const failed = mountView(settledImage({ isError: true, content: [{ type: 'text', text: 'Error: denied' }] }), loadImage)
    expect(failed.container.getAttribute('role')).not.toBe('alert')
    expect(failed.container.textContent).toContain('Error: denied')
    expect(loadImage).not.toHaveBeenCalled()
    await failed.dispose()

    const legacy = mountView(settledImage({ content: [{ type: 'text', text: 'legacy image result' }] }), loadImage)
    expect(legacy.container.textContent).toContain('No preview attachment was recorded')
    expect(loadImage).not.toHaveBeenCalled()
  })

  it('offers retry after an attachment failure', async () => {
    const loadImage = vi.fn()
      .mockRejectedValueOnce(new Error('Attachment missing'))
      .mockResolvedValueOnce({ url: 'blob:retried', attachment: imageAttachment, release: vi.fn() })
    const view = mountView(settledImage(), loadImage)

    await act(async () => { await Promise.resolve() })
    expect(view.container.textContent).toContain('Attachment missing')
    await act(async () => {
      view.container.querySelector<HTMLButtonElement>('.dsh-image-preview-retry')?.click()
      await Promise.resolve()
    })
    expect(view.container.querySelector<HTMLImageElement>('img')?.src).toContain('blob:retried')
    expect(loadImage).toHaveBeenCalledTimes(2)
  })

  it('releases a stale image that resolves after unmount', async () => {
    let resolveImage: ((value: LoadedSessionImage) => void) | undefined
    const loadImage = vi.fn(() => new Promise<LoadedSessionImage>((resolve) => { resolveImage = resolve }))
    const release = vi.fn()
    const view = mountView(settledImage(), loadImage)
    await view.dispose()

    await act(async () => {
      resolveImage?.({ url: 'blob:stale', attachment: imageAttachment, release })
      await Promise.resolve()
    })
    expect(release).toHaveBeenCalledOnce()
  })
})
