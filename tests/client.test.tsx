import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ReadImageToolView } from '../src/client/ImageToolView.js'
import { apply, PLUGIN_ID } from '../src/client/index.js'
import type { LoadedSessionImage } from '../src/client/loader.js'
import { ImagePreviewSettingsCard } from '../src/client/SettingsCard.js'
import type { ImagePreviewSettings } from '../src/settings.js'
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

function mount(element: React.ReactNode) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const item: Mounted = { container, root, disposed: false }
  mounted.push(item)
  act(() => root.render(element))
  return {
    container,
    rerender(next: React.ReactNode) {
      act(() => root.render(next))
    },
    async dispose() {
      if (item.disposed) return
      item.disposed = true
      await act(async () => root.unmount())
      container.remove()
    },
  }
}

function mountView(
  block: ReturnType<typeof settledImage> | ReturnType<typeof runningImage>,
  loadImage: (attachment: typeof imageAttachment) => Promise<LoadedSessionImage>,
  defaultOpen = true,
) {
  const openFile = vi.fn()
  const inspect = vi.fn()
  return {
    ...mount(<ReadImageToolView {...({
      block,
      callId: block.callId,
      toolName: 'read_image',
      defaultOpen,
      loadImage,
      openFile,
      inspect,
    } as never)} />),
    openFile,
    inspect,
  }
}

function createSettings(initial: ImagePreviewSettings = { enabled: true, defaultOpen: true }) {
  let value = initial
  let snapshot = { status: 'ready', writable: true, value } as const
  const listeners = new Set<() => void>()
  const publish = () => {
    snapshot = { status: 'ready', writable: true, value }
    listeners.forEach(listener => listener())
  }
  const scope = {
    getSnapshot: vi.fn(() => snapshot),
    subscribe: vi.fn((listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }),
    set: vi.fn(async (key: keyof ImagePreviewSettings, next: boolean) => {
      value = { ...value, [key]: next }
      publish()
    }),
    unset: vi.fn(async (key: keyof ImagePreviewSettings) => {
      const defaults: ImagePreviewSettings = { enabled: true, defaultOpen: true }
      value = { ...value, [key]: defaults[key] }
      publish()
    }),
  } as unknown as SettingsScope<ImagePreviewSettings>
  return { scope, current: () => value }
}

describe('client registration', () => {
  it('keeps the Settings card mounted and reacts live to both settings', async () => {
    const registrations: Array<{
      name: string
      descriptor: Record<string, unknown>
      component: unknown
      active: boolean
    }> = []
    const cleanups: Array<() => void> = []
    const settings = createSettings()
    const ctx = {
      effect(effect: () => void | (() => void)) {
        const cleanup = effect()
        if (typeof cleanup === 'function') cleanups.push(cleanup)
      },
      settingsScope: { bind: vi.fn(() => settings.scope) },
      sessions: { binding: vi.fn() },
      slots: {
        inject: (name: string, register: () => unknown) => {
          const cleanup = register()
          return typeof cleanup === 'function' ? cleanup : () => {}
        },
        register: (descriptor: Record<string, unknown>, component: unknown) => {
          const entry = { name: String(descriptor.name), descriptor, component, active: true }
          registrations.push(entry)
          return () => { entry.active = false }
        },
      },
    }

    apply(ctx as never)
    const active = (name: string) => registrations.filter(entry => entry.name === name && entry.active)
    expect(active('settings.plugin.item')).toHaveLength(1)
    expect(active('settings.plugin.item')[0]?.descriptor).toMatchObject({
      key: 'dsh-image-preview',
      registrant: PLUGIN_ID,
    })
    expect(active('tool.call.toolview')).toHaveLength(1)

    await settings.scope.set('enabled', false)
    expect(active('settings.plugin.item')).toHaveLength(1)
    expect(active('tool.call.toolview')).toHaveLength(0)

    await settings.scope.set('defaultOpen', false)
    await settings.scope.set('enabled', true)
    const tool = active('tool.call.toolview')[0]
    expect(tool?.descriptor).toMatchObject({ key: 'read_image', registrant: PLUGIN_ID })
    const injected = (tool?.descriptor.inject as (sessionId: string) => { defaultOpen: boolean })('session-1')
    expect(injected.defaultOpen).toBe(false)

    cleanups.reverse().forEach(cleanup => cleanup())
    expect(active('settings.plugin.item')).toHaveLength(0)
    expect(active('tool.call.toolview')).toHaveLength(0)
    expect(document.head.querySelector('style[data-plugin-css="dsh-image-preview/styles"]')).toBeNull()
  })
})

