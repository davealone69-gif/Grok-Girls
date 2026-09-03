package ai.grokgirls.studio

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import ai.grokgirls.studio.ui.AppShell
import ai.grokgirls.studio.ui.theme.GrokGirlsTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContent {
            GrokGirlsTheme(darkTheme = true) { AppShell() }
        }
    }
}
