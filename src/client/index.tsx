import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-api-remotes/client'
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type {} from '@deepseek-ai/dsh-client-ui-tool/client'
import {
  DEFAULT_SETTINGS,
  SETTINGS_NAMESPACE_VALUE,
  decodeSettings,
  type ImagePreviewSettings,
} from '../settings.js'
import { ReadImageToolView } from './ImageToolView.js'
import { loadSessionImage } from './loader.js'
import { ImagePreviewSettingsCard } from './SettingsCard.js'
import { STYLE_ID, styles } from './styles.js'

export const PLUGIN_ID = 'dsh-image-preview'
export const inject = ['slots', 'sessions', 'settingsScope'] as const

type ImagePreviewClientContext = ClientContext & { sessions: ISessions }

export function installStyles(): () => void {
  document.querySelector('style[data-plugin-css="' + STYLE_ID + '"]')?.remove()
  const tag = document.createElement('style')
  tag.dataset.plugin = PLUGIN_ID
  tag.dataset.pluginCss = STYLE_ID
  tag.textContent = styles
  document.head.append(tag)
  return () => tag.remove()
}

export function registerPreviewToolView(
  ctx: Pick<ImagePreviewClientContext, 'sessions' | 'slots'>,
  settings: SettingsScope<ImagePreviewSettings>,
): () => void {
  let disposeView: (() => void) | undefined
  let registeredDefaultOpen: boolean | undefined

  const reconcile = () => {
    const value = settings.getSnapshot().value ?? DEFAULT_SETTINGS
    if (!value.enabled) {
      disposeView?.()
      disposeView = undefined
      registeredDefaultOpen = undefined
      return
    }
    if (disposeView !== undefined && registeredDefaultOpen === value.defaultOpen) return

    disposeView?.()
    registeredDefaultOpen = value.defaultOpen
    disposeView = ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({
      name: 'tool.call.toolview',
      key: 'read_image',
      registrant: PLUGIN_ID,
      inject: (sessionId: SessionId) => ({
        defaultOpen: value.defaultOpen,
        loadImage: (attachment: ImageAttachmentRef) => loadSessionImage(ctx, sessionId, attachment),
      }),
    }, ReadImageToolView))
  }

  const unsubscribe = settings.subscribe(reconcile)
  reconcile()
  return () => {
    unsubscribe()
    disposeView?.()
  }
}

export function apply(ctx: ImagePreviewClientContext): void {
  ctx.effect(installStyles, 'dsh-image-preview: styles')
  const settings = ctx.settingsScope.bind<ImagePreviewSettings>({
    namespace: SETTINGS_NAMESPACE_VALUE,
    decode: decodeSettings,
  }) as SettingsScope<ImagePreviewSettings>

  ctx.effect(() => ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
    name: 'settings.plugin.item',
    key: SETTINGS_NAMESPACE_VALUE,
    registrant: PLUGIN_ID,
    inject: () => ({ settings }),
  }, ImagePreviewSettingsCard)), 'dsh-image-preview: settings card')

  ctx.effect(
    () => registerPreviewToolView(ctx, settings),
    'dsh-image-preview: read_image tool view',
  )
}
