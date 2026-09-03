package ai.grokgirls.studio.data.model

import kotlinx.serialization.Serializable
import java.util.UUID

@Serializable
enum class RenderEngine(val label: String) {
    LOCAL("Local"), OPENROUTER("OpenRouter"), GEMINI("Gemini"),
    CUSTOM("Custom"), SELF_HOSTED("Self-Hosted")
}

@Serializable
data class RenderSettings(
    val negativePrompt: String = "lowres, deformed, extra limbs, watermark, text",
    val seed: Long = -1L,
    val steps: Int = 32,
    val cfg: Float = 7.0f,
    val resolution: Int = 1024,
    val engine: RenderEngine = RenderEngine.LOCAL,
)

@Serializable
data class GalleryItem(
    val id: String = UUID.randomUUID().toString(),
    val personaId: String,
    val personaName: String,
    val prompt: String,
    val engine: RenderEngine,
    val assetOrPath: String,
    val favorite: Boolean = false,
    val isVideo: Boolean = false,
    val createdAt: Long = System.currentTimeMillis(),
)

@Serializable
data class ChatMessage(
    val id: String = UUID.randomUUID().toString(),
    val personaId: String,
    val fromUser: Boolean,
    val text: String,
    val createdAt: Long = System.currentTimeMillis(),
)

@Serializable
data class Chapter(
    val index: Int,
    val title: String,
    val blurb: String,
    val requiredAffinity: Int,
    val actions: List<String>,
)

@Serializable
data class Achievement(
    val key: String,
    val title: String,
    val description: String,
    val target: Int,
)

@Serializable
data class Stats(
    val renders: Int = 0,
    val favorites: Int = 0,
    val messages: Int = 0,
    val chapters: Int = 0,
    val imports: Int = 0,
    val clips: Int = 0,
    val affinity: Int = 10,
)

object Catalog {
    val hairStyles = listOf("Long Waves", "Sleek Bob", "Undercut", "High Ponytail", "Braided Crown", "Pixie", "Curtain Bangs", "Space Buns")
    val eyeShapes = listOf("Almond", "Hooded", "Upturned", "Round", "Monolid")
    val browShapes = listOf("Arched", "Straight", "Soft Angled", "Feathered")
    val makeupLooks = listOf("Smoky Noir", "Clean Glow", "Graphic Liner", "Cyber Chrome", "Soft Rose", "Bare")
    val tops = listOf("Velvet Jacket", "Techwear Shell", "Silk Blouse", "Leather Coat", "Knit Sweater", "Corset Top")
    val bottoms = listOf("Tailored Trousers", "Pleated Skirt", "Cargo Pants", "Long Gown", "Denim")
    val hosiery = listOf("None", "Sheer", "Fishnets", "Opaque", "Thigh-highs")
    val neckwear = listOf("Velvet Choker", "None", "Chain", "Silk Scarf", "Collar")
    val footwear = listOf("Ankle Boots", "Stilettos", "Combat Boots", "Barefoot", "Platform")
    val postures = listOf("Reclining", "Standing", "Seated", "Leaning", "Over-shoulder")
    val tattoos = listOf("Sleeve", "Spine Script", "Floral Shoulder", "Geometric", "Nape Sigil", "Ankle Band")
    val augments = listOf("Optic Implant", "Temple Circuit", "Chrome Jaw", "Neural Port", "Light Freckles", "Arm Plating")
    val accessories = listOf("Drop Earrings", "Rings", "Glasses", "Hair Pin", "Bracelet", "Pendant")
    val skinTones = listOf(0xFFF6DCC7, 0xFFEBC49A, 0xFFD9A273, 0xFFB87B4F, 0xFF8D5A34, 0xFF6A4126, 0xFF4A2C1A, 0xFF2E1B10)

    val chapters = listOf(
        Chapter(0, "First Meeting", "A rain-slick bar, a shared cigarette, an unexpected honesty.", 0,
            listOf("Order a drink", "Ask her name", "Step outside", "Offer your coat")),
        Chapter(1, "Private Space", "Her apartment. Records on the shelf, city light through the blinds.", 25,
            listOf("Browse the records", "Talk about the past", "Make coffee", "Sit by the window")),
        Chapter(2, "Nightlife", "Neon corridors and a club that never quite closes.", 55,
            listOf("Dance", "Find the rooftop", "Meet her friends", "Slip away early")),
        Chapter(3, "New Horizons", "Dawn on the coast road, deciding what comes next.", 80,
            listOf("Drive further", "Ask her to stay", "Take a photo", "Say goodbye")),
    )

    val achievements = listOf(
        Achievement("first_render", "First Light", "Complete your first render", 1),
        Achievement("ten_renders", "Prolific", "Complete 10 renders", 10),
        Achievement("fifty_renders", "Studio Veteran", "Complete 50 renders", 50),
        Achievement("first_fav", "Curator", "Favourite an image", 1),
        Achievement("chatty", "Conversationalist", "Send 25 messages", 25),
        Achievement("story", "Storyteller", "Finish all 4 chapters", 4),
        Achievement("importer", "Archivist", "Import 3 personas", 3),
        Achievement("director", "Director", "Render 5 video clips", 5),
    )
}
