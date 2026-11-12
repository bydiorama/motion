// Stylesheets are bundled as text (see cli/files.ts) and injected by the studio.
declare module 'dialkit/vanilla/styles.css' {
  const css: string;
  export default css;
}
// Fonts are bundled as data: URLs, so a built film page needs no font files beside it.
declare module '*.woff2' {
  const url: string;
  export default url;
}
