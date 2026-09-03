package ai.grokgirls.studio

import android.app.Activity
import android.opengl.GLSurfaceView
import android.os.Bundle
import android.view.MotionEvent
import android.view.Window
import android.view.WindowManager
import com.aura.avatarstudio.renderer.GltfAvatarLoader
import com.aura.avatarstudio.renderer.HdAvatarRenderer

/** Native GLES3 HD avatar viewport used by the Capacitor Grok-Girls app. */
class NativeAvatarActivity : Activity() {

    private lateinit var renderer: HdAvatarRenderer
    private var glView: GLSurfaceView? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestWindowFeature(Window.FEATURE_NO_TITLE)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        renderer = HdAvatarRenderer(this)
        val requestedAsset = intent.getStringExtra(EXTRA_AVATAR)
        val definitionJson = intent.getStringExtra(EXTRA_DEFINITION)
        val definition = NativeAvatarDefinition.parse(definitionJson)
        val asset = resolveAvatarAsset(requestedAsset, definition)

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
            runCatching {
                GltfAvatarLoader(this@NativeAvatarActivity).loadFromAssets(asset)
            }.onSuccess(renderer::setAvatar)
        }
    }

    /** Prefer a requested/definition-specific GLB when it is actually bundled. */
    private fun resolveAvatarAsset(requested: String?, definition: NativeAvatarDefinition): String {
        val explicit = requested?.takeIf { it.isNotBlank() }
        if (explicit != null && assetExists(explicit)) return explicit

        val key = buildString {
            append(slug(definition.body)); append('_')
            append(slug(definition.head)); append('_')
            append(slug(definition.hair)); append('_')
            append(slug(definition.outfit))
        }
        val generated = "avatars/$key.glb"
        return if (assetExists(generated)) generated else DEFAULT_AVATAR
    }

    private fun assetExists(path: String): Boolean = runCatching {
        assets.open(path).close()
        true
    }.getOrDefault(false)

    private fun slug(value: String): String = value
        .trim()
        .lowercase()
        .replace(Regex("[^a-z0-9]+"), "_")
        .trim('_')

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
    private var pinchBase = 0f

    override fun onTouchEvent(event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                lastX = event.x
                lastY = event.y
            }
            MotionEvent.ACTION_POINTER_DOWN -> {
                pinchBase = touchDistance(event)
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