describe('ImagePreviewSettingsCard', () => {
  it('renders both persisted options and saves changes immediately', async () => {
    const settings = createSettings()
    const view = mount(<ImagePreviewSettingsCard settings={settings.scope} />)
    act(() => view.container.querySelector<HTMLButtonElement>('.dsh-image-preview-settings-header')?.click())

    const inputs = view.container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
    expect(inputs).toHaveLength(2)
    expect(Array.from(inputs, input => input.checked)).toEqual([true, true])

    await act(async () => {
      inputs[1]?.click()
      await Promise.resolve()
    })
    expect(settings.scope.set).toHaveBeenCalledWith('defaultOpen', false)
    expect(settings.current().defaultOpen).toBe(false)
  })
})

describe('ReadImageToolView', () => {
  it('renders a visible inline preview, metadata, navigation, expansion, and cleanup', async () => {
    const release = vi.fn()
    const loadImage = vi.fn(async () => ({ url: 'blob:inline-preview', blob: new Blob([1], { type: 'image/png' }), attachment: imageAttachment, release }))
    const view = mountView(settledImage(), loadImage)

    await act(async () => { await Promise.resolve() })
    const image = view.container.querySelector<HTMLImageElement>('img.dsh-image-preview-image')
    expect(image?.src).toContain('blob:inline-preview')
    expect(view.container.textContent).toContain('640×360 · 2.0 KB · PNG')
    expect(view.container.querySelector<HTMLButtonElement>('.dsh-image-preview-copy')?.textContent).toBe('Copy image')
    expect(view.container.querySelector('[data-dsh-image-preview="tool-view"]')).not.toBeNull()

    act(() => view.container.querySelector<HTMLButtonElement>('.dsh-image-preview-path')?.click())
    expect(view.openFile).toHaveBeenCalledWith('C:/workspace/preview.png')

    const canvas = view.container.querySelector<HTMLButtonElement>('.dsh-image-preview-canvas')
    act(() => canvas?.click())
    expect(canvas?.getAttribute('aria-pressed')).toBe('true')

    await view.dispose()
    expect(release).toHaveBeenCalledOnce()
  })

  it('copies the authenticated preview blob and reports success', async () => {
    const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    const originalClipboardItem = Object.getOwnPropertyDescriptor(globalThis, 'ClipboardItem')
    const write = vi.fn(async () => undefined)
    class TestClipboardItem {
      static supports() { return true }
      constructor(readonly payload: Record<string, Blob | Promise<Blob>>) {}
    }
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write } })
    Object.defineProperty(globalThis, 'ClipboardItem', { configurable: true, value: TestClipboardItem })
    const blob = new Blob([1], { type: 'image/png' })
    const view = mountView(settledImage(), vi.fn(async () => ({ url: 'blob:copy-preview', blob, attachment: imageAttachment, release: vi.fn() })))

    try {
      await act(async () => { await Promise.resolve() })
      await act(async () => {
        view.container.querySelector<HTMLButtonElement>('.dsh-image-preview-copy')?.click()
        await Promise.resolve()
      })
      expect(write).toHaveBeenCalledOnce()
      expect(view.container.querySelector<HTMLButtonElement>('.dsh-image-preview-copy')?.textContent).toBe('Copy image')
      expect(view.container.querySelector('.dsh-image-preview-copy-status')?.textContent).toBe('Copied')
    } finally {
      await view.dispose()
      if (originalClipboard === undefined) delete (navigator as { clipboard?: Clipboard }).clipboard
      else Object.defineProperty(navigator, 'clipboard', originalClipboard)
      if (originalClipboardItem === undefined) delete (globalThis as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem
      else Object.defineProperty(globalThis, 'ClipboardItem', originalClipboardItem)
    }
  })

  it('keeps the Copy image action stable when clipboard permission is denied', async () => {
    const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    const originalClipboardItem = Object.getOwnPropertyDescriptor(globalThis, 'ClipboardItem')
    const write = vi.fn(async () => { throw new DOMException('Clipboard permission denied', 'NotAllowedError') })
    class TestClipboardItem {
      static supports() { return true }
      constructor(readonly payload: Record<string, Blob | Promise<Blob>>) {}
    }
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write } })
    Object.defineProperty(globalThis, 'ClipboardItem', { configurable: true, value: TestClipboardItem })
    const view = mountView(settledImage(), vi.fn(async () => ({
      url: 'blob:copy-denied',
      blob: new Blob([1], { type: 'image/png' }),
      attachment: imageAttachment,
      release: vi.fn(),
    })))

    try {
      await act(async () => { await Promise.resolve() })
      await act(async () => {
        view.container.querySelector<HTMLButtonElement>('.dsh-image-preview-copy')?.click()
        await Promise.resolve()
      })
      expect(view.container.querySelector<HTMLButtonElement>('.dsh-image-preview-copy')?.textContent).toBe('Copy image')
      expect(view.container.querySelector('[role="alert"]')?.textContent).toContain('Clipboard permission denied')
    } finally {
      await view.dispose()
      if (originalClipboard === undefined) delete (navigator as { clipboard?: Clipboard }).clipboard
      else Object.defineProperty(navigator, 'clipboard', originalClipboard)
      if (originalClipboardItem === undefined) delete (globalThis as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem
      else Object.defineProperty(globalThis, 'ClipboardItem', originalClipboardItem)
    }
  })

  it('does not apply a pending copy result after attachment replacement', async () => {
    const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    const originalClipboardItem = Object.getOwnPropertyDescriptor(globalThis, 'ClipboardItem')
    let finishWrite: (() => void) | undefined
    const write = vi.fn(() => new Promise<void>(resolve => { finishWrite = resolve }))
    class TestClipboardItem {
      static supports() { return true }
      constructor(readonly payload: Record<string, Blob | Promise<Blob>>) {}
    }
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write } })
    Object.defineProperty(globalThis, 'ClipboardItem', { configurable: true, value: TestClipboardItem })

    const replacement = { ...imageAttachment, attachmentId: 'sha256:replacement', name: 'replacement.png' }
    const firstBlock = settledImage()
    const secondBlock = settledImage({
      content: [
        { type: 'text', text: '<image path="C:/workspace/replacement.png" />' },
        { type: 'image', attachment: replacement },
      ],
    })
    const loadImage = vi.fn(async (attachment: typeof imageAttachment) => ({
      url: 'blob:' + attachment.attachmentId,
      blob: new Blob([attachment.attachmentId], { type: 'image/png' }),
      attachment,
      release: vi.fn(),
    }))
    const props = (block: typeof firstBlock) => ({
      block,
      callId: block.callId,
      toolName: 'read_image',
      defaultOpen: true,
      loadImage,
      openFile: vi.fn(),
      inspect: vi.fn(),
    })
    const view = mount(<ReadImageToolView {...(props(firstBlock) as never)} />)

    try {
      await act(async () => { await Promise.resolve() })
      act(() => view.container.querySelector<HTMLButtonElement>('.dsh-image-preview-copy')?.click())
      expect(view.container.querySelector('.dsh-image-preview-copy-status')?.textContent).toBe('Copying…')

      view.rerender(<ReadImageToolView {...(props(secondBlock) as never)} />)
      await act(async () => { await Promise.resolve() })
      expect(view.container.querySelector<HTMLImageElement>('img')?.src).toContain('blob:sha256:replacement')
      expect(view.container.querySelector('.dsh-image-preview-copy-status')).toBeNull()

      await act(async () => {
        finishWrite?.()
        await Promise.resolve()
      })
      expect(view.container.querySelector('.dsh-image-preview-copy-status')).toBeNull()
    } finally {
      await view.dispose()
      if (originalClipboard === undefined) delete (navigator as { clipboard?: Clipboard }).clipboard
      else Object.defineProperty(navigator, 'clipboard', originalClipboard)
      if (originalClipboardItem === undefined) delete (globalThis as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem
      else Object.defineProperty(globalThis, 'ClipboardItem', originalClipboardItem)
    }
  })

  it('stays closed without fetching until clicked when defaultOpen is off', async () => {
    const release = vi.fn()
    const loadImage = vi.fn(async () => ({ url: 'blob:opened-on-demand', blob: new Blob([1], { type: 'image/png' }), attachment: imageAttachment, release }))
    const view = mountView(settledImage(), loadImage, false)

    expect(loadImage).not.toHaveBeenCalled()
    expect(view.container.querySelector('img')).toBeNull()
    const toggle = view.container.querySelector<HTMLButtonElement>('.dsh-image-preview-toggle')
    expect(toggle?.textContent).toContain('Show preview')

    await act(async () => {
      toggle?.click()
      await Promise.resolve()
    })
    expect(loadImage).toHaveBeenCalledOnce()
    expect(view.container.querySelector<HTMLImageElement>('img')?.src).toContain('blob:opened-on-demand')

    await act(async () => toggle?.click())
    expect(view.container.querySelector('img')).toBeNull()
    expect(release).toHaveBeenCalledOnce()
  })

  it('renders the same inline preview for the nested read_image child of run_code', async () => {
    const nested = runCodeWithNestedImage().subCalls[0]
    if (nested === undefined || !('kind' in nested)) throw new Error('nested fixture missing')
    const loadImage = vi.fn(async () => ({ url: 'blob:nested-preview', blob: new Blob([1], { type: 'image/png' }), attachment: imageAttachment, release: vi.fn() }))
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
      .mockResolvedValueOnce({ url: 'blob:retried', blob: new Blob([1], { type: 'image/png' }), attachment: imageAttachment, release: vi.fn() })
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
      resolveImage?.({ url: 'blob:stale', blob: new Blob([1], { type: 'image/png' }), attachment: imageAttachment, release })
      await Promise.resolve()
    })
    expect(release).toHaveBeenCalledOnce()
  })

  it('keeps the loaded preview when the same attachment re-renders through a fresh block and loader', async () => {
    const release = vi.fn()
    const firstLoad = vi.fn(async () => ({ url: 'blob:stable', blob: new Blob([1], { type: 'image/png' }), attachment: imageAttachment, release }))
    const render = (block: ReturnType<typeof settledImage>, loadImage: typeof firstLoad) => (
      <ReadImageToolView {...({
        block,
        callId: block.callId,
        toolName: 'read_image',
        defaultOpen: true,
        loadImage,
        openFile: vi.fn(),
        inspect: vi.fn(),
      } as never)} />
    )
    const view = mount(render(settledImage(), firstLoad))

    await act(async () => { await Promise.resolve() })
    expect(view.container.querySelector<HTMLImageElement>('img')?.src).toContain('blob:stable')
    expect(firstLoad).toHaveBeenCalledOnce()

    // The conversation re-renders the same call with a fresh block object and a fresh loader
    // closure on every snapshot tick. The preview must NOT revoke and refetch the attachment.
    const secondLoad = vi.fn(async () => ({ url: 'blob:stable-2', blob: new Blob([1], { type: 'image/png' }), attachment: imageAttachment, release }))
    view.rerender(render(settledImage(), secondLoad))
    await act(async () => { await Promise.resolve() })

    expect(secondLoad).not.toHaveBeenCalled()
    expect(firstLoad).toHaveBeenCalledOnce()
    expect(view.container.querySelector<HTMLImageElement>('img')?.src).toContain('blob:stable')
    expect(release).not.toHaveBeenCalled()
  })
})
