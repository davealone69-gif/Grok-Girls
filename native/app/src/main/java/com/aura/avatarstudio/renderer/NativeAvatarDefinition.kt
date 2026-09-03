package com.aura.avatarstudio.renderer

import org.json.JSONObject

/** Canonical avatar payload received from the Grok-Girls web editor. */
data class NativeAvatarDefinition(
    val gender: String = "Female",
    val skin: String = "Tone 01",
    val head: String = "Head 01",
    val age: String = "Adult",
    val hair: String = "Short",
    val eyes: String = "Natural",
    val face: String = "Soft",
    val body: String = "Average",
    val tattoos: String = "None",
    val augmentations: String = "None",
    val outfit: String = "Casual"
) {
    companion object {
        fun fromJson(raw: String?): NativeAvatarDefinition {
            if (raw.isNullOrBlank()) return NativeAvatarDefinition()
            return runCatching {
                val o = JSONObject(raw)
                NativeAvatarDefinition(
                    gender = o.optString("gender", "Female"),
                    skin = o.optString("skin", "Tone 01"),
                    head = o.optString("head", "Head 01"),
                    age = o.optString("age", "Adult"),
                    hair = o.optString("hair", "Short"),
                    eyes = o.optString("eyes", "Natural"),
                    face = o.optString("face", "Soft"),
                    body = o.optString("body", "Average"),
                    tattoos = o.optString("tattoos", "None"),
                    augmentations = o.optString("augmentations", "None"),
                    outfit = o.optString("outfit", "Casual")
                )
            }.getOrDefault(NativeAvatarDefinition())
        }
    }
}
