package ai.grokgirls.studio.threed

import ai.grokgirls.studio.threed.scan.VisualHull
import kotlin.math.sqrt
import org.junit.Assert.assertTrue
import org.junit.Test

class VisualHullTest {

    @Test
    fun emittedTrianglesFollowOutwardNormals() {
        val resolution = 8
        val mask = BooleanArray(32 * 32) { true }
        val hull = VisualHull(resolution)
        hull.carve(listOf(VisualHull.View(mask, 32, 32, 0f)))
        assertTrue(hull.occupiedCount() > 0)

        val mesh = hull.buildMesh()
        assertTrue(mesh.triangleCount > 0)

        for (i in mesh.indices.indices step 3) {
            val ia = mesh.indices[i]
            val ib = mesh.indices[i + 1]
            val ic = mesh.indices[i + 2]
            val ax = mesh.positions[ia * 3]
            val ay = mesh.positions[ia * 3 + 1]
            val az = mesh.positions[ia * 3 + 2]
            val bx = mesh.positions[ib * 3]
            val by = mesh.positions[ib * 3 + 1]
            val bz = mesh.positions[ib * 3 + 2]
            val cx = mesh.positions[ic * 3]
            val cy = mesh.positions[ic * 3 + 1]
            val cz = mesh.positions[ic * 3 + 2]

            val ux = bx - ax
            val uy = by - ay
            val uz = bz - az
            val vx = cx - ax
            val vy = cy - ay
            val vz = cz - az
            val nx = uy * vz - uz * vy
            val ny = uz * vx - ux * vz
            val nz = ux * vy - uy * vx
            val len = sqrt(nx * nx + ny * ny + nz * nz)
            if (len < 1e-6f) continue

            val mx = (ax + bx + cx) / 3f
            val my = (ay + by + cy) / 3f
            val mz = (az + bz + cz) / 3f
            val normalX = mesh.normals[ia * 3]
            val normalY = mesh.normals[ia * 3 + 1]
            val normalZ = mesh.normals[ia * 3 + 2]

            assertTrue("triangle winding disagrees with stored outward normal",
                (nx * normalX + ny * normalY + nz * normalZ) > 0f)
            assertTrue("triangle normal points inward",
                nx * mx + ny * my + nz * mz > -1e-4f * len)
        }
    }
}
