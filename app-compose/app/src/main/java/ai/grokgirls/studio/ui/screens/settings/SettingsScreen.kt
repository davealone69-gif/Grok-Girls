package ai.grokgirls.studio.ui.screens.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import ai.grokgirls.studio.data.model.*
import ai.grokgirls.studio.data.repo.StudioViewModel
import ai.grokgirls.studio.ui.components.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(vm: StudioViewModel) {
    val settings by vm.repo.settings.collectAsState()
    val server by vm.repo.server.collectAsState()
    val adult by vm.repo.adultMode.collectAsState()
    val testing by vm.testing.collectAsState()
    val testResult by vm.testResult.collectAsState()
    val models by vm.models.collectAsState()

    Scaffold(
        containerColor = Color.Transparent,
        topBar = {
            TopAppBar(title = { Text("Settings", style = MaterialTheme.typography.headlineSmall) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.Transparent))
        },
    ) { pad ->
        LazyColumn(Modifier.padding(pad), contentPadding = PaddingValues(bottom = 96.dp)) {
            item {
                SectionHeader("Render engine")
                ChipRow(RenderEngine.entries.map { it.label }, settings.engine.label) { l ->
                    vm.setSettings(settings.copy(
                        engine = RenderEngine.entries.first { it.label == l }))
                }

                val needsServer = settings.engine in listOf(
                    RenderEngine.SELF_HOSTED, RenderEngine.CUSTOM)
                val needsKey = settings.engine in listOf(
                    RenderEngine.OPENROUTER, RenderEngine.GEMINI)

                if (needsServer) {
                    Spacer(Modifier.height(14.dp))
                    SectionHeader("Self-hosted server")
                    GlassPanel(Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
                        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            OutlinedTextField(
                                server.url, { vm.setServer(server.copy(url = it)) },
                                Modifier.fillMaxWidth(),
                                label = { Text("Server URL") }, singleLine = true,
                                shape = MaterialTheme.shapes.small,
                                supportingText = {
                                    Text("A1111 :7860 (launch with --api --listen) or ComfyUI :8188")
                                },
                            )

                            Text("Server type", style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                ServerKind.entries.forEach { k ->
                                    FilterChip(
                                        server.kind == k,
                                        { vm.setServer(server.copy(kind = k)) },
                                        { Text(k.label, style = MaterialTheme.typography.labelSmall) },
                                        shape = MaterialTheme.shapes.small,
                                    )
                                }
                            }

                            OutlinedTextField(
                                server.checkpoint, { vm.setServer(server.copy(checkpoint = it)) },
                                Modifier.fillMaxWidth(),
                                label = { Text("Checkpoint") }, singleLine = true,
                                shape = MaterialTheme.shapes.small,
                            )

                            if (models.isNotEmpty()) {
                                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    items(models.size) { i ->
                                        FilterChip(
                                            models[i] == server.checkpoint,
                                            { vm.setServer(server.copy(checkpoint = models[i])) },
                                            { Text(models[i], style = MaterialTheme.typography.labelSmall) },
                                            shape = MaterialTheme.shapes.small,
                                        )
                                    }
                                }
                            }

                            OutlinedTextField(
                                server.sampler, { vm.setServer(server.copy(sampler = it)) },
                                Modifier.fillMaxWidth(),
                                label = { Text("Sampler") }, singleLine = true,
                                shape = MaterialTheme.shapes.small,
                            )

                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Column(Modifier.weight(1f)) {
                                    Text("Hires fix", style = MaterialTheme.typography.titleMedium)
                                    Text("Upscale with ${server.upscaler}",
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                                Switch(server.hiresFix, { vm.setServer(server.copy(hiresFix = it)) })
                            }

                            server.loras.forEachIndexed { i, slot ->
                                Column {
                                    OutlinedTextField(
                                        slot.name,
                                        { v ->
                                            vm.setServer(server.copy(
                                                loras = server.loras.toMutableList().also { l ->
                                                    l[i] = slot.copy(name = v)
                                                }))
                                        },
                                        Modifier.fillMaxWidth(),
                                        label = { Text("LORA slot ${i + 1}") }, singleLine = true,
                                        shape = MaterialTheme.shapes.small,
                                    )
                                    if (slot.name.isNotBlank()) {
                                        LabeledSlider("Weight", slot.weight, 0f..1.5f,
                                            display = { "%.2f".format(it) }) { v ->
                                            vm.setServer(server.copy(
                                                loras = server.loras.toMutableList().also { l ->
                                                    l[i] = slot.copy(weight = v)
                                                }))
                                        }
                                    }
                                }
                            }

                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                OutlinedButton({ vm.testConnection() }, Modifier.weight(1f),
                                    enabled = !testing, shape = MaterialTheme.shapes.small) {
                                    if (testing) {
                                        CircularProgressIndicator(Modifier.size(15.dp), strokeWidth = 2.dp)
                                    } else {
                                        Icon(Icons.Rounded.Cable, null, Modifier.size(16.dp))
                                    }
                                    Spacer(Modifier.width(7.dp)); Text("TEST")
                                }
                                OutlinedButton({ vm.fetchModels() }, Modifier.weight(1f),
                                    enabled = !testing, shape = MaterialTheme.shapes.small) {
                                    Icon(Icons.Rounded.Refresh, null, Modifier.size(16.dp))
                                    Spacer(Modifier.width(7.dp)); Text("FETCH")
                                }
                            }

                            testResult?.let {
                                Text(it, style = MaterialTheme.typography.bodyMedium,
                                    color = if (it.startsWith("✕")) MaterialTheme.colorScheme.error
                                            else MaterialTheme.colorScheme.tertiary)
                            }
                        }
                    }
                }

                if (needsKey) {
                    Spacer(Modifier.height(14.dp))
                    SectionHeader("Cloud API key")
                    Column(Modifier.padding(horizontal = 16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            server.apiKey, { vm.setServer(server.copy(apiKey = it)) },
                            Modifier.fillMaxWidth(),
                            label = { Text("${settings.engine.label} API key") }, singleLine = true,
                            visualTransformation = PasswordVisualTransformation(),
                            shape = MaterialTheme.shapes.small,
                            supportingText = { Text("Stored on this device only.") },
                        )
                        if (settings.engine == RenderEngine.OPENROUTER) {
                            OutlinedTextField(
                                server.checkpoint, { vm.setServer(server.copy(checkpoint = it)) },
                                Modifier.fillMaxWidth(),
                                label = { Text("Model slug") }, singleLine = true,
                                shape = MaterialTheme.shapes.small,
                                placeholder = { Text("google/gemini-2.5-flash-image-preview") },
                            )
                        }
                        OutlinedButton({ vm.testConnection() }, enabled = !testing,
                            shape = MaterialTheme.shapes.small) {
                            Icon(Icons.Rounded.Cable, null, Modifier.size(16.dp))
                            Spacer(Modifier.width(7.dp)); Text("TEST KEY")
                        }
                        testResult?.let {
                            Text(it, style = MaterialTheme.typography.bodyMedium,
                                color = if (it.startsWith("✕")) MaterialTheme.colorScheme.error
                                        else MaterialTheme.colorScheme.tertiary)
                        }
                    }
                }

                if (settings.engine == RenderEngine.LOCAL) {
                    Spacer(Modifier.height(14.dp))
                    GlassPanel(Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
                        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Rounded.OfflineBolt, null,
                                tint = MaterialTheme.colorScheme.tertiary)
                            Spacer(Modifier.width(12.dp))
                            Text("Local mode renders on-device with the procedural engine — " +
                                "no server or API key required.",
                                style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }

                Spacer(Modifier.height(14.dp))
                SectionHeader("Content")
                ToggleRow("Mature content (18+)",
                    "All personas are fictional adults. Keep interactions respectful.", adult) {
                    vm.setAdult(it)
                }

                Spacer(Modifier.height(14.dp))
                SectionHeader("Data")
                ListItem(
                    headlineContent = { Text("Export everything") },
                    supportingContent = { Text("Personas, gallery index, chat logs") },
                    leadingContent = { Icon(Icons.Rounded.Download, null) },
                    colors = ListItemDefaults.colors(containerColor = Color.Transparent),
                )
                ListItem(
                    headlineContent = { Text("Reset local data") },
                    supportingContent = { Text("Cannot be undone") },
                    leadingContent = {
                        Icon(Icons.Rounded.DeleteForever, null,
                            tint = MaterialTheme.colorScheme.error)
                    },
                    colors = ListItemDefaults.colors(containerColor = Color.Transparent),
                    modifier = Modifier.clickable { vm.resetAll() },
                )
            }
        }
    }
}

@Composable
private fun ToggleRow(title: String, sub: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    GlassPanel(Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(title, style = MaterialTheme.typography.titleMedium)
                Text(sub, style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Switch(checked, onChange)
        }
    }
}
