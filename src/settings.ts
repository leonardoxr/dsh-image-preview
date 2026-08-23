export const SETTINGS_NAMESPACE_VALUE = 'dsh-image-preview'

export interface ImagePreviewSettings {
  enabled: boolean
  defaultOpen: boolean
}

export const SETTING_KEYS = ['enabled', 'defaultOpen'] as const satisfies readonly (keyof ImagePreviewSettings)[]
export type SettingKey = (typeof SETTING_KEYS)[number]

export const DEFAULT_SETTINGS: Readonly<ImagePreviewSettings> = Object.freeze({
  enabled: true,
  defaultOpen: true,
})

export function decodeSettings(value: unknown): ImagePreviewSettings | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const record = value as Record<string, unknown>
  if (typeof record.enabled !== 'boolean' || typeof record.defaultOpen !== 'boolean') return undefined
  return { enabled: record.enabled, defaultOpen: record.defaultOpen }
}
