package ai.grokgirls.studio

import android.content.Intent
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/** ComfyUI lifecycle bridge for the existing Termux checkout. */
@CapacitorPlugin(name = "ComfyUiLocal")
class ComfyUiLocalPlugin : Plugin() {
    private val pool = Executors.newCachedThreadPool()

    companion object {
        private const val DEFAULT_BASE = "http://127.0.0.1:8188"
        private const val TERMUX_PACKAGE = "com.termux"
        private const val TERMUX_RUN_COMMAND = "com.termux.RUN_COMMAND"
        private const val TERMUX_SERVICE = "com.termux.app.RunCommandService"
    }

    private fun baseOf(call: PluginCall): String =
        (call.getString("base") ?: DEFAULT_BASE).trim().trimEnd('/')

    private fun health(base: String, timeoutMs: Int): Pair<Boolean, String?> {
        var connection: HttpURLConnection? = null
        return try {
            connection = (URL("$base/system_stats").openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = minOf(timeoutMs, 5000)
                readTimeout = timeoutMs
                setRequestProperty("Accept", "application/json")
            }
            val code = connection.responseCode
            if (code !in 200..299) return Pair(false, "ComfyUI returned HTTP $code at $base/system_stats")
            val body = connection.inputStream.bufferedReader().use { it.readText() }
            val system = JSONObject(body).optJSONObject("system")
                ?: return Pair(false, "ComfyUI answered but /system_stats had no system object.")
            val version = system.optString("comfyui_version", "")
            Pair(true, version.ifBlank { "unknown" })
        } catch (e: Exception) {
            Pair(false, e.message ?: "ComfyUI API is not responding.")
        } finally {
            connection?.disconnect()
        }
    }

    @PluginMethod
    fun status(call: PluginCall) {
        val base = baseOf(call)
        val timeout = call.getInt("timeoutMs") ?: 6000
        pool.execute {
            val (running, versionOrError) = health(base, timeout)
            val result = JSObject()
            result.put("running", running)
            if (running) {
                result.put("version", versionOrError)
                result.put("message", "ComfyUI API is responding at $base (version ${versionOrError ?: "unknown"}). Generation still requires a successful workflow.")
            } else {
                result.put("message", versionOrError ?: "ComfyUI is not ready at $base.")
            }
            call.resolve(result)
        }
    }

    @PluginMethod
    fun startServer(call: PluginCall) {
        val base = baseOf(call)
        val timeout = (call.getInt("timeoutMs") ?: 120000).coerceIn(10000, 180000)
        pool.execute {
            try {
                val initial = health(base, 4000)
                if (initial.first) {
                    val result = JSObject()
                    result.put("running", true)
                    result.put("started", true)
                    result.put("method", "already-running")
                    result.put("version", initial.second)
                    result.put("message", "ComfyUI is already responding at $base. No duplicate process was started.")
                    call.resolve(result)
                    return@execute
                }

                val ctx = context
                val installed = runCatching { ctx.packageManager.getPackageInfo(TERMUX_PACKAGE, 0); true }.getOrDefault(false)
                if (!installed) {
                    val result = JSObject()
                    result.put("running", false)
                    result.put("started", false)
                    result.put("message", "Termux is not installed. Install/open Termux and configure RUN_COMMAND before using this button.")
                    call.resolve(result)
                    return@execute
                }

                val script = "if pgrep -f '[p]ython.*main.py.*--port 8188' >/dev/null 2>&1; then exit 0; fi; " +
                    "cd \"\$HOME/llama/llama.cpp/ComfyUI\" || exit 72; " +
                    "nohup env LD_PRELOAD=\"\$PREFIX/lib/libpython3.13.so\" python main.py --listen 127.0.0.1 --port 8188 --use-split-cross-attention >>\"\$HOME/comfyui-crash.log\" 2>&1 </dev/null &"

                val intent = Intent().apply {
                    setClassName(TERMUX_PACKAGE, TERMUX_SERVICE)
                    action = TERMUX_RUN_COMMAND
                    putExtra("com.termux.RUN_COMMAND_PATH", "/data/data/com.termux/files/usr/bin/bash")
                    putExtra("com.termux.RUN_COMMAND_ARGUMENTS", arrayOf("-lc", script))
                    putExtra("com.termux.RUN_COMMAND_WORKDIR", "/data/data/com.termux/files/home")
                    putExtra("com.termux.RUN_COMMAND_BACKGROUND", true)
                    putExtra("com.termux.RUN_COMMAND_SESSION_ACTION", "0")
                }
                val launched = runCatching { ctx.startService(intent); true }.getOrDefault(false)
                if (!launched) {
                    val result = JSObject()
                    result.put("running", false)
                    result.put("started", false)
                    result.put("message", "Android refused the Termux start request. Grant com.termux.permission.RUN_COMMAND and set allow-external-apps=true in ~/.termux/termux.properties.")
                    call.resolve(result)
                    return@execute
                }

                val deadline = System.currentTimeMillis() + timeout
                while (System.currentTimeMillis() < deadline) {
                    val (ready, versionOrError) = health(base, 3500)
                    if (ready) {
                        val result = JSObject()
                        result.put("running", true)
                        result.put("started", true)
                        result.put("method", "termux")
                        result.put("version", versionOrError)
                        result.put("message", "ComfyUI API became ready at $base (version ${versionOrError ?: "unknown"}). Run a generation test to verify model execution.")
                        call.resolve(result)
                        return@execute
                    }
                    Thread.sleep(1000)
                }
                val result = JSObject()
                result.put("running", false)
                result.put("started", false)
                result.put("method", "termux")
                result.put("message", "Termux accepted the request, but ComfyUI /system_stats did not become ready within ${timeout / 1000}s. Check ~/comfyui-crash.log in Termux.")
                call.resolve(result)
            } catch (e: Exception) {
                val result = JSObject()
                result.put("running", false)
                result.put("started", false)
                result.put("message", e.message ?: "Could not start ComfyUI through Termux.")
                call.resolve(result)
            }
        }
    }
}
