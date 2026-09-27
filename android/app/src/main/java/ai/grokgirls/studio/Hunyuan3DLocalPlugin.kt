package ai.grokgirls.studio

import android.util.Base64
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.PluginMethod
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.InetSocketAddress
import java.net.Socket
import java.net.URL
import java.io.File
import java.util.UUID
import java.util.concurrent.Executors

@CapacitorPlugin(name = "Hunyuan3DLocal")
class Hunyuan3DLocalPlugin : Plugin() {
    private val pool = Executors.newCachedThreadPool()

    companion object {
        private const val DEFAULT_BASE = "http://127.0.0.1:8081"
        private const val HEALTH = "/health"
        private const val GENERATE = "/generate"
    }

    private fun base(call: PluginCall): String =
        (call.getString("base") ?: DEFAULT_BASE).trim().trimEnd('/')

    private fun fail(call: PluginCall, message: String) {
        call.resolve(JSObject().apply {
            put("ok", false)
            put("error", message)
        })
    }

    private fun connection(url: String, method: String, timeout: Int): HttpURLConnection =
        (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = minOf(timeout, 15000)
            readTimeout = timeout
            setRequestProperty("Accept", "application/json")
            setRequestProperty("User-Agent", "GrokGirlsStudio/Android")
        }

    private fun read(c: HttpURLConnection): ByteArray {
        val stream = if (c.responseCode in 200..299) c.inputStream else c.errorStream
        return stream?.use { input ->
            ByteArrayOutputStream().also { input.copyTo(it) }.toByteArray()
        } ?: ByteArray(0)
    }

    private fun postJson(c: HttpURLConnection, json: JSONObject) {
        c.doOutput = true
        c.setRequestProperty("Content-Type", "application/json")
        c.outputStream.use { out: OutputStream ->
            out.write(json.toString().toByteArray(Charsets.UTF_8))
        }
    }

    @PluginMethod
    fun status(call: PluginCall) {
        val b = base(call)
        val timeout = call.getInt("timeoutMs") ?: 4000
        pool.execute {
            try {
                val u = URL(b)
                val port = if (u.port > 0) u.port else 80
                Socket().use { it.connect(InetSocketAddress(u.host, port), minOf(timeout, 2500)) }
                val c = connection(b + HEALTH, "GET", timeout)
                try {
                    val code = c.responseCode
                    val body = String(read(c), Charsets.UTF_8)
                    val r = JSObject()
                    r.put("ok", code in 200..299)
                    r.put("base", b)
                    r.put("message", if (code in 200..299) "Hunyuan3D worker is ready at " + b else "Hunyuan3D worker returned HTTP " + code)
                    if (body.isNotBlank()) r.put("health", body.take(1000))
                    call.resolve(r)
                } finally {
                    c.disconnect()
                }
            } catch (e: Exception) {
                fail(call, "Cannot reach Hunyuan3D worker at " + b + ": " + (e.message ?: e.javaClass.simpleName))
            }
        }
    }

    @PluginMethod
    fun generate(call: PluginCall) {
        val b = base(call)
        var image = call.getString("image")?.trim().orEmpty()
        if (image.isEmpty()) {
            fail(call, "A source image is required for Hunyuan3D image-to-3D generation.")
            return
        }
        val comma = image.indexOf(',')
        if (image.startsWith("data:") && comma >= 0) image = image.substring(comma + 1)
        val timeout = call.getInt("timeoutMs") ?: 1800000
        val texture = call.getBoolean("texture") ?: true
        val seed = call.getInt("seed") ?: 1234
        val resolution = call.getInt("octreeResolution") ?: 256
        val steps = call.getInt("steps") ?: 5

        pool.execute {
            try {
                Base64.decode(image, Base64.DEFAULT)
                val body = JSONObject()
                    .put("image", image)
                    .put("remove_background", true)
                    .put("texture", texture)
                    .put("seed", seed)
                    .put("octree_resolution", resolution)
                    .put("num_inference_steps", steps)
                    .put("guidance_scale", 5.0)
                    .put("num_chunks", 8000)
                    .put("face_count", 40000)
                    .put("type", "glb")

                val c = connection(b + GENERATE, "POST", timeout)
                try {
                    postJson(c, body)
                    val code = c.responseCode
                    val bytes = read(c)
                    if (code !in 200..299) {
                        val detail = String(bytes, Charsets.UTF_8).take(500)
                        fail(call, "Hunyuan3D generation failed (HTTP " + code + ")" + if (detail.isNotBlank()) ": " + detail else "")
                        return@execute
                    }
                    require(bytes.size >= 20) { "Worker returned an empty or invalid GLB payload." }
                    require(bytes[0] == 0x67.toByte() && bytes[1] == 0x6c.toByte() && bytes[2] == 0x54.toByte() && bytes[3] == 0x46.toByte()) {
                        "Worker returned a non-GLB payload."
                    }
                    val dir = File(context.filesDir, "hunyuan3d").apply { mkdirs() }
                    val file = File(dir, "avatar-" + UUID.randomUUID() + ".glb")
                    file.writeBytes(bytes)
                    call.resolve(JSObject().apply {
                        put("ok", true)
                        put("file", file.absolutePath)
                        put("bytes", bytes.size)
                        put("format", "glb")
                    })
                } finally {
                    c.disconnect()
                }
            } catch (e: Exception) {
                fail(call, "Hunyuan3D generation failed: " + (e.message ?: e.javaClass.simpleName))
            }
        }
    }
}
