export const STYLE_ID = 'dsh-image-preview/styles'

export const styles = `
.dsh-image-preview-root{box-sizing:border-box;display:flex;min-width:0;flex-direction:column;margin:2px 0;color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px}
.dsh-image-preview-header{position:relative;display:flex;min-width:0;min-height:32px;align-items:center;padding:4px 4px;overflow:hidden}
.dsh-image-preview-root[data-state=running] .dsh-image-preview-header::after{content:'';position:absolute;inset:0 auto 0 -240px;width:240px;pointer-events:none;background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--dsw-alias-bg-base) 60%,transparent),transparent);animation:dsh-image-preview-sweep 2.6s ease-out infinite}
@keyframes dsh-image-preview-sweep{0%{left:-240px}90%,100%{left:100%}}
.dsh-image-preview-icon{display:inline-flex;width:16px;height:16px;flex:none;align-items:center;justify-content:center;color:var(--dsw-alias-label-secondary)}
.dsh-image-preview-title{margin-left:8px;white-space:nowrap;font-size:14px;line-height:24px}
.dsh-image-preview-separator{width:2px;height:2px;flex:none;margin:0 8px;border-radius:50%;background:var(--dsw-alias-label-caption)}
.dsh-image-preview-path{appearance:none;min-width:0;flex:1;overflow:hidden;border:0;background:transparent;padding:0;color:var(--dsw-alias-label-secondary);font:inherit;font-size:14px;line-height:24px;text-align:left;text-decoration:underline;text-decoration-color:var(--dsw-alias-label-quaternary);text-overflow:ellipsis;white-space:nowrap;cursor:pointer}
.dsh-image-preview-path:hover{color:var(--dsw-alias-label-primary);text-decoration-color:currentColor}
.dsh-image-preview-path-static{text-decoration:none;cursor:default;color:var(--dsw-alias-label-tertiary)}
.dsh-image-preview-status{flex:none;margin-left:8px;color:var(--dsw-alias-label-tertiary);font-size:12px}
.dsh-image-preview-status-error{color:var(--dsw-alias-state-error-primary)}
.dsh-image-preview-loading,.dsh-image-preview-message,.dsh-image-preview-figure{box-sizing:border-box;width:min(520px,calc(100% - 4px));margin:4px 0 5px 4px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-markdown-code-block)}
.dsh-image-preview-loading{display:flex;min-height:96px;align-items:center;justify-content:center;gap:9px;color:var(--dsw-alias-label-tertiary)}
.dsh-image-preview-spinner{box-sizing:border-box;width:14px;height:14px;border:2px solid var(--dsw-alias-border-l1);border-top-color:var(--dsw-alias-brand-primary);border-radius:50%;animation:dsh-image-preview-spin .8s linear infinite}
@keyframes dsh-image-preview-spin{to{transform:rotate(360deg)}}
.dsh-image-preview-message{display:flex;flex-direction:column;gap:5px;padding:12px 14px;color:var(--dsw-alias-label-tertiary);white-space:pre-wrap;overflow-wrap:anywhere}
.dsh-image-preview-message strong{color:var(--dsw-alias-label-secondary);font-weight:500}
.dsh-image-preview-message-error{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 35%,var(--dsw-alias-border-l1));color:var(--dsw-alias-state-error-primary)}
.dsh-image-preview-retry,.dsh-image-preview-inspect{appearance:none;align-self:flex-start;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;background:var(--dsw-alias-bg-base);padding:3px 10px;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;line-height:16px;cursor:pointer}
.dsh-image-preview-retry:hover,.dsh-image-preview-inspect:hover{background:var(--dsw-alias-interactive-bg-hover-solid);color:var(--dsw-alias-label-primary)}
.dsh-image-preview-figure{overflow:hidden}
.dsh-image-preview-figure[data-expanded=true]{width:calc(100% - 4px);max-width:none}
.dsh-image-preview-canvas{appearance:none;display:flex;width:100%;min-height:120px;max-height:340px;align-items:center;justify-content:center;overflow:hidden;border:0;background:repeating-conic-gradient(color-mix(in srgb,var(--dsw-alias-bg-base) 60%,transparent) 0 25%,transparent 0 50%) 50%/16px 16px;padding:0;cursor:zoom-in}
.dsh-image-preview-figure[data-expanded=true] .dsh-image-preview-canvas{max-height:72vh;cursor:zoom-out}
.dsh-image-preview-image{display:block;width:auto;max-width:100%;height:auto;max-height:340px;object-fit:contain}
.dsh-image-preview-figure[data-expanded=true] .dsh-image-preview-image{max-height:72vh}
.dsh-image-preview-caption{display:flex;min-width:0;align-items:center;justify-content:space-between;gap:12px;border-top:1px solid var(--dsw-alias-border-l2);padding:7px 10px;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}
.dsh-image-preview-caption span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-image-preview-caption span:last-child{flex:none}
.dsh-image-preview-inspect{margin:2px 0 2px 4px;opacity:0;transition:opacity .1s}
.dsh-image-preview-root:hover .dsh-image-preview-inspect,.dsh-image-preview-inspect:focus-visible{opacity:1}
.dsh-image-preview-path:focus-visible,.dsh-image-preview-canvas:focus-visible,.dsh-image-preview-retry:focus-visible,.dsh-image-preview-inspect:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
@media (max-width:640px){.dsh-image-preview-loading,.dsh-image-preview-message,.dsh-image-preview-figure{width:calc(100% - 4px)}.dsh-image-preview-caption span:last-child{display:none}}
@media (prefers-reduced-motion:reduce){.dsh-image-preview-root[data-state=running] .dsh-image-preview-header::after,.dsh-image-preview-spinner{animation:none}}
`
