// JSON Schema for film files, generated from the catalog, for editor completion.
// `motion validate` is the real check: it knows each primitive's props and params
// and resolves the timing; the schema only covers the shape.
import type { Catalog } from '../catalog.ts';

export function filmSchema(c: Catalog) {
  const seconds = { anyOf: [{ type: 'number', minimum: 0 }, { type: 'string', pattern: '^\\$' }] };
  const timeRef = { anyOf: [{ type: 'number', minimum: 0 }, { type: 'string', description: 'e.g. "headline.end + 0.2" or "scene.end - 1"' }] };
  const ease = {
    anyOf: [
      { enum: c.eases }, { type: 'string', pattern: '^\\$' },
      { type: 'array', items: { type: 'number' }, minItems: 4, maxItems: 4 },
      { type: 'object', required: ['spring'], properties: { spring: { type: 'object', required: ['duration'], properties: { duration: { type: 'number' }, bounce: { type: 'number' } } } } },
    ],
  };
  const tracks = {
    type: 'object', additionalProperties: false,
    properties: Object.fromEntries(c.tracks.map((p) => [p, { type: 'array', items: { type: 'array', minItems: 2, maxItems: 3 } }])),
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
      theme: { type: 'object', additionalProperties: false, properties: { scheme: { enum: ['light', 'dark'] }, accent: { type: 'string' }, onAccent: { type: 'string' }, vars: { type: 'object', additionalProperties: { type: 'string' } } } },
      scenes: {
        type: 'array', minItems: 1,
        items: {
          type: 'object', required: ['id', 'layers'], additionalProperties: false,
          properties: {
            id: { type: 'string', pattern: '^[a-z][a-z0-9-]*$' },
            length: { type: 'number', exclusiveMinimum: 0 }, hold: seconds,
            background: { anyOf: [{ enum: c.surfaces }, { type: 'string' }] }, scheme: { enum: ['light', 'dark'] },
            layout: { type: 'object', additionalProperties: false, properties: { align: { enum: ['start', 'center', 'end'] }, justify: { enum: ['start', 'center', 'end', 'between'] }, gap: { type: 'number' }, padding: { type: 'number' } } },
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
                  place: { type: 'object', required: ['x', 'y'], additionalProperties: false, properties: { x: { type: 'number' }, y: { type: 'number' }, anchor: { enum: c.anchors } } },
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
