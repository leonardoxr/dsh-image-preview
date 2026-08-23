import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'
import type { RunningToolCall, ToolResultNode } from '@deepseek-ai/dsh-client-runtime/client'

export const imageAttachment = {
  attachmentId: 'sha256:test-image',
  mediaType: 'image/png',
  bytes: 2_048,
  width: 640,
  height: 360,
  name: 'preview.png',
} as ImageAttachmentRef

export function runningImage(argsRaw = JSON.stringify({ file_path: 'C:/workspace/preview.png' })): RunningToolCall {
  return {
    callId: 'call-image',
    name: 'read_image',
    argsRaw,
    turn: 1,
    step: 1,
    time: 1,
    callView: null,
    subCalls: [],
  }
}

export function settledImage(overrides: Partial<ToolResultNode> = {}): ToolResultNode {
  return {
    kind: 'tool-result',
    seq: 2,
    time: 2,
    callId: 'call-image',
    call: { name: 'read_image', argsRaw: JSON.stringify({ file_path: 'C:/workspace/preview.png' }) },
    callTime: 1,
    content: [
      { type: 'text', text: '<image path="C:/workspace/preview.png" />' },
      { type: 'image', attachment: imageAttachment },
    ],
    isError: false,
    callView: null,
    resultView: null,
    subCalls: [],
    ...overrides,
  }
}

export function runCodeWithNestedImage(child = settledImage()): ToolResultNode {
  return {
    kind: 'tool-result',
    seq: 3,
    time: 3,
    callId: 'call-code',
    call: { name: 'run_code', argsRaw: JSON.stringify({ code: 'await tools.read_image(...)' }) },
    callTime: 1,
    content: [{ type: 'text', text: 'done' }],
    isError: false,
    callView: null,
    resultView: null,
    subCalls: [child],
  }
}
