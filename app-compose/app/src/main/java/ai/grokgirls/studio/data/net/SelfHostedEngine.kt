package ai.grokgirls.studio.data.net

import ai.grokgirls.studio.data.model.RenderSettings
import ai.grokgirls.studio.data.model.ServerConfig
import ai.grokgirls.studio.data.model.ServerKind

/**
 * Delegates to A1111 or ComfyUI, auto-detecting the server type on first use
 * (or honouring an explicit choice in ServerConfig.kind).
 */
class SelfHostedEngine(
    private val a1111: Automatic1111Engine = Automatic1111Engine(),
    private val comfy: ComfyUiEngine = ComfyUiEngine(),
) : ImageEngine {

    override val name = "Self-Hosted"

    private suspend fun resolve(server: ServerConfig): ImageEngine = when (server.kind) {
        ServerKind.A1111 -> a1111
        ServerKind.COMFYUI -> comfy
        ServerKind.AUTO -> detect(server)
    }

    private suspend fun detect(server: ServerConfig): ImageEngine {
        val base = server.url.trimEnd('/')
        runCatching { Http.getJson("$base/sdapi/v1/sd-models", timeoutMs = 8_000) }
            .onSuccess { return a1111 }
        runCatching { Http.getJson("$base/system_stats", timeoutMs = 8_000) }
            .onSuccess { return comfy }
        throw EngineException(
            "No AUTOMATIC1111 or ComfyUI found at $base. " +
                "Check the address, and that A1111 was launched with --api --listen."
        )
    }

    override suspend fun render(
        prompt: String, settings: RenderSettings, server: ServerConfig, onProgress: ProgressSink,
    ) = resolve(server).render(prompt, settings, server, onProgress)

    override suspend fun test(server: ServerConfig) = resolve(server).test(server)

    override suspend fun models(server: ServerConfig) = resolve(server).models(server)
}
