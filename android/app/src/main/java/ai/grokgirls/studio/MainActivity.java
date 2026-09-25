package ai.grokgirls.studio;

import android.os.Bundle;
import android.view.Window;
import android.view.WindowInsets;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    // Phone studio owns the full screen. Android's navigation buttons/gesture
    // bar must not cover the render controls or bottom navigation.
    WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
    WindowInsetsControllerCompat controller =
        new WindowInsetsControllerCompat(getWindow(), getWindow().getDecorView());
    controller.hide(WindowInsetsCompat.Type.navigationBars());
    controller.setSystemBarsBehavior(
        WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);

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
