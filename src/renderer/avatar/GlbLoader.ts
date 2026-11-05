/* ------------------------------------------------------------------ */
/* GlbLoader — strict GLB 2.0 container parser.                         */
/* ------------------------------------------------------------------ */

import { GltfAsset, GltfJson } from './GltfTypes';

const GLB_MAGIC = 0x46546c67;
const GLB_VERSION = 2;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

export function parseGlb(data: ArrayBuffer): GltfAsset {
  if (data.byteLength < 20) throw new Error('GLB header or JSON chunk is truncated');
  const view = new DataView(data);
  if (view.getUint32(0, true) !== GLB_MAGIC) throw new Error('Invalid GLB magic');
  if (view.getUint32(4, true) !== GLB_VERSION) throw new Error('Unsupported GLB version');
  const length = view.getUint32(8, true);
  if (length !== data.byteLength) throw new Error('GLB declared length does not match file size');

  let offset = 12;
  let chunkIndex = 0;
  let json: GltfJson | null = null;
  let binary = new ArrayBuffer(0);
  let hasBinary = false;

  while (offset < length) {
    if (offset + 8 > length) throw new Error('Truncated GLB chunk header');
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    offset += 8;
    if (chunkLength % 4 !== 0 || chunkLength > length - offset) {
      throw new Error('Invalid GLB chunk length');
    }
    if (chunkIndex === 0 && chunkType !== JSON_CHUNK) {
      throw new Error('GLB JSON chunk must be first');
    }

    const chunk = data.slice(offset, offset + chunkLength);
    offset += chunkLength;

    if (chunkType === JSON_CHUNK) {
      if (json !== null || chunkIndex !== 0) {
        throw new Error('GLB must contain exactly one leading JSON chunk');
      }
      // GLB JSON padding is whitespace; trim also tolerates NUL padding.
      const text = new TextDecoder().decode(chunk).replace(/\u0000+$/g, '').trim();
      json = JSON.parse(text) as GltfJson;
    } else if (chunkType === BIN_CHUNK) {
      if (hasBinary || json === null) {
        throw new Error('GLB must contain at most one BIN chunk after JSON');
      }
      binary = chunk;
      hasBinary = true;
    }
    chunkIndex++;
  }

  if (offset !== length) throw new Error('GLB chunks do not consume declared container length');
  if (!json) throw new Error('GLB contains no JSON chunk');
  if (!hasBinary) throw new Error('GLB contains no BIN chunk');
  const declared = json.buffers?.[0]?.byteLength;
  if (declared !== undefined && declared > binary.byteLength) {
    throw new Error('GLB BIN chunk is shorter than declared buffer');
  }
  return { json, binary };
}
