import { str, type Primitive } from '../types.ts';

// The markup is inserted as written. A film is authored content, like a page's
// own source: do not build one from text you would not put in a page.
export const html: Primitive = {
  slug: 'el/html',
  summary: 'Static markup, for content no primitive covers. Style it with --ui-* tokens.',
  props: { html: { type: 'html', required: true, label: 'Markup' } },
  params: {},
  duration: () => 0,
  build(el, props) {
    el.innerHTML = str(props.html);
    return { seek() {} };
  },
};
