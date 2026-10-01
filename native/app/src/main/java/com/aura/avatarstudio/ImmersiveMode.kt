package com.aura.avatarstudio

import android.app.Activity
import android.os.Build
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController

/**
 * Hides the on-screen Android navigation buttons (back / home / recents).
 *
 * This module deliberately has zero external dependencies, so the AndroidX
 * WindowInsetsControllerCompat is not available. Two paths:
 *
 *   API 30+  -> window.setDecorFitsSystemWindows(false) + insetsController
 *   API < 30 -> the deprecated systemUiVisibility flags (still the only option)
 *
 * BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE / IMMERSIVE_STICKY means the bar is
 * never gone for good: a swipe up from the bottom edge shows it for a moment
 * and it hides itself again, so the device is never trapped.
 *
 * Sticky mode is dropped whenever another surface takes focus (dialog, keyboard,
 * share sheet), which is why callers also re-arm it from onWindowFocusChanged().
 */
object ImmersiveMode {

    @Suppress("DEPRECATION")
    fun enter(activity: Activity) {
        val window = activity.window ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false)
            window.insetsController?.apply {
                systemBarsBehavior =
                    WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                hide(WindowInsets.Type.navigationBars())
            }
        } else {
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                )
        }
    }
}
