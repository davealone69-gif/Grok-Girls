package ai.grokgirls.studio.ui.components

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.*
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import ai.grokgirls.studio.ui.theme.*

/** Frosted, subtly-gradient surface used for every panel in the app. */
@Composable
fun GlassPanel(
    modifier: Modifier = Modifier,
    shape: androidx.compose.ui.graphics.Shape = MaterialTheme.shapes.medium,
    accent: Color? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier
            .clip(shape)
            .background(
                Brush.verticalGradient(
                    listOf(
                        MaterialTheme.colorScheme.surfaceContainerHigh.copy(alpha = 0.92f),
                        MaterialTheme.colorScheme.surfaceContainer.copy(alpha = 0.78f),
                    )
                )
            )
            .border(
                1.dp,
                Brush.verticalGradient(
                    listOf(
                        (accent ?: MaterialTheme.colorScheme.primary).copy(alpha = 0.28f),
                        Color.Transparent,
                    )
                ),
                shape,
            ),
        content = content,
    )
}

@Composable
fun SectionHeader(title: String, action: (@Composable () -> Unit)? = null) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier.size(3.dp, 16.dp).clip(CircleShape)
                .background(Brush.verticalGradient(listOf(Crimson60, Violet60)))
        )
        Spacer(Modifier.width(10.dp))
        Text(
            title.uppercase(),
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.weight(1f))
        action?.invoke()
    }
}

@Composable
fun ChipRow(
    options: List<String>,
    selected: String,
    modifier: Modifier = Modifier,
    onSelect: (String) -> Unit,
) {
    LazyRow(
        modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        contentPadding = PaddingValues(horizontal = 18.dp),
    ) {
        items(options.size) { i ->
            val o = options[i]
            FilterChip(
                selected = o == selected,
                onClick = { onSelect(o) },
                label = { Text(o, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                shape = MaterialTheme.shapes.small,
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.22f),
                    selectedLabelColor = MaterialTheme.colorScheme.onSurface,
                ),
                border = FilterChipDefaults.filterChipBorder(
                    enabled = true,
                    selected = o == selected,
                    borderColor = MaterialTheme.colorScheme.outlineVariant,
                    selectedBorderColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.6f),
                ),
            )
        }
    }
}

@Composable
fun LabeledSlider(
    label: String,
    value: Float,
    range: ClosedFloatingPointRange<Float> = 0f..1f,
    display: (Float) -> String = { "${(it * 100).toInt()}%" },
    onChange: (Float) -> Unit,
) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 6.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(label, style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.weight(1f))
            Text(display(value), style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.primary)
        }
        Slider(
            value = value, onValueChange = onChange, valueRange = range,
            colors = SliderDefaults.colors(
                thumbColor = MaterialTheme.colorScheme.primary,
                activeTrackColor = MaterialTheme.colorScheme.primary,
                inactiveTrackColor = MaterialTheme.colorScheme.surfaceContainerHighest,
            ),
        )
    }
}

@Composable
fun SwatchRow(
    colors: List<Long>,
    selectedIndex: Int,
    onSelect: (Int) -> Unit,
) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 18.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        colors.forEachIndexed { i, c ->
            val sel = i == selectedIndex
            val ring by animateDpAsState(if (sel) 2.5.dp else 0.dp, label = "ring")
            Box(
                Modifier.weight(1f).aspectRatio(1f).clip(CircleShape)
                    .background(Color(c))
                    .border(ring, MaterialTheme.colorScheme.primary, CircleShape)
                    .clickable { onSelect(i) }
            )
        }
    }
}

@Composable
fun PrimaryAction(
    text: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    Box(
        modifier
            .height(52.dp)
            .clip(MaterialTheme.shapes.small)
            .background(
                if (enabled) Brush.horizontalGradient(listOf(Crimson60, Violet60))
                else Brush.horizontalGradient(listOf(Ink20, Ink20))
            )
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Row(
            Modifier.padding(horizontal = 22.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(icon, null, Modifier.size(19.dp), tint = Color.White)
            Spacer(Modifier.width(9.dp))
            Text(text.uppercase(), style = MaterialTheme.typography.labelLarge, color = Color.White)
        }
    }
}

@Composable
fun StatPill(label: String, value: String, accent: Color = Crimson60) {
    Column(
        Modifier.clip(MaterialTheme.shapes.small)
            .background(MaterialTheme.colorScheme.surfaceContainerHigh)
            .border(1.dp, accent.copy(alpha = 0.25f), MaterialTheme.shapes.small)
            .padding(horizontal = 16.dp, vertical = 12.dp)
    ) {
        Text(value, style = MaterialTheme.typography.headlineSmall, color = accent)
        Text(label.uppercase(), style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
fun EmptyState(icon: androidx.compose.ui.graphics.vector.ImageVector, title: String, body: String) {
    Column(
        Modifier.fillMaxSize().padding(40.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            Modifier.size(84.dp).clip(CircleShape)
                .background(Brush.linearGradient(listOf(Crimson40.copy(alpha=.35f), Violet40.copy(alpha=.35f)))),
            contentAlignment = Alignment.Center,
        ) { Icon(icon, null, Modifier.size(38.dp), tint = MaterialTheme.colorScheme.primary) }
        Spacer(Modifier.height(18.dp))
        Text(title, style = MaterialTheme.typography.headlineSmall)
        Spacer(Modifier.height(6.dp))
        Text(body, style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = androidx.compose.ui.text.style.TextAlign.Center)
    }
}

/** Animated aurora backdrop used behind the whole app. */
@Composable
fun AuroraBackground(accent: Color, modifier: Modifier = Modifier) {
    val t = rememberInfiniteTransition(label = "aurora")
    val shift by t.animateFloat(
        0f, 1f,
        infiniteRepeatable(tween(14000, easing = LinearEasing), RepeatMode.Reverse),
        label = "shift",
    )
    Canvas(modifier.fillMaxSize()) {
        drawRect(Ink00)
        drawCircle(
            Brush.radialGradient(
                listOf(accent.copy(alpha = 0.20f), Color.Transparent),
                center = androidx.compose.ui.geometry.Offset(size.width * (0.25f + shift * 0.2f), size.height * 0.22f),
                radius = size.minDimension * 0.85f,
            ),
            radius = size.minDimension * 0.85f,
            center = androidx.compose.ui.geometry.Offset(size.width * (0.25f + shift * 0.2f), size.height * 0.22f),
        )
        drawCircle(
            Brush.radialGradient(
                listOf(Violet60.copy(alpha = 0.15f), Color.Transparent),
                center = androidx.compose.ui.geometry.Offset(size.width * (0.85f - shift * 0.25f), size.height * 0.78f),
                radius = size.minDimension * 0.8f,
            ),
            radius = size.minDimension * 0.8f,
            center = androidx.compose.ui.geometry.Offset(size.width * (0.85f - shift * 0.25f), size.height * 0.78f),
        )
    }
}
