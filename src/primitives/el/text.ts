import { str, type Primitive } from '../types.ts';

export const text: Primitive = {
  slug: 'el/text',
  summary: 'A block of text. Animate it with enter, exit and tracks.',
  props: { text: { type: 'string', required: true, label: 'Text. Use \\n for a line break.' } },
  params: {},
  duration: () => 0,
  build(el, props) {
    el.style.whiteSpace = 'pre-line';
    el.textContent = str(props.text);
    return { seek() {} };
  },
};
