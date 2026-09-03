package ai.grokgirls.studio.data.repo

import ai.grokgirls.studio.data.model.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Single in-memory source of truth for the studio session.
 * Persistence hooks (DataStore) attach at the app layer.
 */
class StudioRepository {

    private val _personas = MutableStateFlow(seedPersonas())
    val personas: StateFlow<List<Persona>> = _personas.asStateFlow()

    private val _activeId = MutableStateFlow(_personas.value.first().id)
    val activeId: StateFlow<String> = _activeId.asStateFlow()

    private val _gallery = MutableStateFlow<List<GalleryItem>>(emptyList())
    val gallery: StateFlow<List<GalleryItem>> = _gallery.asStateFlow()

    private val _messages = MutableStateFlow<List<ChatMessage>>(emptyList())
    val messages: StateFlow<List<ChatMessage>> = _messages.asStateFlow()

    private val _settings = MutableStateFlow(RenderSettings())
    val settings: StateFlow<RenderSettings> = _settings.asStateFlow()

    private val _stats = MutableStateFlow(Stats())
    val stats: StateFlow<Stats> = _stats.asStateFlow()

    private val _adult = MutableStateFlow(false)
    val adultMode: StateFlow<Boolean> = _adult.asStateFlow()

    private val _chapter = MutableStateFlow(0)
    val chapter: StateFlow<Int> = _chapter.asStateFlow()

    fun active(): Persona = _personas.value.first { it.id == _activeId.value }

    fun select(id: String) { _activeId.value = id }

    fun update(transform: (Persona) -> Persona) {
        val id = _activeId.value
        _personas.value = _personas.value.map { if (it.id == id) transform(it) else it }
    }

    fun add(p: Persona) { _personas.value = _personas.value + p; _activeId.value = p.id }

    fun duplicate(id: String) {
        val src = _personas.value.first { it.id == id }
        add(src.copy(id = java.util.UUID.randomUUID().toString(), name = "${src.name} Copy"))
    }

    fun delete(id: String) {
        if (_personas.value.size <= 1) return
        _personas.value = _personas.value.filterNot { it.id == id }
        if (_activeId.value == id) _activeId.value = _personas.value.first().id
    }

    fun setSettings(s: RenderSettings) { _settings.value = s }
    fun setAdult(v: Boolean) { _adult.value = v }
    fun setChapter(i: Int) {
        _chapter.value = i
        _stats.value = _stats.value.copy(chapters = maxOf(_stats.value.chapters, i + 1))
    }

    fun addRender(item: GalleryItem) {
        _gallery.value = listOf(item) + _gallery.value
        _stats.value = _stats.value.copy(
            renders = _stats.value.renders + if (item.isVideo) 0 else 1,
            clips = _stats.value.clips + if (item.isVideo) 1 else 0,
        )
    }

    fun toggleFavorite(id: String) {
        _gallery.value = _gallery.value.map { if (it.id == id) it.copy(favorite = !it.favorite) else it }
        _stats.value = _stats.value.copy(favorites = _gallery.value.count { it.favorite })
    }

    fun deleteRender(id: String) { _gallery.value = _gallery.value.filterNot { it.id == id } }

    fun send(text: String) {
        val p = active()
        _messages.value = _messages.value + ChatMessage(personaId = p.id, fromUser = true, text = text)
        _messages.value = _messages.value + ChatMessage(
            personaId = p.id, fromUser = false, text = Replies.reply(p, text)
        )
        _stats.value = _stats.value.copy(
            messages = _stats.value.messages + 1,
            affinity = (_stats.value.affinity + 2).coerceAtMost(100),
        )
    }

    private fun seedPersonas() = listOf(
        Persona(
            name = "Ruby Noir",
            tagline = "Crimson hair, velvet and shadow",
            previewAsset = "presets/preset_ruby.jpg",
            hair = Hair("Long Waves", 0xFFB4152B, 0.75f, 0.8f),
            face = Face(0xFF3E7C5A, "Almond", "Arched", 0.55f, "Smoky Noir", 0xFF8E1A2E),
            outfit = Outfit("Velvet Jacket", "Tailored Trousers", "None", "Velvet Choker", "Ankle Boots"),
            scene = SceneStyle.NOIR_BOUDOIR,
            accessories = setOf("Drop Earrings"),
        ),
        Persona(
            name = "Nova HD",
            tagline = "Chrome, cyan and clean lines",
            previewAsset = "presets/preset_nova.jpg",
            appearance = Appearance(Presentation.ANDROID, 1, 26, 0.45f, 0.8f, 0xFF34D6F0),
            hair = Hair("Undercut", 0xFFE8E8F0, 0.9f, 0.3f),
            face = Face(0xFF34D6F0, "Upturned", "Straight", 0.4f, "Cyber Chrome", 0xFFB86A7A),
            outfit = Outfit("Techwear Shell", "Cargo Pants", "None", "Chain", "Combat Boots"),
            scene = SceneStyle.CYBER_NEON,
            augments = setOf("Temple Circuit", "Optic Implant"),
        ),
        Persona(
            name = "Kira HD",
            tagline = "Golden hour, sharp tailoring",
            previewAsset = "presets/preset_kira.jpg",
            appearance = Appearance(Presentation.FEMININE, 3, 30, 0.5f, 0.7f, 0xFFE8C07A),
            hair = Hair("Sleek Bob", 0xFF15100E, 0.7f, 0.35f),
            face = Face(0xFF5A3A24, "Hooded", "Soft Angled", 0.6f, "Clean Glow", 0xFFA8564F),
            outfit = Outfit("Leather Coat", "Denim", "None", "Silk Scarf", "Ankle Boots"),
            scene = SceneStyle.GOLDEN_HOUR,
        ),
        Persona(
            name = "Aria HD",
            tagline = "Lavender light and silk",
            previewAsset = "presets/preset_aria.jpg",
            appearance = Appearance(Presentation.FEMININE, 1, 24, 0.55f, 0.5f, 0xFFD9BBFF),
            hair = Hair("Curtain Bangs", 0xFFB49BE8, 0.6f, 0.65f),
            face = Face(0xFF6C7CC4, "Round", "Feathered", 0.45f, "Soft Rose", 0xFFC9808F),
            outfit = Outfit("Silk Blouse", "Long Gown", "Sheer", "Pendant", "Barefoot"),
            scene = SceneStyle.PASTEL_DREAM,
            tattoos = setOf("Floral Shoulder"),
        ),
    )
}

private object Replies {
    fun reply(p: Persona, input: String): String {
        val t = input.trim().lowercase()
        val mood = when (p.scene) {
            SceneStyle.CYBER_NEON -> "The neon's humming outside."
            SceneStyle.GOLDEN_HOUR -> "The light's going amber."
            SceneStyle.BW_NOIR -> "Everything's shadow and edge tonight."
            else -> "It's quiet in here."
        }
        return when {
            t.contains("hello") || t.contains("hi") -> "$mood Hello. You took your time."
            t.endsWith("?") -> "$mood Ask me again, slower — I want to get the answer right."
            t.contains("name") -> "${p.name}. ${p.tagline}."
            t.length < 6 -> "$mood Is that all you've got?"
            else -> "$mood I've been thinking about that too — more than I'd admit."
        }
    }
}
