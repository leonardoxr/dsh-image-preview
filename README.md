# dsh-image-preview

English | [简体中文](README.zh.md)

Inline image previews for the built-in DeepSeek Harness `read_image` tool.

The plugin uses DSH's public, session-scoped `tool.call.toolview` slot. Because the official tool tree dispatches nested subcalls through the same slot, one renderer covers both:

- direct `read_image` calls; and
- `tools.read_image(...)` calls nested inside `run_code` Code Mode.

Every loaded preview includes **Copy image** with visible success or failure feedback. PNG bytes are copied directly when supported; other accepted formats are converted to PNG in-browser when necessary.

## Security and lifecycle

- Bytes are fetched only through `ctx.sessions.binding(sessionId).session.readAttachment(attachmentId)`.
- The model-supplied file path is display/navigation metadata only and is never reread by the browser plugin.
- Only authenticated PNG, JPEG, WebP, and GIF attachment responses are rendered.
- Blob URLs are revoked on replacement, retry, unmount, and HMR disposal.
- Clipboard copies use the same authenticated attachment blob; bounded in-browser conversion never rereads the model-supplied path or adds a network fallback.
- Malformed/legacy results and attachment RPC failures degrade to a bounded inline error with no filesystem or network fallback.

## Settings

The plugin contributes an **Image previews** card under DSH Settings → Plugins with two live, persisted options:

- **Enable inline previews** — disabling it removes the custom renderer and restores DSH's generic tool row.
- **Open previews automatically** — when disabled, each image starts collapsed and loads only after **Show preview** is clicked.

## Development

Requires DeepSeek Harness 0.1.2-alpha.2 or compatible.

```sh
pnpm install
pnpm check
```

The package follows the official [Harness plugin guide](https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/): it exports a function-form host plugin, declares a `dsh.bundle` patch, exposes a Web client entry, declares its injected public packages, and owns explicit cleanup through lifecycle effects.

## Install into a profile

A tarball avoids git-build permissions and is robust when the checkout path contains spaces:

```sh
pnpm pack --pack-destination "$HOME/.dsh/packages"
dsh plugin --profile web add "$HOME/.dsh/packages/dsh-image-preview-0.3.3.tgz"
dsh --profile web --dump-config
```

The install command adds the package dependency and appends `dsh-image-preview` to the profile's ordered bundle list. Refresh the page after the running Web profile has loaded the new bundle; a first-time host mount requires an operator-approved Web restart.
