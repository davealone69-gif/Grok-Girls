package android.opengl

/**
 * Real AOSP column-major matrix math (the only android.opengl surface
 * the skinning code depends on), so skin tests are meaningful headless.
 */
object Matrix {
    fun multiplyMM(m: FloatArray, mOffset: Int, a: FloatArray, aOffset: Int,
                   b: FloatArray, bOffset: Int) {
        for (i in 0 until 4) {          // row
            for (j in 0 until 4) {      // col
                var s = 0f
                for (k in 0 until 4) {
                    s += a[aOffset + k * 4 + i] * b[bOffset + j * 4 + k]
                }
                m[mOffset + j * 4 + i] = s
            }
        }
    }
}
