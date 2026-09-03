package ai.grokgirls.studio.ui.screens.studio

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import ai.grokgirls.studio.data.model.*
import ai.grokgirls.studio.data.repo.PromptEngine
import ai.grokgirls.studio.data.repo.StudioViewModel
import ai.grokgirls.studio.ui.components.*
import ai.grokgirls.studio.ui.nav.Dest

private enum class Tab(val label: String, val icon: androidx.compose.ui.graphics.vector.ImageVector) {
    APPEARANCE("Appearance", Icons.Rounded.Face),
    HAIR("Hair", Icons.Rounded.ContentCut),
    FACE("Face", Icons.Rounded.Visibility),
    BODY("Body", Icons.Rounded.Accessibility),
    CLOTHING("Clothing", Icons.Rounded.Checkroom),
    EXTRAS("Extras", Icons.Rounded.AutoAwesome),
    SCENE("Scene", Icons.Rounded.Landscape),
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StudioScreen(vm: StudioViewModel, nav: NavHostController) {
    val personas by vm.repo.personas.collectAsState()
    val activeId by vm.repo.activeId.collectAsState()
    val p = personas.first { it.id == activeId }
    val rendering by vm.rendering.collectAsState()
    val progress by vm.progress.collectAsState()
    val settings by vm.repo.settings.collectAsState()
    val adult by vm.repo.adultMode.collectAsState()

    var tab by remember { mutableStateOf(Tab.APPEARANCE) }
    var showPrompt by remember { mutableStateOf(false) }
    var immersive by remember { mutableStateOf(false) }
    val accent = Color(p.scene.accent)

    Column(Modifier.fillMaxSize()) {
        AnimatedVisibility(!immersive) {
            TopAppBar(
                title = {
                    Column {
                        Text(p.name, style = MaterialTheme.typography.titleLarge, maxLines = 1)
                        Text(p.tagline.ifBlank { p.scene.label },
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
                    }
                },
                actions = {
                    IconButton({ showPrompt = true }) { Icon(Icons.Rounded.Edit, "Prompt") }
                    IconButton({ nav.navigate(Dest.SETTINGS.route) }) { Icon(Icons.Rounded.Tune, "Settings") }
                    IconButton({ immersive = true }) { Icon(Icons.Rounded.Fullscreen, "Fullscreen") }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.Transparent),
            )
        }

        // ---------- Viewport ----------
        Box(
            Modifier.fillMaxWidth()
                .weight(if (immersive) 1f else 0.52f)
                .padding(horizontal = 14.dp)
                .clip(MaterialTheme.shapes.large)
        ) {
            AssetImage(p.scene.backdropAsset, Modifier.fillMaxSize(), alpha = 0.55f)
            p.previewAsset?.let {
                AssetImage(it, Modifier.fillMaxSize(), ContentScale.Crop)
            }
            Box(
                Modifier.matchParentSize().background(
                    Brush.verticalGradient(
                        0f to Color.Transparent,
                        0.55f to Color.Transparent,
                        1f to Color(0xCC07070B),
                    )
                )
            )
            // camera chip
            Row(
                Modifier.align(Alignment.TopStart).padding(14.dp)
                    .clip(CircleShape).background(Color(0x99000000))
                    .padding(horizontal = 12.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(Modifier.size(6.dp).clip(CircleShape).background(accent))
                Spacer(Modifier.width(7.dp))
                Text(p.scene.label.uppercase(), style = MaterialTheme.typography.labelSmall, color = Color.White)
            }
            if (immersive) {
                IconButton({ immersive = false }, Modifier.align(Alignment.TopEnd).padding(10.dp)) {
                    Icon(Icons.Rounded.FullscreenExit, "Exit", tint = Color.White)
                }
            }
            // viewport tools
            Column(
                Modifier.align(Alignment.CenterEnd).padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                val tools: List<Pair<androidx.compose.ui.graphics.vector.ImageVector, String>> = listOf(
                    Icons.Rounded.Rotate90DegreesCw to "Rotate",
                    Icons.Rounded.ZoomIn to "Zoom",
                    Icons.Rounded.OpenWith to "Pan",
                    Icons.Rounded.Casino to "Random",
                    Icons.Rounded.Download to "Export",
                )
                tools.forEach { tool ->
                    Surface(
                        shape = CircleShape,
                        color = Color(0x66000000),
                        modifier = Modifier.size(40.dp),
                    ) {
                        IconButton({}) {
                            Icon(tool.first, tool.second, Modifier.size(19.dp), tint = Color.White)
                        }
                    }
                }
            }
            if (rendering) {
                Column(
                    Modifier.align(Alignment.BottomCenter).fillMaxWidth().padding(18.dp),
                ) {
                    Text("RENDERING · ${(progress * 100).toInt()}%",
                        style = MaterialTheme.typography.labelMedium, color = Color.White)
                    Spacer(Modifier.height(6.dp))
                    LinearProgressIndicator(
                        { progress }, Modifier.fillMaxWidth().height(4.dp).clip(CircleShape),
                        color = accent, trackColor = Color(0x33FFFFFF),
                    )
                }
            }
        }

        if (!immersive) {
            Spacer(Modifier.height(12.dp))

            // ---------- Category tabs ----------
            ScrollableTabRow(
                selectedTabIndex = tab.ordinal,
                containerColor = Color.Transparent,
                edgePadding = 14.dp,
                divider = {},
                indicator = { positions ->
                    if (tab.ordinal < positions.size) {
                        TabRowDefaults.SecondaryIndicator(
                            Modifier.tabIndicatorOffset(positions[tab.ordinal]),
                            height = 3.dp,
                            color = accent,
                        )
                    }
                },
            ) {
                Tab.entries.forEach { t ->
                    Tab(
                        selected = t == tab, onClick = { tab = t },
                        text = { Text(t.label, style = MaterialTheme.typography.labelMedium, maxLines = 1) },
                        icon = { Icon(t.icon, null, Modifier.size(17.dp)) },
                    )
                }
            }

            // ---------- Inspector ----------
            Box(Modifier.weight(0.48f)) {
                LazyColumn(
                    Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(bottom = 100.dp, top = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    item {
                        when (tab) {
                            Tab.APPEARANCE -> AppearancePanel(p, vm)
                            Tab.HAIR -> HairPanel(p, vm)
                            Tab.FACE -> FacePanel(p, vm)
                            Tab.BODY -> BodyPanel(p, vm)
                            Tab.CLOTHING -> ClothingPanel(p, vm, adult)
                            Tab.EXTRAS -> ExtrasPanel(p, vm)
                            Tab.SCENE -> ScenePanel(p, vm)
                        }
                    }
                }

                // ---------- Action dock ----------
                Row(
                    Modifier.align(Alignment.BottomCenter).fillMaxWidth()
                        .background(Brush.verticalGradient(listOf(Color.Transparent, Color(0xEE07070B))))
                        .padding(14.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    if (rendering) {
                        OutlinedButton(
                            { vm.cancel() }, Modifier.height(52.dp),
                            shape = MaterialTheme.shapes.small,
                        ) { Text("CANCEL", style = MaterialTheme.typography.labelLarge) }
                    } else {
                        PrimaryAction("Generate", Icons.Rounded.AutoAwesome, { vm.generate() }, Modifier.weight(1f))
                    }
                    FilledTonalIconButton(
                        { vm.generate(4) }, Modifier.size(52.dp),
                        shape = MaterialTheme.shapes.small,
                        enabled = !rendering,
                    ) { Icon(Icons.Rounded.Dashboard, "x4 variations") }
                    FilledTonalIconButton(
                        { nav.navigate(Dest.GALLERY.route) }, Modifier.size(52.dp),
                        shape = MaterialTheme.shapes.small,
                    ) { Icon(Icons.Rounded.PhotoLibrary, "Gallery") }
                }
            }
        }
    }

    if (showPrompt) {
        PromptSheet(
            prompt = PromptEngine.compile(p),
            settings = settings,
            onSettings = { vm.setSettings(it) },
            onDismiss = { showPrompt = false },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PromptSheet(
    prompt: String,
    settings: RenderSettings,
    onSettings: (RenderSettings) -> Unit,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(onDismiss, containerColor = MaterialTheme.colorScheme.surfaceContainer) {
        SectionHeader("Compiled prompt")
        Text(prompt, Modifier.padding(horizontal = 18.dp),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(16.dp))
        SectionHeader("Negative prompt")
        OutlinedTextField(
            settings.negativePrompt,
            { onSettings(settings.copy(negativePrompt = it)) },
            Modifier.fillMaxWidth().padding(horizontal = 18.dp),
            shape = MaterialTheme.shapes.small,
            minLines = 2,
        )
        Spacer(Modifier.height(12.dp))
        SectionHeader("Sampling")
        LabeledSlider("Steps", settings.steps / 60f, onChange = { onSettings(settings.copy(steps = (it * 60).toInt().coerceIn(4, 60))) },
            display = { "${(it * 60).toInt()}" })
        LabeledSlider("CFG scale", settings.cfg / 20f, onChange = { onSettings(settings.copy(cfg = it * 20)) },
            display = { "%.1f".format(it * 20) })
        SectionHeader("Resolution")
        ChipRow(listOf("1024", "1536", "2048"), settings.resolution.toString()) {
            onSettings(settings.copy(resolution = it.toInt()))
        }
        Spacer(Modifier.height(12.dp))
        SectionHeader("Engine")
        ChipRow(RenderEngine.entries.map { it.label }, settings.engine.label) { l ->
            onSettings(settings.copy(engine = RenderEngine.entries.first { it.label == l }))
        }
        Spacer(Modifier.height(36.dp))
    }
}
