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
  const tracks = {
    type: 'object', additionalProperties: false,
    properties: Object.fromEntries(c.tracks.map((p) => [p, { type: 'array', items: { type: 'array', minItems: 2, maxItems: 3, description: '[time, value] or [time, value, ease]; time in seconds or beats ("2b")' } }])),
  };
  const move = (exit: boolean) => ({
    anyOf: [{ enum: c.moves }, {
      type: 'object', required: ['move'], additionalProperties: false,
      properties: { move: { enum: c.moves }, duration: seconds, ease, amount: { type: 'number' }, ...(exit ? { at: timeRef } : {}) },
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
                  enter: move(false), exit: move(true), tracks,
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
