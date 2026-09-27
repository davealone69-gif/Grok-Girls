package ai.grokgirls.studio.threed.geometry

import kotlin.math.sqrt

/** Real single-image silhouette inflation mesh generator, adapted from 3DDD. */
object PhotoMeshBuilder {
    data class Options(
        val gridSize: Int = 140,
        val depth: Float = 0.22f,
        val height: Float = 1.8f
    )

    fun build(mask: BooleanArray, maskWidth: Int, maskHeight: Int, options: Options = Options()): TriangleMesh? {
        if (maskWidth <= 0 || maskHeight <= 0 || mask.size < maskWidth * maskHeight) return null
        var minX = Int.MAX_VALUE
        var minY = Int.MAX_VALUE
        var maxX = -1
        var maxY = -1
        for (y in 0 until maskHeight) for (x in 0 until maskWidth) if (mask[y * maskWidth + x]) {
            minX = minOf(minX, x); maxX = maxOf(maxX, x)
            minY = minOf(minY, y); maxY = maxOf(maxY, y)
        }
        if (maxX < minX || maxY < minY) return null
        val boxW = (maxX - minX + 1).toFloat()
        val boxH = (maxY - minY + 1).toFloat()
        val scale = options.gridSize.toFloat() / maxOf(boxW, boxH)
        val gw = (boxW * scale).toInt().coerceIn(2, options.gridSize * 2)
        val gh = (boxH * scale).toInt().coerceIn(2, options.gridSize * 2)
        val foreground = BooleanArray(gw * gh)
        for (cy in 0 until gh) for (cx in 0 until gw) {
            val sx = minX + ((cx + 0.5f) / gw * boxW).toInt()
            val sy = minY + ((cy + 0.5f) / gh * boxH).toInt()
            foreground[cy * gw + cx] =
                mask[sy.coerceIn(0, maskHeight - 1) * maskWidth + sx.coerceIn(0, maskWidth - 1)]
        }
        if (foreground.none { it }) return null
        val distance = distanceTransform(foreground, gw, gh)
        val maxDistance = distance.max().coerceAtLeast(1f)
        val cell = options.height / gh
        val positions = ArrayList<Float>()
        val normals = ArrayList<Float>()
        val uvs = ArrayList<Float>()
        val indices = ArrayList<Int>()
        val front = IntArray(gw * gh) { -1 }
        val back = IntArray(gw * gh) { -1 }
        fun worldX(cx: Int) = (cx + 0.5f - gw / 2f) * cell
        fun worldY(cy: Int) = (gh - cy - 0.5f) * cell
        fun depthAt(cx: Int, cy: Int): Float {
            val t = (distance[cy * gw + cx] / maxDistance).coerceIn(0f, 1f)
            return options.depth * sqrt(t.toDouble()).toFloat()
        }
        fun uFor(cx: Int) = (cx + 0.5f) / gw
        fun vFor(cy: Int) = 1f - (cy + 0.5f) / gh
        for (cy in 0 until gh) for (cx in 0 until gw) {
            val i = cy * gw + cx
            if (!foreground[i]) continue
            val d = depthAt(cx, cy)
            front[i] = positions.size / 3
            positions.add(worldX(cx)); positions.add(worldY(cy)); positions.add(d)
            normals.add(0f); normals.add(0f); normals.add(1f)
            uvs.add(uFor(cx)); uvs.add(vFor(cy))
            back[i] = positions.size / 3
            positions.add(worldX(cx)); positions.add(worldY(cy)); positions.add(-d)
            normals.add(0f); normals.add(0f); normals.add(-1f)
            uvs.add(uFor(cx)); uvs.add(vFor(cy))
        }
        fun quad(a: Int, b: Int, c: Int, d: Int) {
            if (a < 0 || b < 0 || c < 0 || d < 0) return
            indices.add(a); indices.add(b); indices.add(c)
            indices.add(a); indices.add(c); indices.add(d)
        }
        for (cy in 0 until gh - 1) for (cx in 0 until gw - 1) {
            val i00 = cy * gw + cx
            val i10 = i00 + 1
            val i01 = (cy + 1) * gw + cx
            val i11 = i01 + 1
            if (foreground[i00] && foreground[i10] && foreground[i01] && foreground[i11]) {
                quad(front[i01], front[i11], front[i10], front[i00])
                quad(back[i01], back[i00], back[i10], back[i11])
            }
        }
        for (cy in 0 until gh) for (cx in 0 until gw) {
            val i = cy * gw + cx
            if (!foreground[i]) continue
            val openLeft = cx == 0 || !foreground[cy * gw + cx - 1]
            val openRight = cx == gw - 1 || !foreground[cy * gw + cx + 1]
            val openTop = cy == 0 || !foreground[(cy - 1) * gw + cx]
            val openBottom = cy == gh - 1 || !foreground[(cy + 1) * gw + cx]
            val below = if (cy + 1 < gh && foreground[(cy + 1) * gw + cx]) (cy + 1) * gw + cx else -1
            val right = if (cx + 1 < gw && foreground[cy * gw + cx + 1]) cy * gw + cx + 1 else -1
            // Close each exposed boundary using adjacent surface-center vertices.
            if (openLeft && below >= 0) quad(front[i], front[below], back[below], back[i])
            if (openRight && below >= 0) quad(front[below], front[i], back[i], back[below])
            if (openTop && right >= 0) quad(front[right], front[i], back[i], back[right])
            if (openBottom && right >= 0) quad(front[i], front[right], back[right], back[i])
        }
        if (indices.isEmpty()) return null
        val p = positions.toFloatArray()
        return TriangleMesh(p, rebuildNormals(p, indices.toIntArray()), uvs.toFloatArray(), indices.toIntArray())
    }

