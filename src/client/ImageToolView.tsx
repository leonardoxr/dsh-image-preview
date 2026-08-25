import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { clipboardFailureMessage, copyImageToClipboard } from './clipboard.js'
import type { LoadedSessionImage } from './loader.js'
import {
  basename,
  formatBytes,
  imageAttachmentFrom,
  isSettledToolBlock,
  readImagePath,
  resultText,
  toolErrorSummary,
} from './model.js'

export type ImageAttachmentLoader = (attachment: ImageAttachmentRef) => Promise<LoadedSessionImage>

export type ReadImageToolViewProps = ToolCallViewProps & {
  defaultOpen: boolean
  loadImage: ImageAttachmentLoader
}

type PreviewState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'ready'; image: LoadedSessionImage }
  | { phase: 'error'; message: string }

type CopyState =
  | { phase: 'idle' }
  | { phase: 'copying' }
  | { phase: 'copied' }
  | { phase: 'error'; message: string }

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== '') return error.message.slice(0, 500)
  return 'The image attachment could not be loaded.'
}

function ImageGlyph(): JSX.Element {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M4 3.5h12A1.5 1.5 0 0 1 17.5 5v10A1.5 1.5 0 0 1 16 16.5H4A1.5 1.5 0 0 1 2.5 15V5A1.5 1.5 0 0 1 4 3.5Zm0 1A.5.5 0 0 0 3.5 5v8.2l3.1-3.1a1 1 0 0 1 1.4 0l1.7 1.7 2.8-3.3a1 1 0 0 1 1.5 0l2.5 2.9V5a.5.5 0 0 0-.5-.5H4Zm12.5 8.4-3.3-3.8-2.8 3.3 2.1 2.1H16a.5.5 0 0 0 .5-.5v-1.1Zm-5.4 1.6L7.3 10.8l-3.8 3.8v.4a.5.5 0 0 0 .5.5h7.9l-.8-1ZM6.6 6a1.4 1.4 0 1 1 0 2.8A1.4 1.4 0 0 1 6.6 6Z" fill="currentColor" />
    </svg>
  )
}

function metadata(attachment: ImageAttachmentRef): string {
  const dimensions = attachment.width + '×' + attachment.height
  return dimensions + ' · ' + formatBytes(attachment.bytes) + ' · ' + attachment.mediaType.replace('image/', '').toUpperCase()
}

