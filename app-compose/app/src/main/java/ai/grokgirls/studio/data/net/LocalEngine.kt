package ai.grokgirls.studio.data.net

import ai.grokgirls.studio.data.model.Persona
import ai.grokgirls.studio.data.model.RenderSettings
import ai.grokgirls.studio.data.model.ServerConfig
import android.graphics.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import kotlin.math.sin
import kotlin.random.Random

/**
 * Zero-config procedural renderer. Draws a stylised portrait card on Canvas that
 * genuinely reflects the persona's choices (hair colour, accent, scene, posture),
 * so Local mode always produces a real, distinct image with no server required.
 */
class LocalEngine(private val personaProvider: () -> Persona) : ImageEngine {
    override val name = "Local"

    override suspend fun render(
        prompt: String, settings: RenderSettings, server: ServerConfig, onProgress: ProgressSink,
    ): RenderResult = withContext(Dispatchers.Default) {
        val p = personaProvider()
        val seed = if (settings.seed >= 0) settings.seed else Random.nextLong(0, 1_000_000)
        val rnd = Random(seed)
        val size = settings.resolution.coerceIn(512, 2048)

        val bmp = Bitmap.createBitmap(size, (size * 1.4f).toInt(), Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        val w = bmp.width.toFloat()
        val h = bmp.height.toFloat()
        val accent = p.scene.accent.toInt()
        val hair = p.hair.colorArgb.toInt()
        val skin = ai.grokgirls.studio.data.model.Catalog.skinTones[
            p.appearance.skinToneIndex.coerceIn(0, 7)
        ].toInt()

        // backdrop
        c.drawColor(Color.rgb(7, 7, 11))
        onProgress(0.15f); delay(60)

        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            shader = RadialGradient(
                w * 0.5f, h * 0.34f, h * 0.62f,
                intArrayOf(withAlpha(accent, 110), withAlpha(accent, 30), Color.TRANSPARENT),
                floatArrayOf(0f, 0.55f, 1f), Shader.TileMode.CLAMP,
            )
        }.also { c.drawRect(0f, 0f, w, h, it) }
        onProgress(0.3f); delay(60)

        // soft light bands for depth
        val band = Paint(Paint.ANTI_ALIAS_FLAG)
        repeat(7) { i ->
            val y = h * (0.12f + i * 0.11f) + sin((i + seed % 7).toDouble()).toFloat() * 18f
            band.shader = LinearGradient(
                0f, y, w, y + 40f,
                withAlpha(accent, 26), Color.TRANSPARENT, Shader.TileMode.CLAMP,
            )
            c.drawRect(0f, y, w, y + 40f, band)
        }
        onProgress(0.45f); delay(60)

        // figure: shoulders, neck, head, hair mass
        val cx = w * 0.5f
        val headR = w * 0.185f
        val headCy = h * 0.36f
        val fill = Paint(Paint.ANTI_ALIAS_FLAG)

        fill.color = darken(skin, 0.55f)
        c.drawRoundRect(
            RectF(cx - w * 0.30f, headCy + headR * 0.75f, cx + w * 0.30f, h * 0.98f),
            w * 0.16f, w * 0.16f, fill,
        )
        fill.color = darken(skin, 0.85f)
        c.drawRect(cx - headR * 0.36f, headCy, cx + headR * 0.36f, headCy + headR * 1.25f, fill)

        // hair back mass
        fill.color = hair
        c.drawOval(
            RectF(cx - headR * 1.42f, headCy - headR * 1.30f,
                  cx + headR * 1.42f, headCy + headR * (0.6f + p.hair.length * 2.6f)),
            fill,
        )

        // face
        fill.color = skin
        c.drawOval(RectF(cx - headR, headCy - headR * 1.18f, cx + headR, headCy + headR * 1.18f), fill)

        // hair front / fringe
        fill.color = lighten(hair, 1f + p.hair.gloss * 0.35f)
        c.drawArc(
            RectF(cx - headR * 1.12f, headCy - headR * 1.42f, cx + headR * 1.12f, headCy + headR * 0.5f),
            180f, 180f, true, fill,
        )
        onProgress(0.65f); delay(60)

        // eyes, brows, lips
        val eyeY = headCy - headR * 0.06f
        val eyeDx = headR * 0.40f
        listOf(-1, 1).forEach { s ->
            fill.color = Color.WHITE
            c.drawOval(RectF(cx + s * eyeDx - headR * 0.19f, eyeY - headR * 0.11f,
                             cx + s * eyeDx + headR * 0.19f, eyeY + headR * 0.11f), fill)
            fill.color = p.face.eyeColorArgb.toInt()
            c.drawCircle(cx + s * eyeDx, eyeY, headR * 0.093f, fill)
            fill.color = Color.BLACK
            c.drawCircle(cx + s * eyeDx, eyeY, headR * 0.042f, fill)

            fill.color = darken(hair, 0.75f)
            c.drawRoundRect(
                RectF(cx + s * eyeDx - headR * 0.22f, eyeY - headR * (0.30f + p.face.browThickness * 0.09f),
                      cx + s * eyeDx + headR * 0.22f, eyeY - headR * 0.24f),
                6f, 6f, fill,
            )
        }
        fill.color = p.face.lipColorArgb.toInt()
        c.drawOval(RectF(cx - headR * 0.24f, headCy + headR * 0.52f,
                         cx + headR * 0.24f, headCy + headR * 0.74f), fill)

        // rim light
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = w * 0.012f
            color = withAlpha(accent, 190)
        }.also {
            c.drawArc(RectF(cx - headR * 1.42f, headCy - headR * 1.30f,
                            cx + headR * 1.42f, headCy + headR * 1.6f), 200f, 130f, false, it)
        }
        onProgress(0.85f); delay(60)

        // grain
        val grain = Paint()
        repeat(size * 3) {
            grain.color = withAlpha(Color.WHITE, rnd.nextInt(3, 12))
            c.drawPoint(rnd.nextFloat() * w, rnd.nextFloat() * h, grain)
        }

        // vignette + caption
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            shader = RadialGradient(
                w / 2f, h / 2f, h * 0.72f,
                intArrayOf(Color.TRANSPARENT, Color.argb(215, 4, 4, 8)),
                floatArrayOf(0.55f, 1f), Shader.TileMode.CLAMP,
            )
        }.also { c.drawRect(0f, 0f, w, h, it) }

        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE
            textSize = w * 0.045f
            typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
        }.also { c.drawText(p.name.uppercase(), w * 0.07f, h * 0.94f, it) }

        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = withAlpha(accent, 235)
            textSize = w * 0.026f
            letterSpacing = 0.18f
        }.also { c.drawText(p.scene.label.uppercase(), w * 0.07f, h * 0.965f, it) }

        val out = ByteArrayOutputStream()
        bmp.compress(Bitmap.CompressFormat.PNG, 100, out)
        bmp.recycle()
        onProgress(1f)
        RenderResult(out.toByteArray(), seed)
    }

    override suspend fun test(server: ServerConfig) = "Local procedural engine ready — no server needed"

    private fun withAlpha(color: Int, a: Int) =
        Color.argb(a, Color.red(color), Color.green(color), Color.blue(color))

    private fun darken(color: Int, f: Float) = Color.rgb(
        (Color.red(color) * f).toInt().coerceIn(0, 255),
        (Color.green(color) * f).toInt().coerceIn(0, 255),
        (Color.blue(color) * f).toInt().coerceIn(0, 255),
    )

    private fun lighten(color: Int, f: Float) = darken(color, f)
}
