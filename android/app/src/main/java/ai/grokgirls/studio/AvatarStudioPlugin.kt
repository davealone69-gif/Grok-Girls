package ai.grokgirls.studio

import android.content.Intent
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Bridges the native 3D avatar viewport into the web app.
 *
 * JS usage:
 *   await Capacitor.Plugins.AvatarStudio.openViewport({ avatar: 'avatars/my_avatar.glb' })
 */
@CapacitorPlugin(name = "AvatarStudio")
class AvatarStudioPlugin : Plugin() {

    @PluginMethod
    fun openViewport(call: PluginCall) {
        val asset = call.getString("avatar") ?: NativeAvatarActivity.DEFAULT_AVATAR
        val intent = Intent(activity, NativeAvatarActivity::class.java)
            .putExtra(NativeAvatarActivity.EXTRA_AVATAR, asset)
        activity?.startActivity(intent)
        call.resolve()
    }
}
