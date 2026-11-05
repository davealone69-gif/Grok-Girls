package ai.grokgirls.studio.renderer

import android.content.Context
import android.util.Log
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Dependency-free GLB 2.0 loader for the core mesh/accessor pipeline.
 *
 * Handles buffers, buffer views, accessors, meshes, PBR material values,
 * skin joints/weights and morph targets. Textures are not decoded here —
 * they are resolved on the GL thread by [GltfTextures] from the retained
 * document ([HdAvatar.gltf] / [HdAvatar.gltfBinary]).
 */
class GltfAvatarLoader(
    private val context: Context
) {
    // Reuse decoded accessors across material primitives. This GLB format
    // shares the same vertex and morph accessors between all 12 submeshes.
    private val floatAccessorCache = HashMap<Int, FloatArray>()
    private val intAccessorCache = HashMap<Int, IntArray>()

    fun loadFromFile(filePath: String): HdAvatar {
        val file = java.io.File(filePath)
        require(file.isFile) { "GLB file not found: $filePath" }
        require(file.length() in 20L..(200L * 1024L * 1024L)) { "GLB file size must be between 20 bytes and 200 MB" }
        return loadGlb(file.readBytes())
    }

    fun loadFromAssets(
        assetName: String
    ): HdAvatar {
        val bytes = context.assets
            .open(assetName)
            .use { it.readBytes() }

        return loadGlb(bytes)
    }

    fun loadGlb(
        bytes: ByteArray
    ): HdAvatar {

        require(bytes.size >= 20) {
            "Invalid GLB: file too small"
        }

        val header =
            ByteBuffer
                .wrap(bytes)
                .order(ByteOrder.LITTLE_ENDIAN)

        val magic = header.int
        val version = header.int
        val length = header.int

        require(magic == GLB_MAGIC) {
            "Invalid GLB magic"
        }

        require(version == 2) {
            "Only GLB 2.0 is supported"
        }

        require(length <= bytes.size) {
            "Invalid GLB length"
        }

        var json: String? = null
        var binary: ByteArray? = null

        var offset = 12

        while (offset + 8 <= bytes.size) {

            val chunkHeader =
                ByteBuffer
                    .wrap(bytes, offset, 8)
                    .order(ByteOrder.LITTLE_ENDIAN)

            val chunkLength =
                chunkHeader.int

            val chunkType =
                chunkHeader.int

            val dataStart =
                offset + 8

            val dataEnd =
                dataStart + chunkLength

            require(dataEnd <= bytes.size) {
                "Invalid GLB chunk"
            }

            when (chunkType) {

                JSON_CHUNK -> {
                    json = String(
                        bytes,
                        dataStart,
                        chunkLength,
                        Charsets.UTF_8
                    ).trim()
                }

                BIN_CHUNK -> {
                    binary =
                        bytes.copyOfRange(
                            dataStart,
                            dataEnd
                        )
                }
            }

            offset = dataEnd
        }

        require(json != null) {
            "GLB JSON chunk missing"
        }

        require(binary != null) {
            "GLB binary chunk missing"
        }

        floatAccessorCache.clear()
        intAccessorCache.clear()
        return try {
            parse(GltfDocument.parse(json!!), binary!!)
        } finally {
            // Keep only compact per-primitive arrays in the returned avatar.
            floatAccessorCache.clear()
            intAccessorCache.clear()
        }
    }

    private fun parse(
        document: GltfDocument,
        binary: ByteArray
    ): HdAvatar {

        val avatar =
            HdAvatar()

        avatar.gltf = document
        avatar.gltfBinary = binary

        val skin =
            document.skins.firstOrNull()

        if (skin != null) {

            avatar.skeleton =
                AvatarSkeleton(
                    skin.joints.size
                )

            avatar.jointMatrices =
                SkeletonMatrices.compute(
                    document,
                    binary
                )
        }

        val scene =
            document.scenes
                .getOrNull(
                    document.scene
                )
                ?: document.scenes.firstOrNull()

        val rootNodes =
            scene?.nodes
                ?: document.nodes.indices.toList()

        rootNodes.forEach { nodeIndex ->

            parseNode(
                nodeIndex,
                document,
                binary,
                avatar
            )
        }

        return avatar
    }

    private fun parseNode(
        nodeIndex: Int,
        document: GltfDocument,
        binary: ByteArray,
        avatar: HdAvatar
    ) {

        val node =
            document.nodes
                .getOrNull(nodeIndex)
                ?: return

        node.mesh?.let { meshIndex ->

            val mesh =
                document.meshes
                    .getOrNull(meshIndex)

            val meshWeights =
                mesh?.weights

            mesh?.primitives?.forEach { primitive ->

                val gpuMesh =
                    buildPrimitive(
                        primitive,
                        document,
                        binary
                    )
                gpuMesh.nodeIndex = nodeIndex
                gpuMesh.morphTargetNames = mesh?.targetNames ?: emptyList()

                // glTF "mesh.weights": default morph weights for this mesh.
                if (
                    meshWeights != null &&
                    meshWeights.isNotEmpty() &&
                    primitive.targets.isNotEmpty()
                ) {
                    gpuMesh.morphWeights =
                        meshWeights.toFloatArray()
                }

                avatar.meshes += gpuMesh
            }
        }

        node.children.forEach { child ->

            parseNode(
                child,
                document,
                binary,
                avatar
            )
        }
    }

    private fun buildPrimitive(
        primitive: GltfPrimitive,
        document: GltfDocument,
        binary: ByteArray
    ): GpuMesh {
        val sourcePositions = readFloatAttribute(primitive.attributes["POSITION"], document, binary, 3)
        require(sourcePositions.isNotEmpty()) { "Primitive has no POSITION attribute" }
        val sourceVertexCount = sourcePositions.size / 3

        val sourceNormals = readFloatAttribute(primitive.attributes["NORMAL"], document, binary, 3)
        val sourceUvs = readFloatAttribute(primitive.attributes["TEXCOORD_0"], document, binary, 2)
        val sourceTangents = readFloatAttribute(primitive.attributes["TANGENT"], document, binary, 4)
        val sourceJoints = primitive.attributes["JOINTS_0"]?.let { readIntAttribute(it, document, binary, 4) }
        val sourceWeights = primitive.attributes["WEIGHTS_0"]?.let { readFloatAttribute(it, document, binary, 4) }
        val sourceIndices = primitive.indices?.let { readIntAttribute(it, document, binary, 1) }
            ?: IntArray(sourceVertexCount) { it }

        require(sourceIndices.size % 3 == 0) { "TRIANGLES index count is not divisible by three" }
        require(sourceIndices.all { it >= 0 && it < sourceVertexCount }) { "Primitive index is outside POSITION accessor" }
        require(sourceNormals.isEmpty() || sourceNormals.size == sourceVertexCount * 3) { "NORMAL count does not match POSITION" }
        require(sourceUvs.isEmpty() || sourceUvs.size == sourceVertexCount * 2) { "TEXCOORD_0 count does not match POSITION" }
        require(sourceTangents.isEmpty() || sourceTangents.size == sourceVertexCount * 4) { "TANGENT count does not match POSITION" }
        require(sourceJoints == null || sourceJoints.size == sourceVertexCount * 4) { "JOINTS_0 count does not match POSITION" }
        require(sourceWeights == null || sourceWeights.size == sourceVertexCount * 4) { "WEIGHTS_0 count does not match POSITION" }

        var normals = if (sourceNormals.isEmpty()) {
            MeshGeometry.generateNormals(sourcePositions, sourceIndices)
        } else sourceNormals
        var tangents: FloatArray? = if (sourceTangents.isEmpty()) null else sourceTangents
        if (tangents == null && sourceUvs.isNotEmpty()) {
            tangents = MeshGeometry.generateTangents(sourcePositions, normals, sourceUvs, sourceIndices)
        }

        val morphTargets = primitive.targets.map { target ->
            MorphTarget(
                positionDeltas = target["POSITION"]?.let { readFloatAttribute(it, document, binary, 3) },
                normalDeltas = target["NORMAL"]?.let { readFloatAttribute(it, document, binary, 3) },
                tangentDeltas = target["TANGENT"]?.let { readFloatAttribute(it, document, binary, 3) }
            )
        }

        // The exporter stores one full-body vertex stream and lets every
        // material primitive index into it. Uploading that whole stream for
        // every material multiplied CPU/GPU memory by 12. Compact each
        // primitive to only its referenced vertices, preserving index order.
        val remap = IntArray(sourceVertexCount) { -1 }
        val sourceVertexForCompact = ArrayList<Int>()
        for (sourceIndex in sourceIndices) {
            if (remap[sourceIndex] == -1) {
                remap[sourceIndex] = sourceVertexForCompact.size
                sourceVertexForCompact += sourceIndex
            }
        }
        fun compactFloat(data: FloatArray?, components: Int): FloatArray? {
            if (data == null) return null
            require(data.size == sourceVertexCount * components) { "Vertex attribute size mismatch during compaction" }
            val compact = FloatArray(sourceVertexForCompact.size * components)
            for (newIndex in sourceVertexForCompact.indices) {
                val oldIndex = sourceVertexForCompact[newIndex]
                System.arraycopy(data, oldIndex * components, compact, newIndex * components, components)
            }
            return compact
        }
        fun compactInt(data: IntArray?, components: Int): IntArray? {
            if (data == null) return null
            require(data.size == sourceVertexCount * components) { "Integer vertex attribute size mismatch during compaction" }
            val compact = IntArray(sourceVertexForCompact.size * components)
            for (newIndex in sourceVertexForCompact.indices) {
                val oldIndex = sourceVertexForCompact[newIndex]
                System.arraycopy(data, oldIndex * components, compact, newIndex * components, components)
            }
            return compact
        }
        val compactIndices = IntArray(sourceIndices.size) { remap[sourceIndices[it]] }
        val compactMorphs = morphTargets.map { target ->
            MorphTarget(
                positionDeltas = compactFloat(target.positionDeltas, 3),
                normalDeltas = compactFloat(target.normalDeltas, 3),
                tangentDeltas = compactFloat(target.tangentDeltas, 3)
            )
        }

        val material = primitive.material?.let { document.materials.getOrNull(it) }?.toHdPbrMaterial()
            ?: HdPbrMaterial()

        return GpuMesh(
            positions = compactFloat(sourcePositions, 3)!!,
            normals = compactFloat(normals, 3)!!,
            tangents = compactFloat(tangents, 4),
            uvs = if (sourceUvs.isEmpty()) FloatArray(sourceVertexForCompact.size * 2) else compactFloat(sourceUvs, 2)!!,
            joints = compactInt(sourceJoints, 4),
            weights = compactFloat(sourceWeights, 4),
            indices = compactIndices,
            material = material,
            morphTargets = compactMorphs
        )
    }

    private fun bufferForView(
        viewIndex: Int,
        document: GltfDocument,
        binary: ByteArray
    ): Pair<GltfBufferView, ByteArray> {
        val view = document.bufferViews.getOrNull(viewIndex)
            ?: error("Missing glTF bufferView $viewIndex")
        val buffer = document.buffers.getOrNull(view.buffer)
            ?: error("Missing glTF buffer ${view.buffer}")
        val source = if (buffer.uri == null) binary else decodeDataUri(buffer.uri)
        val end = view.byteOffset.toLong() + view.byteLength.toLong()
        require(view.byteOffset >= 0 && view.byteLength >= 0 && end <= source.size.toLong()) {
            "glTF bufferView $viewIndex exceeds its buffer"
        }
        return view to source
    }

    private fun readFloatAttribute(
        accessorIndex: Int?,
        document: GltfDocument,
        binary: ByteArray,
        expectedComponents: Int
    ): FloatArray {
        if (accessorIndex == null) return FloatArray(0)
        floatAccessorCache[accessorIndex]?.let { cached ->
            require(cached.size % expectedComponents == 0) { "Cached accessor component mismatch" }
            return cached
        }
        val accessor = document.accessors.getOrNull(accessorIndex)
            ?: error("Missing glTF accessor $accessorIndex")
        val components = accessor.componentCount()
        require(components == expectedComponents) { "Unexpected component count: $components" }
        require(accessor.count >= 0) { "Negative glTF accessor count" }
        val output = FloatArray(accessor.count * components)
        val componentSize = accessor.componentTypeSize()
        val packed = components * componentSize

        // A sparse-only accessor has an implicit all-zero base.
        accessor.bufferView?.let { viewIndex ->
            val (view, source) = bufferForView(viewIndex, document, binary)
            val stride = view.byteStride ?: packed
            val base = view.byteOffset + (accessor.byteOffset ?: 0)
            val required = if (accessor.count == 0) 0L else (accessor.count - 1L) * stride + packed
            require(stride >= packed && base >= view.byteOffset &&
                base.toLong() + required <= view.byteOffset.toLong() + view.byteLength &&
                base.toLong() + required <= source.size.toLong()) {
                "glTF accessor $accessorIndex exceeds its bufferView"
            }
            val bb = ByteBuffer.wrap(source).order(ByteOrder.LITTLE_ENDIAN)
            for (i in 0 until accessor.count) {
                val element = base + i * stride
                for (c in 0 until components) {
                    output[i * components + c] = readComponentAsFloat(
                        bb, source, element + c * componentSize,
                        accessor.componentType, accessor.normalized
                    )
                }
            }
        }

        accessor.sparseData?.let { sparse ->
            require(sparse.count in 0..accessor.count) { "Invalid sparse count for accessor $accessorIndex" }
            val (indexView, indexSource) = bufferForView(sparse.indices.bufferView, document, binary)
            val indexSize = when (sparse.indices.componentType) {
                COMPONENT_UNSIGNED_BYTE -> 1
                COMPONENT_UNSIGNED_SHORT -> 2
                COMPONENT_UNSIGNED_INT -> 4
                else -> error("Invalid sparse index component type")
            }
            val indexStart = indexView.byteOffset + (sparse.indices.byteOffset ?: 0)
            require(indexStart >= indexView.byteOffset &&
                indexStart.toLong() + sparse.count.toLong() * indexSize <= indexView.byteOffset.toLong() + indexView.byteLength) {
                "Sparse indices exceed their bufferView"
            }
            val (valueView, valueSource) = bufferForView(sparse.values.bufferView, document, binary)
            val valueStart = valueView.byteOffset + (sparse.values.byteOffset ?: 0)
            val valueBytes = sparse.count.toLong() * packed
            require(valueStart >= valueView.byteOffset &&
                valueStart.toLong() + valueBytes <= valueView.byteOffset.toLong() + valueView.byteLength) {
                "Sparse values exceed their bufferView"
            }
            val ib = ByteBuffer.wrap(indexSource).order(ByteOrder.LITTLE_ENDIAN)
            val vb = ByteBuffer.wrap(valueSource).order(ByteOrder.LITTLE_ENDIAN)
            var previous = -1
            for (i in 0 until sparse.count) {
                val index = readComponentAsInt(ib, indexSource, indexStart + i * indexSize, sparse.indices.componentType)
                require(index in 0 until accessor.count && index > previous) {
                    "Sparse accessor indices must be strictly increasing and in range"
                }
                previous = index
                val valueOffset = valueStart + i * packed
                for (c in 0 until components) {
                    output[index * components + c] = readComponentAsFloat(
                        vb, valueSource, valueOffset + c * componentSize,
                        accessor.componentType, accessor.normalized
                    )
                }
            }
        }

        floatAccessorCache[accessorIndex] = output
        return output
    }

    private fun readIntAttribute(
        accessorIndex: Int,
        document: GltfDocument,
        binary: ByteArray,
        expectedComponents: Int
    ): IntArray {
        intAccessorCache[accessorIndex]?.let { return it }
        val accessor = document.accessors.getOrNull(accessorIndex)
            ?: error("Missing glTF accessor $accessorIndex")
        val components = accessor.componentCount()
        require(components == expectedComponents) { "Unexpected integer component count: $components" }
        val output = IntArray(accessor.count * components)
        val componentSize = accessor.componentTypeSize()
        val packed = components * componentSize
        accessor.bufferView?.let { viewIndex ->
            val (view, source) = bufferForView(viewIndex, document, binary)
            val stride = view.byteStride ?: packed
            val base = view.byteOffset + (accessor.byteOffset ?: 0)
            val required = if (accessor.count == 0) 0L else (accessor.count - 1L) * stride + packed
            require(stride >= packed && base >= view.byteOffset &&
                base.toLong() + required <= view.byteOffset.toLong() + view.byteLength &&
                base.toLong() + required <= source.size.toLong()) {
                "glTF integer accessor $accessorIndex exceeds its bufferView"
            }
            val bb = ByteBuffer.wrap(source).order(ByteOrder.LITTLE_ENDIAN)
            for (i in 0 until accessor.count) for (c in 0 until components) {
                output[i * components + c] = readComponentAsInt(
                    bb, source, base + i * stride + c * componentSize, accessor.componentType
                )
            }
        }
        accessor.sparseData?.let { sparse ->
            require(sparse.count in 0..accessor.count) { "Invalid sparse count for accessor $accessorIndex" }
            val (iv, isrc) = bufferForView(sparse.indices.bufferView, document, binary)
            val isize = when (sparse.indices.componentType) {
                COMPONENT_UNSIGNED_BYTE -> 1
                COMPONENT_UNSIGNED_SHORT -> 2
                COMPONENT_UNSIGNED_INT -> 4
                else -> error("Invalid sparse index component type")
            }
            val istart = iv.byteOffset + (sparse.indices.byteOffset ?: 0)
            val (vv, vsrc) = bufferForView(sparse.values.bufferView, document, binary)
            val vstart = vv.byteOffset + (sparse.values.byteOffset ?: 0)
            require(istart.toLong() + sparse.count.toLong() * isize <= iv.byteOffset.toLong() + iv.byteLength)
            require(vstart.toLong() + sparse.count.toLong() * packed <= vv.byteOffset.toLong() + vv.byteLength)
            val ib = ByteBuffer.wrap(isrc).order(ByteOrder.LITTLE_ENDIAN)
            val vb = ByteBuffer.wrap(vsrc).order(ByteOrder.LITTLE_ENDIAN)
            var previous = -1
            for (i in 0 until sparse.count) {
                val index = readComponentAsInt(ib, isrc, istart + i * isize, sparse.indices.componentType)
                require(index in 0 until accessor.count && index > previous) { "Invalid sparse indices" }
                previous = index
                for (c in 0 until components) {
                    output[index * components + c] = readComponentAsInt(
                        vb, vsrc, vstart + i * packed + c * componentSize, accessor.componentType
                    )
                }
            }
        }
        intAccessorCache[accessorIndex] = output
        return output
    }

    private fun readComponentAsFloat(
        buffer: ByteBuffer,
        source: ByteArray,
        offset: Int,
        type: Int,
        normalized: Boolean
    ): Float = when (type) {
        COMPONENT_FLOAT -> buffer.getFloat(offset)
        COMPONENT_UNSIGNED_BYTE -> {
            val value = source[offset].toInt() and 0xFF
            if (normalized) value / 255f else value.toFloat()
        }
        COMPONENT_BYTE -> {
            val value = source[offset].toInt()
            if (normalized) maxOf(-1f, value / 127f) else value.toFloat()
        }
        COMPONENT_UNSIGNED_SHORT -> {
            val value = buffer.getShort(offset).toInt() and 0xFFFF
            if (normalized) value / 65535f else value.toFloat()
        }
        COMPONENT_SHORT -> {
            val value = buffer.getShort(offset).toInt()
            if (normalized) maxOf(-1f, value / 32767f) else value.toFloat()
        }
        else -> error("Unsupported float component type: $type")
    }

    private fun readComponentAsInt(
        buffer: ByteBuffer,
        source: ByteArray,
        offset: Int,
        type: Int
    ): Int = when (type) {
        COMPONENT_UNSIGNED_BYTE -> source[offset].toInt() and 0xFF
        COMPONENT_BYTE -> source[offset].toInt()
        COMPONENT_UNSIGNED_SHORT -> buffer.getShort(offset).toInt() and 0xFFFF
        COMPONENT_SHORT -> buffer.getShort(offset).toInt()
        COMPONENT_UNSIGNED_INT -> buffer.getInt(offset)
        else -> error("Unsupported integer component type: $type")
    }

    private fun decodeDataUri(
        uri: String
    ): ByteArray =
        GltfDataUris.decode(uri)

    private fun GltfMaterial.toHdPbrMaterial():
        HdPbrMaterial {

        val pbr =
            pbrMetallicRoughness
                ?: GltfPbr()

        return HdPbrMaterial(
            baseColor =
                pbr.baseColorFactor
                    .toFloatArray(),

            metallic =
                pbr.metallicFactor,

            roughness =
                pbr.roughnessFactor,

            emissive =
                emissiveFactor
                    .toFloatArray(),

            normalScale =
                normalTexture?.scale ?: 1f,

            occlusionStrength =
                occlusionTexture
                    ?.strength ?: 1f,

            baseColorTextureIndex =
                pbr.baseColorTexture?.index ?: -1,

            metallicRoughnessTextureIndex =
                pbr.metallicRoughnessTexture?.index ?: -1,

            normalTextureIndex =
                normalTexture?.index ?: -1,

            occlusionTextureIndex =
                occlusionTexture?.index ?: -1,

            emissiveTextureIndex =
                emissiveTexture?.index ?: -1,

            alphaMode = alphaMode,
            doubleSided = doubleSided
        )
    }

    companion object {

        private const val TAG = "GltfAvatarLoader"

        private const val GLB_MAGIC =
            0x46546C67

        private const val JSON_CHUNK =
            0x4E4F534A

        private const val BIN_CHUNK =
            0x004E4942

        private const val COMPONENT_BYTE =
            5120

        private const val COMPONENT_UNSIGNED_BYTE =
            5121

        private const val COMPONENT_SHORT =
            5122

        private const val COMPONENT_UNSIGNED_SHORT =
            5123

        private const val COMPONENT_UNSIGNED_INT =
            5125

        private const val COMPONENT_FLOAT =
            5126
    }
}
