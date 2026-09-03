package ai.grokgirls.studio.data.net

import ai.grokgirls.studio.data.model.RenderSettings
import ai.grokgirls.studio.data.model.ServerConfig
import android.util.Base64
import org.json.JSONObject

/** Google Gemini / Imagen image generation. */
class GeminiEngine : ImageEngine {
    override val name = "Gemini"

    override suspend fun render(
        prompt: String, settings: RenderSettings, server: ServerConfig, onProgress: ProgressSink,
    ): RenderResult {
        val key = server.apiKey.ifBlank { throw EngineException("Add your Gemini API key in Settings.") }
        onProgress(0.15f)
        val model = "imagen-3.0-generate-002"
        val res = Http.postJson(
            "https://generativelanguage.googleapis.com/v1beta/models/$model:predict?key=$key",
            JSONObject()
                .put("instances", org.json.JSONArray().put(JSONObject().put("prompt", prompt)))
                .put("parameters", JSONObject()
                    .put("sampleCount", 1)
                    .put("aspectRatio", "1:1")),
        )
        onProgress(0.9f)
        val b64 = res.optJSONArray("predictions")?.optJSONObject(0)
            ?.optString("bytesBase64Encoded").orEmpty()
        if (b64.isBlank()) throw EngineException("Gemini returned no image data.")
        onProgress(1f)
        return RenderResult(Base64.decode(b64, Base64.DEFAULT), settings.seed)
    }

    override suspend fun test(server: ServerConfig): String {
        if (server.apiKey.isBlank()) throw EngineException("No Gemini API key set.")
        return "Gemini key present · Imagen 3 ready"
    }
}

/** OpenRouter — routes to whichever image-capable model is configured. */
class OpenRouterEngine : ImageEngine {
    override val name = "OpenRouter"

    override suspend fun render(
        prompt: String, settings: RenderSettings, server: ServerConfig, onProgress: ProgressSink,
    ): RenderResult {
        val key = server.apiKey.ifBlank { throw EngineException("Add your OpenRouter API key in Settings.") }
        onProgress(0.15f)
        val res = Http.postJson(
            "https://openrouter.ai/api/v1/chat/completions",
            JSONObject()
                .put("model", server.checkpoint.ifBlank { "google/gemini-2.5-flash-image-preview" })
                .put("messages", org.json.JSONArray().put(
                    JSONObject().put("role", "user").put("content", prompt)
                )),
            headers = mapOf(
                "Authorization" to "Bearer $key",
                "HTTP-Referer" to "https://grokgirls.ai",
                "X-Title" to "Grok Girls Studio",
            ),
        )
        onProgress(0.9f)
        val images = res.optJSONArray("choices")?.optJSONObject(0)
            ?.optJSONObject("message")?.optJSONArray("images")
        val url = images?.optJSONObject(0)?.optJSONObject("image_url")?.optString("url").orEmpty()
        if (url.isBlank()) throw EngineException("OpenRouter returned no image.")
        val b64 = url.substringAfter("base64,", "")
        if (b64.isBlank()) throw EngineException("Unexpected image payload from OpenRouter.")
        onProgress(1f)
        return RenderResult(Base64.decode(b64, Base64.DEFAULT), settings.seed)
    }

    override suspend fun test(server: ServerConfig): String {
        if (server.apiKey.isBlank()) throw EngineException("No OpenRouter API key set.")
        val res = Http.getJson(
            "https://openrouter.ai/api/v1/key",
            headers = mapOf("Authorization" to "Bearer ${server.apiKey}"),
        )
        val label = res.optJSONObject("data")?.optString("label").orEmpty()
        return "OpenRouter connected${if (label.isNotBlank()) " · $label" else ""}"
    }
}

/** Any OpenAI-compatible / A1111-compatible custom endpoint. */
class CustomEngine(private val a1111: Automatic1111Engine = Automatic1111Engine()) : ImageEngine {
    override val name = "Custom"
    override suspend fun render(
        prompt: String, settings: RenderSettings, server: ServerConfig, onProgress: ProgressSink,
    ) = a1111.render(prompt, settings, server, onProgress)
    override suspend fun test(server: ServerConfig) = a1111.test(server)
    override suspend fun models(server: ServerConfig) = a1111.models(server)
}
