package ai.grokgirls.studio

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.UUID
import java.util.concurrent.Executors

internal object VknnModelIntegrity {
    const val MODEL_REVISION = "2d148c902dbfd10473d91b6be4278ebf9dbd4e91"
    const val MODEL_SIZE = 2_336_982_453L
    const val MODEL_SHA256 = "406dfebef5f9135af2085ec586f10ff7efbe8eb76c919242f64c464b13144835"
    private const val MAX_REDIRECTS = 5
    private val TRUSTED_HOSTS = setOf("huggingface.co", "hf.co")

    fun isTrustedHost(host: String?): Boolean {
        val normalized = host?.lowercase()?.trimEnd('.') ?: return false
        return TRUSTED_HOSTS.any { normalized == it || normalized.endsWith(".$it") }
    }

    fun verify(file: File, expectedSize: Long = MODEL_SIZE, expectedSha256: String = MODEL_SHA256): Boolean {
        if (!file.isFile || file.length() != expectedSize) return false
        val digest = MessageDigest.getInstance("SHA-256")
        return file.inputStream().use { input ->
            val buffer = ByteArray(1024 * 1024)
            var total = 0L
            while (true) {
                val count = input.read(buffer)
                if (count < 0) break
                total += count
                if (total > expectedSize) return@use false
                digest.update(buffer, 0, count)
            }
            total == expectedSize && digest.digest().toHex() == expectedSha256
        }
    }

    fun verifiedFileOrNull(
        file: File,
        expectedSize: Long = MODEL_SIZE,
        expectedSha256: String = MODEL_SHA256
    ): File? {
        if (!file.isFile) return null
        if (verify(file, expectedSize, expectedSha256)) return file
        file.delete()
        return null
    }

    fun resolveRedirect(current: URL, location: String): URL {
        val next = URL(current, location)
        require(next.protocol.equals("https", ignoreCase = true)) { "Model redirect must use HTTPS" }
        require(isTrustedHost(next.host)) { "Model redirect points to an untrusted host" }
        return next
    }

    fun maxRedirects(): Int = MAX_REDIRECTS

    private fun ByteArray.toHex(): String = joinToString("") { "%02x".format(it.toInt() and 0xff) }
}

/** Native manager for the real VKNN YoNoSplat .vxm model. No model bytes are bundled in the APK. */
@CapacitorPlugin(name = "Vknn3D")
class Vknn3DPlugin : Plugin() {
    private val pool = Executors.newSingleThreadExecutor()

    companion object {
        private const val MODEL_URL =
            "https://huggingface.co/katolikov/yonosplat-vknn/resolve/${VknnModelIntegrity.MODEL_REVISION}/dl3dv/encoder8_fp16.vxm?download=true"
        private const val MODEL_NAME = "encoder8_fp16.vxm"
    }

    @PluginMethod
    fun status(call: PluginCall) {
        pool.execute {
            val file = verifiedModelFile()
            val loaded = VknnNative.ensureLoaded()
            val result = JSObject()
            result.put("nativeLoaded", loaded)
            if (!loaded) result.put("nativeError", VknnNative.error())
            result.put("modelFile", modelFile().absolutePath)
            result.put("modelPresent", file != null)
            result.put("modelBytes", file?.length() ?: 0L)
            result.put("modelUrl", MODEL_URL)
            result.put("modelRevision", VknnModelIntegrity.MODEL_REVISION)
            result.put("modelSha256", VknnModelIntegrity.MODEL_SHA256)
            result.put("message", when {
                !loaded -> "VKNN native library could not be loaded: " + (VknnNative.error() ?: "unknown error")
                file == null -> "VKNN is built into this APK; verified YoNoSplat model is missing or failed integrity verification."
                else -> "VKNN native library loaded and verified YoNoSplat model is present."
            })
            call.resolve(result)
        }
    }

    @PluginMethod
    fun probeModel(call: PluginCall) {
        pool.execute {
            val result = JSObject()
            try {
                val file = verifiedModelFile()
                if (file == null) {
                    result.put("ok", false)
                    result.put("error", "YoNoSplat model is missing or failed integrity verification. Install the VKNN model first.")
                    call.resolve(result)
                    return@execute
                }
                if (!VknnNative.ensureLoaded()) {
                    result.put("ok", false)
                    result.put("error", VknnNative.error() ?: "VKNN native library could not be loaded.")
                    call.resolve(result)
                    return@execute
                }
                val cache = File(context.cacheDir, "vknn/yonosplat.cache").apply { parentFile?.mkdirs() }
                val handle = VknnNative.nativeSplatLoad(file.absolutePath, cache.absolutePath, "low", "vulkan", 512)
                if (handle == 0L) {
                    result.put("ok", false)
                    result.put("error", "VKNN returned a null YoNoSplat handle. Check the native log for the Vulkan capability/load failure.")
                } else {
                    val info = VknnNative.nativeSplatInfo(handle)
                    VknnNative.nativeSplatFree(handle)
                    result.put("ok", true)
                    result.put("gaussians", info.getOrElse(0) { 0 })
                    result.put("views", info.getOrElse(1) { 0 })
                    result.put("height", info.getOrElse(2) { 0 })
                    result.put("width", info.getOrElse(3) { 0 })
                    result.put("message", "VKNN YoNoSplat model loaded and Vulkan rasterizer initialized.")
                }
            } catch (t: Throwable) {
                result.put("ok", false)
                result.put("error", t.message ?: t.javaClass.simpleName)
            }
            call.resolve(result)
        }
    }

