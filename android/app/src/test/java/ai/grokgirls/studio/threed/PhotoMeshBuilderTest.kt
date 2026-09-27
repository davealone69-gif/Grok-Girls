package ai.grokgirls.studio.threed

import ai.grokgirls.studio.threed.geometry.PhotoMeshBuilder
import org.junit.Assert.assertTrue
import org.junit.Test

class PhotoMeshBuilderTest {
    @Test
    fun buildsClosedMeshFromSolidMask() {
        val width = 32
        val height = 48
        val mask = BooleanArray(width * height) { i ->
            val x = i % width
            val y = i / width
            val dx = (x - width / 2f) / (width * 0.38f)
            val dy = (y - height / 2f) / (height * 0.46f)
            dx * dx + dy * dy < 1f
        }
        val mesh = PhotoMeshBuilder.build(mask, width, height)
        requireNotNull(mesh)
        assertTrue(mesh.vertexCount > 100)
        assertTrue(mesh.triangleCount > 100)
        assertTrue(mesh.positions.size == mesh.normals.size)
        assertTrue(mesh.uvs.size == mesh.vertexCount * 2)
        assertTrue(mesh.indices.size % 3 == 0)
    }

    @Test
    fun rejectsEmptyMask() {
        val mesh = PhotoMeshBuilder.build(BooleanArray(32 * 32), 32, 32)
        assertTrue(mesh == null)
    }
}
