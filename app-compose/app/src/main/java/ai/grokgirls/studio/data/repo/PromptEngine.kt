package ai.grokgirls.studio.data.repo

import ai.grokgirls.studio.data.model.*

/** Compiles builder selections into an HD photoreal render prompt. */
object PromptEngine {

    fun compile(p: Persona): String {
        val parts = mutableListOf<String>()
        parts += "ultra-HD photorealistic 3D character render, cinematic 8K, subsurface scattering skin"
        parts += "${p.appearance.age} year old adult ${p.appearance.presentation.label.lowercase()} character named ${p.name}"
        parts += "${p.hair.style.lowercase()} hair in ${hex(p.hair.colorArgb)}"
        parts += "${p.face.eyeShape.lowercase()} ${hex(p.face.eyeColorArgb)} eyes, ${p.face.browShape.lowercase()} brows"
        if (p.face.makeup != "Bare") parts += "${p.face.makeup.lowercase()} makeup"
        parts += "wearing ${p.outfit.top.lowercase()} and ${p.outfit.bottom.lowercase()}"
        if (p.outfit.hosiery != "None") parts += p.outfit.hosiery.lowercase()
        if (p.outfit.neckwear != "None") parts += p.outfit.neckwear.lowercase()
        parts += "${p.outfit.footwear.lowercase()}"
        parts += "${p.body.posture.lowercase()} pose"
        if (p.tattoos.isNotEmpty()) parts += "tattoos: ${p.tattoos.joinToString(", ") { it.lowercase() }}"
        if (p.augments.isNotEmpty()) parts += "cyberware: ${p.augments.joinToString(", ") { it.lowercase() }}"
        if (p.accessories.isNotEmpty()) parts += p.accessories.joinToString(", ") { it.lowercase() }
        parts += p.scene.promptStyle
        parts += "global illumination, pore-level detail, sharp focus, professional colour grade"
        return parts.joinToString(", ")
    }

    fun hex(argb: Long): String = "#%06X".format(argb and 0xFFFFFF)
}
