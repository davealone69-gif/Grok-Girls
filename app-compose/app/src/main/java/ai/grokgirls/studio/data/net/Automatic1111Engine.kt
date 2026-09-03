package ai.grokgirls.studio.data.net

import ai.grokgirls.studio.data.model.RenderSettings
import ai.grokgirls.studio.data.model.ServerConfig
import android.util.Base64
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.coroutineScope
import org.json.JSONArray
import org.json.JSONObject

/**
 * AUTOMATIC1111 stable-diffusion-webui.
 * Launch the server with `--api --listen` to allow LAN access.
 */
class Automatic1111Engine : ImageEngine {
    override val name = "AUTOMATIC1111"

    override suspend fun render(
        prompt: String,
        settings: RenderSettings,
        server: ServerConfig,
        onProgress: ProgressSink,
    ): RenderResult = coroutineScope {
        val base = server.url.trimEnd('/')

        val fullPrompt = buildString {
            append(prompt)
            server.loras.filter { it.name.isNotBlank() }.forEach {
                append(" <lora:${it.name}:${"%.2f".format(it.weight)}>")
            }
        }

        val payload = JSONObject().apply {
            put("prompt", fullPrompt)
            put("negative_prompt", settings.negativePrompt)
            put("steps", settings.steps)
            put("cfg_scale", settings.cfg.toDouble())
            put("width", settings.resolution)
            put("height", settings.resolution)
            put("seed", settings.seed)
            put("sampler_name", server.sampler.ifBlank { "DPM++ 2M Karras" })
            if (server.hiresFix) {
                put("enable_hr", true)
                put("hr_upscaler", server.upscaler.ifBlank { "Latent" })
                put("hr_scale", 1.5)
            }
            if (server.checkpoint.isNotBlank()) {
                put("override_settings", JSONObject().put("sd_model_checkpoint", server.checkpoint))
                put("override_settings_restore_afterwards", true)
            }
        }

        // Poll /sdapi/v1/progress alongside the blocking txt2img call.
        val poller = launch {
            while (isActive) {
                delay(700)
                runCatching {
                    val p = Http.getJson("$base/sdapi/v1/progress?skip_current_image=true")
                    onProgress(p.optDouble("progress", 0.0).toFloat().coerceIn(0f, 1f))
                }
            }
        }

        try {
            val res = Http.postJson("$base/sdapi/v1/txt2img", payload)
            val images = res.optJSONArray("images")
                ?: throw EngineException("A1111 returned no images")
            val b64 = images.optString(0).substringAfter("base64,", images.optString(0))
            val bytes = Base64.decode(b64, Base64.DEFAULT)

            val seed = runCatching {
                JSONObject(res.optString("info", "{}")).optLong("seed", settings.seed)
            }.getOrDefault(settings.seed)

            onProgress(1f)
            RenderResult(bytes, seed)
        } finally {
            poller.cancel()
        }
    }

    override suspend fun test(server: ServerConfig): String {
        val base = server.url.trimEnd('/')
        val models = models(server)
        val loras = runCatching {
            Http.getJson("$base/sdapi/v1/loras").optJSONArray("items")?.length() ?: 0
        }.getOrDefault(0)
        return "Connected · AUTOMATIC1111 · ${models.size} models · $loras LORAs"
    }

    override suspend fun models(server: ServerConfig): List<String> {
        val base = server.url.trimEnd('/')
        val arr: JSONArray = Http.getJson("$base/sdapi/v1/sd-models").optJSONArray("items")
            ?: throw EngineException("Unexpected response from /sdapi/v1/sd-models — is --api enabled?")
        return (0 until arr.length()).mapNotNull {
            arr.optJSONObject(it)?.optString("title")?.takeIf(String::isNotBlank)
        }
    }
}
