// The stage's stylesheet. Colours, fonts and weights come from bydiorama/ui theme
// tokens (--ui-*) when a theme is on the page; the fallbacks keep a film readable
// without one. Sizes are in --m-u, one hundredth of the stage width, so a film
// looks the same at any resolution.
export const STAGE_CSS = `
.m-stage {
  position: relative; overflow: hidden; transform-origin: 0 0; box-sizing: border-box; isolation: isolate;
  color-scheme: light;
  --m-bg-base: var(--ui-bg-base, light-dark(#FFFFFF, #14161A));
  --m-bg-surface: var(--ui-bg-elevated, light-dark(#EEF0F3, #23262D));
  --m-bg-sunken: var(--ui-bg-sunken, light-dark(#E4E7EB, #0C0D10));
  --m-bg-accent: var(--ui-bg-accent, #2440F0);
  --m-bg-inverse: var(--ui-bg-inverse, light-dark(#14161A, #F4F5F7));
  --m-text-primary: var(--ui-text-primary, light-dark(#14161A, #F4F5F7));
  --m-text-secondary: var(--ui-text-secondary, light-dark(#2C3038, #D5D8DE));
  --m-text-muted: var(--ui-text-muted, light-dark(#646B78, #9299A6));
  --m-text-inverse: var(--ui-text-inverse, light-dark(#F4F5F7, #14161A));
  --m-text-on-accent: var(--ui-text-on-accent, #FFFFFF);
  --m-accent: var(--ui-bg-accent-legible, light-dark(#2440F0, #8C9CFF));
  --m-border: var(--ui-border-default, light-dark(#C3C8D0, #3A3F49));
  --m-font-display: var(--ui-font-display, "Helvetica Neue", Helvetica, Arial, sans-serif);
  --m-font-body: var(--ui-font-body, "Helvetica Neue", Helvetica, Arial, sans-serif);
  --m-font-mono: var(--ui-font-mono, ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace);
  background: var(--m-bg-base); color: var(--m-text-primary);
  font-family: var(--m-font-display); font-kerning: normal; text-rendering: geometricPrecision;
  -webkit-font-smoothing: antialiased;
}
.m-stage *, .m-stage *::before, .m-stage *::after { box-sizing: border-box; }
.m-scene { position: absolute; inset: 0; overflow: hidden; visibility: hidden; color: var(--m-text-primary); }
.m-cam {
  position: absolute; inset: 0; display: flex; flex-direction: column;
  gap: calc(var(--m-u) * 2.2); padding: calc(var(--m-u) * 6); will-change: transform;
}
.m-layer { position: relative; flex: none; max-width: 100%; will-change: transform, opacity; }
/* When rendering, the browser must repaint every frame from scratch. A compositor
   layer kept alive by will-change is reused at a new sub-pixel offset, so the same
   time can come out as two different pictures depending on what was drawn before. */
html.render .m-stage, html.render .m-stage * { will-change: auto !important; }
.m-layer[data-size="hero"] { font-size: calc(var(--m-u) * 10.4); font-weight: var(--ui-weight-bold, 600); line-height: 0.95; letter-spacing: -0.04em; }
.m-layer[data-size="headline"] { font-size: calc(var(--m-u) * 5.8); font-weight: var(--ui-weight-bold, 600); line-height: 1.05; letter-spacing: -0.03em; }
.m-layer[data-size="title"] { font-size: calc(var(--m-u) * 2.9); font-weight: var(--ui-weight-semibold, 550); line-height: 1.15; letter-spacing: -0.015em; }
.m-layer[data-size="body"] { font-size: calc(var(--m-u) * 1.9); font-weight: var(--ui-weight-book, 450); line-height: 1.35; font-family: var(--m-font-body); }
.m-layer[data-size="caption"] { font-size: calc(var(--m-u) * 1.45); font-weight: var(--ui-weight-medium, 500); line-height: 1.3; letter-spacing: 0.01em; }
`;
