package ai.grokgirls.studio

import android.content.Intent
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/** Bridges the native HD avatar viewport into the Grok-Girls editor. */
@CapacitorPlugin(name = "AvatarStudio")
class AvatarStudioPlugin : Plugin() {

    @PluginMethod
    fun openViewport(call: PluginCall) {
        val asset = call.getString("avatar") ?: NativeAvatarActivity.DEFAULT_AVATAR
        val definition = call.getString("definition")
        val intent = Intent(activity, NativeAvatarActivity::class.java)
            .putExtra(NativeAvatarActivity.EXTRA_AVATAR, asset)
            .putExtra(NativeAvatarActivity.EXTRA_DEFINITION, definition)
        activity?.startActivity(intent)
        call.resolve()
    }
}
