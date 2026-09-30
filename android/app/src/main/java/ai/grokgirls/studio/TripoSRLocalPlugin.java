package ai.grokgirls.studio;

import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "TripoSRLocal")
public class TripoSRLocalPlugin extends Plugin {
  private final java.util.concurrent.ExecutorService pool = Executors.newCachedThreadPool();
  private static final String TERMUX = "com.termux";
  private static final String SERVICE = "com.termux.app.RunCommandService";
  private static final String ACTION = "com.termux.RUN_COMMAND";
  private static final String BASE = "http://127.0.0.1:8081";

  private boolean ready() {
    try {
      HttpURLConnection c = (HttpURLConnection) new URL(BASE + "/health").openConnection();
      c.setConnectTimeout(1500); c.setReadTimeout(2000);
      int code = c.getResponseCode(); c.disconnect();
      return code == 200;
    } catch (Exception e) { return false; }
  }

  @PluginMethod
  public void startServer(PluginCall call) {
    pool.execute(() -> {
      if (ready()) {
        JSObject r = new JSObject(); r.put("started", true); r.put("method", "already-running");
        r.put("message", "TripoSR worker is already running at " + BASE); call.resolve(r); return;
      }
      try {
        if (getContext().getPackageManager().getPackageInfo(TERMUX, 0) == null) throw new Exception("Termux is not installed.");
        Intent intent = new Intent();
        intent.setClassName(TERMUX, SERVICE);
        intent.setAction(ACTION);
        intent.putExtra("com.termux.RUN_COMMAND_PATH", "/data/data/com.termux/files/usr/bin/bash");
        intent.putExtra("com.termux.RUN_COMMAND_ARGUMENTS", new String[]{"-lc", "bash \"$HOME/Grok-Girls/tools/triposr-worker/start-triposr.sh\""});
        intent.putExtra("com.termux.RUN_COMMAND_WORKDIR", "/data/data/com.termux/files/home");
        intent.putExtra("com.termux.RUN_COMMAND_BACKGROUND", true);
        getContext().startService(intent);
        long deadline = System.currentTimeMillis() + 10000;
        while (System.currentTimeMillis() < deadline) {
          if (ready()) {
            JSObject r = new JSObject(); r.put("started", true); r.put("method", "termux");
            r.put("message", "TripoSR worker started at " + BASE); call.resolve(r); return;
          }
          Thread.sleep(500);
        }
        JSObject r = new JSObject(); r.put("started", false); r.put("method", "termux");
        r.put("message", "Termux command was sent, but TripoSR did not become ready. Check RUN_COMMAND permission, allow-external-apps, and the worker log at ~/.cache/grokgirls/triposr-worker.log.");
        call.resolve(r);
      } catch (Exception e) {
        JSObject r = new JSObject(); r.put("started", false); r.put("message", e.getMessage() == null ? "Could not start TripoSR worker." : e.getMessage()); call.resolve(r);
      }
    });
  }
}
