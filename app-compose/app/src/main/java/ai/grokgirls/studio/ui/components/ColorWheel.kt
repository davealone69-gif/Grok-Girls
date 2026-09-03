package ai.grokgirls.studio.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp
import kotlin.math.*

/** HSV colour wheel + value slider, returns ARGB Long. */
@Composable
fun ColorWheel(
    value: Long,
    modifier: Modifier = Modifier,
    onChange: (Long) -> Unit,
) {
    val hsv = remember(value) {
        FloatArray(3).also { android.graphics.Color.colorToHSV(value.toInt(), it) }
    }
    var brightness by remember(value) { mutableFloatStateOf(hsv[2]) }

    Column(modifier) {
        Box(Modifier.fillMaxWidth().aspectRatio(1f).padding(horizontal = 24.dp)) {
            Canvas(
                Modifier.fillMaxSize().pointerInput(brightness) {
                    fun pick(o: Offset) {
                        val r = minOf(size.width, size.height) / 2f
                        val dx = o.x - r
                        val dy = o.y - r
                        val dist = hypot(dx, dy).coerceAtMost(r)
                        val hue = ((atan2(dy, dx) * 180 / PI).toFloat() + 360f) % 360f
                        val sat = (dist / r).coerceIn(0f, 1f)
                        val c = android.graphics.Color.HSVToColor(floatArrayOf(hue, sat, brightness))
                        onChange((c.toLong() and 0xFFFFFFFF) or 0xFF000000)
                    }
                    detectTapGestures { pick(it) }
                }.pointerInput(brightness) {
                    detectDragGestures { change, _ ->
                        val r = minOf(size.width, size.height) / 2f
                        val dx = change.position.x - r
                        val dy = change.position.y - r
                        val dist = hypot(dx, dy).coerceAtMost(r)
                        val hue = ((atan2(dy, dx) * 180 / PI).toFloat() + 360f) % 360f
                        val sat = (dist / r).coerceIn(0f, 1f)
                        val c = android.graphics.Color.HSVToColor(floatArrayOf(hue, sat, brightness))
                        onChange((c.toLong() and 0xFFFFFFFF) or 0xFF000000)
                    }
                }
            ) {
                val r = minOf(size.width, size.height) / 2f
                drawCircle(
                    Brush.sweepGradient(
                        (0..360 step 30).map {
                            Color(android.graphics.Color.HSVToColor(floatArrayOf(it.toFloat(), 1f, brightness)))
                        }
                    ),
                    radius = r,
                )
                drawCircle(
                    Brush.radialGradient(
                        listOf(Color(android.graphics.Color.HSVToColor(floatArrayOf(0f, 0f, brightness))), Color.Transparent),
                        radius = r,
                    ),
                    radius = r,
                )
                // selection marker
                val hue = hsv[0]; val sat = hsv[1]
                val rad = Math.toRadians(hue.toDouble())
                val cx = r + cos(rad).toFloat() * sat * r
                val cy = r + sin(rad).toFloat() * sat * r
                drawCircle(Color.White, 9f, Offset(cx, cy), style = androidx.compose.ui.graphics.drawscope.Stroke(3f))
            }
        }
        Spacer(Modifier.height(12.dp))
        LabeledSlider("Brightness", brightness) {
            brightness = it
            val c = android.graphics.Color.HSVToColor(floatArrayOf(hsv[0], hsv[1], it))
            onChange((c.toLong() and 0xFFFFFFFF) or 0xFF000000)
        }
        Text(
            "#%06X".format(value and 0xFFFFFF),
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.primary,
            modifier = Modifier.padding(horizontal = 18.dp),
        )
    }
}
