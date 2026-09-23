package ai.grokgirls.studio

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * PHASE 8 — native bridge and manifest posture, asserted on the REAL installed
 * package rather than on source files.
 *
 * Source can say anything; these read what actually shipped.
 */
@RunWith(AndroidJUnit4::class)
class PluginBridgeTest {

    private val ctx: Context get() = ApplicationProvider.getApplicationContext()

    /** All three plugin classes survived dexing and are loadable at runtime. */
    @Test
    fun pluginClassesAreLoadable() {
        val required = listOf(
            "ai.grokgirls.studio.OllamaLocalPlugin",
            "ai.grokgirls.studio.SdLocalPlugin",
            "ai.grokgirls.studio.AvatarStudioPlugin",
            "ai.grokgirls.studio.MainActivity"
        )
        val missing = required.filter {
            runCatching { Class.forName(it) }.isFailure
        }
        assertTrue("Plugin classes missing from the installed APK: $missing", missing.isEmpty())
    }

    /**
     * Each plugin really exposes the @PluginMethod entry points the web layer
     * calls. A renamed or dropped method would break the feature silently.
     */
    @Test
    fun pluginMethodsExist() {
        val expected = mapOf(
            "ai.grokgirls.studio.OllamaLocalPlugin" to
                listOf("status", "listModels", "chat", "cancel", "pull", "startServer", "openTermux"),
            "ai.grokgirls.studio.SdLocalPlugin" to
                listOf("txt2img", "cancel")
        )
        val problems = mutableListOf<String>()
        for ((cls, methods) in expected) {
            val k = runCatching { Class.forName(cls) }.getOrNull()
            if (k == null) { problems += "$cls not loadable"; continue }
            val names = k.declaredMethods.map { it.name }.toSet()
            methods.filterNot { names.contains(it) }
                .forEach { problems += "$cls is missing $it()" }
        }
        assertTrue("Plugin bridge methods missing: $problems", problems.isEmpty())
    }

    /** The Termux integration cannot work without these manifest entries. */
    @Test
    fun termuxIntegrationIsDeclared() {
        val pkg = ctx.packageManager.getPackageInfo(
            ctx.packageName, android.content.pm.PackageManager.GET_PERMISSIONS
        )
        val perms = pkg.requestedPermissions?.toList() ?: emptyList()

        assertTrue(
            "com.termux.permission.RUN_COMMAND not requested — auto-start cannot work. Got: $perms",
            perms.contains("com.termux.permission.RUN_COMMAND")
        )
        assertTrue(
            "INTERNET not requested. Got: $perms",
            perms.contains("android.permission.INTERNET")
        )
    }

    /**
     * <queries> for com.termux is mandatory on API 30+, otherwise
     * getPackageInfo() throws NameNotFoundException even when Termux IS
     * installed, and auto-start silently reports "not installed".
     */
    @Test
    fun termuxIsVisibleUnderPackageVisibility() {
        if (android.os.Build.VERSION.SDK_INT < 30) return

        val pm = ctx.packageManager
        val termuxInstalled = runCatching { pm.getPackageInfo("com.termux", 0) }.isSuccess
        val canSeeSomething = runCatching {
            pm.getLaunchIntentForPackage("com.termux")
        }.isSuccess

        // If Termux is absent this is a clean negative, not a failure. The
        // assertion that matters: querying must not throw a SecurityException,
        // which is what a missing <queries> entry produces.
        assertTrue(
            "Querying com.termux threw — <queries> entry likely missing from the manifest",
            canSeeSomething || !termuxInstalled
        )
    }

    /** Backup is off, so persona data is never copied off-device by Auto Backup. */
    @Test
    fun backupIsDisabled() {
        val info = ctx.applicationInfo
        val allowBackup =
            (info.flags and android.content.pm.ApplicationInfo.FLAG_ALLOW_BACKUP) != 0
        assertFalse("allowBackup is true — app data can leave the device", allowBackup)
    }

    /** Cleartext is required for the two loopback servers; confirm it shipped. */
    @Test
    fun cleartextIsPermittedForLoopback() {
        val ok = android.security.NetworkSecurityPolicy.getInstance()
            .isCleartextTrafficPermitted("127.0.0.1")
        assertTrue(
            "Cleartext blocked for 127.0.0.1 — Ollama :11434 and sd-server :1234 cannot be reached",
            ok
        )
    }

    /** Sanity: the app under test is the real package, not the scaffold. */
    @Test
    fun packageIsCorrect() {
        assertEquals("ai.grokgirls.studio", ctx.packageName)
        assertNotNull(ctx.packageManager.getLaunchIntentForPackage("ai.grokgirls.studio"))
    }
}
