package ai.grokgirls.studio.ui.screens.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.Send
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
import ai.grokgirls.studio.data.repo.StudioViewModel
import ai.grokgirls.studio.ui.components.*

private val quickReplies = listOf("Tell me about tonight", "How are you feeling?", "What do you want?", "Change the subject")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(vm: StudioViewModel) {
    val personas by vm.repo.personas.collectAsState()
    val activeId by vm.repo.activeId.collectAsState()
    val p = personas.first { it.id == activeId }
    val all by vm.repo.messages.collectAsState()
    val msgs = all.filter { it.personaId == p.id }
    var draft by remember { mutableStateOf("") }
    val listState = rememberLazyListState()

    LaunchedEffect(msgs.size) { if (msgs.isNotEmpty()) listState.animateScrollToItem(msgs.lastIndex) }

    Scaffold(
        containerColor = Color.Transparent,
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        p.previewAsset?.let {
                            AssetImage(it, Modifier.size(38.dp).clip(RoundedCornerShape(12.dp)), ContentScale.Crop)
                        }
                        Spacer(Modifier.width(11.dp))
                        Column {
                            Text(p.name, style = MaterialTheme.typography.titleMedium)
                            Text("online · ${p.scene.label}", style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.tertiary)
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.Transparent),
            )
        },
    ) { pad ->
        Column(Modifier.padding(pad).fillMaxSize()) {
            if (msgs.isEmpty()) {
                Box(Modifier.weight(1f)) {
                    EmptyState(Icons.Rounded.ChatBubbleOutline, "Say something",
                        "Start a conversation with ${p.name}. Her replies adapt to the scene you've set.")
                }
            } else {
                LazyColumn(
                    Modifier.weight(1f), listState,
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(msgs, key = { it.id }) { m ->
                        Row(
                            Modifier.fillMaxWidth(),
                            horizontalArrangement = if (m.fromUser) Arrangement.End else Arrangement.Start,
                        ) {
                            Box(
                                Modifier.widthIn(max = 300.dp)
                                    .clip(RoundedCornerShape(
                                        18.dp, 18.dp,
                                        if (m.fromUser) 4.dp else 18.dp,
                                        if (m.fromUser) 18.dp else 4.dp))
                                    .background(
                                        if (m.fromUser)
                                            Brush.horizontalGradient(listOf(
                                                MaterialTheme.colorScheme.primary,
                                                MaterialTheme.colorScheme.secondary))
                                        else Brush.horizontalGradient(listOf(
                                            MaterialTheme.colorScheme.surfaceContainerHigh,
                                            MaterialTheme.colorScheme.surfaceContainerHigh))
                                    )
                                    .padding(horizontal = 15.dp, vertical = 10.dp)
                            ) {
                                Text(m.text, style = MaterialTheme.typography.bodyLarge,
                                    color = if (m.fromUser) Color.White else MaterialTheme.colorScheme.onSurface)
                            }
                        }
                    }
                }
            }

            LazyRow(
                Modifier.fillMaxWidth().padding(vertical = 6.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                contentPadding = PaddingValues(horizontal = 16.dp),
            ) {
                items(quickReplies.size) { i ->
                    SuggestionChip({ vm.send(quickReplies[i]) }, { Text(quickReplies[i]) },
                        shape = MaterialTheme.shapes.small)
                }
            }

            Row(
                Modifier.fillMaxWidth().padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                OutlinedTextField(
                    draft, { draft = it }, Modifier.weight(1f),
                    placeholder = { Text("Message ${p.name}") },
                    shape = MaterialTheme.shapes.large, maxLines = 4,
                )
                Spacer(Modifier.width(8.dp))
                FilledIconButton(
                    { if (draft.isNotBlank()) { vm.send(draft.trim()); draft = "" } },
                    Modifier.size(52.dp),
                    colors = IconButtonDefaults.filledIconButtonColors(
                        containerColor = MaterialTheme.colorScheme.primary),
                ) { Icon(Icons.AutoMirrored.Rounded.Send, "Send") }
            }
        }
    }
}
