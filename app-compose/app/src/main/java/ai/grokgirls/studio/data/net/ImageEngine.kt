package ai.grokgirls.studio.data.net

import ai.grokgirls.studio.data.model.RenderSettings
import ai.grokgirls.studio.data.model.ServerConfig

/** Result of a render: a decoded PNG/JPEG payload plus the seed actually used. */
data class RenderResult(val bytes: ByteArray, val seed: Long) {
    override fun equals(other: Any?) = this === other
    override fun hashCode() = System.identityHashCode(this)
}

/** Progress callback: 0f..1f, or -1f when the engine reports no progress. */
typealias ProgressSink = (Float) -> Unit

interface ImageEngine {
    val name: String
    suspend fun render(
        prompt: String,
        settings: RenderSettings,
        server: ServerConfig,
        onProgress: ProgressSink = {},
    ): RenderResult

    /** Returns a human-readable status line, throws EngineException on failure. */
    suspend fun test(server: ServerConfig): String

    /** Available checkpoints, empty when the engine has no concept of them. */
    suspend fun models(server: ServerConfig): List<String> = emptyList()
}
