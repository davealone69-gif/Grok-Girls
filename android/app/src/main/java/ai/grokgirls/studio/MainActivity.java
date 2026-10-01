package ai.grokgirls.studio;

import android.os.Bundle;

import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

  /**
   * Hide the on-screen Android navigation buttons (back / home / recents).
   *
   * Only ONE mechanism is used here on purpose. The previous version set both
   * the modern WindowInsetsControllerCompat AND the deprecated
   * View.setSystemUiVisibility flags — on API 30+ those two fight each other,
   * the legacy call resets the controller's state, and the nav bar came
   * straight back with the web content laid out underneath it.
   *
   * BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE keeps the bar reachable: a swipe up
   * from the bottom edge shows it briefly and it hides itself again.
   */
  private void enterImmersiveMode() {
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    WindowInsetsControllerCompat controller =
        new WindowInsetsControllerCompat(getWindow(), getWindow().getDecorView());
    controller.setSystemBarsBehavior(
        WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    controller.hide(WindowInsetsCompat.Type.navigationBars());
  }

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    enterImmersiveMode();

    registerPlugin(AvatarStudioPlugin.class);
    registerPlugin(OllamaLocalPlugin.class);
    registerPlugin(SdLocalPlugin.class);
    registerPlugin(Hunyuan3DLocalPlugin.class);
    registerPlugin(TripoSRLocalPlugin.class);
    registerPlugin(Photo3DLocalPlugin.class);
    registerPlugin(Vknn3DPlugin.class);

    // Keep web content clear of the system bars whenever they ARE on screen
    // (swiped in, or a device reporting non-zero insets). With the nav bar
    // hidden this resolves to 0 and the app runs truly edge to edge.
    ViewCompat.setOnApplyWindowInsetsListener(getBridge().getWebView(), (v, insets) -> {
      androidx.core.graphics.Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
      v.setPadding(0, bars.top, 0, bars.bottom);
      return insets;
    });
  }

  @Override
  public void onResume() {
    super.onResume();
    enterImmersiveMode();
  }

  @Override
  public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    // Sticky immersive is cleared when another surface takes focus (dialog,
    // keyboard, share sheet). Re-arm as soon as focus comes back.
    if (hasFocus) {
      enterImmersiveMode();
    }
  }
}
