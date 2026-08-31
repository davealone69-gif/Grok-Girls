package ai.grokgirls.studio

import android.app.Activity
import android.opengl.GLSurfaceView
import android.os.Bundle
import android.view.MotionEvent
import android.view.Window
import android.view.WindowManager
import com.aura.avatarstudio.renderer.GltfAvatarLoader
import com.aura.avatarstudio.renderer.HdAvatarRenderer

/**
 * Native 3D avatar viewport — the Kotlin/GLES3 counterpart of the in-app
 * WebGL viewport (src/renderer/HdAvatarRenderer.ts mirrors the same engine).
 *
 * Loads a rigged GLB from assets (default "avatars/my_avatar.glb", override
 * via the [EXTRA_AVATAR] intent extra), rendered with the full PBR pipeline:
 * skinning, morph targets, animation, runtime IBL + ACES tone mapping.
 *
 * Drag to orbit, pinch to zoom. Launch from JS via AvatarStudioPlugin:
 *   Capacitor.Plugins.AvatarStudio.openViewport({ avatar: 'avatars/foo.glb' })
 */
class NativeAvatarActivity : Activity() {

    private lateinit var renderer: HdAvatarRenderer
    private var glView: GLSurfaceView? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestWindowFeature(Window.FEATURE_NO_TITLE)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        renderer = HdAvatarRenderer(this)
        val asset = intent.getStringExtra(EXTRA_AVATAR) ?: DEFAULT_AVATAR

        val glView = GLSurfaceView(this).apply {
            setEGLContextClientVersion(3)
            setEGLConfigChooser(8, 8, 8, 8, 24, 8)
            preserveEGLContextOnPause = true
            setRenderer(renderer)
            renderMode = GLSurfaceView.RENDERMODE_CONTINUOUSLY
        }
        this.glView = glView
        setContentView(glView)

        glView.queueEvent {
            renderer.setAvatar(
                GltfAvatarLoader(this@NativeAvatarActivity)
                    .loadFromAssets(asset)
            )
        }
    }

    override fun onResume() {
        super.onResume()
        glView?.onResume()
    }

    override fun onPause() {
        glView?.onPause()
        super.onPause()
    }

    // ---- touch controls --------------------------------------------------
    private var lastX = 0f
    private var lastY = 0f
    private var pinchBase = 1f

    override fun onTouchEvent(event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                lastX = event.x
                lastY = event.y
            }

            MotionEvent.ACTION_POINTER_DOWN -> {
                pinchBase = touchDistance(event)
                lastX = event.x
                lastY = event.y
            }

            MotionEvent.ACTION_MOVE -> {
                if (event.pointerCount >= 2) {
                    val d = touchDistance(event)
                    if (pinchBase > 0f && d > 0f) {
                        renderer.zoomCamera(d / pinchBase)
                    }
                    pinchBase = d
                } else {
                    renderer.rotateCamera(
                        event.x - lastX,
                        event.y - lastY
                    )
                }
                lastX = event.x
                lastY = event.y
            }

            MotionEvent.ACTION_POINTER_UP -> {
                pinchBase = 0f
            }
        }
        return true
    }

    private fun touchDistance(event: MotionEvent): Float {
        val dx = event.getX(0) - event.getX(1)
        val dy = event.getY(0) - event.getY(1)
        return kotlin.math.sqrt(dx * dx + dy * dy)
    }

    companion object {
        const val EXTRA_AVATAR = "avatar"
        const val DEFAULT_AVATAR = "avatars/my_avatar.glb"
    }
}
