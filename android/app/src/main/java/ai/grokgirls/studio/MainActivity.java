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
    WindowInsetsControllerCompat controller =
        new WindowInsetsControllerCompat(getWindow(), getWindow().getDecorView());
    controller.setSystemBarsBehavior(
        WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    controller.hide(WindowInsetsCompat.Type.navigationBars());
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
    getWindow().getDecorView().setOnSystemUiVisibilityChangeListener(visibility ->
        enterImmersiveMode());

    registerPlugin(AvatarStudioPlugin.class);
    registerPlugin(OllamaLocalPlugin.class);
    registerPlugin(SdLocalPlugin.class);
    registerPlugin(Hunyuan3DLocalPlugin.class);
    registerPlugin(TripoSRLocalPlugin.class);
    registerPlugin(Photo3DLocalPlugin.class);
    registerPlugin(Vknn3DPlugin.class);

    ViewCompat.setOnApplyWindowInsetsListener(getBridge().getWebView(), (v, insets) -> {
      androidx.core.graphics.Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
      v.setPadding(0, bars.top, 0, bars.bottom);
      return insets;
    });
  }
}