    @PluginMethod
    fun downloadModel(call: PluginCall) {
        pool.execute {
            val target = modelFile()
            val part = File(target.parentFile, target.name + ".part")
            try {
                target.parentFile?.mkdirs()
                part.delete()
                val usableBytes = target.parentFile?.usableSpace ?: 0L
                if (!VknnModelStorage.hasEnoughSpace(usableBytes, VknnModelIntegrity.MODEL_SIZE)) {
                    throw IllegalStateException(
                        "Insufficient internal storage for the VKNN model download: " +
                            "${usableBytes} usable bytes, ${VknnModelIntegrity.MODEL_SIZE} required"
                    )
                }
                downloadVerified(part)
                if (!VknnModelIntegrity.verify(part)) throw IllegalStateException("Downloaded model failed integrity verification.")
                replaceVerifiedModel(part, target)
                val result = JSObject()
                result.put("ok", true)
                result.put("file", target.absolutePath)
                result.put("bytes", target.length())
                result.put("sha256", VknnModelIntegrity.MODEL_SHA256)
                call.resolve(result)
            } catch (t: Throwable) {
                part.delete()
                call.resolve(JSObject().apply {
                    put("ok", false)
                    put("error", t.message ?: t.javaClass.simpleName)
                })
            } finally {
                part.delete()
            }
        }
    }

    private fun replaceVerifiedModel(part: File, target: File) {
        if (!target.exists()) {
            if (!part.renameTo(target)) throw IllegalStateException("Could not finalize verified downloaded model.")
            return
        }

        val backup = File(target.parentFile, ".${target.name}.${UUID.randomUUID()}.previous")
        if (!target.renameTo(backup)) throw IllegalStateException("Could not stage existing model for replacement.")
        try {
            if (!part.renameTo(target)) throw IllegalStateException("Could not finalize verified downloaded model.")
            backup.delete()
        } catch (failure: Throwable) {
            target.delete()
            if (!backup.renameTo(target)) {
                throw IllegalStateException("Could not restore the existing verified model after download failure.", failure)
            }
            throw failure
        }
    }

    private fun downloadVerified(part: File) {
        var current = URL(MODEL_URL)
        var connection: HttpURLConnection? = null
        try {
            repeat(VknnModelIntegrity.maxRedirects() + 1) { redirectIndex ->
                require(VknnModelIntegrity.isTrustedHost(current.host)) { "Model URL points to an untrusted host" }
                connection = (current.openConnection() as HttpURLConnection).apply {
                    connectTimeout = 15000
                    readTimeout = 60000
                    instanceFollowRedirects = false
                    requestMethod = "GET"
                }
                connection!!.connect()
                val code = connection!!.responseCode
                if (code in 300..399) {
                    if (redirectIndex == VknnModelIntegrity.maxRedirects()) throw IllegalStateException("Too many model redirects")
                    val location = connection!!.getHeaderField("Location") ?: throw IllegalStateException("Model redirect has no location")
                    current = VknnModelIntegrity.resolveRedirect(current, location)
                    connection!!.disconnect()
                    connection = null
                    return@repeat
                }
                if (code !in 200..299) throw IllegalStateException("Hugging Face returned HTTP $code")
                val total = connection!!.contentLengthLong
                if (total >= 0 && total != VknnModelIntegrity.MODEL_SIZE) {
                    throw IllegalStateException("Model size header is $total, expected ${VknnModelIntegrity.MODEL_SIZE}")
                }
                var done = 0L
                val digest = MessageDigest.getInstance("SHA-256")
                connection!!.inputStream.use { input ->
                    part.outputStream().use { output ->
                        val buffer = ByteArray(1024 * 1024)
                        while (true) {
                            val count = input.read(buffer)
                            if (count < 0) break
                            done += count
                            if (done > VknnModelIntegrity.MODEL_SIZE) throw IllegalStateException("Downloaded model exceeds expected size")
                            digest.update(buffer, 0, count)
                            output.write(buffer, 0, count)
                            notifyProgress(done, VknnModelIntegrity.MODEL_SIZE)
                        }
                    }
                }
                if (done != VknnModelIntegrity.MODEL_SIZE || digest.digest().toHex() != VknnModelIntegrity.MODEL_SHA256) {
                    throw IllegalStateException("Downloaded model digest or size does not match the trusted metadata")
                }
                return
            }
            throw IllegalStateException("Too many model redirects")
        } finally {
            connection?.disconnect()
        }
    }

    private fun notifyProgress(done: Long, total: Long) {
        val data = JSObject()
        data.put("done", done)
        data.put("total", total)
        data.put("fraction", done.toDouble() / total.toDouble())
        notifyListeners("downloadProgress", data)
    }

    private fun verifiedModelFile(): File? = VknnModelIntegrity.verifiedFileOrNull(modelFile())

    private fun modelFile(): File = File(context.filesDir, "vknn/models/$MODEL_NAME")

    private fun ByteArray.toHex(): String = joinToString("") { "%02x".format(it.toInt() and 0xff) }
}
