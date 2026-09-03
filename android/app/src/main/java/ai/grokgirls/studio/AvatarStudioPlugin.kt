package ai.grokgirls.studio

import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.opengl.EGL14
import android.opengl.EGLDisplay
import android.opengl.EGLSurface
import android.opengl.GLES30
import android.os.Handler
import android.os.Looper
import android.util.Base64
import com.aura.avatarstudio.renderer.GltfAvatarLoader
import com.aura.avatarstudio.renderer.HdAvatarRenderer
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.PluginMethod
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder

/** Native Android bridge for the real GLES3 HD avatar renderer. */
@CapacitorPlugin(name = "AvatarStudio")
class AvatarStudioPlugin : Plugin() {

    @PluginMethod
    fun openViewport(call: PluginCall) {
        val asset = call.getString("avatar") ?: NativeAvatarActivity.DEFAULT_AVATAR
        val definition = call.getString("definition")
        val intent = Intent(activity, NativeAvatarActivity::class.java)
            .putExtra(NativeAvatarActivity.EXTRA_AVATAR, asset)
            .putExtra(NativeAvatarActivity.EXTRA_DEFINITION, definition)
        activity?.startActivity(intent)
        call.resolve()
    }

    /** Render directly into an offscreen GLES3 pbuffer at the requested size. */
    @PluginMethod
    fun renderImage(call: PluginCall) {
        val host = activity
        if (host == null) {
            call.reject("AvatarStudio activity is unavailable")
            return
        }
        val width = (call.getInt("width") ?: 1920).coerceIn(256, 3840)
        val height = (call.getInt("height") ?: 1080).coerceIn(256, 2160)
        val asset = call.getString("avatar") ?: NativeAvatarActivity.DEFAULT_AVATAR
        val definition = NativeAvatarDefinition.parse(call.getString("definition"))

        Thread {
            try {
                val result = renderOffscreen(host, asset, definition, width, height)
                val out = JSObject()
                out.put("dataUrl", result.dataUrl)
                out.put("width", result.width)
                out.put("height", result.height)
                Handler(Looper.getMainLooper()).post { call.resolve(out) }
            } catch (t: Throwable) {
                Handler(Looper.getMainLooper()).post {
                    call.reject("Native HD render failed: ${t.message ?: t.javaClass.simpleName}")
                }
            }
        }.start()
    }

    private data class RenderResult(val dataUrl: String, val width: Int, val height: Int)

    private fun renderOffscreen(
        context: Activity,
        asset: String,
        definition: NativeAvatarDefinition,
        width: Int,
        height: Int
    ): RenderResult {
        val display: EGLDisplay = EGL14.eglGetDisplay(EGL14.EGL_DEFAULT_DISPLAY)
        check(display != EGL14.EGL_NO_DISPLAY) { "No EGL display" }
        val version = IntArray(2)
        check(EGL14.eglInitialize(display, version, 0, version, 1)) { "EGL initialization failed" }

        try {
            val configs = arrayOfNulls<android.opengl.EGLConfig>(1)
            val count = IntArray(1)
            val configAttrs = intArrayOf(
                EGL14.EGL_RENDERABLE_TYPE, 0x40,
                EGL14.EGL_SURFACE_TYPE, EGL14.EGL_PBUFFER_BIT,
                EGL14.EGL_RED_SIZE, 8,
                EGL14.EGL_GREEN_SIZE, 8,
                EGL14.EGL_BLUE_SIZE, 8,
                EGL14.EGL_ALPHA_SIZE, 8,
                EGL14.EGL_DEPTH_SIZE, 24,
                EGL14.EGL_NONE
            )
            check(EGL14.eglChooseConfig(display, configAttrs, 0, configs, 0, 1, count, 0) && count[0] > 0) {
                "No GLES3 pbuffer configuration"
            }
            val config = configs[0]!!
            val contextAttrs = intArrayOf(EGL14.EGL_CONTEXT_CLIENT_VERSION, 3, EGL14.EGL_NONE)
            val eglContext = EGL14.eglCreateContext(display, config, EGL14.EGL_NO_CONTEXT, contextAttrs, 0)
            check(eglContext != EGL14.EGL_NO_CONTEXT) { "Could not create GLES3 context" }

            val surfaceAttrs = intArrayOf(EGL14.EGL_WIDTH, width, EGL14.EGL_HEIGHT, height, EGL14.EGL_NONE)
            val surface: EGLSurface = EGL14.eglCreatePbufferSurface(display, config, surfaceAttrs, 0)
            check(surface != EGL14.EGL_NO_SURFACE) { "Could not create render surface" }

            try {
                check(EGL14.eglMakeCurrent(display, surface, surface, eglContext)) { "Could not bind EGL context" }
                val renderer = HdAvatarRenderer(context)
                // HdAvatarRenderer exposes the legacy GLSurfaceView callback type.
                // The callback's config is not consumed by the renderer, so pass null
                // while EGL14 owns the actual android.opengl.EGLConfig.
                renderer.onSurfaceCreated(null, null)
                renderer.setAvatar(GltfAvatarLoader(context).loadFromAssets(asset))
                applyDefinition(renderer, definition)
                renderer.onSurfaceChanged(null, width, height)
                renderer.onDrawFrame(null)
                renderer.onDrawFrame(null)
                GLES30.glFinish()

                val pixels = ByteBuffer.allocateDirect(width * height * 4).order(ByteOrder.nativeOrder())
                GLES30.glReadPixels(0, 0, width, height, GLES30.GL_RGBA, GLES30.GL_UNSIGNED_BYTE, pixels)
                check(GLES30.glGetError() == GLES30.GL_NO_ERROR) { "glReadPixels failed" }

                val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
                val row = IntArray(width)
                val rgba = ByteArray(width * 4)
                for (y in 0 until height) {
                    pixels.position((height - 1 - y) * width * 4)
                    pixels.get(rgba)
                    for (x in 0 until width) {
                        val i = x * 4
                        val r = rgba[i].toInt() and 0xff
                        val g = rgba[i + 1].toInt() and 0xff
                        val b = rgba[i + 2].toInt() and 0xff
                        val a = rgba[i + 3].toInt() and 0xff
                        row[x] = (a shl 24) or (r shl 16) or (g shl 8) or b
                    }
                    bitmap.setPixels(row, 0, width, 0, y, width, 1)
                }

                val compressed = ByteArrayOutputStream()
                check(bitmap.compress(Bitmap.CompressFormat.JPEG, 94, compressed)) { "JPEG encode failed" }
                bitmap.recycle()
                renderer.clearAvatar()
                val dataUrl = "data:image/jpeg;base64," + Base64.encodeToString(compressed.toByteArray(), Base64.NO_WRAP)
                return RenderResult(dataUrl, width, height)
            } finally {
                EGL14.eglMakeCurrent(display, EGL14.EGL_NO_SURFACE, EGL14.EGL_NO_SURFACE, EGL14.EGL_NO_CONTEXT)
                EGL14.eglDestroySurface(display, surface)
                EGL14.eglDestroyContext(display, eglContext)
            }
        } finally {
            EGL14.eglTerminate(display)
        }
    }

    /** Apply canonical render policy only where the current GLB supports it. */
    private fun applyDefinition(renderer: HdAvatarRenderer, definition: NativeAvatarDefinition) {
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
}
