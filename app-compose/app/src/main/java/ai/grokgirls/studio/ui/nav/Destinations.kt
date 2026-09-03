package ai.grokgirls.studio.ui.nav

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.ui.graphics.vector.ImageVector

enum class Dest(val route: String, val label: String, val icon: ImageVector, val inBar: Boolean = true) {
    STUDIO("studio", "Studio", Icons.Rounded.AutoAwesome),
    PRESETS("presets", "Presets", Icons.Rounded.GridView),
    CHAT("chat", "Chat", Icons.Rounded.ChatBubble),
    STORY("story", "Story", Icons.Rounded.MenuBook),
    GALLERY("gallery", "Gallery", Icons.Rounded.PhotoLibrary),
    VIDEO("video", "Video", Icons.Rounded.Movie, inBar = false),
    STATS("stats", "Stats", Icons.Rounded.EmojiEvents, inBar = false),
    SETTINGS("settings", "Settings", Icons.Rounded.Settings, inBar = false),
    PREMIUM("premium", "Premium", Icons.Rounded.WorkspacePremium, inBar = false);

    companion object {
        val bar = entries.filter { it.inBar }
    }
}
