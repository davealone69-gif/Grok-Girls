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
import ai.grokgirls.studio.renderer.GltfAvatarLoader
import ai.grokgirls.studio.renderer.HdAvatarRenderer
import com.getcapacitor.ActivityCallback
import com.getcapacitor.ActivityResult
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.PluginMethod
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileInputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder

/** Native Android bridge for the real GLES3 HD avatar renderer. */
@CapacitorPlugin(name = "AvatarStudio")
class AvatarStudioPlugin : Plugin() {

    @PluginMethod
    fun pickGlb(call: PluginCall) {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "*/*"
            putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("model/gltf-binary", "application/octet-stream"))
        }
        startActivityForResult(call, intent, "handleGlbPick")
    }

    @ActivityCallback
    private fun handleGlbPick(call: PluginCall, result: ActivityResult) {
        if (result.resultCode != Activity.RESULT_OK) {
            call.reject("GLB selection was cancelled")
            return
        }
        val uri = result.data?.data
        if (uri == null) {
            call.reject("No file was selected")
            return
        }
        try {
            val directory = File(context.filesDir, "avatars")
            check(directory.exists() || directory.mkdirs()) { "Cannot create avatar storage" }
            val destination = File(directory, "grok-face-import.glb")
            context.contentResolver.openInputStream(uri).use { input ->
                requireNotNull(input) { "Cannot open selected GLB" }
                destination.outputStream().use { output -> input.copyTo(output) }
            }
            require(destination.length() in 20L..(200L * 1024L * 1024L)) { "GLB must be between 20 bytes and 200 MB" }
            val header = ByteArray(12)
            FileInputStream(destination).use { input ->
                require(input.read(header) == header.size) { "GLB header is incomplete" }
            }
            val glbHeader = ByteBuffer.wrap(header).order(ByteOrder.LITTLE_ENDIAN)
            require(glbHeader.int == 0x46546C67 && glbHeader.int == 2) { "Selected file is not a GLB 2.0 model" }
            require(glbHeader.int.toLong() <= destination.length()) { "GLB declares a length beyond the file" }
            val out = JSObject()
            out.put("file", destination.canonicalPath)
            out.put("bytes", destination.length())
            call.resolve(out)
        } catch (t: Throwable) {
            call.reject("GLB import failed: ${t.message ?: t.javaClass.simpleName}")
        }
    }

    @PluginMethod
    fun openViewport(call: PluginCall) {
        val host = activity
        if (host == null) {
            call.reject("AvatarStudio activity is unavailable")
            return
        }
        val asset = call.getString("avatar") ?: NativeAvatarActivity.DEFAULT_AVATAR
        val definition = call.getString("definition")
        val filePath = call.getString("file")?.let { validateImportedGlbPath(it) }
        val intent = Intent(host, NativeAvatarActivity::class.java)
            .putExtra(NativeAvatarActivity.EXTRA_AVATAR, asset)
            .putExtra(NativeAvatarActivity.EXTRA_FILE, filePath)
            .putExtra(NativeAvatarActivity.EXTRA_DEFINITION, definition)
        host.startActivity(intent)
        call.resolve()
    }

    private fun validateImportedGlbPath(path: String): String {
        val file = File(path).canonicalFile
        val root = File(context.filesDir, "avatars").canonicalFile
        require(file.path.startsWith(root.path + File.separator) && file.isFile) {
            "GLB path is not an imported app-owned avatar"
        }
        require(file.length() in 20L..(200L * 1024L * 1024L)) { "Imported GLB size is invalid" }
        return file.path
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
        val filePath = call.getString("file")?.let { validateImportedGlbPath(it) }
        val definition = NativeAvatarDefinition.parse(call.getString("definition"))

        Thread {
            try {
                val result = renderOffscreen(host, asset, filePath, definition, width, height)
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
        filePath: String?,
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
                val loader = GltfAvatarLoader(context)
                renderer.setAvatar(if (filePath.isNullOrBlank()) loader.loadFromAssets(asset) else loader.loadFromFile(filePath))
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
        renderer.setExpression(definition.expression)
    }
}
