/* ------------------------------------------------------------------ */
/* GlbLoader — GLB container parser (milestone 8). GLB 2.0 only,       */
/* mirrors native GltfAvatarLoader chunk handling                      */
/* (0x4E4F534A JSON / 0x004E4942 BIN).                                 */
/* ------------------------------------------------------------------ */

import { GltfAsset, GltfJson } from './GltfTypes';

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

export function parseGlb(data: ArrayBuffer): GltfAsset {
  const view = new DataView(data);

  const magic = view.getUint32(0, true);
  if (magic !== GLB_MAGIC) {
    throw new Error('Invalid GLB magic');
  }

  const version = view.getUint32(4, true);
  if (version !== 2) {
    throw new Error(`Unsupported GLB version: ${version}`);
  }

  const length = view.getUint32(8, true);
  if (length > data.byteLength) {
    throw new Error('GLB length exceeds buffer');
  }

  let offset = 12;
  let json: GltfJson | null = null;
  let binary = new ArrayBuffer(0);

  while (offset + 8 <= length) {
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    offset += 8;

    if (offset + chunkLength > length) {
      throw new Error('Invalid GLB chunk');
    }

    const chunk = data.slice(offset, offset + chunkLength);
    offset += chunkLength;

    if (chunkType === JSON_CHUNK) {
      const text = new TextDecoder().decode(chunk);
      json = JSON.parse(text.trim()) as GltfJson;
    }

    if (chunkType === BIN_CHUNK) {
      binary = chunk;
    }
  }

  if (!json) {
    throw new Error('GLB contains no JSON chunk');
  }

  return { json, binary };
}
