package ai.grokgirls.studio.ui.screens.story

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import ai.grokgirls.studio.data.model.Catalog
import ai.grokgirls.studio.data.repo.StudioViewModel
import ai.grokgirls.studio.ui.components.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StoryScreen(vm: StudioViewModel) {
    val personas by vm.repo.personas.collectAsState()
    val activeId by vm.repo.activeId.collectAsState()
    val p = personas.first { it.id == activeId }
    val stats by vm.repo.stats.collectAsState()
    val current by vm.repo.chapter.collectAsState()
    val accent = Color(p.scene.accent)

    Scaffold(
        containerColor = Color.Transparent,
        topBar = {
            TopAppBar(
                title = { Text("Story", style = MaterialTheme.typography.headlineSmall) },
                actions = {
                    Row(
                        Modifier.padding(end = 14.dp).clip(CircleShape)
                            .background(accent.copy(alpha = 0.18f))
                            .padding(horizontal = 12.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(Icons.Rounded.Favorite, null, Modifier.size(14.dp), tint = accent)
                        Spacer(Modifier.width(6.dp))
                        Text("${stats.affinity}", style = MaterialTheme.typography.labelMedium, color = accent)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.Transparent),
            )
        },
    ) { pad ->
        LazyColumn(
            Modifier.padding(pad),
            contentPadding = PaddingValues(16.dp, 4.dp, 16.dp, 90.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            items(Catalog.chapters.size) { i ->
                val ch = Catalog.chapters[i]
                val locked = stats.affinity < ch.requiredAffinity
                val isCurrent = i == current
                Column(
                    Modifier.fillMaxWidth().clip(MaterialTheme.shapes.medium)
                        .background(MaterialTheme.colorScheme.surfaceContainer)
                        .border(
                            if (isCurrent) 2.dp else 1.dp,
                            if (isCurrent) accent else MaterialTheme.colorScheme.outlineVariant,
                            MaterialTheme.shapes.medium,
                        )
                        .alpha(if (locked) 0.5f else 1f)
                ) {
                    Box(Modifier.fillMaxWidth().height(120.dp)) {
                        AssetImage(p.scene.backdropAsset, Modifier.fillMaxSize(), ContentScale.Crop)
                        Box(Modifier.matchParentSize().background(
                            Brush.verticalGradient(listOf(Color(0x3307070B), Color(0xEE07070B)))))
                        Row(Modifier.align(Alignment.BottomStart).padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically) {
                            Text("0${i + 1}", style = MaterialTheme.typography.displayMedium,
                                color = accent.copy(alpha = 0.85f))
                            Spacer(Modifier.width(12.dp))
                            Column {
                                Text(ch.title, style = MaterialTheme.typography.titleLarge, color = Color.White)
                                if (locked) Text("Requires ${ch.requiredAffinity} affinity",
                                    style = MaterialTheme.typography.labelSmall, color = Color(0xCCFFFFFF))
                            }
                        }
                        if (locked) Icon(Icons.Rounded.Lock, null,
                            Modifier.align(Alignment.TopEnd).padding(12.dp), tint = Color.White)
                    }
                    Text(ch.blurb, Modifier.padding(16.dp, 12.dp, 16.dp, 6.dp),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                    FlowRowActions(ch.actions, enabled = !locked) {
                        vm.setChapter(i)
                        vm.generate()
                    }
                    if (!locked) {
                        TextButton({ vm.setChapter(i) }, Modifier.padding(8.dp)) {
                            Text(if (isCurrent) "CURRENT CHAPTER" else "JUMP TO CHAPTER",
                                style = MaterialTheme.typography.labelMedium)
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun FlowRowActions(actions: List<String>, enabled: Boolean, onAction: (String) -> Unit) {
    FlowRow(
        Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        actions.forEach { a ->
            AssistChip(
                { if (enabled) onAction(a) },
                { Text(a, style = MaterialTheme.typography.labelMedium) },
                enabled = enabled,
                shape = MaterialTheme.shapes.small,
            )
        }
    }
}
