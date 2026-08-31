package android.util

/** JVM stub backed by java.util.Base64. */
object Base64 {
    const val DEFAULT = 0
    fun decode(input: String, flags: Int): ByteArray =
        java.util.Base64.getDecoder().decode(input)
}
