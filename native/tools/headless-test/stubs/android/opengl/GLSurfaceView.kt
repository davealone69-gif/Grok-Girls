package android.opengl

/** Minimal JVM stub of the GLSurfaceView surface used by the demo view. */
open class GLSurfaceView(context: android.content.Context) : android.view.View(context) {

    interface Renderer {
        fun onSurfaceCreated(gl: javax.microedition.khronos.opengles.GL10?,
                             config: javax.microedition.khronos.egl.EGLConfig?)
        fun onSurfaceChanged(gl: javax.microedition.khronos.opengles.GL10?,
                             width: Int, height: Int)
        fun onDrawFrame(gl: javax.microedition.khronos.opengles.GL10?)
    }

    fun setEGLContextClientVersion(version: Int) {}
    fun setEGLConfigChooser(red: Int, green: Int, blue: Int, alpha: Int,
                            depth: Int, stencil: Int) {}
    var preserveEGLContextOnPause: Boolean = false
    fun setRenderer(renderer: Renderer) {}
    var renderMode: Int = 0
    fun queueEvent(r: Runnable) { r.run() }
    fun onResume() {}
    fun onPause() {}

    companion object {
        const val RENDERMODE_CONTINUOUSLY = 1
    }
}
