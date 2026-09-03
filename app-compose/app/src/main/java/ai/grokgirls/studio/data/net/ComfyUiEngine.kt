package ai.grokgirls.studio.data.net

import ai.grokgirls.studio.data.model.RenderSettings
import ai.grokgirls.studio.data.model.ServerConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.URL
import java.net.URLEncoder
import kotlin.random.Random

/**
 * ComfyUI. Builds a standard txt2img graph
 * (CheckpointLoader -> 2x CLIPTextEncode -> EmptyLatent -> KSampler -> VAEDecode -> SaveImage),
 * submits to /prompt, polls /history, then fetches the PNG from /view.
 */
class ComfyUiEngine : ImageEngine {
    override val name = "ComfyUI"

    override suspend fun render(
        prompt: String,
        settings: RenderSettings,
        server: ServerConfig,
        onProgress: ProgressSink,
    ): RenderResult {
        val base = server.url.trimEnd('/')
        val clientId = "grokgirls-${Random.nextInt(100_000, 999_999)}"
        val seed = if (settings.seed >= 0) settings.seed else Random.nextLong(0, Long.MAX_VALUE)

        val fullPrompt = buildString {
            append(prompt)
            server.loras.filter { it.name.isNotBlank() }.forEach {
                append(" <lora:${it.name}:${"%.2f".format(it.weight)}>")
            }
        }

        val graph = buildGraph(fullPrompt, settings, server, seed)
        val submit = Http.postJson(
            "$base/prompt",
            JSONObject().put("prompt", graph).put("client_id", clientId),
        )
        val promptId = submit.optString("prompt_id").ifBlank {
            throw EngineException("ComfyUI did not return a prompt_id: $submit")
        }

        // Poll history until the job appears with outputs.
        var waited = 0L
        val timeout = 300_000L
        while (waited < timeout) {
            delay(900)
            waited += 900
            onProgress((waited.toFloat() / 45_000f).coerceIn(0f, 0.95f))

            val hist = runCatching { Http.getJson("$base/history/$promptId") }.getOrNull() ?: continue
            val entry = hist.optJSONObject(promptId) ?: continue
            val outputs = entry.optJSONObject("outputs") ?: continue

            for (nodeKey in outputs.keys()) {
                val images = outputs.optJSONObject(nodeKey)?.optJSONArray("images") ?: continue
                val img = images.optJSONObject(0) ?: continue
                val bytes = fetchImage(
                    base,
                    img.optString("filename"),
                    img.optString("subfolder"),
                    img.optString("type", "output"),
                )
                onProgress(1f)
                return RenderResult(bytes, seed)
            }
        }
        throw EngineException("ComfyUI render timed out after ${timeout / 1000}s")
    }

    private suspend fun fetchImage(
        base: String, filename: String, subfolder: String, type: String,
    ): ByteArray = withContext(Dispatchers.IO) {
        fun enc(s: String) = URLEncoder.encode(s, "UTF-8")
        val url = "$base/view?filename=${enc(filename)}&subfolder=${enc(subfolder)}&type=${enc(type)}"
        URL(url).openStream().use { it.readBytes() }
    }

    private fun buildGraph(
        prompt: String, s: RenderSettings, server: ServerConfig, seed: Long,
    ): JSONObject {
        fun node(cls: String, inputs: JSONObject) =
            JSONObject().put("class_type", cls).put("inputs", inputs)

        val ckpt = server.checkpoint.ifBlank { "v1-5-pruned-emaonly.safetensors" }

        return JSONObject().apply {
            put("1", node("CheckpointLoaderSimple",
                JSONObject().put("ckpt_name", ckpt)))

            put("2", node("CLIPTextEncode", JSONObject()
                .put("text", prompt)
                .put("clip", JSONArray(listOf("1", 1)))))

            put("3", node("CLIPTextEncode", JSONObject()
                .put("text", s.negativePrompt)
                .put("clip", JSONArray(listOf("1", 1)))))

            put("4", node("EmptyLatentImage", JSONObject()
                .put("width", s.resolution)
                .put("height", s.resolution)
                .put("batch_size", 1)))

            put("5", node("KSampler", JSONObject()
                .put("seed", seed)
                .put("steps", s.steps)
                .put("cfg", s.cfg.toDouble())
                .put("sampler_name", comfySampler(server.sampler))
                .put("scheduler", "karras")
                .put("denoise", 1.0)
                .put("model", JSONArray(listOf("1", 0)))
                .put("positive", JSONArray(listOf("2", 0)))
                .put("negative", JSONArray(listOf("3", 0)))
                .put("latent_image", JSONArray(listOf("4", 0)))))

            put("6", node("VAEDecode", JSONObject()
                .put("samples", JSONArray(listOf("5", 0)))
                .put("vae", JSONArray(listOf("1", 2)))))

            put("7", node("SaveImage", JSONObject()
                .put("filename_prefix", "grokgirls")
                .put("images", JSONArray(listOf("6", 0)))))
        }
    }

    private fun comfySampler(name: String) = when {
        name.contains("DPM++ 2M", true) -> "dpmpp_2m"
        name.contains("DPM++ SDE", true) -> "dpmpp_sde"
        name.contains("Euler a", true) -> "euler_ancestral"
        name.contains("Euler", true) -> "euler"
        name.contains("DDIM", true) -> "ddim"
        name.isBlank() -> "dpmpp_2m"
        else -> "dpmpp_2m"
    }

    override suspend fun test(server: ServerConfig): String {
        val models = models(server)
        return "Connected · ComfyUI · ${models.size} checkpoints"
    }

    override suspend fun models(server: ServerConfig): List<String> {
        val base = server.url.trimEnd('/')
        val info = Http.getJson("$base/object_info/CheckpointLoaderSimple")
        val arr = info.optJSONObject("CheckpointLoaderSimple")
            ?.optJSONObject("input")?.optJSONObject("required")
            ?.optJSONArray("ckpt_name")?.optJSONArray(0)
            ?: throw EngineException("Unexpected /object_info response from ComfyUI")
        return (0 until arr.length()).map { arr.optString(it) }.filter { it.isNotBlank() }
    }
}
