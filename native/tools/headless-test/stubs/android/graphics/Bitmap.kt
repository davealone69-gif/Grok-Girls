package android.graphics

/** Minimal JVM stubs — texture upload is not exercised headless. */
class Bitmap(
    val width: Int,
    val height: Int,
    var config: Config = Config.ARGB_8888
) {
    enum class Config { ALPHA_8, RGB_565, ARGB_8888, RGBA_F16, HARDWARE }

    val byteCount: Int get() = width * height * 4

    fun copy(config: Config, isMutable: Boolean): Bitmap = Bitmap(width, height, config)

    fun recycle() {}

    fun copyPixelsToBuffer(dst: java.nio.Buffer): java.nio.Buffer = dst

    companion object {
        fun createBitmap(width: Int, height: Int, config: Config): Bitmap =
            Bitmap(width, height, config)
    }
}
