package ai.grokgirls.studio.renderer

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.opengl.GLES30
import android.opengl.GLUtils

/**
 * Loads standalone textures from assets into GL textures.
 *
 * This is the utility for texture assets that live outside the GLB
 * (environment backplates, skin albedo overrides, HDR-ish lighting maps).
 * Textures embedded in the GLB itself are handled by [GltfTextures].
 *
 * [loadAsset] uploads with mipmaps; when [srgb] is true the texture is
 * allocated as GL_SRGB8_ALPHA8 so the GPU decodes it to linear light at
 * sample time (correct PBR input for base-color/emissive maps).
 */
class PbrTexture(
    private val context: Context
) {

    fun loadAsset(
        assetPath: String,
        srgb: Boolean = false
    ): Int {

        val bitmap = decodeSampledAsset(assetPath)
            ?: error("Unable to decode texture: $assetPath")

        return upload(
            bitmap,
            srgb
        ).also {
            bitmap.recycle()
        }
    }

    /**
     * Decode at a phone-friendly size before allocating a full-resolution Bitmap.
     * This caps decoded textures at 1024 px per side and avoids transient OOMs.
     */
    private fun decodeSampledAsset(assetPath: String): Bitmap? {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        context.assets.open(assetPath).use {
            BitmapFactory.decodeStream(it, null, bounds)
        }
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null

        var sample = 1
        while (bounds.outWidth / sample > MAX_TEXTURE_DIMENSION ||
            bounds.outHeight / sample > MAX_TEXTURE_DIMENSION) {
            sample *= 2
        }
        val options = BitmapFactory.Options().apply {
            inSampleSize = sample
            inPreferredConfig = Bitmap.Config.ARGB_8888
        }
        return context.assets.open(assetPath).use {
            BitmapFactory.decodeStream(it, null, options)
        }
    }

    private fun upload(
        bitmap: Bitmap,
        srgb: Boolean
    ): Int {

        val id = IntArray(1)

        GLES30.glGenTextures(
            1,
            id,
            0
        )

        GLES30.glBindTexture(
            GLES30.GL_TEXTURE_2D,
            id[0]
        )

        GLES30.glTexParameteri(
            GLES30.GL_TEXTURE_2D,
            GLES30.GL_TEXTURE_MIN_FILTER,
            GLES30.GL_LINEAR_MIPMAP_LINEAR
        )

        GLES30.glTexParameteri(
            GLES30.GL_TEXTURE_2D,
            GLES30.GL_TEXTURE_MAG_FILTER,
            GLES30.GL_LINEAR
        )

        GLES30.glTexParameteri(
            GLES30.GL_TEXTURE_2D,
            GLES30.GL_TEXTURE_WRAP_S,
            GLES30.GL_REPEAT
        )

        GLES30.glTexParameteri(
            GLES30.GL_TEXTURE_2D,
            GLES30.GL_TEXTURE_WRAP_T,
            GLES30.GL_REPEAT
        )

        val internalFormat =
            if (srgb) {
                GLES30.GL_SRGB8_ALPHA8
            } else {
                GLES30.GL_RGBA8
            }

        GLUtils.texImage2D(
            GLES30.GL_TEXTURE_2D,
            0,
            internalFormat,
            bitmap,
            0
        )

        GLES30.glGenerateMipmap(
            GLES30.GL_TEXTURE_2D
        )

        GLES30.glBindTexture(
            GLES30.GL_TEXTURE_2D,
            0
        )

        return id[0]
    }

    fun destroy(
        texture: Int
    ) {
        if (texture != 0) {
            GLES30.glDeleteTextures(
                1,
                intArrayOf(texture),
                0
            )
        }
    }

    companion object {
        private const val MAX_TEXTURE_DIMENSION = 1024
    }
}
