package ai.grokgirls.studio

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
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
 * Phone-local Stable Diffusion bridge.
 *
 *   Android App -> Local Server Manager -> Termux -> sd-server :1234
 *
 * This is the IMAGE half of the local stack and is deliberately independent
 * of OllamaLocalPlugin (the TEXT half on :11434): separate port, separate
 * Termux command, separate lifecycle. Neither can start or stop the other.
 *
 * Why native instead of fetch() from the WebView — same two reasons as the
 * Ollama bridge:
 *  - CORS: sd-server sends no Access-Control-Allow-Origin, so a WebView
 *    fetch from https://localhost fails opaquely. HttpURLConnection is not
 *    a browser request, so there is no preflight and no Origin check.
 *  - Cleartext: http://127.0.0.1 from an https://localhost page is blocked
 *    as mixed content. Native HTTP has no such rule (and the manifest
 *    whitelists only loopback cleartext).
 *
 * Methods (all async, off the UI thread):
 *   status(base, timeoutMs)      -> { running, model, message }
 *   txt2img(base, prompt, ...)   -> { ok, image, width, height, seed }
 *   startServer(base, timeoutMs) -> { started, method, message }
 *   cancel(requestId)            -> { ok }
 */
@CapacitorPlugin(name = "SdLocal")
class SdLocalPlugin : Plugin() {

    private val pool = Executors.newCachedThreadPool()
    private val cancelled = ConcurrentHashMap<String, AtomicBoolean>()
    private val liveConnections = ConcurrentHashMap<String, HttpURLConnection>()

    companion object {
        private const val DEFAULT_BASE = "http://127.0.0.1:1234"
        private const val DEFAULT_PORT = 1234
        private const val TXT2IMG_PATH = "/sdapi/v1/txt2img"
        private const val TERMUX_PACKAGE = "com.termux"
        private const val TERMUX_RUN_COMMAND = "com.termux.RUN_COMMAND"
        private const val TERMUX_SERVICE = "com.termux.app.RunCommandService"
    }

    /* ------------------------------------------------------------ utils */

    private fun baseOf(call: PluginCall): String =
        (call.getString("base") ?: DEFAULT_BASE).trim().trimEnd('/')

    private fun hostPort(base: String): Pair<String, Int> = try {
        val u = URL(base)
        Pair(u.host ?: "127.0.0.1", if (u.port > 0) u.port else DEFAULT_PORT)
    } catch (_: Exception) {
        Pair("127.0.0.1", DEFAULT_PORT)
    }

    /** TCP-level liveness: faster and more honest than an HTTP timeout. */
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

    private fun writeJson(c: HttpURLConnection, body: JSONObject) {
        c.doOutput = true
        c.setRequestProperty("Content-Type", "application/json")
        val out: OutputStream = c.outputStream
        out.write(body.toString().toByteArray(Charsets.UTF_8))
        out.flush()
        out.close()
    }

    private fun fail(call: PluginCall, message: String) {
        val r = JSObject()
        r.put("ok", false)
        r.put("error", message)
        call.resolve(r)
    }

    /* ----------------------------------------------------------- status */

    /**
     * "Polls 127.0.0.1:1234/ until it responds" — any HTTP answer from the
     * root proves a server is listening, including a 404, because sd-server
     * builds differ in what they serve at "/".
     */
    @PluginMethod
    fun status(call: PluginCall) {
        val base = baseOf(call)
        val timeout = call.getInt("timeoutMs") ?: 4000

        pool.execute {
            if (!portOpen(base, minOf(timeout, 2500))) {
                val r = JSObject()
                r.put("running", false)
                r.put("message", "No image server is listening at $base")
                call.resolve(r)
                return@execute
            }

            var model: String? = null
            var reachable = false
            var code = 0
            var conn: HttpURLConnection? = null
            try {
                conn = openConnection("$base/", "GET", timeout)
                code = conn.responseCode
                // Any HTTP status means a server answered.
                reachable = code > 0
            } catch (_: Exception) {
                reachable = false
            } finally {
                conn?.disconnect()
            }

            // The checkpoint name is a nice-to-have, never a failure.
            if (reachable) {
                var opt: HttpURLConnection? = null
                try {
                    opt = openConnection("$base/sdapi/v1/options", "GET", minOf(timeout, 3000))
                    if (opt.responseCode in 200..299) {
                        val j = JSONObject(readBody(opt))
                        val ckpt = j.optString("sd_model_checkpoint", "")
                        if (ckpt.isNotEmpty()) model = ckpt
                    }
                } catch (_: Exception) {
                } finally {
                    opt?.disconnect()
                }
            }

            val r = JSObject()
            r.put("running", reachable)
            if (model != null) r.put("model", model)
            r.put(
                "message",
                if (reachable) {
                    "✓ Image server is running at $base" +
                        (if (model != null) " ($model)" else "") + " [HTTP $code]"
                } else {
                    "Port ${hostPort(base).second} is open but $base did not answer HTTP."
                }
            )
            call.resolve(r)
        }
    }

