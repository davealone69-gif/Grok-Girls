package ai.grokgirls.studio.data.repo

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import ai.grokgirls.studio.data.model.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class StudioViewModel : ViewModel() {
    val repo = StudioRepository()

    private val _rendering = MutableStateFlow(false)
    val rendering = _rendering.asStateFlow()

    private val _progress = MutableStateFlow(0f)
    val progress = _progress.asStateFlow()

    private var job: kotlinx.coroutines.Job? = null

    fun prompt(): String = PromptEngine.compile(repo.active())

    fun generate(count: Int = 1, isVideo: Boolean = false) {
        if (_rendering.value) return
        job = viewModelScope.launch {
            _rendering.value = true
            _progress.value = 0f
            val steps = 40
            repeat(steps) {
                delay(if (isVideo) 60L else 35L)
                _progress.value = (it + 1) / steps.toFloat()
            }
            val p = repo.active()
            repeat(count) {
                repo.addRender(
                    GalleryItem(
                        personaId = p.id,
                        personaName = p.name,
                        prompt = PromptEngine.compile(p),
                        engine = repo.settings.value.engine,
                        assetOrPath = p.previewAsset ?: "presets/preset_ruby.jpg",
                        isVideo = isVideo,
                    )
                )
            }
            _rendering.value = false
            _progress.value = 0f
        }
    }

    fun cancel() {
        job?.cancel()
        _rendering.value = false
        _progress.value = 0f
    }
}
