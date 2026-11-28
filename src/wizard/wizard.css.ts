// The wizard: one question per screen, a quiet page, one strong button.
// Bundled Graphite tokens, Aspekta throughout.
import { GRAPHITE_CSS } from '../studio/theme/graphite.css.ts';
import aspekta from '../studio/theme/fonts/AspektaVF.woff2';

export const WIZARD_CSS = `
@font-face { font-family: "Aspekta"; font-weight: 100 900; font-style: normal; font-display: swap; src: url("${aspekta}") format("woff2"); }
${GRAPHITE_CSS}
html, body { margin: 0; }
.mw {
  --ink: var(--ui-text-primary); --muted: var(--ui-text-muted); --line: var(--ui-border-subtle);
  --fill: var(--ui-bg-muted); --card: var(--ui-bg-elevated); --page: var(--ui-bg-surface);
  min-height: 100vh; display: grid; grid-template-rows: auto 1fr auto;
  background: var(--page); color: var(--ink);
  font-family: var(--ui-font-body); font-size: var(--ui-text-body-md); line-height: var(--ui-text-body-md-leading);
  letter-spacing: var(--ui-tracking-normal); -webkit-font-smoothing: antialiased;
}
.mw *, .mw *::before, .mw *::after { box-sizing: border-box; }
:where(.mw) :where(button, input, textarea) { font: inherit; letter-spacing: inherit; color: inherit; }
:where(.mw) button { cursor: pointer; }
.mw :focus-visible { outline: var(--ui-focus-ring-width) solid var(--ui-focus-ring-color); outline-offset: 2px; }
.mw ::selection { background: var(--ui-selection-bg); }

/* Top: a wordmark and one quiet action. */
.mw-top { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; }
.mw-mark { font-weight: 650; letter-spacing: -0.03em; font-size: 17px; }
.mw-mark span { color: var(--muted); font-weight: 500; }
.mw-pill { min-height: 32px; padding: 0 14px; border: var(--ui-stroke-default) solid var(--line); border-radius: var(--ui-radius-full); background: var(--card); font-weight: 550; font-size: var(--ui-text-body-sm); }
.mw-pill:hover { background: var(--ui-bg-hover); }

/* The question. */
.mw-main { width: 100%; max-width: 780px; margin: 0 auto; padding: 24px 24px 64px; }
.mw-step { margin: 0 0 8px; color: var(--muted); font-size: var(--ui-text-body-sm); font-weight: 550; }
.mw-q { margin: 0 0 8px; font-size: clamp(26px, 3.2vw, 34px); line-height: 1.15; font-weight: 550; letter-spacing: -0.03em; text-wrap: balance; }
.mw-q:focus { outline: none; }
.mw-help { margin: 0 0 28px; color: var(--muted); max-width: 52ch; }

/* Option cards. */
.mw-options { display: grid; gap: 10px; }
.mw-option { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 4px 16px; width: 100%; padding: 16px 18px; text-align: left;
  border: var(--ui-stroke-default) solid var(--line); border-radius: var(--ui-radius-lg); background: var(--card);
  transition: border-color var(--ui-motion-micro), background-color var(--ui-motion-micro), transform var(--ui-motion-micro); }
.mw-option:hover { border-color: var(--ui-border-default); }
.mw-option:active { transform: scale(0.995); }
.mw-option[aria-pressed="true"] { border-color: var(--ink); box-shadow: inset 0 0 0 1px var(--ink); background: var(--ui-bg-base); }
.mw-option b { font-weight: 600; }
.mw-option small { grid-column: 1; color: var(--muted); font-size: var(--ui-text-body-sm); }
.mw-option .mw-meta { grid-row: 1 / span 2; grid-column: 2; color: var(--muted); font-size: var(--ui-text-body-sm); font-variant-numeric: tabular-nums; text-align: right; }
.mw-tag { display: inline-block; margin-left: 8px; padding: 1px 8px; border-radius: var(--ui-radius-full); background: var(--fill); color: var(--ui-text-secondary); font-size: var(--ui-text-caption); font-weight: 600; vertical-align: 1px; }

/* Fields: filled, borderless, like a quiet form. */
.mw-fields { display: grid; gap: 18px; max-width: 600px; }
.mw-field { display: grid; gap: 6px; }
.mw-field > span { font-weight: 600; font-size: var(--ui-text-body-sm); }
.mw-field > small { color: var(--muted); font-size: var(--ui-text-body-sm); }
.mw-input { width: 100%; min-height: 48px; padding: 12px 14px; border: 0; border-radius: var(--ui-radius-md); background: var(--fill); }
.mw-input::placeholder { color: var(--ui-text-placeholder); }
textarea.mw-input { min-height: 120px; resize: vertical; line-height: 1.5; }
.mw-input:focus { outline: var(--ui-focus-ring-width) solid var(--ui-focus-ring-color); outline-offset: 0; background: var(--card); }

/* Chips. */
.mw-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.mw-chip { min-height: 36px; padding: 0 14px; border: var(--ui-stroke-default) solid var(--line); border-radius: var(--ui-radius-full); background: var(--card); font-size: var(--ui-text-body-sm); font-weight: 550; }
.mw-chip:has(.mw-ratio) { display: inline-flex; align-items: center; gap: 8px; }
.mw-ratio { display: inline-block; flex: none; border: 1.5px solid currentColor; border-radius: 3px; opacity: 0.7; }
.mw-chip:not(:disabled):not([data-fixed]):hover { background: var(--ui-bg-hover); }
.mw-chip[aria-pressed="true"], .mw-chip[aria-pressed="true"]:hover { background: var(--ui-bg-selected); border-color: transparent; color: var(--ink); }
.mw-chip:disabled { cursor: default; opacity: 0.45; }
.mw-chip[data-fixed] { cursor: default; background: var(--fill); border-color: transparent; color: var(--ui-text-secondary); opacity: 1; }
.mw-group + .mw-group { margin-top: 24px; }
.mw-group h2 { margin: 0 0 10px; font-size: var(--ui-text-body-sm); font-weight: 600; }
.mw-group p { margin: 0 0 10px; color: var(--muted); font-size: var(--ui-text-body-sm); }

/* Tabs: one kind of video at a time. */
.mw-tabs { display: flex; flex-wrap: wrap; gap: 4px; margin: 0 0 20px; padding: 0; }
.mw-tabs button { min-height: 36px; padding: 0 12px; border: 0; border-radius: var(--ui-radius-md); background: none; color: var(--muted); font-weight: 600; transition: background-color var(--ui-motion-micro), color var(--ui-motion-micro); }
.mw-tabs button:hover { color: var(--ui-text-secondary); }
.mw-tabs button[aria-selected="true"] { background: var(--ui-bg-selected); color: var(--ink); }

/* Cards with a live thumbnail: the tile is the picture, the words sit under it. */
.mw-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 20px 14px; }
.mw-cards-3 { grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); }
.mw-cards-small { grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 16px 12px; }
.mw-card { display: grid; gap: 10px; align-content: start; padding: 0; border: 0; background: none; text-align: left; border-radius: var(--ui-radius-lg); }
.mw-card:focus-visible { outline-offset: 4px; }
.mw-thumb { position: relative; display: block; aspect-ratio: 16 / 9; overflow: hidden; border-radius: var(--ui-radius-lg); background: var(--fill);
  box-shadow: inset 0 0 0 1px light-dark(rgb(0 0 0 / 0.1), rgb(255 255 255 / 0.1)); transition: box-shadow var(--ui-motion-micro), transform var(--ui-motion-micro); }
.mw-thumb-host { position: absolute; inset: 0; display: block; }
.mw-thumb-host .m-stage { pointer-events: none; }
.mw-card:hover .mw-thumb { box-shadow: inset 0 0 0 1px light-dark(rgb(0 0 0 / 0.22), rgb(255 255 255 / 0.22)); }
.mw-card:active .mw-thumb { transform: scale(0.985); }
.mw-card[aria-pressed="true"] .mw-thumb { box-shadow: 0 0 0 2px var(--ui-bg-base), 0 0 0 4px var(--ink); }
.mw-card[aria-disabled="true"] { cursor: default; }
.mw-card[aria-disabled="true"][aria-pressed="false"] .mw-card-text { opacity: 0.5; }
.mw-card-text { display: block; padding: 0 2px; }
.mw-card-text b { font-weight: 600; }
.mw-card { position: relative; }
.mw-badge { position: absolute; top: 8px; left: 8px; padding: 3px 9px; border-radius: var(--ui-radius-full); background: var(--card); color: var(--ink);
  font-size: var(--ui-text-caption); font-weight: 600; box-shadow: 0 0 0 1px var(--line); }
.mw-card-text small { display: block; margin-top: 2px; color: var(--muted); font-size: var(--ui-text-body-sm); line-height: 1.4; }
.mw-card-text .mw-meta { display: block; margin-top: 4px; color: var(--muted); font-size: var(--ui-text-caption); font-variant-numeric: tabular-nums; }
.mw-cards-small .mw-card-text small { font-size: var(--ui-text-caption); }

/* Slider: label and value sit inside the track, as in the studio's dials. */
.mw-slider { position: relative; display: flex; align-items: center; justify-content: space-between; height: 52px; padding: 0 16px; overflow: hidden;
  border-radius: var(--ui-radius-md); background: var(--fill); font-variant-numeric: tabular-nums; cursor: ew-resize; touch-action: none; }
.mw-slider-fill { position: absolute; inset: 0 auto 0 0; width: calc(var(--k, 0) * 100%); background: var(--ui-bg-active); }
.mw-slider-fill::after { content: ""; position: absolute; right: 6px; top: 14px; bottom: 14px; width: 3px; border-radius: 2px; background: var(--ink); opacity: 0.55; }
.mw-slider-band { position: absolute; top: 0; bottom: 0; background: color-mix(in oklab, var(--ink) 12%, transparent); }
.mw-slider-label, .mw-slider-value { position: relative; pointer-events: none; font-weight: 600; }
.mw-slider-value { font-weight: 550; }
.mw-slider-input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: ew-resize; }
.mw-slider:has(.mw-slider-input:focus-visible) { outline: var(--ui-focus-ring-width) solid var(--ui-focus-ring-color); outline-offset: 2px; }
.mw-scale { display: flex; align-items: center; gap: 8px; margin: 10px 0 0; color: var(--muted); font-size: var(--ui-text-body-sm); }
.mw-band-key { display: inline-block; width: 18px; height: 12px; border-radius: var(--ui-radius-sm); background: color-mix(in oklab, var(--ink) 14%, transparent); }
.mw-color { display: flex; align-items: center; gap: 10px; }
.mw-color input[type=color] { width: 48px; height: 48px; padding: 0; border: 0; border-radius: var(--ui-radius-md); background: none; }

/* Result. */
.mw-summary { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 20px; padding: 0; list-style: none; }
.mw-summary button { min-height: 30px; padding: 0 12px; border: 0; border-radius: var(--ui-radius-full); background: var(--fill); font-size: var(--ui-text-body-sm); }
.mw-summary button:hover { background: var(--ui-bg-active); }
.mw-brief { margin: 0; padding: 20px 22px; max-height: max(220px, calc(100vh - 400px)); overflow: auto; border-radius: var(--ui-radius-lg); background: var(--card); border: var(--ui-stroke-default) solid var(--line);
  white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; font-size: var(--ui-text-body-sm); line-height: 1.6; }
.mw-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
.mw-note { margin: 10px 0 0; color: var(--muted); font-size: var(--ui-text-body-sm); }
.mw-note code { font: inherit; font-weight: 600; color: var(--ink); }

/* Bottom: progress, back, next. */
.mw-foot { position: sticky; bottom: 0; background: var(--page); }
.mw-progress { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 4px; padding: 0; }
.mw-progress i { display: block; height: 3px; background: var(--ui-bg-active); }
.mw-progress i[data-done] { background: var(--ink); }
.mw-nav { display: flex; align-items: center; justify-content: space-between; padding: 14px 24px 18px; }
.mw-back { border: 0; background: none; padding: 8px 2px; font-weight: 600; text-decoration: underline; text-underline-offset: 3px; }
.mw-back[hidden] { visibility: hidden; display: block; }
.mw-next, .mw-primary { min-height: 48px; padding: 0 24px; border: 0; border-radius: var(--ui-radius-md); background: var(--ink); color: var(--ui-text-inverse); font-weight: 600; }
.mw-next:hover, .mw-primary:hover { background: var(--ui-bg-inverse-hover); }
.mw-next:disabled { background: var(--ui-bg-active); color: var(--ui-text-disabled); cursor: not-allowed; }
.mw-secondary { min-height: 48px; padding: 0 18px; border: var(--ui-stroke-default) solid var(--line); border-radius: var(--ui-radius-md); background: var(--card); font-weight: 600; }
.mw-secondary:hover { background: var(--ui-bg-hover); }
.mw-live { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }

@media (max-width: 560px) { .mw-main { padding: 8px 16px 32px; } .mw-top, .mw-nav { padding-inline: 16px; } .mw-option { padding: 14px; } .mw-cards, .mw-cards-3 { grid-template-columns: 1fr 1fr; gap: 16px 10px; } }
@media (prefers-reduced-motion: reduce) { .mw * { transition: none !important; } }
`;
