package com.aura.avatarstudio

import android.app.Activity
import android.content.Intent
import android.media.MediaPlayer
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.widget.ImageView
import android.widget.VideoView
import java.util.concurrent.atomic.AtomicBoolean

/**
 * DD3 intro splash for the native Avatar Studio module.
 *
 * Extends plain [Activity] (not AppCompatActivity) on purpose: this module has
 * no external dependencies at all - the renderer is 100% android.* + org.json -
 * and AppCompatActivity would force an AppCompat theme and a new dependency.
 *
 * The splash NEVER depends on the video finishing. It hands off to MainActivity
 * (the GLES3 GLTF viewport) on the first of:
 *   1. video onCompletion
 *   2. soft timer   (reported duration + slack)
 *   3. hard timer   (13 s, armed before MediaPlayer is touched)
 *   4. user tap     (skip)
 *
 * Handoff is idempotent: an AtomicBoolean CAS plus a monitor means two triggers
 * firing together can only ever start MainActivity once.
 *
 * Poster rules:
 *   - poster is visible from the first layout pass (declared ON TOP of the video)
 *   - video starts underneath it
 *   - poster fades only after the first genuine rendered video frame
 *   - on codec failure the poster stays up and the normal timers carry on
 */
class DD3SplashActivity : Activity() {

    private val handler by lazy { Handler(Looper.getMainLooper()) }
    private val handedOff = AtomicBoolean(false)
    private val monitor = Any()
    private var pausedBeforeHandoff = false

    private val hardStop = Runnable { goToMain() }
    private val softStop = Runnable { goToMain() }
    private val posterHold = Runnable { goToMain() }

    private var video: VideoView? = null
    private var poster: ImageView? = null
    private var firstFrameRendered = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_dd3_splash)
        // Intro plays edge to edge — no navigation bar over the bottom of it.
        ImmersiveMode.enter(this)

        video = findViewById(R.id.splash_video)
        poster = findViewById(R.id.splash_poster)

        // (3) HARD TIMEOUT - armed before MediaPlayer/VideoView is touched at all.
        handler.postDelayed(hardStop, HARD_TIMEOUT_MS)

        // Poster is already visible here: the layout declares it above the video
        // with visibility="visible", so there is never a black frame.

        // (4) tap anywhere to skip
        findViewById<View>(R.id.splash_root)?.setOnClickListener { goToMain() }

        video?.setVideoURI(Uri.parse("android.resource://$packageName/${R.raw.dd3_intro}"))

        video?.setOnPreparedListener { mp ->
            mp.setVideoScalingMode(MediaPlayer.VIDEO_SCALING_MODE_SCALE_TO_FIT_WITH_CROPPING)
            mp.setVolume(0f, 0f)            // splashes play muted
            mp.isLooping = false

            // (2) soft timer; fall back to the known length if the container lies
            val duration = mp.duration
            handler.postDelayed(
                softStop,
                (if (duration > 0) duration.toLong() else EXPECTED_DURATION_MS) + SLACK_MS
            )

            mp.setOnInfoListener { _, what, _ ->
                if (what == MediaPlayer.MEDIA_INFO_VIDEO_RENDERING_START && !firstFrameRendered) {
                    firstFrameRendered = true
                    fadeOutPoster()     // only after a real frame is on screen
                }
                false
            }

            video?.start()              // video plays underneath the poster
        }

        // (1) normal path
        video?.setOnCompletionListener { goToMain() }

        // codec / IO failure: keep the poster up and proceed on the normal timer
        video?.setOnErrorListener { _, _, _ -> onPlaybackFailed(); true }
    }

    private fun fadeOutPoster() {
        handler.post {
            poster?.animate()
                ?.alpha(0f)
                ?.setDuration(POSTER_FADE_MS)
                ?.withEndAction { poster?.visibility = View.GONE }
                ?.start()
        }
    }

    private fun onPlaybackFailed() {
        // Poster stays exactly as it is - visible, un-faded. No black screen.
        poster?.animate()?.cancel()
        poster?.alpha = 1f
        poster?.visibility = View.VISIBLE
        video?.visibility = View.GONE
        handler.removeCallbacks(softStop)
        handler.postDelayed(posterHold, POSTER_HOLD_MS)
    }

    override fun onPause() {
        super.onPause()
        // Backgrounded mid-splash: cancel everything rather than firing
        // MainActivity from the background. onResume() finishes the handoff.
        if (!handedOff.get()) {
            handler.removeCallbacksAndMessages(null)
            video?.stopPlayback()
            pausedBeforeHandoff = true
        }
    }

    override fun onResume() {
        super.onResume()
        if (pausedBeforeHandoff && !handedOff.get()) goToMain()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        // Sticky immersive is dropped whenever another surface takes focus.
        if (hasFocus) ImmersiveMode.enter(this)
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)   // cancel every timer/callback
        video?.stopPlayback()
        video = null
        poster = null
        super.onDestroy()
    }

    /** Idempotent: exactly one handoff, no matter how many triggers fire. */
    private fun goToMain() {
        if (!handedOff.compareAndSet(false, true)) return
        synchronized(monitor) {
            handler.removeCallbacksAndMessages(null)
            video?.stopPlayback()
            // MainActivity hosts the GLES3 GLTF avatar viewport.
            startActivity(Intent(this, MainActivity::class.java))
            finish()
            overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
        }
    }

    companion object {
        private const val EXPECTED_DURATION_MS = 11_000L  // length of dd3_intro.mp4
        private const val SLACK_MS = 1_200L               // decode + scheduling slack
        private const val HARD_TIMEOUT_MS = 13_000L       // absolute ceiling
        private const val POSTER_HOLD_MS = 700L           // poster beat after a failure
        private const val POSTER_FADE_MS = 120L           // poster -> video crossfade
    }
}
