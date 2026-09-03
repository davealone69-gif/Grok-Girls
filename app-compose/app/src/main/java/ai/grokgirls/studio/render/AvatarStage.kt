package ai.grokgirls.studio.render

import android.view.Choreographer
import android.view.SurfaceView
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import com.google.android.filament.Skybox
import com.google.android.filament.utils.KTX1Loader
import com.google.android.filament.utils.ModelViewer
import com.google.android.filament.utils.Utils
import java.nio.ByteBuffer

/**
 * Filament-backed 3D avatar stage. Loads a glTF/GLB from assets and renders it
 * with an IBL environment. Falls back silently to an empty stage if the asset
 * is missing, so the UI is always usable.
 */
@Composable
fun AvatarStage(
    modelAsset: String,
    modifier: Modifier = Modifier,
    autoRotate: Boolean = true,
    onReady: (Boolean) -> Unit = {},
) {
    val choreographer = remember { Choreographer.getInstance() }
    var viewer by remember { mutableStateOf<ModelViewer?>(null) }

    AndroidView(
        modifier = modifier,
        factory = { ctx ->
            Utils.init()
            val surfaceView = SurfaceView(ctx)
            val mv = ModelViewer(surfaceView)
            surfaceView.setOnTouchListener { _, e -> mv.onTouchEvent(e); true }
            viewer = mv

            mv.scene.skybox = Skybox.Builder()
                .color(0.03f, 0.03f, 0.05f, 1.0f)
                .build(mv.engine)

            var loaded = false
            runCatching {
                ctx.assets.open(modelAsset).use { input ->
                    val bytes = input.readBytes()
                    mv.loadModelGlb(ByteBuffer.wrap(bytes))
                    mv.transformToUnitCube()
                    loaded = true
                }
            }
            runCatching {
                ctx.assets.open("envs/studio_ibl.ktx").use { i ->
                    val b = ByteBuffer.wrap(i.readBytes())
                    mv.scene.indirectLight = KTX1Loader.createIndirectLight(mv.engine, b).apply {
                        intensity = 32_000f
                    }
                }
            }
            onReady(loaded)

            val cb = object : Choreographer.FrameCallback {
                private var last = 0L
                override fun doFrame(frameTimeNanos: Long) {
                    choreographer.postFrameCallback(this)
                    if (autoRotate && last != 0L) {
                        val root = mv.asset?.root
                        if (root != null) {
                            val tm = mv.engine.transformManager
                            val inst = tm.getInstance(root)
                            val delta = (frameTimeNanos - last) / 1_000_000_000.0f
                            rotationY += delta * 0.35f
                            val c = kotlin.math.cos(rotationY)
                            val s = kotlin.math.sin(rotationY)
                            tm.setTransform(inst, floatArrayOf(
                                c, 0f, -s, 0f,
                                0f, 1f, 0f, 0f,
                                s, 0f, c, 0f,
                                0f, 0f, 0f, 1f,
                            ))
                        }
                    }
                    last = frameTimeNanos
                    mv.render(frameTimeNanos)
                }
            }
            choreographer.postFrameCallback(cb)
            surfaceView
        },
    )

    DisposableEffect(Unit) {
        onDispose { viewer?.destroyModel() }
    }
}

private var rotationY = 0f
