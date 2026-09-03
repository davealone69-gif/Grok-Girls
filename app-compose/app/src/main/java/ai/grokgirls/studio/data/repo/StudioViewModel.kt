package ai.grokgirls.studio.data.repo

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import ai.grokgirls.studio.data.model.*
import ai.grokgirls.studio.data.net.EngineException
import ai.grokgirls.studio.data.net.EngineRegistry
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class StudioViewModel(app: Application) : AndroidViewModel(app) {

    val repo = StudioRepository()
    private val store = Persistence(app)
    private val engines = EngineRegistry { repo.active() }

    private val _rendering = MutableStateFlow(false)
    val rendering = _rendering.asStateFlow()

    private val _progress = MutableStateFlow(0f)
    val progress = _progress.asStateFlow()

    /** One-shot user-facing message (error or confirmation). */
    private val _toast = MutableStateFlow<String?>(null)
    val toast = _toast.asStateFlow()

    private val _testing = MutableStateFlow(false)
    val testing = _testing.asStateFlow()

    private val _testResult = MutableStateFlow<String?>(null)
    val testResult = _testResult.asStateFlow()

    private val _models = MutableStateFlow<List<String>>(emptyList())
    val models = _models.asStateFlow()

    private var job: Job? = null

    init {
        viewModelScope.launch {
            store.load()?.let { repo.restore(it) }
        }
    }

    fun prompt(): String = PromptEngine.compile(repo.active())

    fun dismissToast() { _toast.value = null }

    private fun autosave() {
        viewModelScope.launch { store.save(repo.snapshot()) }
    }

    /** Renders [count] images with the currently selected engine. */
    fun generate(count: Int = 1, isVideo: Boolean = false) {
        if (_rendering.value) return
        job = viewModelScope.launch {
            _rendering.value = true
            _progress.value = 0f
            val persona = repo.active()
            val settings = repo.settings.value
            val server = repo.server.value
            val engine = engines[settings.engine]
            val promptText = PromptEngine.compile(persona)

            try {
                repeat(count) { i ->
                    val result = engine.render(promptText, settings, server) { p ->
                        val base = i / count.toFloat()
                        _progress.value = base + (p.coerceIn(0f, 1f) / count)
                    }
                    val item = GalleryItem(
                        personaId = persona.id,
                        personaName = persona.name,
                        prompt = promptText,
                        engine = settings.engine,
                        assetOrPath = "",
                        isVideo = isVideo,
                    )
                    val path = store.writeImage(item.id, result.bytes)
                    repo.addRender(item.copy(assetOrPath = path))
                }
                _toast.value = if (count > 1) "$count renders complete" else "Render complete"
                autosave()
            } catch (e: EngineException) {
                _toast.value = e.message
            } catch (e: kotlinx.coroutines.CancellationException) {
                throw e
            } catch (e: Exception) {
                _toast.value = "${settings.engine.label} failed: ${e.message ?: e::class.simpleName}"
            } finally {
                _rendering.value = false
                _progress.value = 0f
            }
        }
    }

    fun cancel() {
        job?.cancel()
        _rendering.value = false
        _progress.value = 0f
    }

    /** Settings → TEST CONNECTION */
    fun testConnection() {
        if (_testing.value) return
        viewModelScope.launch {
            _testing.value = true
            _testResult.value = null
            val settings = repo.settings.value
            try {
                _testResult.value = engines[settings.engine].test(repo.server.value)
            } catch (e: Exception) {
                _testResult.value = "✕ ${e.message ?: "Connection failed"}"
            } finally {
                _testing.value = false
            }
        }
    }

    /** Settings → FETCH MODELS */
    fun fetchModels() {
        viewModelScope.launch {
            _testing.value = true
            try {
                val list = engines[repo.settings.value.engine].models(repo.server.value)
                _models.value = list
                _testResult.value = "Loaded ${list.size} checkpoints"
            } catch (e: Exception) {
                _testResult.value = "✕ ${e.message ?: "Could not fetch models"}"
            } finally {
                _testing.value = false
            }
        }
    }

    fun setSettings(s: RenderSettings) { repo.setSettings(s); autosave() }
    fun setServer(s: ServerConfig) { repo.setServer(s); autosave() }
    fun setAdult(v: Boolean) { repo.setAdult(v); autosave() }

    fun update(transform: (Persona) -> Persona) { repo.update(transform); autosave() }
    fun select(id: String) { repo.select(id); autosave() }
    fun addPersona(p: Persona) { repo.add(p); autosave() }
    fun duplicate(id: String) { repo.duplicate(id); autosave() }
    fun deletePersona(id: String) { repo.delete(id); autosave() }
    fun send(text: String) { repo.send(text); autosave() }
    fun setChapter(i: Int) { repo.setChapter(i); autosave() }
    fun toggleFavorite(id: String) { repo.toggleFavorite(id); autosave() }

    fun deleteRender(id: String) {
        val item = repo.gallery.value.firstOrNull { it.id == id }
        repo.deleteRender(id)
        viewModelScope.launch {
            item?.assetOrPath?.let { store.deleteImage(it) }
            store.save(repo.snapshot())
        }
    }

    fun exportJson(): String = store.exportJson(repo.snapshot())

    fun importJson(text: String) {
        viewModelScope.launch {
            try {
                repo.restore(store.importJson(text))
                _toast.value = "Import complete"
                autosave()
            } catch (e: Exception) {
                _toast.value = "Import failed: ${e.message}"
            }
        }
    }

    fun resetAll() {
        viewModelScope.launch {
            store.reset()
            _toast.value = "Local data cleared — restart to reseed"
        }
    }
}
