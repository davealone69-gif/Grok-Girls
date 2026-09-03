package ai.grokgirls.studio.ui.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import java.io.File

/**
 * Loads an image either from the APK assets folder (relative path such as
 * "presets/preset_ruby.jpg") or from internal storage (absolute path produced
 * by a render). Decoded off the composition thread and cached by path.
 */
@Composable
fun AssetImage(
    path: String,
    modifier: Modifier = Modifier,
    contentScale: ContentScale = ContentScale.Crop,
    alpha: Float = 1f,
) {
    val ctx = LocalContext.current
    val bmp by produceState<ImageBitmap?>(null, path) {
        value = runCatching {
            if (path.startsWith("/")) {
                val f = File(path)
                if (!f.exists()) null
                else android.graphics.BitmapFactory.decodeFile(path)?.asImageBitmap()
            } else {
                ctx.assets.open(path).use {
                    android.graphics.BitmapFactory.decodeStream(it)
                }?.asImageBitmap()
            }
        }.getOrNull()
    }
    Box(modifier) {
        bmp?.let {
            Image(it, null, Modifier.fillMaxSize(), contentScale = contentScale, alpha = alpha)
        }
    }
}
