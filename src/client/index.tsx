import type { ClientContext, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-tool/client'
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'
import { ReadImageToolView } from './ImageToolView.js'
import { loadSessionImage } from './loader.js'
import { STYLE_ID, styles } from './styles.js'

export const PLUGIN_ID = 'dsh-image-preview'
export const inject = ['slots', 'sessions'] as const

export function installStyles(): () => void {
  document.querySelector('style[data-plugin-css="' + STYLE_ID + '"]')?.remove()
  const tag = document.createElement('style')
  tag.dataset.plugin = PLUGIN_ID
  tag.dataset.pluginCss = STYLE_ID
  tag.textContent = styles
  document.head.append(tag)
  return () => tag.remove()
}

export function apply(ctx: ClientContext): void {
  ctx.effect(installStyles, 'dsh-image-preview: styles')
  ctx.effect(() => ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({
    name: 'tool.call.toolview',
    key: 'read_image',
    registrant: PLUGIN_ID,
    inject: (sessionId: SessionId) => ({
      loadImage: (attachment: ImageAttachmentRef) => loadSessionImage(ctx, sessionId, attachment),
    }),
  }, ReadImageToolView)), 'dsh-image-preview: read_image tool view')
}
