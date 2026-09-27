package ai.grokgirls.studio

import android.graphics.Bitmap
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
import java.io.File
import java.util.UUID
import java.util.concurrent.Executors

/** Real phone-native single-image -> mesh -> self-contained GLB pipeline from 3DDD. */
@CapacitorPlugin(name = "Photo3DLocal")
class Photo3DLocalPlugin : Plugin() {
    private val pool = Executors.newCachedThreadPool()

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
                GltfMeshWriter.write(mesh, bytes, name, file)
                if (!file.isFile || file.length() < 20L) {
                    throw IllegalStateException("GLB writer returned no usable file.")
                }
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
