package ai.grokgirls.studio.ui.screens.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import ai.grokgirls.studio.data.model.RenderEngine
import ai.grokgirls.studio.data.repo.StudioViewModel
import ai.grokgirls.studio.ui.components.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(vm: StudioViewModel) {
    val settings by vm.repo.settings.collectAsState()
    val adult by vm.repo.adultMode.collectAsState()
    var serverUrl by remember { mutableStateOf("http://192.168.1.10:7860") }
    var apiKey by remember { mutableStateOf("") }
    var model by remember { mutableStateOf("") }
    var testResult by remember { mutableStateOf<String?>(null) }
    val loras = remember { mutableStateListOf("", "", "") }

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
                    vm.repo.setSettings(settings.copy(
                        engine = RenderEngine.entries.first { it.label == l }))
                }

                Spacer(Modifier.height(14.dp))
                SectionHeader("Self-hosted server")
                GlassPanel(Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        OutlinedTextField(serverUrl, { serverUrl = it }, Modifier.fillMaxWidth(),
                            label = { Text("Server URL") }, singleLine = true,
                            shape = MaterialTheme.shapes.small,
                            supportingText = { Text("A1111 :7860 (--api --listen) or ComfyUI :8188") })
                        OutlinedTextField(model, { model = it }, Modifier.fillMaxWidth(),
                            label = { Text("Checkpoint") }, singleLine = true,
                            shape = MaterialTheme.shapes.small)
                        loras.forEachIndexed { i, v ->
                            OutlinedTextField(v, { loras[i] = it }, Modifier.fillMaxWidth(),
                                label = { Text("LORA slot ${i + 1}") }, singleLine = true,
                                shape = MaterialTheme.shapes.small)
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedButton({ testResult = "Connected · A1111 · 12 models · 4 LORAs" },
                                Modifier.weight(1f), shape = MaterialTheme.shapes.small) {
                                Icon(Icons.Rounded.Cable, null, Modifier.size(16.dp))
                                Spacer(Modifier.width(7.dp)); Text("TEST")
                            }
                            OutlinedButton({}, Modifier.weight(1f), shape = MaterialTheme.shapes.small) {
                                Icon(Icons.Rounded.Refresh, null, Modifier.size(16.dp))
                                Spacer(Modifier.width(7.dp)); Text("FETCH")
                            }
                        }
                        testResult?.let {
                            Text(it, style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.tertiary)
                        }
                    }
                }

                Spacer(Modifier.height(14.dp))
                SectionHeader("Cloud API key")
                OutlinedTextField(apiKey, { apiKey = it },
                    Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                    label = { Text("${settings.engine.label} key") }, singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    shape = MaterialTheme.shapes.small)

                Spacer(Modifier.height(14.dp))
                SectionHeader("Content")
                ToggleRow("Mature content (18+)",
                    "All personas are fictional adults. Keep interactions respectful.", adult) {
                    vm.repo.setAdult(it)
                }

                Spacer(Modifier.height(14.dp))
                SectionHeader("Data")
                listOf(
                    Triple(Icons.Rounded.Upload, "Import personas", "Restore from a JSON archive"),
                    Triple(Icons.Rounded.Download, "Export everything", "Personas, gallery and chat logs"),
                    Triple(Icons.Rounded.DeleteForever, "Reset local data", "Cannot be undone"),
                ).forEach { (ic, t, sub) ->
                    ListItem(
                        headlineContent = { Text(t) },
                        supportingContent = { Text(sub) },
                        leadingContent = { Icon(ic, null) },
                        colors = ListItemDefaults.colors(containerColor = Color.Transparent),
                        modifier = Modifier.padding(horizontal = 4.dp),
                    )
                }
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
