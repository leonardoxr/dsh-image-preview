# dsh-image-preview

This directory is an independent DeepSeek Harness plugin repository.

## Rules

- Never modify DeepSeek Harness source or import private source paths.
- Render built-in tool calls only through the public keyed `tool.call.toolview` slot.
- Load image bytes only through the owning session's public `readAttachment` API; never reread model-supplied paths or add an unauthenticated file route.
- Keep the `read_image` wire key exact; prefix every plugin-owned ID, registrant, style marker, and data attribute with `dsh-image-preview`.
- Own styles, slot registrations, and object URLs through Cordis/React lifecycle cleanup so HMR leaves no registrations or browser resources behind.
- Treat persisted tool content as untrusted and fail closed on malformed references or unsupported media types.
- Cover direct calls, nested Code Mode subcalls, failures, stale async completion, and URL revocation with tests.
- Develop code on `feat/*` or `fix/*` branches; keep `main` release-ready.
