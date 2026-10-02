// Builds the sample 3D objects a manager can pick to try AR before having a
// model of their own. Run with `node at/samples/build-samples.js`; it writes
// chest.glb and key.glb next to this file. Both are made of plain boxes with
// flat normals and metal/wood materials, at real-world size in metres, with the
// origin on the floor so AR viewers stand them on the ground.
'use strict';
const fs = require('fs');
const path = require('path');

function glb(parts) {
  const chunks = []; let offset = 0;
  const views = [], accessors = [], prims = [], materials = [];
  const push = (buf, target) => {
    const pad = (4 - buf.length % 4) % 4;
    chunks.push(buf, Buffer.alloc(pad));
    views.push({ buffer: 0, byteOffset: offset, byteLength: buf.length, target });
    offset += buf.length + pad;
    return views.length - 1;
  };
  for (const part of parts) {
    const pos = [], nrm = [], idx = [];
    for (const [x0, y0, z0, x1, y1, z1] of part.boxes) {
      const faces = [
        [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], [1, 0, 0]],
        [[x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0], [-1, 0, 0]],
        [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [0, 1, 0]],
        [[x0, y0, z1], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [0, -1, 0]],
        [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]],
        [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]],
      ];
      for (const [a, b, c, d, n] of faces) {
        const base = pos.length / 3;
        for (const v of [a, b, c, d]) { pos.push(...v); nrm.push(...n); }
        idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }
    const P = Buffer.from(new Float32Array(pos).buffer), N = Buffer.from(new Float32Array(nrm).buffer);
    const I = Buffer.from(new Uint16Array(idx).buffer);
    const mn = [0, 1, 2].map(k => Math.min(...pos.filter((_, i) => i % 3 === k)));
    const mx = [0, 1, 2].map(k => Math.max(...pos.filter((_, i) => i % 3 === k)));
    const pv = push(P, 34962), nv = push(N, 34962), iv = push(I, 34963);
    accessors.push({ bufferView: pv, componentType: 5126, count: pos.length / 3, type: 'VEC3', min: mn, max: mx });
    accessors.push({ bufferView: nv, componentType: 5126, count: nrm.length / 3, type: 'VEC3' });
    accessors.push({ bufferView: iv, componentType: 5123, count: idx.length, type: 'SCALAR' });
    materials.push({ name: part.name, pbrMetallicRoughness: {
      baseColorFactor: [...part.color, 1], metallicFactor: part.metal, roughnessFactor: part.rough } });
    prims.push({ attributes: { POSITION: accessors.length - 3, NORMAL: accessors.length - 2 },
      indices: accessors.length - 1, material: materials.length - 1 });
  }
  const bin = Buffer.concat(chunks);
  let json = Buffer.from(JSON.stringify({
    asset: { version: '2.0', generator: 'AdventureTrail samples' },
    scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    meshes: [{ primitives: prims }], materials,
    buffers: [{ byteLength: bin.length }], bufferViews: views, accessors,
  }));
  json = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 0x20)]);
  const head = Buffer.alloc(12);
  head.writeUInt32LE(0x46546C67, 0); head.writeUInt32LE(2, 4);
  head.writeUInt32LE(12 + 8 + json.length + 8 + bin.length, 8);
  const c0 = Buffer.alloc(8); c0.writeUInt32LE(json.length, 0); c0.writeUInt32LE(0x4E4F534A, 4);
  const c1 = Buffer.alloc(8); c1.writeUInt32LE(bin.length, 0); c1.writeUInt32LE(0x004E4942, 4);
  return Buffer.concat([head, c0, json, c1, bin]);
}

const WOOD = [0.42, 0.25, 0.12], WOOD_DARK = [0.33, 0.19, 0.09];
const IRON = [0.26, 0.26, 0.28], BRASS = [0.83, 0.62, 0.22];

// A chest about 62 cm wide and 45 cm tall: body, lid, two iron bands, a lock.
const chest = glb([
  { name: 'Holz', color: WOOD, metal: 0, rough: 0.85, boxes: [[-0.30, 0.02, -0.20, 0.30, 0.32, 0.20]] },
  { name: 'Deckel', color: WOOD_DARK, metal: 0, rough: 0.8, boxes: [[-0.31, 0.32, -0.21, 0.31, 0.44, 0.21]] },
  { name: 'Eisen', color: IRON, metal: 0.85, rough: 0.45, boxes: [
    [-0.22, 0.00, -0.215, -0.17, 0.445, 0.215], [0.17, 0.00, -0.215, 0.22, 0.445, 0.215],
    [-0.315, 0.00, -0.215, 0.315, 0.03, 0.215] ] },
  { name: 'Schloss', color: BRASS, metal: 1, rough: 0.3, boxes: [[-0.045, 0.24, 0.205, 0.045, 0.36, 0.235]] },
]);

// An old key about 30 cm long, lying flat: a square bow, a shaft, two bits.
const key = glb([
  { name: 'Messing', color: BRASS, metal: 1, rough: 0.35, boxes: [
    [-0.15, 0, -0.04, -0.13, 0.015, 0.04], [-0.07, 0, -0.04, -0.05, 0.015, 0.04],
    [-0.15, 0, 0.03, -0.05, 0.015, 0.05], [-0.15, 0, -0.05, -0.05, 0.015, -0.03],
    [-0.05, 0, -0.008, 0.15, 0.015, 0.008],
    [0.09, 0, 0.008, 0.11, 0.015, 0.045], [0.125, 0, 0.008, 0.15, 0.015, 0.035] ] },
]);

fs.writeFileSync(path.join(__dirname, 'chest.glb'), chest);
fs.writeFileSync(path.join(__dirname, 'key.glb'), key);
console.log('chest.glb', chest.length, 'bytes; key.glb', key.length, 'bytes');
