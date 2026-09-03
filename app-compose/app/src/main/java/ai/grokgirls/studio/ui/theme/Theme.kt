package ai.grokgirls.studio.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val DarkScheme = darkColorScheme(
    primary = Crimson60, onPrimary = Color.White,
    primaryContainer = Crimson40, onPrimaryContainer = Crimson80,
    secondary = Violet60, onSecondary = Color.White,
    secondaryContainer = Violet40, onSecondaryContainer = Violet80,
    tertiary = Cyan60, onTertiary = Ink00,
    tertiaryContainer = Cyan40, onTertiaryContainer = Cyan80,
    background = Ink00, onBackground = Bone,
    surface = Ink05, onSurface = Bone,
    surfaceVariant = Ink15, onSurfaceVariant = Muted,
    surfaceContainerLowest = Ink00,
    surfaceContainerLow = Ink05,
    surfaceContainer = Ink10,
    surfaceContainerHigh = Ink15,
    surfaceContainerHighest = Ink20,
    outline = Ink30, outlineVariant = Ink20,
    error = Danger, onError = Color.White,
    inversePrimary = Crimson40,
)

private val LightScheme = lightColorScheme(
    primary = Crimson40, onPrimary = Color.White,
    secondary = Violet40, onSecondary = Color.White,
    tertiary = Cyan40, onTertiary = Color.White,
    background = Color(0xFFFBF8FC), onBackground = Ink10,
    surface = Color.White, onSurface = Ink10,
    surfaceVariant = Color(0xFFEDE7F0), onSurfaceVariant = Color(0xFF544C5C),
    error = Color(0xFFB3261E),
)

@Composable
fun GrokGirlsTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val scheme = if (darkTheme) DarkScheme else LightScheme
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = Color.Transparent.toArgb()
            window.navigationBarColor = Color.Transparent.toArgb()
            WindowCompat.getInsetsController(window, view).apply {
                isAppearanceLightStatusBars = !darkTheme
                isAppearanceLightNavigationBars = !darkTheme
            }
        }
    }
    MaterialTheme(colorScheme = scheme, typography = AppTypography, shapes = AppShapes, content = content)
}
