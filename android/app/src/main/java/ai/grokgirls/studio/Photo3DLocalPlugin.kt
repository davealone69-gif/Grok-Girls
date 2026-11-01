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
import java.util.concurrent.Semaphore
import java.util.concurrent.SynchronousQueue
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit

/** Real phone-native single-image -> mesh -> self-contained GLB pipeline from 3DDD. */
@CapacitorPlugin(name = "Photo3DLocal")
class Photo3DLocalPlugin : Plugin() {
    private val admission = Semaphore(MAX_CONCURRENT_JOBS)
    private val pool = ThreadPoolExecutor(
        MAX_CONCURRENT_JOBS,
        MAX_CONCURRENT_JOBS,
        0L,
        TimeUnit.MILLISECONDS,
        SynchronousQueue(),
        ThreadPoolExecutor.AbortPolicy()
    )

    @PluginMethod
    fun buildMultiView(call: PluginCall) {
        val images = call.getArray("images")
        val frameCount = images?.length() ?: 0
        Photo3DInputLimits.frameCountError(frameCount)?.let {
            call.resolve(error(it))
            return
        }
        enqueue(call) {
            try {
                val views = ArrayList<ai.grokgirls.studio.threed.scan.VisualHull.View>(frameCount)
                var firstPng: ByteArray? = null
                var aggregatePixels = 0L
                for (i in 0 until frameCount) {
                    val dataUrl = images!!.optString(i, "")
                    var bitmap: Bitmap? = null
                    try {
                        bitmap = decodeBounded(dataUrl, "Frame $i", aggregatePixels)
                        aggregatePixels += bitmap.width.toLong() * bitmap.height.toLong()
                        val silhouette = SilhouetteExtractor.extract(bitmap)
                        if (firstPng == null) {
                            firstPng = ByteArrayOutputStream().use { out ->
                                if (!bitmap.compress(CompressFormat.PNG, 100, out)) {
                                    throw IllegalStateException("Could not encode first frame.")
                                }
                                out.toByteArray()
                            }
                        }
                        val azimuth = (2.0 * Math.PI * i / frameCount).toFloat()
                        views.add(
                            ai.grokgirls.studio.threed.scan.VisualHull.View(
                                silhouette.mask, silhouette.width, silhouette.height, azimuth
                            )
                        )
                    } finally {
                        bitmap?.recycle()
                    }
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
        enqueue(call) {
            var bitmap: Bitmap? = null
            try {
                bitmap = decodeBounded(dataUrl, "Image")
                val silhouette = SilhouetteExtractor.extract(bitmap)
                if (silhouette.coverage !in 0.02f..0.985f) {
                    throw IllegalStateException(
                        "Foreground segmentation was not reliable (coverage=" + silhouette.coverage + "). " +
                            "Use a clearer subject/background image; no synthetic fallback mesh is used."
                    )
                }
                val width = silhouette.width
                val height = silhouette.height
                val mask = silhouette.mask
                val depth = (call.getDouble("depth") ?: 0.22).toFloat().coerceIn(0.05f, 0.5f)
                val mesh = PhotoMeshBuilder.build(
                    mask, width, height, PhotoMeshBuilder.Options(depth = depth)
                ) ?: throw IllegalStateException("The 3DDD mesh builder produced no triangles.")
                val dir = File(context.filesDir, "threed/avatars").apply { mkdirs() }
                val name = (call.getString("name") ?: "photo-avatar")
                    .replace(Regex("[^A-Za-z0-9._-]"), "_").ifBlank { "photo-avatar" }
                val file = File(dir, name + "-" + UUID.randomUUID().toString() + ".glb")
                val png = ByteArrayOutputStream().use { out ->
                    if (!bitmap.compress(CompressFormat.PNG, 100, out)) {
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
                result.put("usedSilhouette", true)
                call.resolve(result)
            } catch (t: Throwable) {
                call.resolve(error(t.message ?: t.javaClass.simpleName))
            } finally {
                bitmap?.recycle()
            }
        }
    }

    private fun enqueue(call: PluginCall, task: () -> Unit) {
        if (!admission.tryAcquire()) {
            call.resolve(error("Another photo-to-3D conversion is already running."))
            return
        }
        try {
            pool.execute {
                try {
                    task()
                } finally {
                    admission.release()
                }
            }
        } catch (t: Throwable) {
            admission.release()
            call.resolve(error("Photo-to-3D conversion could not be started."))
        }
    }

    private fun decodeBounded(dataUrl: String, label: String, aggregatePixels: Long = 0L): Bitmap {
        val comma = dataUrl.indexOf(',')
        val encodedStart = if (comma >= 0) comma + 1 else 0
        val encodedLength = dataUrl.length - encodedStart
        Photo3DInputLimits.encodedPayloadError(encodedLength)?.let {
            throw IllegalArgumentException("$label: $it")
        }
        val encoded = dataUrl.substring(encodedStart)
        val bytes = try {
            Base64.decode(encoded, Base64.DEFAULT)
        } catch (t: IllegalArgumentException) {
            throw IllegalArgumentException("$label is not valid Base64.")
        }
        if (bytes.size > Photo3DInputLimits.MAX_DECODED_BYTES) {
            throw IllegalArgumentException("$label payload is too large.")
        }
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
        Photo3DInputLimits.bitmapError(bounds.outWidth, bounds.outHeight, aggregatePixels)?.let {
            throw IllegalArgumentException("$label: $it")
        }
        return BitmapFactory.decodeByteArray(bytes, 0, bytes.size, BitmapFactory.Options())
            ?: throw IllegalArgumentException("$label could not be decoded.")
    }

    private fun error(message: String): JSObject = JSObject().apply {
        put("ok", false)
        put("error", message)
    }

    private companion object {
        const val MAX_CONCURRENT_JOBS = 2
    }
}
