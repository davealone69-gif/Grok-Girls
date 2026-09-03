package ai.grokgirls.studio.ui.screens.presets

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.*
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import ai.grokgirls.studio.data.model.Persona
import ai.grokgirls.studio.data.repo.StudioViewModel
import ai.grokgirls.studio.ui.components.AssetImage
import ai.grokgirls.studio.ui.nav.Dest

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PresetsScreen(vm: StudioViewModel, nav: NavHostController) {
    val personas by vm.repo.personas.collectAsState()
    val activeId by vm.repo.activeId.collectAsState()
    var query by remember { mutableStateOf("") }
    val filtered = personas.filter { it.name.contains(query, true) || it.tagline.contains(query, true) }

    Scaffold(
        containerColor = Color.Transparent,
        topBar = {
            TopAppBar(
                title = { Text("Presets", style = MaterialTheme.typography.headlineSmall) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.Transparent),
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { vm.repo.add(Persona(name = "Persona ${personas.size + 1}",
                    previewAsset = "presets/preset_ruby.jpg")); nav.navigate(Dest.STUDIO.route) },
                icon = { Icon(Icons.Rounded.Add, null) },
                text = { Text("NEW") },
                containerColor = MaterialTheme.colorScheme.primary,
            )
        },
    ) { pad ->
        Column(Modifier.padding(pad)) {
            OutlinedTextField(
                query, { query = it },
                Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp),
                placeholder = { Text("Search personas") },
                leadingIcon = { Icon(Icons.Rounded.Search, null) },
                shape = MaterialTheme.shapes.large, singleLine = true,
            )
            LazyVerticalGrid(
                GridCells.Adaptive(168.dp),
                Modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp, 10.dp, 16.dp, 96.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                items(filtered, key = { it.id }) { p ->
                    PresetCard(
                        p, p.id == activeId,
                        onLoad = { vm.repo.select(p.id); nav.navigate(Dest.STUDIO.route) },
                        onDuplicate = { vm.repo.duplicate(p.id) },
                        onDelete = { vm.repo.delete(p.id) },
                    )
                }
            }
        }
    }
}

@Composable
private fun PresetCard(
    p: Persona, active: Boolean,
    onLoad: () -> Unit, onDuplicate: () -> Unit, onDelete: () -> Unit,
) {
    var confirm by remember { mutableStateOf(false) }
    Column(
        Modifier.clip(MaterialTheme.shapes.medium)
            .background(MaterialTheme.colorScheme.surfaceContainer)
            .border(
                if (active) 2.dp else 1.dp,
                if (active) Color(p.scene.accent) else MaterialTheme.colorScheme.outlineVariant,
                MaterialTheme.shapes.medium,
            )
            .clickable(onClick = onLoad)
    ) {
        Box(Modifier.fillMaxWidth().aspectRatio(0.78f)) {
            p.previewAsset?.let { AssetImage(it, Modifier.fillMaxSize(), ContentScale.Crop) }
            Box(Modifier.matchParentSize().background(
                Brush.verticalGradient(0.5f to Color.Transparent, 1f to Color(0xE007070B))))
            if (active) {
                Row(
                    Modifier.align(Alignment.TopStart).padding(8.dp).clip(CircleShape)
                        .background(Color(p.scene.accent)).padding(horizontal = 9.dp, vertical = 3.dp)
                ) { Text("ACTIVE", style = MaterialTheme.typography.labelSmall, color = Color.White) }
            }
            Column(Modifier.align(Alignment.BottomStart).padding(11.dp)) {
                Text(p.name, style = MaterialTheme.typography.titleMedium, color = Color.White, maxLines = 1)
                Text(p.tagline.ifBlank { p.scene.label },
                    style = MaterialTheme.typography.labelSmall, color = Color(0xCCFFFFFF), maxLines = 1)
            }
        }
        Row(Modifier.fillMaxWidth().padding(horizontal = 6.dp, vertical = 2.dp)) {
            TextButton(onLoad, Modifier.weight(1f)) {
                Text("LOAD", style = MaterialTheme.typography.labelMedium)
            }
            IconButton(onDuplicate) { Icon(Icons.Rounded.ContentCopy, "Duplicate", Modifier.size(17.dp)) }
            IconButton({ if (confirm) onDelete() else confirm = true }) {
                Icon(Icons.Rounded.DeleteOutline, "Delete", Modifier.size(18.dp),
                    tint = if (confirm) MaterialTheme.colorScheme.error else LocalContentColor.current)
            }
        }
    }
}