    /* ---------------------------------------------------------- txt2img */

    /**
     * POST <base>/sdapi/v1/txt2img with
     *   { prompt, negative_prompt, steps, width, height, cfg_scale }
     * then decode images[0] from Base64.
     *
     * The Bitmap decode is not decoration: it is how we verify the payload
     * is a real, parseable image before handing it to the WebView. A corrupt
     * or truncated response fails here with a clear message instead of
     * silently rendering a broken <img>. We decode bounds-only (no full
     * pixel allocation) so a 1024x1024 PNG costs no extra heap on a phone.
     */
    @PluginMethod
    fun txt2img(call: PluginCall) {
        val base = baseOf(call)
        val prompt = call.getString("prompt") ?: ""
        if (prompt.isBlank()) {
            fail(call, "Cannot render: the prompt is empty.")
            return
        }
        val negative = call.getString("negativePrompt") ?: ""
        val steps = call.getInt("steps") ?: 24
        val width = call.getInt("width") ?: 512
        val height = call.getInt("height") ?: 512
        val cfgScale = call.getDouble("cfgScale") ?: 7.0
        val seed = call.getInt("seed")
        val requestId = call.getString("requestId") ?: "sd-${System.currentTimeMillis()}"
        // A phone render is slow; default to 10 minutes.
        val timeout = call.getInt("timeoutMs") ?: 600000

        val flag = AtomicBoolean(false)
        cancelled[requestId] = flag

        pool.execute {
            var conn: HttpURLConnection? = null
            try {
                val body = JSONObject()
                body.put("prompt", prompt)
                body.put("negative_prompt", negative)
                body.put("steps", steps)
                body.put("width", width)
                body.put("height", height)
                body.put("cfg_scale", cfgScale)
                if (seed != null) body.put("seed", seed)

                conn = openConnection("$base$TXT2IMG_PATH", "POST", timeout)
                liveConnections[requestId] = conn
                writeJson(conn, body)

                val code = conn.responseCode
                val text = readBody(conn)

                if (flag.get()) {
                    fail(call, "Render cancelled.")
                    return@execute
                }

                if (code !in 200..299) {
                    val snippet = if (text.length > 160) text.substring(0, 160) else text
                    fail(
                        call,
                        when (code) {
                            404 -> "$base$TXT2IMG_PATH returned 404. The server is running but does not expose the A1111 txt2img API."
                            422 -> "The server rejected the render parameters (422) — $snippet"
                            500 -> "The image server hit an internal error (500) — $snippet"
                            503 -> "The image server is busy or still loading its model (503). Wait and retry."
                            else -> "Image server HTTP $code — $snippet"
                        }
                    )
                    return@execute
                }

                val json = JSONObject(text)
                val images = json.optJSONArray("images")
                if (images == null || images.length() == 0) {
                    val detail = json.optString("detail", "")
                    fail(
                        call,
                        "The image server returned no image" +
                            (if (detail.isNotEmpty()) " — $detail" else "")
                    )
                    return@execute
                }

                var b64 = images.optString(0, "")
                if (b64.isEmpty()) {
                    fail(call, "The image server returned an empty image.")
                    return@execute
                }
                // Some builds hand back a full data: URL.
                val comma = b64.indexOf(',')
                if (b64.startsWith("data:") && comma >= 0) b64 = b64.substring(comma + 1)

                // Decode to verify it is a real image, and to learn its true size.
                val bytes = try {
                    Base64.decode(b64, Base64.DEFAULT)
                } catch (_: IllegalArgumentException) {
                    fail(call, "The image server returned data that is not valid Base64.")
                    return@execute
                }

                val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
                if (bounds.outWidth <= 0 || bounds.outHeight <= 0) {
                    fail(call, "The image server returned ${bytes.size} bytes that could not be decoded as an image.")
                    return@execute
                }

                // A1111 puts the resolved seed in `info`, which is a JSON *string*.
                var resolvedSeed: Int? = seed
                val info = json.optString("info", "")
                if (info.isNotEmpty()) {
                    try {
                        val parsed = JSONObject(info)
                        if (parsed.has("seed")) resolvedSeed = parsed.optInt("seed", seed ?: -1)
                    } catch (_: Exception) {
                    }
                }

                val r = JSObject()
                r.put("ok", true)
                r.put("image", b64)
                r.put("width", bounds.outWidth)
                r.put("height", bounds.outHeight)
                r.put("bytes", bytes.size)
                if (resolvedSeed != null && resolvedSeed >= 0) r.put("seed", resolvedSeed)
                call.resolve(r)
            } catch (e: Exception) {
                if (flag.get()) fail(call, "Render cancelled.")
                else fail(
                    call,
                    e.message?.takeIf { it.isNotBlank() }
                        ?: "Could not reach the image server at $base."
                )
            } finally {
                liveConnections.remove(requestId)
                cancelled.remove(requestId)
                conn?.disconnect()
            }
        }
    }