export function ReadImageToolView(props: ReadImageToolViewProps): JSX.Element {
  const { block, callId, defaultOpen, loadImage, openFile, inspect } = props
  const path = useMemo(() => readImagePath(block), [block])
  const attachment = useMemo(() => imageAttachmentFrom(block), [block])
  const [attempt, setAttempt] = useState(0)
  const [open, setOpen] = useState(defaultOpen)
  const [expanded, setExpanded] = useState(false)
  const [preview, setPreview] = useState<PreviewState>({ phase: 'idle' })
  const [copyState, setCopyState] = useState<CopyState>({ phase: 'idle' })
  const copyRequestRef = useRef(0)
  const loadImageRef = useRef(loadImage)
  loadImageRef.current = loadImage
  const attachmentRef = useRef(attachment)
  attachmentRef.current = attachment
  const attachmentKey = attachment === null ? null : attachment.attachmentId
  const settled = isSettledToolBlock(block)
  const failed = settled && block.isError
  const copyIdentity = preview.phase === 'ready' ? preview.image : null

  useEffect(() => {
    setOpen(defaultOpen)
    setExpanded(false)
  }, [callId, defaultOpen])


  useEffect(() => {
    copyRequestRef.current += 1
    setCopyState({ phase: 'idle' })
  }, [attempt, attachment?.attachmentId, callId, copyIdentity, open])

  useEffect(() => () => {
    copyRequestRef.current += 1
  }, [])

  useEffect(() => {
    const currentAttachment = attachmentRef.current
    if (!open || currentAttachment === null || failed) {
      setPreview({ phase: 'idle' })
      return
    }

    let alive = true
    let release: (() => void) | undefined
    setPreview({ phase: 'loading' })
    void loadImageRef.current(currentAttachment).then((image) => {
      if (!alive) {
        image.release()
        return
      }
      release = image.release
      setPreview({ phase: 'ready', image })
    }, (error: unknown) => {
      if (alive) setPreview({ phase: 'error', message: errorMessage(error) })
    })

    return () => {
      alive = false
      release?.()
    }
  }, [attachmentKey, attempt, failed, open])

  const label = basename(path) ?? attachment?.name ?? 'image'
  const state = !settled ? 'running' : failed ? 'error' : !open ? 'closed' : preview.phase
  const recordedText = resultText(block, 500)

  const markDecodeFailure = () => {
    if (preview.phase !== 'ready') return
    preview.image.release()
    setPreview({ phase: 'error', message: 'The image bytes loaded, but this browser could not decode them.' })
  }


  const copyImage = async () => {
    if (preview.phase !== 'ready') return
    const request = copyRequestRef.current + 1
    copyRequestRef.current = request
    setCopyState({ phase: 'copying' })
    try {
      await copyImageToClipboard(preview.image.blob)
      if (copyRequestRef.current === request) setCopyState({ phase: 'copied' })
    } catch (error) {
      if (copyRequestRef.current === request) {
        setCopyState({ phase: 'error', message: clipboardFailureMessage(error) })
      }
    }
  }

  const copyStatus = copyState.phase === 'copying'
    ? 'Copying…'
    : copyState.phase === 'copied'
      ? 'Copied'
      : copyState.phase === 'error'
        ? copyState.message
        : null

  return (
    <section
      className="dsh-image-preview-root"
      data-dsh-image-preview="tool-view"
      data-state={state}
      aria-label={'Read image ' + label}
      aria-busy={state === 'running' || state === 'loading' || undefined}
    >
      <div className="dsh-image-preview-header">
        <span className="dsh-image-preview-icon"><ImageGlyph /></span>
        <span className="dsh-image-preview-title">Read image</span>
        <span className="dsh-image-preview-separator" aria-hidden="true" />
        {path !== null ? (
          <button
            type="button"
            className="dsh-image-preview-path"
            title={path}
            onClick={() => openFile(path)}
          >
            {path}
          </button>
        ) : (
          <span className="dsh-image-preview-path dsh-image-preview-path-static">{label}</span>
        )}
        {!settled && <span className="dsh-image-preview-status">Reading…</span>}
        {failed && <span className="dsh-image-preview-status dsh-image-preview-status-error">Failed</span>}
        {settled && !failed && attachment !== null && (
          <button
            type="button"
            className="dsh-image-preview-toggle"
            aria-expanded={open}
            aria-label={(open ? 'Hide' : 'Show') + ' preview of ' + label}
            onClick={() => setOpen(value => !value)}
          >
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {open ? 'Hide preview' : 'Show preview'}
          </button>
        )}
      </div>

      {!settled && (
        <div className="dsh-image-preview-loading" role="status">
          <span className="dsh-image-preview-spinner" aria-hidden="true" />
          Waiting for the image attachment…
        </div>
      )}

      {failed && (
        <div className="dsh-image-preview-message dsh-image-preview-message-error" role="alert">
          {toolErrorSummary(block)}
        </div>
      )}

      {settled && !failed && attachment === null && (
        <div className="dsh-image-preview-message" role="status">
          <strong>No preview attachment was recorded.</strong>
          {recordedText !== null && <span>{recordedText}</span>}
        </div>
      )}

      {open && settled && !failed && attachment !== null && preview.phase === 'loading' && (
        <div className="dsh-image-preview-loading" role="status">
          <span className="dsh-image-preview-spinner" aria-hidden="true" />
          Loading preview…
        </div>
      )}

      {open && settled && !failed && attachment !== null && preview.phase === 'error' && (
        <div className="dsh-image-preview-message dsh-image-preview-message-error" role="alert">
          <span>{preview.message}</span>
          <button type="button" className="dsh-image-preview-retry" onClick={() => setAttempt(value => value + 1)}>
            Retry
          </button>
        </div>
      )}

      {open && preview.phase === 'ready' && (
        <figure className="dsh-image-preview-figure" data-expanded={expanded || undefined}>
          <button
            type="button"
            className="dsh-image-preview-canvas"
            aria-label={(expanded ? 'Collapse' : 'Expand') + ' preview of ' + label}
            aria-pressed={expanded}
            onClick={() => setExpanded(value => !value)}
          >
            <img
              className="dsh-image-preview-image"
              src={preview.image.url}
              alt={'Preview of ' + label}
              loading="lazy"
              decoding="async"
              onError={markDecodeFailure}
            />
          </button>
          <figcaption className="dsh-image-preview-caption">
            <span>{metadata(preview.image.attachment)}</span>
            <span className="dsh-image-preview-caption-actions">
              {copyStatus !== null && (
                <span
                  className={'dsh-image-preview-copy-status' + (copyState.phase === 'error' ? ' dsh-image-preview-copy-status-error' : '')}
                  role={copyState.phase === 'error' ? 'alert' : 'status'}
                  aria-live={copyState.phase === 'error' ? 'assertive' : 'polite'}
                  title={copyState.phase === 'error' ? copyState.message : undefined}
                >{copyStatus}</span>
              )}
              <button
                type="button"
                className="dsh-image-preview-copy"
                disabled={copyState.phase === 'copying'}
                aria-label="Copy image"
                onClick={() => { void copyImage() }}
              >Copy image</button>
              <span>{expanded ? 'Click to collapse' : 'Click to enlarge'}</span>
            </span>
          </figcaption>
        </figure>
      )}

      {inspect !== undefined && (
        <button type="button" className="dsh-image-preview-inspect" onClick={inspect}>Inspect call</button>
      )}
    </section>
  )
}
