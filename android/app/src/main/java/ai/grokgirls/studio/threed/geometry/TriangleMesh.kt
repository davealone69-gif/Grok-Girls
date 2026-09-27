package ai.grokgirls.studio.threed.geometry

/** Plain indexed triangle mesh used by the on-device photo-to-GLB pipeline. */
data class TriangleMesh(
    val positions: FloatArray,
    val normals: FloatArray,
    val uvs: FloatArray,
    val indices: IntArray
) {
    val vertexCount: Int get() = positions.size / 3
    val triangleCount: Int get() = indices.size / 3
}
