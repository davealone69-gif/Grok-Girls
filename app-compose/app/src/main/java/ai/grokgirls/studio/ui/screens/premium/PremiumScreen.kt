package ai.grokgirls.studio.ui.screens.premium

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import ai.grokgirls.studio.ui.components.PrimaryAction
import ai.grokgirls.studio.ui.theme.*

@Composable
fun PremiumScreen() {
    val perks = listOf(
        Icons.Rounded.HighQuality to "4K renders with no watermark",
        Icons.Rounded.Bolt to "Priority queue on every cloud engine",
        Icons.Rounded.Movie to "Unlimited video clips up to 15 seconds",
        Icons.Rounded.Palette to "Exclusive scene styles and LORA packs",
        Icons.Rounded.Cloud to "Cloud sync across all your devices",
        Icons.Rounded.SupportAgent to "Direct support",
    )
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState())
            .padding(24.dp, 40.dp, 24.dp, 96.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(Modifier.size(96.dp).clip(CircleShape)
            .background(Brush.linearGradient(listOf(Gold, Crimson60, Violet60))),
            contentAlignment = Alignment.Center) {
            Icon(Icons.Rounded.WorkspacePremium, null, Modifier.size(46.dp), tint = Color.White)
        }
        Spacer(Modifier.height(22.dp))
        Text("Studio Premium", style = MaterialTheme.typography.displayMedium, textAlign = TextAlign.Center)
        Spacer(Modifier.height(8.dp))
        Text("Everything unlocked. One subscription.",
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center)
        Spacer(Modifier.height(30.dp))
        perks.forEach { (ic, t) ->
            Row(Modifier.fillMaxWidth().padding(vertical = 9.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(34.dp).clip(CircleShape)
                    .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.16f)),
                    contentAlignment = Alignment.Center) {
                    Icon(ic, null, Modifier.size(17.dp), tint = MaterialTheme.colorScheme.primary)
                }
                Spacer(Modifier.width(14.dp))
                Text(t, style = MaterialTheme.typography.bodyLarge)
            }
        }
        Spacer(Modifier.height(32.dp))
        Text("A$12.99 / month", style = MaterialTheme.typography.headlineMedium, color = Gold)
        Text("Cancel anytime", style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(20.dp))
        PrimaryAction("Upgrade now", Icons.Rounded.WorkspacePremium, {}, Modifier.fillMaxWidth())
    }
}
