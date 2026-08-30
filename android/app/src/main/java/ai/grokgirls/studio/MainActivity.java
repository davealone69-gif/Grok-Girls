package ai.grokgirls.studio;

import android.os.Bundle;

import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
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
