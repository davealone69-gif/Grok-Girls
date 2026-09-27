package ai.grokgirls.studio

import android.graphics.Bitmap
import android.graphics.Bitmap.CompressFormat
import android.graphics.BitmapFactory
import android.util.Base64
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import ai.grokgirls.studio.threed.geometry.PhotoMeshBuilder
import ai.grokgirls.studio.threed.scan.GltfMeshWriter
import ai.grokgirls.studio.threed.scan.SilhouetteExtractor
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.UUID
import java.util.concurrent.Executors

/** Real phone-native single-image -> mesh -> self-contained GLB pipeline from 3DDD. */
@CapacitorPlugin(name = "Photo3DLocal")
class Photo3DLocalPlugin : Plugin() {
    private val pool = Executors.newCachedThreadPool()

    @PluginMethod
    fun buildMultiView(call: PluginCall) {
        val images = call.getArray("images")
        if (images == null || images.length() < 3) {
            call.resolve(error("Multi-view 3D requires at least 3 real captured frames."))
            return
        }
        pool.execute {
            try {
                val views = ArrayList<ai.grokgirls.studio.threed.scan.VisualHull.View>()
                var firstPng: ByteArray? = null
                for (i in 0 until images.length()) {
                    val dataUrl = images.optString(i, "")
                    val comma = dataUrl.indexOf(',')
                    val bytes = Base64.decode(if (comma >= 0) dataUrl.substring(comma + 1) else dataUrl, Base64.DEFAULT)
                    val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                        ?: throw IllegalArgumentException("Frame $i could not be decoded.")
                    val silhouette = SilhouetteExtractor.extract(bitmap)
                    if (firstPng == null) {
                        firstPng = ByteArrayOutputStream().use { out ->
                            if (!bitmap.compress(CompressFormat.PNG, 100, out)) throw IllegalStateException("Could not encode first frame.")
                            out.toByteArray()
                        }
                    }
                    val azimuth = (2.0 * Math.PI * i / images.length()).toFloat()
                    views.add(
                        ai.grokgirls.studio.threed.scan.VisualHull.View(
                            silhouette.mask, silhouette.width, silhouette.height, azimuth
                        )
                    )
                    bitmap.recycle()
                }
                val resolution = (call.getInt("resolution") ?: 56).coerceIn(24, 72)
                val hull = ai.grokgirls.studio.threed.scan.VisualHull(resolution)
                hull.carve(views)
                if (hull.occupiedCount() == 0) throw IllegalStateException("Visual hull was completely carved away.")
                val mesh = hull.buildMesh()
                if (mesh.triangleCount == 0) throw IllegalStateException("Visual hull produced no triangles.")
                val dir = File(context.filesDir, "threed/avatars").apply { mkdirs() }
                val name = (call.getString("name") ?: "multiview-avatar")
                    .replace(Regex("[^A-Za-z0-9._-]"), "_").ifBlank { "multiview-avatar" }
                val file = File(dir, name + "-" + UUID.randomUUID().toString() + ".glb")
                GltfMeshWriter.write(mesh, firstPng, name, file)
                val result = JSObject()
                result.put("ok", true)
                result.put("file", file.absolutePath)
                result.put("bytes", file.length())
                result.put("triangles", mesh.triangleCount)
                result.put("vertices", mesh.vertexCount)
                result.put("occupiedVoxels", hull.occupiedCount())
                call.resolve(result)
            } catch (t: Throwable) {
                call.resolve(error(t.message ?: t.javaClass.simpleName))
            }
        }
    }

    @PluginMethod
    fun build(call: PluginCall) {
        val dataUrl = call.getString("image")?.trim().orEmpty()
        if (dataUrl.isEmpty()) {
            call.resolve(error("No image supplied."))
            return
        }
        pool.execute {
            var bitmap: Bitmap? = null
            try {
                val comma = dataUrl.indexOf(',')
                val encoded = if (comma >= 0) dataUrl.substring(comma + 1) else dataUrl
                val bytes = Base64.decode(encoded, Base64.DEFAULT)
                bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                    ?: throw IllegalArgumentException("The supplied image could not be decoded.")
                val silhouette = SilhouetteExtractor.extract(bitmap)
                val usable = silhouette.coverage in 0.02f..0.985f
                val width: Int
                val height: Int
                val mask: BooleanArray
                if (usable) {
                    mask = silhouette.mask
                    width = silhouette.width
                    height = silhouette.height
                } else {
                    width = 128
                    height = 192
                    mask = ovalMask(width, height)
                }
                val depth = (call.getDouble("depth") ?: 0.22).toFloat().coerceIn(0.05f, 0.5f)
                val mesh = PhotoMeshBuilder.build(
                    mask, width, height, PhotoMeshBuilder.Options(depth = depth)
                ) ?: throw IllegalStateException("The 3DDD mesh builder produced no triangles.")
                val dir = File(context.filesDir, "threed/avatars").apply { mkdirs() }
                val name = (call.getString("name") ?: "photo-avatar")
                    .replace(Regex("[^A-Za-z0-9._-]"), "_").ifBlank { "photo-avatar" }
                val file = File(dir, name + "-" + UUID.randomUUID().toString() + ".glb")
                val png = ByteArrayOutputStream().use { out ->
                    if (!bitmap!!.compress(CompressFormat.PNG, 100, out)) {
                        throw IllegalStateException("Could not encode the source image as PNG texture.")
                    }
                    out.toByteArray()
                }
                GltfMeshWriter.write(mesh, png, name, file)
                if (!file.isFile || file.length() < 20L) {
                    throw IllegalStateException("GLB writer returned no usable file.")
                }
                val magic = file.inputStream().use { input ->
                    ByteArray(4).also { input.read(it) }.toString(Charsets.US_ASCII)
                }
                if (magic != "glTF") throw IllegalStateException("GLB validation failed: missing glTF magic.")
                val result = JSObject()
                result.put("ok", true)
                result.put("file", file.absolutePath)
                result.put("bytes", file.length())
                result.put("triangles", mesh.triangleCount)
                result.put("vertices", mesh.vertexCount)
                result.put("usedSilhouette", usable)
                call.resolve(result)
            } catch (t: Throwable) {
                call.resolve(error(t.message ?: t.javaClass.simpleName))
            } finally {
                bitmap?.recycle()
            }
        }
    }

    private fun error(message: String): JSObject = JSObject().apply {
        put("ok", false)
        put("error", message)
    }

    private fun ovalMask(width: Int, height: Int): BooleanArray {
        val cx = width / 2f
        val cy = height / 2f
        val rx = width * 0.42f
        val ry = height * 0.47f
        return BooleanArray(width * height) { i ->
            val x = i % width
            val y = i / width
            val dx = (x + 0.5f - cx) / rx
            val dy = (y + 0.5f - cy) / ry
            dx * dx + dy * dy <= 1f
        }
    }
}
