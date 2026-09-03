# GLB test assets

Served under `/glb/` by the vite build for the browser test suites
(`tests/glb_suite.py`). Source: KhronosGroup/glTF-Sample-Assets.

| File | Tests | Source model | License |
| ---- | ----- | ------------ | ------- |
| `CesiumMan.glb` | skin evaluation (19 joints) + embedded bufferView texture (1×PNG) + sRGB base-color material through the PBR/skin shader | [CesiumMan](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CesiumMan) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/legalcode) — © 2017 Cesium (Jon Watkins / Cesium team) |
| `AnimatedMorphCube.glb` | morph-target read + GPU morph blend (2 targets, weights [0,0] default) | [AnimatedMorphCube](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/AnimatedMorphCube) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/legalcode) |
| `BoxTextured.glb` | embedded texture + sRGB base-color path without skinning | [BoxTextured](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/BoxTextured) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/legalcode) — © 2015 Cesium |
| `MorphBoxTest.glb` | synthetic morph test: BoxTextured geometry + 1 morph target (+X 0.6, weight [0]); human-scale node, textured (proves GPU morph blend on the proven texture path) | derived from BoxTextured (above) by this repo's test tooling | CC BY 4.0 (derivative of Cesium's BoxTextured) |

Attribution (CC BY 4.0 models): "CesiumMan" and "BoxTextured" © Cesium,
from the Khronos glTF Sample Assets repository, licensed CC BY 4.0.
