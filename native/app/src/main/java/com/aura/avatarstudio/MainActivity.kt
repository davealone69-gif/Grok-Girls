package com.aura.avatarstudio

import android.app.Activity
import android.os.Bundle
import android.view.Window
import android.view.WindowManager

class MainActivity : Activity() {

    private lateinit var view: GltfAvatarView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestWindowFeature(Window.FEATURE_NO_TITLE)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        // Full-bleed avatar viewport: no back/home/recents bar eating the bottom.
        ImmersiveMode.enter(this)

        view = GltfAvatarView(this, "avatars/my_avatar.glb")
        setContentView(view)
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        // Sticky immersive is cleared when another surface takes focus; re-arm.
        if (hasFocus) ImmersiveMode.enter(this)
    }

    override fun onResume() {
        super.onResume()
        view.onResume()
    }

    override fun onPause() {
        view.onPause()
        super.onPause()
    }
}
