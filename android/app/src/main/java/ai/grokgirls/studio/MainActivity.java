package ai.grokgirls.studio;

import android.os.Bundle;
import android.view.View;

import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  private void enterImmersiveMode() {
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

    // Modern AndroidX path.
    WindowInsetsControllerCompat controller =
        new WindowInsetsControllerCompat(getWindow(), getWindow().getDecorView());
    controller.setSystemBarsBehavior(
        WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    controller.hide(WindowInsetsCompat.Type.navigationBars());

    // Legacy fallback for Samsung/Android builds that still honour the
    // system-UI visibility flags. This makes the request explicitly
    // immersive-sticky rather than merely hiding the navigation inset.
    getWindow().getDecorView().setSystemUiVisibility(
        View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
  }

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    enterImmersiveMode();
    // Hide Android navigation controls while the studio is in use.
    // The bars can be revealed temporarily with an edge swipe, then Android
    // automatically returns to immersive mode.
    // Re-apply whenever Android gives focus back to the activity or restores
    // system UI after a transient gesture.
    getWindow().getDecorView().setOnSystemUiVisibilityChangeListener(visibility ->
        enterImmersiveMode());

    // Native 3D avatar viewport (Kotlin/GLES3 engine, see NativeAvatarActivity).
    // JS: await Capacitor.Plugins.AvatarStudio.openViewport({...})
    registerPlugin(AvatarStudioPlugin.class);
    // Phone-local Ollama bridge (native HTTP: no CORS, no mixed-content
    // block, can start the server). JS: Capacitor.Plugins.OllamaLocal
    registerPlugin(OllamaLocalPlugin.class);
    // Phone-local Stable Diffusion bridge (image half of the local stack,
    // sd-server on :1234 — separate port and lifecycle from Ollama's
    // :11434). JS: Capacitor.Plugins.SdLocal
    registerPlugin(SdLocalPlugin.class);
    // Official Hunyuan3D-2.1 image-to-GLB worker bridge.
    registerPlugin(Hunyuan3DLocalPlugin.class);
    // Real 3DDD single-image -> mesh -> GLB fallback/generator.
    registerPlugin(Photo3DLocalPlugin.class);
    // VKNN + YoNoSplat on-device Vulkan 3DGS model manager.
    registerPlugin(Vknn3DPlugin.class);
    // Keep the studio UI out from under the phone's system bars (status bar
    // and navigation buttons). Without this, Android draws the WebView
    // edge-to-edge and the GENERATE / SAVE footer ends up hidden behind the
    // navigation buttons. Padding the WebView keeps 100vh inside the safe
    // area on every Android version, including enforced edge-to-edge.
    ViewCompat.setOnApplyWindowInsetsListener(getBridge().getWebView(), (v, insets) -> {
      androidx.core.graphics.Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
      v.setPadding(0, bars.top, 0, bars.bottom);
      return insets;
    });
  }
}
