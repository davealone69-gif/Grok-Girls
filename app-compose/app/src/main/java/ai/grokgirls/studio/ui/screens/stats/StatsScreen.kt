package ai.grokgirls.studio.ui.screens.stats

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import ai.grokgirls.studio.data.model.Catalog
import ai.grokgirls.studio.data.repo.StudioViewModel
import ai.grokgirls.studio.ui.components.*
import ai.grokgirls.studio.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun StatsScreen(vm: StudioViewModel) {
    val s by vm.repo.stats.collectAsState()
    val progressFor = { key: String ->
        when (key) {
            "first_render", "ten_renders", "fifty_renders" -> s.renders
            "first_fav" -> s.favorites
            "chatty" -> s.messages
            "story" -> s.chapters
            "importer" -> s.imports
            "director" -> s.clips
            else -> 0
        }
    }

    Scaffold(
        containerColor = Color.Transparent,
        topBar = {
            TopAppBar(title = { Text("Stats", style = MaterialTheme.typography.headlineSmall) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.Transparent))
        },
    ) { pad ->
        LazyColumn(Modifier.padding(pad), contentPadding = PaddingValues(16.dp, 4.dp, 16.dp, 90.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    StatPill("Renders", "${s.renders}", Crimson60)
                    StatPill("Favourites", "${s.favorites}", Violet60)
                    StatPill("Messages", "${s.messages}", Cyan60)
                    StatPill("Chapters", "${s.chapters}/4", Gold)
                    StatPill("Clips", "${s.clips}", Success)
                    StatPill("Affinity", "${s.affinity}", Crimson60)
                }
            }
            item { SectionHeader("Achievements") }
            items(Catalog.achievements.size) { i ->
                val a = Catalog.achievements[i]
                val cur = progressFor(a.key)
                val unlocked = cur >= a.target
                Row(
                    Modifier.fillMaxWidth().clip(MaterialTheme.shapes.small)
                        .background(MaterialTheme.colorScheme.surfaceContainer)
                        .border(1.dp,
                            if (unlocked) Gold.copy(alpha = 0.5f) else MaterialTheme.colorScheme.outlineVariant,
                            MaterialTheme.shapes.small)
                        .padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(Modifier.size(44.dp).clip(CircleShape).background(
                        if (unlocked) Brush.linearGradient(listOf(Gold, Crimson60))
                        else Brush.linearGradient(listOf(Ink20, Ink20))),
                        contentAlignment = Alignment.Center) {
                        Icon(if (unlocked) Icons.Rounded.EmojiEvents else Icons.Rounded.Lock, null,
                            Modifier.size(21.dp),
                            tint = if (unlocked) Color.White else MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Spacer(Modifier.width(14.dp))
                    Column(Modifier.weight(1f)) {
                        Text(a.title, style = MaterialTheme.typography.titleMedium)
                        Text(a.description, style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Spacer(Modifier.height(6.dp))
                        LinearProgressIndicator(
                            { (cur.toFloat() / a.target).coerceIn(0f, 1f) },
                            Modifier.fillMaxWidth().height(4.dp).clip(CircleShape),
                            color = if (unlocked) Gold else MaterialTheme.colorScheme.primary,
                            trackColor = MaterialTheme.colorScheme.surfaceContainerHighest,
                        )
                    }
                    Spacer(Modifier.width(10.dp))
                    Text("$cur/${a.target}", style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}
