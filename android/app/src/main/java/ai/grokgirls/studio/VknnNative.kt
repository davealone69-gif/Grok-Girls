package ai.grokgirls.studio

/**
 * JNI surface for the VKNN YoNoSplat Vulkan pipeline.
 * The native library is loaded lazily so the app can report a real load error
 * instead of crashing if a device/build lacks the optional backend.
 */
object VknnNative {
    @Volatile private var loadError: String? = null
    @Volatile private var loaded = false

    fun ensureLoaded(): Boolean {
        if (loaded) return true
        synchronized(this) {
            if (loaded) return true
            return try {
                System.loadLibrary("grok_vknn")
                loaded = true
                true
            } catch (t: Throwable) {
                loadError = t.message ?: t.javaClass.simpleName
                false
            }
        }
    }

    fun error(): String? = loadError

    external fun nativeSplatLoad(
        vxmPath: String,
        cacheFile: String,
        precision: String,
        backend: String,
        renderSize: Int
    ): Long

    external fun nativeSplatInfo(ptr: Long): IntArray
    external fun nativeSplatEncode(ptr: Long, images: FloatArray, intrinsics: FloatArray): Int
    external fun nativeSplatPoses(ptr: Long): FloatArray
    external fun nativeSplatPivotDepth(ptr: Long): Float
    external fun nativeSplatRender(ptr: Long, cameraToWorld: FloatArray): IntArray?
    external fun nativeSplatFree(ptr: Long)
}
