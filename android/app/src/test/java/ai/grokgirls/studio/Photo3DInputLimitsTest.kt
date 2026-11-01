package ai.grokgirls.studio

import org.junit.Assert.assertNull
import org.junit.Assert.assertNotNull
import org.junit.Test

class Photo3DInputLimitsTest {
    @Test
    fun encodedPayloadBoundaryIsAcceptedAndNextByteIsRejected() {
        assertNull(Photo3DInputLimits.encodedPayloadError(Photo3DInputLimits.MAX_DECODED_BYTES / 3 * 4))
        assertNotNull(Photo3DInputLimits.encodedPayloadError(Photo3DInputLimits.MAX_DECODED_BYTES / 3 * 4 + 4))
    }

    @Test
    fun dimensionsAndAggregatePixelsAreBounded() {
        assertNull(Photo3DInputLimits.bitmapError(4000, 3000))
        assertNotNull(Photo3DInputLimits.bitmapError(4097, 1))
        assertNotNull(Photo3DInputLimits.bitmapError(4000, 3000, 12_000_001L))
    }

    @Test
    fun multiviewFrameCountHasMinimumAndMaximum() {
        assertNotNull(Photo3DInputLimits.frameCountError(2))
        assertNull(Photo3DInputLimits.frameCountError(3))
        assertNull(Photo3DInputLimits.frameCountError(Photo3DInputLimits.MAX_MULTIVIEW_FRAMES))
        assertNotNull(Photo3DInputLimits.frameCountError(Photo3DInputLimits.MAX_MULTIVIEW_FRAMES + 1))
    }
}
