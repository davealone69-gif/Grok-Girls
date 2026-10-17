package ai.grokgirls.studio

import android.content.Intent
import android.util.Base64
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.InetSocketAddress
import java.net.Socket
import java.net.URL
import java.util.concurrent.Executors

/**
 * Native HTTP transport for the user-configured A1111/ComfyUI server.
 *
 * The Capacitor page is HTTPS while local Termux servers are HTTP. Browser
 * fetch can be blocked by mixed-content/CORS rules even when the server is
 * healthy. This bridge performs the same configured request natively and
 * returns the real HTTP status and response bytes. It does not start, stop,
 * or alter any server process.
 */
@CapacitorPlugin(name = "SelfHostedHttp")
class SelfHostedHttpPlugin : Plugin() {
    private val pool = Executors.newCachedThreadPool()

    companion object {
        private const val TERMUX_PACKAGE = "com.termux"
        private const val TERMUX_SERVICE = "com.termux.app.RunCommandService"
        private const val TERMUX_RUN_COMMAND = "com.termux.RUN_COMMAND"
    }

    private fun portOpen(url: URL, timeoutMs: Int): Boolean = try {
        Socket().use { socket ->
            socket.connect(InetSocketAddress(url.host, if (url.port > 0) url.port else url.defaultPort), timeoutMs)
            true
        }
    } catch (_: Exception) {
        false
    }

    private fun comfyApiResponds(base: String): Boolean {
        var connection: HttpURLConnection? = null
        return try {
            connection = URL("$base/system_stats").openConnection() as HttpURLConnection
            connection.requestMethod = "GET"
            connection.connectTimeout = 2500
            connection.readTimeout = 2500
            connection.responseCode in 200..299
        } catch (_: Exception) {
            false
        } finally {
            connection?.disconnect()
        }
    }

    /**
     * Start only the configured local ComfyUI process through Termux.
     * Never stops or restarts Ollama, sd-server, or any other process.
     */
    @PluginMethod
    fun startServer(call: PluginCall) {
        val base = call.getString("base")?.trim()?.trimEnd('/').orEmpty()
        val timeoutMs = (call.getInt("timeoutMs") ?: 120000).coerceIn(10000, 300000)
        pool.execute {
            try {
                val url = URL(base)
                val port = if (url.port > 0) url.port else url.defaultPort
                if (url.protocol != "http" || url.host !in listOf("127.0.0.1", "localhost", "::1") || port != 8188) {
                    val r = JSObject()
                    r.put("started", false)
                    r.put("message", "In-app start currently supports phone-local ComfyUI on http://127.0.0.1:8188 only. Remote servers and A1111 must be started at their own host.")
                    call.resolve(r)
                    return@execute
                }

                if (portOpen(url, 1200)) {
                    val r = JSObject()
                    r.put("started", comfyApiResponds(base))
                    r.put("method", "already-running")
                    r.put("message", if (comfyApiResponds(base))
                        "ComfyUI API is already responding at $base. Use TEST REAL RENDER to verify image generation."
                    else
                        "Port 8188 has a listener, but it does not answer the ComfyUI /system_stats API. No second server was started.")
                    call.resolve(r)
                    return@execute
                }

                val ctx = context
                val installed = runCatching { ctx.packageManager.getPackageInfo(TERMUX_PACKAGE, 0) != null }.getOrDefault(false)
                if (!installed) {
                    val r = JSObject()
                    r.put("started", false)
                    r.put("method", "none")
                    r.put("message", "Termux is not installed; the app cannot start ComfyUI. Install Termux and retry.")
                    call.resolve(r)
                    return@execute
                }

                val script =
                    "cd \"\$HOME/llama/llama.cpp/ComfyUI\" || { echo 'ComfyUI folder not found at ~/llama/llama.cpp/ComfyUI' >&2; exit 127; }; " +
                    "nohup env LD_PRELOAD=\"\$PREFIX/lib/libpython3.13.so\" python main.py --listen 127.0.0.1 --port 8188 " +
                    "> \"\$HOME/comfyui.log\" 2>&1 &"
                val intent = Intent()
                intent.setClassName(TERMUX_PACKAGE, TERMUX_SERVICE)
                intent.action = TERMUX_RUN_COMMAND
                intent.putExtra("com.termux.RUN_COMMAND_PATH", "/data/data/com.termux/files/usr/bin/bash")
                intent.putExtra("com.termux.RUN_COMMAND_ARGUMENTS", arrayOf("-lc", script))
                intent.putExtra("com.termux.RUN_COMMAND_WORKDIR", "/data/data/com.termux/files/home")
                intent.putExtra("com.termux.RUN_COMMAND_BACKGROUND", true)
                intent.putExtra("com.termux.RUN_COMMAND_SESSION_ACTION", "0")
                val launched = runCatching { ctx.startService(intent); true }.getOrDefault(false)
                if (!launched) {
                    val r = JSObject()
                    r.put("started", false)
                    r.put("method", "termux")
                    r.put("message", "Termux refused the start command. Grant RUN_COMMAND permission and set allow-external-apps=true in ~/.termux/termux.properties.")
                    call.resolve(r)
                    return@execute
                }

                val deadline = System.currentTimeMillis() + timeoutMs
                while (System.currentTimeMillis() < deadline) {
                    if (comfyApiResponds(base)) {
                        val r = JSObject()
                        r.put("started", true)
                        r.put("method", "termux")
                        r.put("message", "ComfyUI API is responding at $base. Use TEST REAL RENDER to verify generation.")
                        call.resolve(r)
                        return@execute
                    }
                    Thread.sleep(1000)
                }
                val r = JSObject()
                r.put("started", false)
                r.put("method", "termux")
                r.put("message", "ComfyUI did not become API-ready within ${timeoutMs / 1000}s. Check ~/comfyui.log; the app did not stop or restart any other server.")
                call.resolve(r)
            } catch (e: Exception) {
                call.reject("Could not start ComfyUI: " + (e.message?.takeIf { it.isNotBlank() } ?: e.javaClass.simpleName))
            }
        }
    }

