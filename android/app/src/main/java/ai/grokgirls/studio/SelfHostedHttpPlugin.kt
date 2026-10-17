package ai.grokgirls.studio

import android.util.Base64
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONObject
import java.net.HttpURLConnection
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