    /**
     * Full-pixel decode helper.
     *
     * txt2img deliberately decodes bounds-only, which is enough to prove the
     * payload is a real image without allocating it. This method exists for
     * callers that need the actual Bitmap in memory on the Android side
     * (post-processing, saving to MediaStore). It is separate so the hot
     * render path never pays for an allocation the WebView does not use.
     */
    fun decodeBitmap(b64: String): Bitmap? = try {
        val bytes = Base64.decode(b64, Base64.DEFAULT)
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
    } catch (_: Exception) {
        null
    }

    /* ----------------------------------------------------- start server */

    /**
     * Start sd-server via Termux's RUN_COMMAND service, then poll the root
     * until it answers. Requires the Termux app, its RUN_COMMAND permission,
     * and allow-external-apps=true in ~/.termux/termux.properties.
     *
     * The launcher tries, in order: a user-provided ~/sd-server.sh hook, then
     * an `sd-server` binary on PATH. Both are run with --port 1234 bound to
     * loopback. Whichever exists first wins; if neither does, the user gets
     * an actionable message rather than a silent failure.
     */
    @PluginMethod
    fun startServer(call: PluginCall) {
        val base = baseOf(call)
        // Model load on a phone is slow — allow far longer than the LLM.
        val timeout = call.getInt("timeoutMs") ?: 90000
        val port = hostPort(base).second

        pool.execute {
            try {
                if (portOpen(base, 1500)) {
                    val r = JSObject()
                    r.put("started", true)
                    r.put("method", "already-running")
                    r.put("message", "The image server is already running at $base")
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
                        "Termux is not installed, so the app cannot start the image server itself. " +
                            "Install Termux, start sd-server on port $port, then press RETRY."
                    )
                    call.resolve(r)
                    return@execute
                }

                val script =
                    "pgrep -f 'sd-server' >/dev/null 2>&1 && exit 0; " +
                        "if [ -x \"\$HOME/sd-server.sh\" ]; then " +
                        "nohup \"\$HOME/sd-server.sh\" --port $port >\"\$HOME/sd-server.log\" 2>&1 & " +
                        "elif command -v sd-server >/dev/null 2>&1; then " +
                        "nohup sd-server --host 127.0.0.1 --port $port >\"\$HOME/sd-server.log\" 2>&1 & " +
                        "else exit 127; fi"

                val intent = android.content.Intent()
                intent.setClassName(TERMUX_PACKAGE, TERMUX_SERVICE)
                intent.action = TERMUX_RUN_COMMAND
                intent.putExtra("com.termux.RUN_COMMAND_PATH", "/data/data/com.termux/files/usr/bin/bash")
                intent.putExtra("com.termux.RUN_COMMAND_ARGUMENTS", arrayOf("-lc", script))
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
                            "allow-external-apps=true in ~/.termux/termux.properties, or start sd-server manually."
                    )
                    call.resolve(r)
                    return@execute
                }

                // Poll 127.0.0.1:1234/ until it responds.
                val deadline = System.currentTimeMillis() + timeout
                while (System.currentTimeMillis() < deadline) {
                    if (portOpen(base, 1200)) {
                        var c: HttpURLConnection? = null
                        val answered = try {
                            c = openConnection("$base/", "GET", 3000)
                            c.responseCode > 0
                        } catch (_: Exception) {
                            false
                        } finally {
                            c?.disconnect()
                        }
                        if (answered) {
                            val r = JSObject()
                            r.put("started", true)
                            r.put("method", "termux")
                            r.put("message", "✓ Image server started at $base")
                            call.resolve(r)
                            return@execute
                        }
                    }
                    Thread.sleep(1000)
                }

                val r = JSObject()
                r.put("started", false)
                r.put("method", "termux")
                r.put(
                    "message",
                    "Start command sent to Termux but $base did not come up within ${timeout / 1000}s. " +
                        "Open Termux and check ~/sd-server.log — the model may still be loading, or " +
                        "sd-server may not be installed (create ~/sd-server.sh to point at your build)."
                )
                call.resolve(r)
            } catch (e: Exception) {
                fail(call, e.message ?: "Could not start the image server.")
            }
        }
    }

    /* ----------------------------------------------------------- cancel */

    @PluginMethod
    fun cancel(call: PluginCall) {
        val requestId = call.getString("requestId") ?: ""
        cancelled[requestId]?.set(true)
        runCatching { liveConnections[requestId]?.disconnect() }
        val r = JSObject()
        r.put("ok", true)
        call.resolve(r)
    }
}
