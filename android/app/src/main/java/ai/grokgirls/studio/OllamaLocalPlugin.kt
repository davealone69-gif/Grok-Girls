package ai.grokgirls.studio

import android.content.Intent
import android.net.Uri
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.InetSocketAddress
import java.net.Socket
import java.net.URL
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Phone-local Ollama bridge.
 *
 * Why this exists instead of calling fetch() from the WebView:
 *
 *  - CORS: Ollama only answers browser requests whose Origin is in
 *    OLLAMA_ORIGINS. A Capacitor WebView origin (https://localhost) is not,
 *    so fetch() fails opaquely. An HttpURLConnection from Kotlin is not a
 *    browser request — no preflight, no Origin check.
 *  - Cleartext: the WebView page is https://localhost; http://127.0.0.1 is
 *    blocked as mixed content. Native HTTP has no such rule (and the
 *    manifest whitelists only loopback cleartext).
 *
 * Methods (all async, off the UI thread):
 *   status(base, timeoutMs)  -> { running, version, models[] }
 *   listModels(base)         -> { models[] }
 *   chat(base, model, messages, stream, requestId, timeoutMs, temperature)
 *                            -> { ok, text }  (+ 'ollamaToken' events)
 *   pull(base, model, requestId) -> { ok }    (+ 'ollamaPullProgress' events)
 *   startServer(base, timeoutMs) -> { started, method, message }
 *   cancel(requestId)        -> { ok }
 */
@CapacitorPlugin(name = "OllamaLocal")
class OllamaLocalPlugin : Plugin() {

    private val pool = Executors.newCachedThreadPool()
    private val cancelled = ConcurrentHashMap<String, AtomicBoolean>()
    private val liveConnections = ConcurrentHashMap<String, HttpURLConnection>()

    companion object {
        private const val DEFAULT_BASE = "http://127.0.0.1:11434"
        private const val TERMUX_PACKAGE = "com.termux"
        private const val TERMUX_RUN_COMMAND = "com.termux.RUN_COMMAND"
        private const val TERMUX_SERVICE = "com.termux.app.RunCommandService"
        private const val TERMUX_PERMISSION = "com.termux.permission.RUN_COMMAND"
    }

    /* ------------------------------------------------------------ utils */

    private fun baseOf(call: PluginCall): String =
        (call.getString("base") ?: DEFAULT_BASE).trim().trimEnd('/').removeSuffix("/v1")

    private fun hostPort(base: String): Pair<String, Int> = try {
        val u = URL(base)
        Pair(u.host ?: "127.0.0.1", if (u.port > 0) u.port else 11434)
    } catch (_: Exception) {
        Pair("127.0.0.1", 11434)
    }

    /** TCP-level liveness: much faster + more honest than an HTTP timeout. */
    private fun portOpen(base: String, timeoutMs: Int): Boolean {
        val (host, port) = hostPort(base)
        return try {
            Socket().use { s ->
                s.connect(InetSocketAddress(host, port), timeoutMs)
                true
            }
        } catch (_: Exception) {
            false
        }
    }

    private fun openConnection(url: String, method: String, timeoutMs: Int): HttpURLConnection {
        val c = URL(url).openConnection() as HttpURLConnection
        c.requestMethod = method
        c.connectTimeout = minOf(timeoutMs, 15000)
        c.readTimeout = timeoutMs
        c.setRequestProperty("Accept", "application/json")
        c.setRequestProperty("User-Agent", "GrokGirlsStudio/Android")
        return c
    }

    private fun readBody(c: HttpURLConnection): String {
        val stream = if (c.responseCode in 200..299) c.inputStream else c.errorStream
        return stream?.let { BufferedReader(InputStreamReader(it)).use { r -> r.readText() } } ?: ""
    }

    private fun httpGet(base: String, path: String, timeoutMs: Int): Pair<Int, String> {
        val c = openConnection("$base$path", "GET", timeoutMs)
        return try {
            Pair(c.responseCode, readBody(c))
        } finally {
            c.disconnect()
        }
    }

    private fun writeJson(c: HttpURLConnection, body: JSONObject) {
        c.doOutput = true
        c.setRequestProperty("Content-Type", "application/json")
        val out: OutputStream = c.outputStream
        out.write(body.toString().toByteArray(Charsets.UTF_8))
        out.flush()
        out.close()
    }

    /** models[] as a JSArray, built via the String constructor (the only
     *  reliable JSONArray -> JSArray conversion in the Capacitor API). */
    private fun modelsArray(tagsJson: String): JSArray {
        val arr = try {
            JSONObject(tagsJson).optJSONArray("models") ?: JSONArray()
        } catch (_: Exception) {
            JSONArray()
        }
        return try {
            JSArray(arr.toString())
        } catch (_: Exception) {
            JSArray()
        }
    }

    private fun fail(call: PluginCall, message: String) {
        val r = JSObject()
        r.put("ok", false)
        r.put("running", false)
        r.put("started", false)
        r.put("message", message)
        call.resolve(r)
    }

    /* ----------------------------------------------------------- status */

    @PluginMethod
    fun status(call: PluginCall) {
        val base = baseOf(call)
        val timeout = call.getInt("timeoutMs") ?: 4000
        pool.execute {
            try {
                if (!portOpen(base, minOf(timeout, 2500))) {
                    val r = JSObject()
                    r.put("running", false)
                    r.put("models", JSArray())
                    r.put("message", "Nothing is listening on $base — the Ollama server is not running.")
                    call.resolve(r)
                    return@execute
                }
                val (code, body) = httpGet(base, "/api/tags", timeout)
                if (code !in 200..299) {
                    val r = JSObject()
                    r.put("running", false)
                    r.put("models", JSArray())
                    r.put("message", "Ollama answered HTTP $code at $base/api/tags")
                    call.resolve(r)
                    return@execute
                }
                var version: String? = null
                try {
                    val (vc, vb) = httpGet(base, "/api/version", 2500)
                    if (vc in 200..299) {
                        val v = JSONObject(vb).optString("version", "")
                        if (v.isNotEmpty()) version = v
                    }
                } catch (_: Exception) { /* optional */ }

                val r = JSObject()
                r.put("running", true)
                r.put("models", modelsArray(body))
                if (version != null) r.put("version", version)
                r.put("message", "Ollama running at $base")
                call.resolve(r)
            } catch (e: Exception) {
                fail(call, "Ollama probe failed: ${e.message}")
            }
        }
    }

    @PluginMethod
    fun listModels(call: PluginCall) {
        val base = baseOf(call)
        pool.execute {
            try {
                val (code, body) = httpGet(base, "/api/tags", 6000)
                val r = JSObject()
                r.put("ok", code in 200..299)
                r.put("models", modelsArray(body))
                call.resolve(r)
            } catch (e: Exception) {
                fail(call, "Could not list models: ${e.message}")
            }
        }
    }

    /* ------------------------------------------------------------- chat */

    @PluginMethod
    fun chat(call: PluginCall) {
        val base = baseOf(call)
        val model = call.getString("model") ?: "llama3.2:1b"
        val stream = call.getBoolean("stream") ?: true
        val requestId = call.getString("requestId") ?: "ollama-${System.currentTimeMillis()}"
        val timeout = call.getInt("timeoutMs") ?: 180000
        val temperature = call.getDouble("temperature")
        val messages = call.getArray("messages") ?: JSArray()

        val flag = AtomicBoolean(false)
        cancelled[requestId] = flag

        pool.execute {
            var conn: HttpURLConnection? = null
            try {
                val payload = JSONObject()
                payload.put("model", model)
                payload.put("messages", JSONArray(messages.toString()))
                payload.put("stream", stream)
                if (temperature != null) {
                    val options = JSONObject()
                    options.put("temperature", temperature)
                    payload.put("options", options)
                }

                // Native /api/chat: same model, simpler NDJSON framing than SSE.
                conn = openConnection("$base/api/chat", "POST", timeout)
                writeJson(conn, payload)
                liveConnections[requestId] = conn

                val code = conn.responseCode
                if (code !in 200..299) {
                    val err = readBody(conn).take(300)
                    fail(call, "Ollama HTTP $code — $err")
                    return@execute
                }

                val sb = StringBuilder()
                BufferedReader(InputStreamReader(conn.inputStream)).use { reader ->
                    while (true) {
                        if (flag.get()) break
                        val line = reader.readLine() ?: break
                        val t = line.trim()
                        if (t.isEmpty()) continue
                        try {
                            val evt = JSONObject(t)
                            val evtError = evt.optString("error", "")
                            if (evtError.isNotEmpty()) throw IllegalStateException(evtError)
                            val token = evt.optJSONObject("message")?.optString("content", "") ?: ""
                            if (token.isNotEmpty()) {
                                sb.append(token)
                                if (stream) {
                                    val ev = JSObject()
                                    ev.put("requestId", requestId)
                                    ev.put("token", token)
                                    notifyListeners("ollamaToken", ev)
                                }
                            }
                            if (evt.optBoolean("done", false)) break
                        } catch (e: IllegalStateException) {
                            throw e
                        } catch (_: Exception) {
                            // partial / non-JSON keep-alive line
                        }
                    }
                }

                if (flag.get()) {
                    fail(call, "Ollama request cancelled.")
                    return@execute
                }
                val r = JSObject()
                r.put("ok", sb.isNotEmpty())
                r.put("text", sb.toString())
                if (sb.isEmpty()) r.put("message", "Ollama returned an empty response.")
                call.resolve(r)
            } catch (e: Exception) {
                fail(call, e.message ?: "Ollama chat failed.")
            } finally {
                liveConnections.remove(requestId)
                cancelled.remove(requestId)
                conn?.disconnect()
            }
        }
    }

    @PluginMethod
    fun cancel(call: PluginCall) {
        val requestId = call.getString("requestId") ?: ""
        cancelled[requestId]?.set(true)
        pool.execute { runCatching { liveConnections[requestId]?.disconnect() } }
        val r = JSObject()
        r.put("ok", true)
        call.resolve(r)
    }

    /* ------------------------------------------------------------- pull */

    @PluginMethod
    fun pull(call: PluginCall) {
        val base = baseOf(call)
        val model = call.getString("model") ?: return call.reject("model is required")
        val requestId = call.getString("requestId") ?: "pull-${System.currentTimeMillis()}"

        pool.execute {
            var conn: HttpURLConnection? = null
            try {
                val payload = JSONObject()
                payload.put("model", model)
                payload.put("stream", true)
                conn = openConnection("$base/api/pull", "POST", 60 * 60 * 1000)
                writeJson(conn, payload)
                if (conn.responseCode !in 200..299) {
                    fail(call, "Pull failed: HTTP ${conn.responseCode} — ${readBody(conn).take(200)}")
                    return@execute
                }
                BufferedReader(InputStreamReader(conn.inputStream)).use { reader ->
                    while (true) {
                        val line = reader.readLine() ?: break
                        val t = line.trim()
                        if (t.isEmpty()) continue
                        try {
                            val evt = JSONObject(t)
                            val error = evt.optString("error", "")
                            if (error.isNotEmpty()) throw IllegalStateException(error)
                            val ev = JSObject()
                            ev.put("requestId", requestId)
                            ev.put("status", evt.optString("status", ""))
                            if (evt.has("completed")) ev.put("completed", evt.optLong("completed"))
                            if (evt.has("total")) ev.put("total", evt.optLong("total"))
                            notifyListeners("ollamaPullProgress", ev)
                        } catch (e: IllegalStateException) {
                            throw e
                        } catch (_: Exception) {
                        }
                    }
                }
                val r = JSObject()
                r.put("ok", true)
                call.resolve(r)
            } catch (e: Exception) {
                fail(call, e.message ?: "Model pull failed.")
            } finally {
                conn?.disconnect()
            }
        }
    }

    /* ----------------------------------------------------- start server */

    /**
     * Start `ollama serve` via Termux's RUN_COMMAND service, then poll the
     * port until it answers. Requires the Termux app, its RUN_COMMAND
     * permission, and allow-external-apps=true in ~/.termux/termux.properties.
     */
    @PluginMethod
    fun startServer(call: PluginCall) {
        val base = baseOf(call)
        val timeout = call.getInt("timeoutMs") ?: 30000

        pool.execute {
            try {
                if (portOpen(base, 1500)) {
                    val r = JSObject()
                    r.put("started", true)
                    r.put("method", "already-running")
                    r.put("message", "Ollama is already running at $base")
                    call.resolve(r)
                    return@execute
                }

                val ctx = context
                val termuxInstalled = runCatching {
                    ctx.packageManager.getPackageInfo(TERMUX_PACKAGE, 0) != null
                }.getOrDefault(false)

                if (!termuxInstalled) {
                    val r = JSObject()
                    r.put("started", false)
                    r.put("method", "none")
                    r.put(
                        "message",
                        "Termux is not installed, so the app cannot start the server itself. " +
                            "Install Termux, run \"ollama serve\", then press RETRY."
                    )
                    call.resolve(r)
                    return@execute
                }

                val intent = Intent()
                intent.setClassName(TERMUX_PACKAGE, TERMUX_SERVICE)
                intent.action = TERMUX_RUN_COMMAND
                intent.putExtra("com.termux.RUN_COMMAND_PATH", "/data/data/com.termux/files/usr/bin/bash")
                intent.putExtra(
                    "com.termux.RUN_COMMAND_ARGUMENTS",
                    arrayOf("-lc", "pgrep -f 'ollama serve' >/dev/null 2>&1 || (OLLAMA_HOST=127.0.0.1:11434 nohup ollama serve >/dev/null 2>&1 &)")
                )
                intent.putExtra("com.termux.RUN_COMMAND_WORKDIR", "/data/data/com.termux/files/home")
                intent.putExtra("com.termux.RUN_COMMAND_BACKGROUND", true)
                intent.putExtra("com.termux.RUN_COMMAND_SESSION_ACTION", "0")

                // startForegroundService is API 26+; minSdk here is 23.
                val launched = runCatching {
                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                        ctx.startForegroundService(intent)
                    } else {
                        ctx.startService(intent)
                    }
                    true
                }.recoverCatching { ctx.startService(intent); true }
                    .getOrDefault(false)

                if (!launched) {
                    val r = JSObject()
                    r.put("started", false)
                    r.put("method", "termux")
                    r.put(
                        "message",
                        "Termux refused the start command. Grant the RUN_COMMAND permission and set " +
                            "allow-external-apps=true in ~/.termux/termux.properties, or run \"ollama serve\" manually."
                    )
                    call.resolve(r)
                    return@execute
                }

                // poll for readiness
                val deadline = System.currentTimeMillis() + timeout
                while (System.currentTimeMillis() < deadline) {
                    if (portOpen(base, 1200)) {
                        // port is open; wait for the API to actually answer
                        val (code, _) = runCatching { httpGet(base, "/api/tags", 3000) }.getOrDefault(Pair(0, ""))
                        if (code in 200..299) {
                            val r = JSObject()
                            r.put("started", true)
                            r.put("method", "termux")
                            r.put("message", "✓ Ollama server started at $base")
                            call.resolve(r)
                            return@execute
                        }
                    }
                    Thread.sleep(700)
                }

                val r = JSObject()
                r.put("started", false)
                r.put("method", "termux")
                r.put(
                    "message",
                    "Start command sent to Termux but $base did not come up within ${timeout / 1000}s. " +
                        "Open Termux and check \"ollama serve\" output."
                )
                call.resolve(r)
            } catch (e: Exception) {
                fail(call, e.message ?: "Could not start the Ollama server.")
            }
        }
    }

    /** Open Termux (or the Play listing) so the user can finish setup. */
    @PluginMethod
    fun openTermux(call: PluginCall) {
        val ctx = context
        val launch = ctx.packageManager.getLaunchIntentForPackage(TERMUX_PACKAGE)
        val intent = launch ?: Intent(Intent.ACTION_VIEW, Uri.parse("https://f-droid.org/packages/com.termux/"))
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        runCatching { ctx.startActivity(intent) }
        val r = JSObject()
        r.put("ok", true)
        r.put("installed", launch != null)
        call.resolve(r)
    }
}