    fun distanceTransform(foreground: BooleanArray, width: Int, height: Int): FloatArray {
        val distance = FloatArray(width * height) { if (foreground[it]) (width + height).toFloat() else 0f }
        for (y in 0 until height) for (x in 0 until width) {
            val i = y * width + x
            if (!foreground[i]) continue
            var d = distance[i]
            if (x > 0) d = minOf(d, distance[i - 1] + 1f)
            if (y > 0) d = minOf(d, distance[i - width] + 1f)
            if (x > 0 && y > 0) d = minOf(d, distance[i - width - 1] + DIAGONAL)
            if (x < width - 1 && y > 0) d = minOf(d, distance[i - width + 1] + DIAGONAL)
            distance[i] = d
        }
        for (y in height - 1 downTo 0) for (x in width - 1 downTo 0) {
            val i = y * width + x
            if (!foreground[i]) continue
            var d = distance[i]
            if (x < width - 1) d = minOf(d, distance[i + 1] + 1f)
            if (y < height - 1) d = minOf(d, distance[i + width] + 1f)
            if (x < width - 1 && y < height - 1) d = minOf(d, distance[i + width + 1] + DIAGONAL)
            if (x > 0 && y < height - 1) d = minOf(d, distance[i + width - 1] + DIAGONAL)
            distance[i] = d
        }
        return distance
    }

    fun rebuildNormals(positions: FloatArray, indices: IntArray): FloatArray {
        val normals = FloatArray(positions.size)
        var i = 0
        while (i + 2 < indices.size) {
            val a = indices[i] * 3; val b = indices[i + 1] * 3; val c = indices[i + 2] * 3
            if (a + 2 < positions.size && b + 2 < positions.size && c + 2 < positions.size) {
                val e1x = positions[b] - positions[a]; val e1y = positions[b + 1] - positions[a + 1]; val e1z = positions[b + 2] - positions[a + 2]
                val e2x = positions[c] - positions[a]; val e2y = positions[c + 1] - positions[a + 1]; val e2z = positions[c + 2] - positions[a + 2]
                val nx = e1y * e2z - e1z * e2y; val ny = e1z * e2x - e1x * e2z; val nz = e1x * e2y - e1y * e2x
                normals[a] += nx; normals[a + 1] += ny; normals[a + 2] += nz
                normals[b] += nx; normals[b + 1] += ny; normals[b + 2] += nz
                normals[c] += nx; normals[c + 1] += ny; normals[c + 2] += nz
            }
            i += 3
        }
        var v = 0
        while (v + 2 < normals.size) {
            val len = sqrt(normals[v] * normals[v] + normals[v + 1] * normals[v + 1] + normals[v + 2] * normals[v + 2])
            if (len > 1e-6f) { normals[v] /= len; normals[v + 1] /= len; normals[v + 2] /= len }
            else { normals[v] = 0f; normals[v + 1] = 0f; normals[v + 2] = 1f }
            v += 3
        }
        return normals
    }

    private const val DIAGONAL = 1.41421356f
}
