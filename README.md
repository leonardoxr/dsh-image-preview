# dsh-image-preview

Inline image previews for the built-in DeepSeek Harness `read_image` tool.

The plugin uses DSH's public, session-scoped `tool.call.toolview` slot. Because the official tool tree dispatches nested subcalls through the same slot, one renderer covers both:

- direct `read_image` calls; and
- `tools.read_image(...)` calls nested inside `run_code` Code Mode.

## Security and lifecycle

- Bytes are fetched only through `ctx.sessions.binding(sessionId).session.readAttachment(attachmentId)`.
- The model-supplied file path is display/navigation metadata only and is never reread by the browser plugin.
- Only authenticated PNG, JPEG, WebP, and GIF attachment responses are rendered.
- Blob URLs are revoked on replacement, retry, unmount, and HMR disposal.
- Malformed/legacy results and attachment RPC failures degrade to a bounded inline error with no filesystem or network fallback.

## Development

```sh
pnpm install
pnpm check
```

The package follows the official [Harness plugin guide](https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/): it exports a function-form host plugin, declares a `dsh.bundle` patch, exposes a Web client entry, declares its injected public packages, and owns explicit cleanup through lifecycle effects.

## Install into a profile

A tarball avoids git-build permissions and is robust when the checkout path contains spaces:

```sh
pnpm pack --pack-destination "$HOME/.dsh/packages"
dsh plugin --profile web add "$HOME/.dsh/packages/dsh-image-preview-0.1.0.tgz"
dsh --profile web --dump-config
```

The install command adds the package dependency and appends `dsh-image-preview` to the profile's ordered bundle list. Refresh the page after the running Web profile has loaded the new bundle; a first-time host mount requires an operator-approved Web restart.
