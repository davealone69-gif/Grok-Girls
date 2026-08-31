package android.graphics

/** JVM stub: returns null (texture decode not exercised headless). */
object BitmapFactory {
    fun decodeByteArray(data: ByteArray, offset: Int, length: Int): Bitmap? = null
    fun decodeStream(stream: java.io.InputStream): Bitmap? = null
    fun decodeResource(res: android.content.res.Resources, id: Int): Bitmap? = null
}
