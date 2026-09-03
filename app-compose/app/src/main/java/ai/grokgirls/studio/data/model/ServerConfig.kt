package ai.grokgirls.studio.data.model

import kotlinx.serialization.Serializable

@Serializable
enum class ServerKind(val label: String) {
    AUTO("Auto-detect"), A1111("AUTOMATIC1111"), COMFYUI("ComfyUI")
}

@Serializable
data class LoraSlot(val name: String = "", val weight: Float = 0.8f)

@Serializable
data class ServerConfig(
    val url: String = "http://192.168.1.10:7860",
    val kind: ServerKind = ServerKind.AUTO,
    val checkpoint: String = "",
    val sampler: String = "DPM++ 2M Karras",
    val upscaler: String = "Latent",
    val hiresFix: Boolean = false,
    val apiKey: String = "",
    val loras: List<LoraSlot> = listOf(LoraSlot(), LoraSlot(), LoraSlot()),
)
