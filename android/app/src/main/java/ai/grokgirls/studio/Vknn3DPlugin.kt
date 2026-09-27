package ai.grokgirls.studio

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/** Native manager for the real VKNN YoNoSplat .vxm model. No model bytes are bundled in the APK. */
@CapacitorPlugin(name = "Vknn3D")
class Vknn3DPlugin : Plugin() {
    private val pool = Executors.newSingleThreadExecutor()

    companion object {
        private const val MODEL_URL =
            "https://huggingface.co/katolikov/yonosplat-vknn/resolve/main/encoder8_fp16.vxm?download=true"
        private const val MODEL_NAME = "encoder8_fp16.vxm"
    }

    @PluginMethod
    fun status(call: PluginCall) {
        val file = modelFile()
        val loaded = VknnNative.ensureLoaded()
        val result = JSObject()
        result.put("nativeLoaded", loaded)
        if (!loaded) result.put("nativeError", VknnNative.error())
        result.put("modelFile", file.absolutePath)
        result.put("modelPresent", file.isFile && file.length() > 1024L)
        result.put("modelBytes", if (file.isFile) file.length() else 0L)
        result.put("modelUrl", MODEL_URL)
        result.put("message", when {
            !loaded -> "VKNN native library could not be loaded: " + (VknnNative.error() ?: "unknown error")
            !file.isFile -> "VKNN is built into this APK; YoNoSplat model is not downloaded yet."
            else -> "VKNN native library loaded and YoNoSplat model is present."
        })
        call.resolve(result)
    }

    @PluginMethod
    fun downloadModel(call: PluginCall) {
        pool.execute {
            try {
                val target = modelFile()
                target.parentFile?.mkdirs()
                val part = File(target.parentFile, target.name + ".part")
                val conn = (URL(MODEL_URL).openConnection() as HttpURLConnection).apply {
                    connectTimeout = 15000
                    readTimeout = 60000
                    instanceFollowRedirects = true
                    requestMethod = "GET"
                }
                conn.connect()
                val code = conn.responseCode
                if (code !in 200..299) throw IllegalStateException("Hugging Face returned HTTP $code")
                val total = conn.contentLengthLong
                var done = 0L
                conn.inputStream.use { input ->
                    part.outputStream().use { output ->
                        val buffer = ByteArray(1024 * 1024)
                        while (true) {
                            val n = input.read(buffer)
                            if (n < 0) break
                            output.write(buffer, 0, n)
                            done += n
                            if (total > 0) notifyProgress(done, total)
                        }
                    }
                }
                conn.disconnect()
                if (done < 1024L) throw IllegalStateException("Downloaded model is unexpectedly small.")
                if (target.exists()) target.delete()
                if (!part.renameTo(target)) throw IllegalStateException("Could not finalize downloaded model.")
                val result = JSObject()
                result.put("ok", true)
                result.put("file", target.absolutePath)
                result.put("bytes", target.length())
                call.resolve(result)
            } catch (t: Throwable) {
                call.resolve(JSObject().apply {
                    put("ok", false)
                    put("error", t.message ?: t.javaClass.simpleName)
                })
            }
        }
    }

    private fun notifyProgress(done: Long, total: Long) {
        val data = JSObject()
        data.put("done", done)
        data.put("total", total)
        data.put("fraction", if (total > 0) done.toDouble() / total else -1.0)
        notifyListeners("downloadProgress", data)
    }

    private fun modelFile(): File = File(context.filesDir, "vknn/models/$MODEL_NAME")
}
