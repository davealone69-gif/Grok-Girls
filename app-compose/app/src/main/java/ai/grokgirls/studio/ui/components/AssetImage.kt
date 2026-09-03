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

/** Loads a bitmap from the APK assets folder, cached per path. */
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
            ctx.assets.open(path).use { android.graphics.BitmapFactory.decodeStream(it) }.asImageBitmap()
        }.getOrNull()
    }
    Box(modifier) {
        bmp?.let {
            Image(it, null, Modifier.fillMaxSize(), contentScale = contentScale, alpha = alpha)
        }
    }
}
