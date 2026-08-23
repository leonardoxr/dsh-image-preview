import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import { useState, useSyncExternalStore } from 'react'
import {
  DEFAULT_SETTINGS,
  SETTING_KEYS,
  type ImagePreviewSettings,
  type SettingKey,
} from '../settings.js'

export interface ImagePreviewSettingsCardProps {
  settings: SettingsScope<ImagePreviewSettings>
}

type Notice = { kind: 'success' | 'error'; text: string } | undefined

function ToggleRow({
  checked,
  description,
  disabled,
  label,
  onChange,
}: {
  checked: boolean
  description: string
  disabled: boolean
  label: string
  onChange(value: boolean): void
}) {
  return <label className="dsh-image-preview-settings-row" data-disabled={disabled || undefined}>
    <span className="dsh-image-preview-settings-copy">
      <span className="dsh-image-preview-settings-label">{label}</span>
      <span className="dsh-image-preview-settings-hint">{description}</span>
    </span>
    <span className="dsh-image-preview-settings-toggle">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={event => onChange(event.currentTarget.checked)}
      />
      <span className="dsh-image-preview-settings-switch" aria-hidden="true" />
    </span>
  </label>
}

export function ImagePreviewSettingsCard({ settings }: ImagePreviewSettingsCardProps): JSX.Element {
  const snapshot = useSyncExternalStore(
    listener => settings.subscribe(listener),
    () => settings.getSnapshot(),
    () => settings.getSnapshot(),
  )
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<SettingKey | 'reset'>()
  const [notice, setNotice] = useState<Notice>()
  const value = snapshot.value ?? DEFAULT_SETTINGS
  const writable = snapshot.status === 'ready' && snapshot.writable

  const update = async (key: SettingKey, next: boolean) => {
    setBusy(key)
    setNotice(undefined)
    try {
      await settings.set(key, next)
      setNotice({ kind: 'success', text: 'Saved. Conversation previews updated immediately.' })
    } catch (cause) {
      setNotice({ kind: 'error', text: cause instanceof Error ? cause.message : String(cause) })
    } finally {
      setBusy(undefined)
    }
  }

  const reset = async () => {
    setBusy('reset')
    setNotice(undefined)
    try {
      for (const key of SETTING_KEYS) await settings.unset(key)
      setNotice({ kind: 'success', text: 'Restored the default image preview behavior.' })
    } catch (cause) {
      setNotice({ kind: 'error', text: cause instanceof Error ? cause.message : String(cause) })
    } finally {
      setBusy(undefined)
    }
  }

  const statusText = notice?.text
    ?? (snapshot.status === 'loading'
      ? 'Loading settings…'
      : snapshot.status === 'ready'
        ? (snapshot.writable ? 'Changes apply immediately.' : 'Settings are read-only in this runtime.')
        : 'The image preview settings namespace is unavailable.')

  return <li
    className="dsh-image-preview-settings-card"
    data-dsh-image-preview-settings="card"
    data-open={open || undefined}
  >
    <button
      type="button"
      className="dsh-image-preview-settings-header"
      aria-expanded={open}
      onClick={() => setOpen(current => !current)}
    >
      <span className="dsh-image-preview-settings-heading">
        <span className="dsh-image-preview-settings-title">Image previews</span>
        <span className="dsh-image-preview-settings-description">Control inline previews for direct and Code Mode read_image calls.</span>
      </span>
      <svg className="dsh-image-preview-settings-chevron" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
    {open && <div className="dsh-image-preview-settings-body">
      <ToggleRow
        checked={value.enabled}
        disabled={!writable || busy !== undefined}
        label="Enable inline previews"
        description="Replace the generic read_image result row with the secure inline image renderer."
        onChange={next => { void update('enabled', next) }}
      />
      <ToggleRow
        checked={value.defaultOpen}
        disabled={!writable || busy !== undefined}
        label="Open previews automatically"
        description="When off, previews stay collapsed until you click Show preview."
        onChange={next => { void update('defaultOpen', next) }}
      />
      <div className="dsh-image-preview-settings-footer">
        <span
          className="dsh-image-preview-settings-status"
          data-kind={notice?.kind}
          role={notice?.kind === 'error' ? 'alert' : 'status'}
          aria-live={notice?.kind === 'error' ? 'assertive' : 'polite'}
        >{statusText}</span>
        <button
          type="button"
          className="dsh-image-preview-settings-reset"
          disabled={!writable || busy !== undefined}
          onClick={() => { void reset() }}
        >Restore defaults</button>
      </div>
    </div>}
  </li>
}
