import { describe, expect, it, vi } from 'vitest'
import { apply, Config, SETTINGS_NAMESPACE } from '../src/index.js'

describe('host settings registration', () => {
  it('registers a live namespace with plugin configuration as its base', () => {
    const register = vi.fn()
    const config = { enabled: true, defaultOpen: false }
    apply({ settings: { register } } as never, config)
    expect(register).toHaveBeenCalledWith(SETTINGS_NAMESPACE, Config, {
      base: config,
      applies: 'live',
    })
  })
})
