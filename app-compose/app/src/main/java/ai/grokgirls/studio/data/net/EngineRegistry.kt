package ai.grokgirls.studio.data.net

import ai.grokgirls.studio.data.model.Persona
import ai.grokgirls.studio.data.model.RenderEngine

/** Maps the selected RenderEngine enum to a concrete client. */
class EngineRegistry(personaProvider: () -> Persona) {
    private val local = LocalEngine(personaProvider)
    private val openRouter = OpenRouterEngine()
    private val gemini = GeminiEngine()
    private val custom = CustomEngine()
    private val selfHosted = SelfHostedEngine()

    operator fun get(engine: RenderEngine): ImageEngine = when (engine) {
        RenderEngine.LOCAL -> local
        RenderEngine.OPENROUTER -> openRouter
        RenderEngine.GEMINI -> gemini
        RenderEngine.CUSTOM -> custom
        RenderEngine.SELF_HOSTED -> selfHosted
    }
}