    @PluginMethod
    fun request(call: PluginCall) {
        val rawUrl = call.getString("url")?.trim().orEmpty()
        if (rawUrl.isBlank()) {
            call.reject("Self-hosted HTTP request requires a URL.")
            return
        }
        val method = (call.getString("method") ?: "GET").uppercase()
        val timeoutMs = (call.getInt("timeoutMs") ?: 8000).coerceIn(1000, 600000)
        val body = call.getString("body")
        val headers = call.data.optJSONObject("headers") ?: JSONObject()

        pool.execute {
            var connection: HttpURLConnection? = null
            try {
                val url = URL(rawUrl)
                if (url.protocol != "http" && url.protocol != "https") {
                    throw IllegalArgumentException("Only HTTP and HTTPS self-hosted endpoints are supported.")
                }
                connection = url.openConnection() as HttpURLConnection
                connection.requestMethod = method
                connection.connectTimeout = minOf(timeoutMs, 15000)
                connection.readTimeout = timeoutMs
                connection.instanceFollowRedirects = true
                for (key in headers.keys()) {
                    val value = headers.optString(key, "")
                    if (value.isNotEmpty()) connection.setRequestProperty(key, value)
                }
                if (body != null && method !in listOf("GET", "HEAD")) {
                    connection.doOutput = true
                    if (!headers.has("Content-Type")) {
                        connection.setRequestProperty("Content-Type", "application/json")
                    }
                    connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
                }

                val status = connection.responseCode
                val contentType = connection.contentType ?: "application/octet-stream"
                val stream = if (status in 200..299) connection.inputStream else connection.errorStream
                val bytes = stream?.use { it.readBytes() } ?: ByteArray(0)
                val result = JSObject()
                result.put("status", status)
                result.put("ok", status in 200..299)
                result.put("contentType", contentType)
                if (contentType.startsWith("text/") ||
                    contentType.contains("json", ignoreCase = true) ||
                    contentType.contains("xml", ignoreCase = true)
                ) {
                    result.put("bodyText", String(bytes, Charsets.UTF_8))
                } else {
                    result.put("bodyBase64", Base64.encodeToString(bytes, Base64.NO_WRAP))
                }
                call.resolve(result)
            } catch (e: Exception) {
                call.reject(
                    "Native self-hosted request failed: " +
                        (e.message?.takeIf { it.isNotBlank() } ?: e.javaClass.simpleName)
                )
            } finally {
                connection?.disconnect()
            }
        }
    }
}
