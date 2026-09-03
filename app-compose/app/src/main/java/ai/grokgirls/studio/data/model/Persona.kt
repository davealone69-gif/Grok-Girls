package ai.grokgirls.studio.data.model

import kotlinx.serialization.Serializable
import java.util.UUID

@Serializable
data class Persona(
    val id: String = UUID.randomUUID().toString(),
    val name: String = "New Persona",
    val tagline: String = "",
    val previewAsset: String? = null,
    val appearance: Appearance = Appearance(),
    val hair: Hair = Hair(),
    val face: Face = Face(),
    val body: Body = Body(),
    val outfit: Outfit = Outfit(),
    val scene: SceneStyle = SceneStyle.NOIR_BOUDOIR,
    val tattoos: Set<String> = emptySet(),
    val augments: Set<String> = emptySet(),
    val accessories: Set<String> = emptySet(),
    val favorite: Boolean = false,
    val createdAt: Long = System.currentTimeMillis(),
)

@Serializable
data class Appearance(
    val presentation: Presentation = Presentation.FEMININE,
    val skinToneIndex: Int = 2,
    val age: Int = 27,
    val headShape: Float = 0.5f,
    val skinDetail: Float = 0.6f,
    val accentColor: Long = 0xFFE23E58,
)

@Serializable
data class Hair(
    val style: String = "Long Waves",
    val colorArgb: Long = 0xFFB4152B,
    val gloss: Float = 0.65f,
    val length: Float = 0.7f,
)

@Serializable
data class Face(
    val eyeColorArgb: Long = 0xFF3E7C5A,
    val eyeShape: String = "Almond",
    val browShape: String = "Arched",
    val browThickness: Float = 0.5f,
    val makeup: String = "Smoky Noir",
    val lipColorArgb: Long = 0xFF8E1A2E,
    val freckles: Float = 0.1f,
)

@Serializable
data class Body(
    val height: Float = 0.55f,
    val build: Float = 0.45f,
    val posture: String = "Reclining",
)

@Serializable
data class Outfit(
    val top: String = "Velvet Jacket",
    val bottom: String = "Tailored Trousers",
    val hosiery: String = "None",
    val neckwear: String = "Velvet Choker",
    val footwear: String = "Ankle Boots",
)

@Serializable
enum class Presentation(val label: String) {
    FEMININE("Feminine"), NONBINARY("Non-binary"), ANDROID("Android")
}

@Serializable
enum class SceneStyle(
    val label: String,
    val backdropAsset: String,
    val accent: Long,
    val promptStyle: String,
) {
    NOIR_BOUDOIR("Noir Boudoir", "scenes/scene_noir.jpg", 0xFFE23E58, "moody noir lighting, deep shadows, warm practical lamp"),
    CYBER_NEON("Cyber Neon", "scenes/scene_neon.jpg", 0xFF34D6F0, "neon magenta and cyan rim light, wet reflections, volumetric fog"),
    GOLDEN_HOUR("Golden Hour", "scenes/scene_noir.jpg", 0xFFE8C07A, "warm golden hour sunlight, soft bokeh, amber grade"),
    CANDLELIGHT("Candlelight", "scenes/scene_noir.jpg", 0xFFFFAE6B, "single candle key light, warm falloff, intimate"),
    PASTEL_DREAM("Pastel Dream", "scenes/scene_neon.jpg", 0xFFD9BBFF, "soft pastel violet and pink light, dreamy diffusion"),
    BW_NOIR("B&W Noir", "scenes/scene_noir.jpg", 0xFFBFBFBF, "black and white, hard chiaroscuro, film grain"),
    BLUE_HOUR("Blue Hour", "scenes/scene_neon.jpg", 0xFF6C8CFF, "cool blue twilight, soft ambient, cinematic"),
    RED_ROOM("Red Room", "scenes/scene_noir.jpg", 0xFFFF3B4E, "saturated crimson wash, dramatic single source"),
}
