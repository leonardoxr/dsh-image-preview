import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, decodeSettings } from '../src/settings.js'

describe('image preview settings', () => {
  it('defaults to enabled and automatically open', () => {
    expect(DEFAULT_SETTINGS).toEqual({ enabled: true, defaultOpen: true })
  })

  it('decodes only complete boolean settings documents', () => {
    expect(decodeSettings({ enabled: false, defaultOpen: false })).toEqual({ enabled: false, defaultOpen: false })
    expect(decodeSettings({ enabled: true })).toBeUndefined()
    expect(decodeSettings({ enabled: 'yes', defaultOpen: true })).toBeUndefined()
    expect(decodeSettings(null)).toBeUndefined()
  })
})
