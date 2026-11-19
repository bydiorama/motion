// JSON Schema for film files, generated from the catalog, for editor completion.
// `motion validate` is the real check: it knows each primitive's props and params
// and resolves the timing; the schema only covers the shape.
import type { Catalog } from '../catalog.ts';

export function filmSchema(c: Catalog) {
  const beats = { type: 'string', pattern: '^\\s*\\d+(\\.\\d+)?\\s*(b|beats?|bars?)\\s*$', description: 'Beats or bars at the film tempo, e.g. "2b" or "1bar"' };
  const seconds = { anyOf: [{ type: 'number', minimum: 0 }, { type: 'string', pattern: '^\\$' }, beats] };
  const timeRef = { anyOf: [{ type: 'number', minimum: 0 }, { type: 'string', description: 'e.g. "headline.end + 0.2", "scene.end - 1", "title.end + 1b" or, with a tempo, "4b"' }] };
  const ease = {
    anyOf: [
      { enum: c.eases }, { type: 'string', pattern: '^\\$' },
      { type: 'array', items: { type: 'number' }, minItems: 4, maxItems: 4 },
      { type: 'object', required: ['spring'], properties: { spring: { type: 'object', required: ['duration'], properties: { duration: { type: 'number' }, bounce: { type: 'number' } } } } },
    ],
  };
  const pair = (min: number, max: number) => ({ type: 'array', items: { type: 'number', minimum: min, maximum: max }, minItems: 2, maxItems: 2 });
  const tracks = {
    type: 'object', additionalProperties: false,
    properties: Object.fromEntries(c.tracks.map((p) => [p, { type: 'array', items: { type: 'array', minItems: 2, maxItems: 3, description: '[time, value] or [time, value, ease]; time in seconds or beats ("2b")' } }])),
  };
  const move = (exit: boolean) => ({
    anyOf: [{ enum: c.moves }, {
      type: 'object', required: ['move'], additionalProperties: false,
      properties: { move: { enum: c.moves }, duration: seconds, ease, amount: { type: 'number' }, angle: { type: 'number', description: 'For wipe and slide: degrees, 0 rightwards, 90 downwards.' }, feather: { anyOf: [{ type: 'boolean' }, { type: 'number', minimum: 0, maximum: 200 }], description: 'For mask-* and wipe-*: a soft edge in px, or true for a tenth of the line height.' }, ...(exit ? { at: timeRef } : {}) },
    }],
  });
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: `Motion film (${c.motion})`,
    type: 'object', required: ['motion', 'size', 'scenes'], additionalProperties: false,
    properties: {
      $schema: { type: 'string' },
      motion: { type: 'string' }, title: { type: 'string' },
      size: { type: 'array', items: { type: 'integer', minimum: 1 }, minItems: 2, maxItems: 2 },
      fps: { type: 'integer', minimum: 1 }, seed: { type: 'integer' }, poster: { type: 'number', minimum: 0 }, loop: { type: 'boolean' },
      narrative: { type: 'string' }, style: { type: 'string' }, tokens: { type: 'object' },
      tempo: {
        type: 'object', required: ['bpm'], additionalProperties: false,
        description: 'One pulse for the whole film: times may then be written in beats and bars, and `motion pace` checks the grid.',
        properties: { bpm: { type: 'number', minimum: 40, maximum: 240 }, bar: { type: 'integer', minimum: 2, maximum: 12 } },
      },
      audio: {
        type: 'object', required: ['src'], additionalProperties: false,
        description: 'A soundtrack: film time 0 plays the file from `from` seconds. The studio plays it with the playhead; render lays it under the video.',
        properties: {
          src: { type: 'string', description: 'Sound file, relative to the film' },
          from: { type: 'number', minimum: 0, description: 'Seconds into the file that film time 0 plays: one of its downbeats' },
          gain: { type: 'number', minimum: -30, maximum: 6, description: 'Level in dB' },
          fade_in: { type: 'number', minimum: 0, maximum: 10 }, fade_out: { type: 'number', minimum: 0, maximum: 10 },
        },
      },
      theme: { type: 'object', additionalProperties: false, properties: { scheme: { enum: ['light', 'dark'] }, accent: { type: 'string' }, onAccent: { type: 'string' }, ui: { enum: ['zero', 'graphite', 'hockney'] }, vars: { type: 'object', additionalProperties: { type: 'string' } } } },
      scenes: {
        type: 'array', minItems: 1,
        items: {
          type: 'object', required: ['id', 'layers'], additionalProperties: false,
          properties: {
            id: { type: 'string', pattern: '^[a-z][a-z0-9-]*$' },
            length: { anyOf: [{ type: 'number', exclusiveMinimum: 0 }, beats] }, hold: seconds,
            background: { anyOf: [{ enum: c.surfaces }, { type: 'string' }] }, scheme: { enum: ['light', 'dark'] },
            layout: { type: 'object', additionalProperties: false, properties: { align: { enum: ['start', 'center', 'end'] }, justify: { enum: ['start', 'center', 'end', 'between'] }, gap: { type: 'number' }, padding: { type: 'number' } } },
            artboard: {
              type: 'object', required: ['width', 'height'], additionalProperties: false,
              description: "A design's frame for layers placed in px: they keep its coordinates and sizes, and it is scaled to the stage as one.",
              properties: { width: { type: 'number', minimum: 1, maximum: 20000 }, height: { type: 'number', minimum: 1, maximum: 20000 }, fit: { enum: ['cover', 'contain', 'width', 'height'] }, align: { type: 'array', items: { type: 'number', minimum: 0, maximum: 100 }, minItems: 2, maxItems: 2 } },
            },
            tracks, uses: { type: 'array', items: { type: 'string' } }, intent: { type: 'string' },
            follow: {
              type: 'object', required: ['layer'], additionalProperties: false,
              description: 'The camera follows the tip of a line as it draws.',
              properties: { layer: { type: 'string' }, at: { type: 'array', items: { type: 'number', minimum: 0, maximum: 100 }, minItems: 2, maxItems: 2 }, lag: { type: 'number', minimum: 0 }, blend: { type: 'number', minimum: 0 } },
            },
            camera: {
              type: 'array', minItems: 1,
              description: 'The framing camera: each key puts a layer (or a point) at an anchor on the screen, this big, tilted so. Replaces the x, y and scale tracks.',
              items: {
                type: 'object', required: ['at'], additionalProperties: false,
                properties: {
                  at: { anyOf: [{ type: 'number', minimum: 0 }, beats] },
                  frame: { anyOf: [{ type: 'string' }, pair(0, 100)], description: 'A layer id, "layer#mark" for a mark recorded with a footage plane\'s footage, or [x, y] in % of the stage.' },
                  point: { ...pair(0, 1), description: 'The point of the layer box to frame, as shares of its width and height.' },
                  offset: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
                  zoom: { type: 'number', exclusiveMinimum: 0 },
                  anchor: { ...pair(0, 100), description: 'Where the framed point sits on the screen, in % of the stage.' },
                  tilt: { type: 'array', items: { type: 'number', minimum: -80, maximum: 80 }, minItems: 2, maxItems: 2, description: 'Degrees about x and y, about the anchor.' },
                  rotate: { type: 'number' }, ease: {}, drift: { type: 'number' },
                },
              },
            },
            perspective: { type: 'number', minimum: 100 },
            motionBlur: { anyOf: [{ type: 'boolean' }, { type: 'number', minimum: 0, maximum: 1 }] },
            out: { type: 'object', required: ['use'], additionalProperties: false, properties: { use: { enum: c.transitions.map((t) => t.slug) }, duration: seconds, params: { type: 'object' } } },
            layers: {
              type: 'array',
              items: {
                type: 'object', required: ['id', 'use'], additionalProperties: false,
                properties: {
                  id: { type: 'string', pattern: '^[a-z][a-z0-9-]*$' },
                  use: { enum: c.primitives.map((p) => p.slug) },
                  props: { type: 'object' }, params: { type: 'object' }, at: timeRef,
                  style: {
                    type: 'object', additionalProperties: false,
                    properties: { size: { enum: c.sizes }, color: { enum: c.colors }, font: { enum: ['display', 'body', 'mono'] }, weight: { type: 'number' }, align: { enum: ['left', 'center', 'right'] }, width: { type: 'number', exclusiveMinimum: 0, maximum: 100 }, css: { type: 'object', additionalProperties: { type: 'string' } } },
                  },
                  place: { type: 'object', required: ['x', 'y'], additionalProperties: false, properties: { x: { type: 'number' }, y: { type: 'number' }, anchor: { enum: c.anchors }, unit: { enum: ['%', 'px'], description: '% of the stage (default), or px of the scene\'s artboard.' } } },
                  screen: { type: 'boolean', description: 'Fixed to the screen: drawn outside the camera, so its travel, zoom and tilt leave the layer where it is.' }, reflow: { enum: ['glide'], description: 'glide: the layer takes no room until it enters and gives it up as it leaves; the layers around it glide over.' },
                  taps: {
                    type: 'array', description: 'Taps: the layer goes down under the finger, landing on each time, comes back up past rest, and an accent ring leaves it in its own shape.',
                    items: { anyOf: [timeRef, { type: 'object', required: ['at'], additionalProperties: false, properties: { at: timeRef, ring: { anyOf: [{ type: 'string', description: 'Another layer to draw the ring around.' }, { const: false }] }, mark: { type: 'string', description: 'On a rig/footage-plane: a mark recorded with the footage, to ring.' } } }] },
                  }, enter: move(false), exit: move(true), tracks,
                  parallax: {
                    description: 'Depth against the camera: 1 travels with the scene, above 1 nearer and faster, 0 holds still. Or { depth, home }.',
                    anyOf: [{ type: 'number', minimum: 0, maximum: 10 }, { type: 'object', required: ['depth'], additionalProperties: false, properties: { depth: { type: 'number', minimum: 0, maximum: 10 }, home: timeRef } }],
                  },
                  motionBlur: { anyOf: [{ type: 'boolean' }, { type: 'number', minimum: 0, maximum: 1 }] },
                },
              },
            },
          },
        },
      },
    },
  };
}
