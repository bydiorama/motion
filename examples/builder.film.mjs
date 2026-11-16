// A generated film: twelve cards on a grid, opening nearest the upper left.
import { film, grid, layer, repeat, scene, sequence, staggerFrom } from '@bydiorama/motion/build';

const places = grid(12, 4, { x: [12, 88], y: [30, 88] });

export default film({
  title: 'Builder demo', size: [1920, 1080], fps: 30,
  scenes: [
    scene('cards', [
      sequence([
        layer('title', 'el/text', { props: { text: 'Twelve cards, one line each' }, style: { size: 'headline' }, place: { x: 50, y: 12 }, enter: 'mask-up' }),
      ]),
      staggerFrom(repeat(12, (i) => layer(`card-${i + 1}`, 'el/box', {
        params: { width: 300, height: 150 }, place: places[i], enter: 'rise',
      })), { focus: [0, 0], step: 0.06, start: 0.4 }),
    ], { hold: 1 }),
  ],
});
