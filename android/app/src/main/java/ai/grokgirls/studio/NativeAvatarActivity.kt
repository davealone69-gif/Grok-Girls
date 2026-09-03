package ai.grokgirls.studio

import android.app.Activity
import android.opengl.GLSurfaceView
import android.os.Bundle
import android.view.MotionEvent
import android.view.Window
import android.view.WindowManager
import com.aura.avatarstudio.renderer.GltfAvatarLoader
import com.aura.avatarstudio.renderer.HdAvatarRenderer

/** Fullscreen interactive native GLES3 HD avatar viewport. */
class NativeAvatarActivity : Activity() {

    private lateinit var renderer: HdAvatarRenderer
    private var glView: GLSurfaceView? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestWindowFeature(Window.FEATURE_NO_TITLE)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        renderer = HdAvatarRenderer(this)
        val asset = intent.getStringExtra(EXTRA_AVATAR) ?: DEFAULT_AVATAR
        val definition = NativeAvatarDefinition.parse(intent.getStringExtra(EXTRA_DEFINITION))

        val view = GLSurfaceView(this).apply {
            setEGLContextClientVersion(3)
            setEGLConfigChooser(8, 8, 8, 8, 24, 8)
            preserveEGLContextOnPause = true
            setRenderer(renderer)
            renderMode = GLSurfaceView.RENDERMODE_CONTINUOUSLY
        }
        glView = view
        setContentView(view)

        view.queueEvent {
            val loaded = GltfAvatarLoader(this@NativeAvatarActivity).loadFromAssets(asset)
            renderer.setAvatar(loaded)
            applyDefinition(definition)
        }
    }

    private fun applyDefinition(definition: NativeAvatarDefinition) {
        renderer.exposure = when {
            definition.skin.contains("02", true) || definition.skin.contains("03", true) -> 1.12f
            definition.skin.contains("04", true) || definition.skin.contains("05", true) -> 1.08f
            else -> 1.15f
        }
        renderer.iblIntensity = if (definition.augmentations != "None") 1.0f else 0.9f
        renderer.cameraTarget = when (definition.age.lowercase()) {
            "young adult" -> floatArrayOf(0f, 0.81f, 0f)
            "mature" -> floatArrayOf(0f, 0.86f, 0f)
            else -> floatArrayOf(0f, 0.85f, 0f)
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
                    if (pinchBase > 0f && d > 0f) renderer.zoomCamera(d / pinchBase)
                    pinchBase = d
                } else {
                    renderer.rotateCamera(event.x - lastX, event.y - lastY)
                }
                lastX = event.x
                lastY = event.y
            }
            MotionEvent.ACTION_POINTER_UP -> pinchBase = 0f
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
        const val EXTRA_DEFINITION = "definition"
        const val DEFAULT_AVATAR = "avatars/my_avatar.glb"
    }
}
