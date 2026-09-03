package ai.grokgirls.studio.ui.screens.gallery

import androidx.compose.animation.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.automirrored.rounded.ArrowForward
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
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import ai.grokgirls.studio.data.model.RenderEngine
import ai.grokgirls.studio.data.repo.StudioViewModel
import ai.grokgirls.studio.ui.components.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GalleryScreen(vm: StudioViewModel) {
    val items by vm.repo.gallery.collectAsState()
    var filter by remember { mutableStateOf("ALL") }
    var lightbox by remember { mutableStateOf<Int?>(null) }
    val filters = listOf("ALL") + RenderEngine.entries.map { it.label.uppercase() }
    val shown = items.filter { filter == "ALL" || it.engine.label.uppercase() == filter }

    Scaffold(
        containerColor = Color.Transparent,
        topBar = {
            TopAppBar(
                title = { Text("Gallery", style = MaterialTheme.typography.headlineSmall) },
                actions = {
                    IconButton({}) { Icon(Icons.Rounded.GridOn, "Contact sheet") }
                    IconButton({}) { Icon(Icons.Rounded.IosShare, "Export") }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.Transparent),
            )
        },
    ) { pad ->
        Column(Modifier.padding(pad)) {
            LazyRow(
                Modifier.fillMaxWidth().padding(vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                contentPadding = PaddingValues(horizontal = 16.dp),
            ) {
                items(filters.size) { i ->
                    FilterChip(filters[i] == filter, { filter = filters[i] },
                        { Text(filters[i], style = MaterialTheme.typography.labelSmall) },
                        shape = MaterialTheme.shapes.small)
                }
            }
            if (shown.isEmpty()) {
                EmptyState(Icons.Rounded.PhotoLibrary, "Nothing rendered yet",
                    "Generate a render in the Studio and it will land here automatically.")
            } else {
                LazyVerticalGrid(
                    GridCells.Adaptive(150.dp),
                    contentPadding = PaddingValues(16.dp, 8.dp, 16.dp, 96.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    items(shown.size) { i ->
                        val g = shown[i]
                        Box(
                            Modifier.aspectRatio(0.75f).clip(MaterialTheme.shapes.small)
                                .clickable { lightbox = i }
                        ) {
                            AssetImage(g.assetOrPath, Modifier.fillMaxSize(), ContentScale.Crop)
                            Box(Modifier.matchParentSize().background(
                                Brush.verticalGradient(0.6f to Color.Transparent, 1f to Color(0xDD07070B))))
                            Row(Modifier.align(Alignment.BottomStart).padding(8.dp),
                                verticalAlignment = Alignment.CenterVertically) {
                                Text(g.engine.label.uppercase(),
                                    style = MaterialTheme.typography.labelSmall, color = Color(0xCCFFFFFF))
                            }
                            if (g.favorite) Icon(Icons.Rounded.Favorite, null,
                                Modifier.align(Alignment.TopEnd).padding(7.dp).size(17.dp),
                                tint = MaterialTheme.colorScheme.primary)
                            if (g.isVideo) Icon(Icons.Rounded.PlayCircle, null,
                                Modifier.align(Alignment.Center).size(38.dp), tint = Color(0xE6FFFFFF))
                        }
                    }
                }
            }
        }
    }

    lightbox?.let { idx ->
        if (idx in shown.indices) {
            val g = shown[idx]
            Dialog({ lightbox = null }, DialogProperties(usePlatformDefaultWidth = false)) {
                Box(Modifier.fillMaxSize().background(Color(0xF207070B))) {
                    AssetImage(g.assetOrPath, Modifier.fillMaxSize(), ContentScale.Fit)
                    IconButton({ lightbox = null }, Modifier.align(Alignment.TopEnd).padding(14.dp)) {
                        Icon(Icons.Rounded.Close, "Close", tint = Color.White)
                    }
                    if (idx > 0) IconButton({ lightbox = idx - 1 },
                        Modifier.align(Alignment.CenterStart).padding(8.dp)) {
                        Icon(Icons.AutoMirrored.Rounded.ArrowBack, "Prev", tint = Color.White) }
                    if (idx < shown.lastIndex) IconButton({ lightbox = idx + 1 },
                        Modifier.align(Alignment.CenterEnd).padding(8.dp)) {
                        Icon(Icons.AutoMirrored.Rounded.ArrowForward, "Next", tint = Color.White) }
                    Column(Modifier.align(Alignment.BottomCenter).fillMaxWidth()
                        .background(Brush.verticalGradient(listOf(Color.Transparent, Color(0xEE07070B))))
                        .padding(18.dp)) {
                        Text(g.personaName, style = MaterialTheme.typography.titleMedium, color = Color.White)
                        Text(g.prompt, style = MaterialTheme.typography.bodyMedium,
                            color = Color(0xAAFFFFFF), maxLines = 3)
                        Spacer(Modifier.height(10.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            IconButton({ vm.repo.toggleFavorite(g.id) }) {
                                Icon(if (g.favorite) Icons.Rounded.Favorite else Icons.Rounded.FavoriteBorder,
                                    "Favourite", tint = MaterialTheme.colorScheme.primary) }
                            IconButton({}) { Icon(Icons.Rounded.Download, "Download", tint = Color.White) }
                            IconButton({}) { Icon(Icons.Rounded.Wallpaper, "Set viewport", tint = Color.White) }
                            IconButton({ vm.repo.deleteRender(g.id); lightbox = null }) {
                                Icon(Icons.Rounded.DeleteOutline, "Delete",
                                    tint = MaterialTheme.colorScheme.error) }
                        }
                    }
                }
            }
        }
    }
}
