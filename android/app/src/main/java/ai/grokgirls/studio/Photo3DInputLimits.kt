package ai.grokgirls.studio

/** Safety limits for the native photo-to-mesh pipeline. Kept pure for deterministic unit coverage. */
internal object Photo3DInputLimits {
    const val MAX_ENCODED_BYTES = 12 * 1024 * 1024
    const val MAX_DECODED_BYTES = 9 * 1024 * 1024
    const val MAX_BITMAP_DIMENSION = 4096
    const val MAX_BITMAP_PIXELS = 12_000_000L
    const val MAX_MULTIVIEW_FRAMES = 12
    const val MAX_MULTIVIEW_PIXELS = 24_000_000L

    fun encodedPayloadError(encodedLength: Int): String? = when {
        encodedLength < 0 -> "Image payload length is invalid."
        encodedLength > MAX_ENCODED_BYTES -> "Image payload is too large."
        decodedLengthUpperBound(encodedLength) > MAX_DECODED_BYTES -> "Image payload is too large."
        else -> null
    }

    fun decodedLengthUpperBound(encodedLength: Int): Long =
        ((encodedLength.toLong() + 3L) / 4L) * 3L

    fun bitmapError(width: Int, height: Int, aggregatePixels: Long = 0L): String? {
        val pixels = width.toLong() * height.toLong()
        return when {
            width <= 0 || height <= 0 -> "Image dimensions are invalid."
            width > MAX_BITMAP_DIMENSION || height > MAX_BITMAP_DIMENSION ->
                "Image dimensions exceed the supported limit."
            pixels > MAX_BITMAP_PIXELS -> "Image has too many pixels."
            aggregatePixels > MAX_MULTIVIEW_PIXELS ||
                pixels > MAX_MULTIVIEW_PIXELS - aggregatePixels ->
                "Multi-view images contain too many pixels."
            else -> null
        }
    }

    fun frameCountError(frameCount: Int): String? = when {
        frameCount < 3 -> "Multi-view 3D requires at least 3 real captured frames."
        frameCount > MAX_MULTIVIEW_FRAMES -> "Too many multi-view frames."
        else -> null
    }
}
