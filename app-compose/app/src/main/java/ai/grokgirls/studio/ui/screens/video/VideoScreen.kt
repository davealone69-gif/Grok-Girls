package ai.grokgirls.studio.ui.screens.video

import androidx.compose.foundation.background
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import ai.grokgirls.studio.data.repo.StudioViewModel
import ai.grokgirls.studio.ui.components.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VideoScreen(vm: StudioViewModel) {
    val personas by vm.repo.personas.collectAsState()
    val activeId by vm.repo.activeId.collectAsState()
    val p = personas.first { it.id == activeId }
    val rendering by vm.rendering.collectAsState()
    val progress by vm.progress.collectAsState()

    var quality by remember { mutableStateOf("1080p") }
    var fps by remember { mutableStateOf("30") }
    var aspect by remember { mutableStateOf("9:16") }
    var motion by remember { mutableStateOf("Ken Burns") }
    var duration by remember { mutableFloatStateOf(0.5f) }

    Scaffold(
        containerColor = Color.Transparent,
        topBar = {
            TopAppBar(
                title = { Text("Video Studio", style = MaterialTheme.typography.headlineSmall) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.Transparent),
            )
        },
    ) { pad ->
        LazyColumn(Modifier.padding(pad), contentPadding = PaddingValues(bottom = 96.dp)) {
            item {
                Box(
                    Modifier.fillMaxWidth().aspectRatio(if (aspect == "9:16") 0.72f else 1.6f)
                        .padding(horizontal = 16.dp).clip(MaterialTheme.shapes.large)
                ) {
                    p.previewAsset?.let { AssetImage(it, Modifier.fillMaxSize(), ContentScale.Crop) }
                    Box(Modifier.matchParentSize().background(Color(0x3307070B)))
                    // HUD frame
                    Row(Modifier.align(Alignment.TopStart).padding(12.dp).clip(CircleShape)
                        .background(Color(0xAA000000)).padding(horizontal = 10.dp, vertical = 5.dp),
                        verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(7.dp).clip(CircleShape).background(MaterialTheme.colorScheme.error))
                        Spacer(Modifier.width(6.dp))
                        Text("REC · $quality · ${fps}fps",
                            style = MaterialTheme.typography.labelSmall, color = Color.White)
                    }
                    if (rendering) {
                        LinearProgressIndicator({ progress },
                            Modifier.align(Alignment.BottomCenter).fillMaxWidth().height(4.dp),
                            color = MaterialTheme.colorScheme.primary)
                    }
                }
                Spacer(Modifier.height(18.dp))
                SectionHeader("Quality")
                ChipRow(listOf("720p", "1080p", "1440p", "4K"), quality) { quality = it }
                SectionHeader("Frame rate")
                ChipRow(listOf("24", "30", "60"), fps) { fps = it }
                SectionHeader("Aspect")
                ChipRow(listOf("9:16", "1:1", "16:9"), aspect) { aspect = it }
                SectionHeader("Camera motion")
                ChipRow(listOf("Ken Burns", "Orbit", "Push In", "Handheld", "Static"), motion) { motion = it }
                SectionHeader("Duration")
                LabeledSlider("Seconds", duration, onChange = { duration = it },
                    display = { "%.1fs".format(2 + it * 13) })
                Spacer(Modifier.height(20.dp))
                Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    if (rendering) {
                        OutlinedButton({ vm.cancel() }, Modifier.weight(1f).height(52.dp),
                            shape = MaterialTheme.shapes.small) { Text("CANCEL") }
                    } else {
                        PrimaryAction("Render clip", Icons.Rounded.Movie,
                            { vm.generate(isVideo = true) }, Modifier.weight(1f))
                    }
                    FilledTonalIconButton({}, Modifier.size(52.dp), shape = MaterialTheme.shapes.small) {
                        Icon(Icons.Rounded.Download, "Download")
                    }
                }
            }
        }
    }
}
