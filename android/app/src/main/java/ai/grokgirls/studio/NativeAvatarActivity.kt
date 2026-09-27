package ai.grokgirls.studio

import android.app.Activity
import android.os.Bundle
import android.view.MotionEvent
import android.view.Window
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.TextView
import com.aura.avatarstudio.renderer.GltfAvatarLoader
import com.aura.avatarstudio.renderer.HdAvatarRenderer

/** Fullscreen interactive native GLES3 HD avatar viewport. */
class NativeAvatarActivity : Activity() {

    private lateinit var renderer: HdAvatarRenderer
    private lateinit var glView: android.opengl.GLSurfaceView
    private var lastX = 0f
    private var lastY = 0f
    private var pinchBase = 0f

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestWindowFeature(Window.FEATURE_NO_TITLE)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        enterImmersive()

        renderer = HdAvatarRenderer(this)
        val asset = intent.getStringExtra(EXTRA_AVATAR) ?: DEFAULT_AVATAR
        val filePath = intent.getStringExtra(EXTRA_FILE)
        val definition = NativeAvatarDefinition.parse(intent.getStringExtra(EXTRA_DEFINITION))

        val root = FrameLayout(this)
        glView = android.opengl.GLSurfaceView(this).apply {
            setEGLContextClientVersion(3)
            setEGLConfigChooser(8, 8, 8, 8, 24, 8)
            preserveEGLContextOnPause = true
            setRenderer(renderer)
            renderMode = android.opengl.GLSurfaceView.RENDERMODE_CONTINUOUSLY
            setOnTouchListener { _, event ->
                when (event.actionMasked) {
                    MotionEvent.ACTION_DOWN -> {
                        lastX = event.x
                        lastY = event.y
                        pinchBase = 0f
                    }
                    MotionEvent.ACTION_POINTER_DOWN -> {
                        pinchBase = distance(event)
                        lastX = event.x
                        lastY = event.y
                    }
                    MotionEvent.ACTION_MOVE -> {
                        if (event.pointerCount >= 2) {
                            val d = distance(event)
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
                true
            }
        }
        root.addView(glView, FrameLayout.LayoutParams(-1, -1))

        val label = TextView(this).apply {
            text = if (filePath != null) "HUNYUAN3D GLB · GENERATED" else "HUNYUAN3D GLB · TEST ASSET"
            textSize = 11f
            setTextColor(0xffd9c7ff.toInt())
            setBackgroundColor(0xaa08080f.toInt())
            setPadding(16, 10, 16, 10)
        }
        root.addView(label, FrameLayout.LayoutParams(-2, -2))
        setContentView(root)

        glView.queueEvent {
            val loaded = if (!filePath.isNullOrBlank()) {
                GltfAvatarLoader(this@NativeAvatarActivity).loadFromFile(filePath)
            } else {
                GltfAvatarLoader(this@NativeAvatarActivity).loadFromAssets(asset)
            }
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
        enterImmersive()
        if (::glView.isInitialized) glView.onResume()
    }

    override fun onPause() {
        if (::glView.isInitialized) glView.onPause()
        super.onPause()
    }

    private fun enterImmersive() {
        if (android.os.Build.VERSION.SDK_INT >= 30) {
            window.setDecorFitsSystemWindows(false)
            window.insetsController?.let {
                it.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                it.hide(WindowInsets.Type.systemBars())
            }
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility =
                android.view.View.SYSTEM_UI_FLAG_FULLSCREEN or
                    android.view.View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                    android.view.View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
                    android.view.View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
                    android.view.View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
        }
    }

    private fun distance(event: MotionEvent): Float {
        val dx = event.getX(0) - event.getX(1)
        val dy = event.getY(0) - event.getY(1)
        return kotlin.math.sqrt(dx * dx + dy * dy)
    }

    companion object {
        const val EXTRA_AVATAR = "avatar"
        const val EXTRA_FILE = "file"
        const val EXTRA_DEFINITION = "definition"
        const val DEFAULT_AVATAR = "avatars/hunyuan-test.glb"
    }
}
