/* ------------------------------------------------------------------ */
/* GltfTypes — glTF 2.0 JSON types (GLB). Mirrors the native           */
/* GltfModel/GltfAvatarLoader data model.                              */
/* ------------------------------------------------------------------ */

export interface GltfAsset {
  json: GltfJson;
  binary: ArrayBuffer;
}

export interface GltfJson {
  scenes?: GltfScene[];
  scene?: number;

  nodes?: GltfNode[];
  meshes?: GltfMesh[];
  materials?: GltfMaterial[];

  accessors?: GltfAccessor[];
  bufferViews?: GltfBufferView[];
  buffers?: GltfBuffer[];

  images?: GltfImage[];
  textures?: GltfTexture[];
  samplers?: GltfSampler[];

  skins?: GltfSkin[];
}

export interface GltfScene {
  nodes?: number[];
}

export interface GltfNode {
  name?: string;

  mesh?: number;
  skin?: number;

  children?: number[];

  translation?: number[];
  rotation?: number[];
  scale?: number[];

  matrix?: number[];
}

export interface GltfMesh {
  primitives: GltfPrimitive[];
}

export interface GltfPrimitive {
  attributes: Record<string, number>;

  indices?: number;
  material?: number;

  targets?: Record<string, number>[];
}

export interface GltfMaterial {
  pbrMetallicRoughness?: {
    baseColorFactor?: number[];
    baseColorTexture?: { index: number };

    metallicFactor?: number;
    roughnessFactor?: number;

    metallicRoughnessTexture?: { index: number };
  };

  normalTexture?: { index: number; scale?: number };

  occlusionTexture?: { index: number; strength?: number };

  emissiveTexture?: { index: number };

  emissiveFactor?: number[];

  alphaMode?: string;
  alphaCutoff?: number;
}

export interface GltfAccessor {
  bufferView?: number;
  byteOffset?: number;

  componentType: number;
  count: number;

  type: string;

  normalized?: boolean;

  min?: number[];
  max?: number[];
}

export interface GltfBufferView {
  buffer: number;

  byteOffset?: number;
  byteLength: number;

  byteStride?: number;

  target?: number;
}

export interface GltfBuffer {
  byteLength: number;
  uri?: string;
}

export interface GltfImage {
  uri?: string;

  bufferView?: number;
  mimeType?: string;
}

export interface GltfTexture {
  sampler?: number;
  source?: number;
}

export interface GltfSampler {
  magFilter?: number;
  minFilter?: number;

  wrapS?: number;
  wrapT?: number;
}

export interface GltfSkin {
  inverseBindMatrices?: number;
  joints: number[];

  skeleton?: number;
}
