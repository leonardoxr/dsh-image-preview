import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-settings'
import Schema from '@deepseek-ai/schemastery'
import { DEFAULT_SETTINGS, SETTINGS_NAMESPACE_VALUE, type ImagePreviewSettings } from './settings.js'

export const name = 'dsh-image-preview'
export const inject = ['settings'] as const
export const SETTINGS_NAMESPACE = SETTINGS_NAMESPACE_VALUE

export type Config = ImagePreviewSettings

export const Config: Schema<Config> = Schema.object({
  enabled: Schema.boolean().default(DEFAULT_SETTINGS.enabled),
  defaultOpen: Schema.boolean().default(DEFAULT_SETTINGS.defaultOpen),
})

export function apply(ctx: Context, config: Config): void {
  ctx.settings.register(SETTINGS_NAMESPACE, Config, {
    base: config,
    applies: 'live',
  })
}
