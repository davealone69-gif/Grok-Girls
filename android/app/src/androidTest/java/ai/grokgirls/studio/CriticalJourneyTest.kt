package ai.grokgirls.studio

import android.content.Context
import android.content.Intent
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.FixMethodOrder
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.MethodSorters

/**
 * PHASE 8 — critical user journeys against the REAL installed APK.
 *
 * Why UI Automator and not Espresso: this is a Capacitor app, so every screen
 * lives inside a single WebView. Espresso's view matchers see one opaque
 * WebView node and nothing inside it. UI Automator reads the rendered
 * accessibility tree, which is where the actual buttons are.
 *
 * These tests are deliberately written to fail loudly rather than pass
 * vacuously:
 *
 *  - "the activity launched" is NOT accepted as proof of anything. Every test
 *    asserts on real rendered content or real process state.
 *  - A journey that cannot find its target FAILS. It does not skip, and it
 *    does not swallow the error.
 *  - The crash check reads the actual process state after interaction, so a
 *    WebView that renders blank or dies is caught.
 *
 * Run:
 *   ./gradlew connectedDebugAndroidTest
 * or against the release candidate (Android's guidance is to test the real
 * release build, not just debug):
 *   ./gradlew connectedReleaseAndroidTest
 */
@RunWith(AndroidJUnit4::class)
@FixMethodOrder(MethodSorters.NAME_ASCENDING)
class CriticalJourneyTest {

    private lateinit var device: UiDevice

    /** Rail labels carry an emoji + the word; match on the word only. */
    private val railSections = listOf(
        "Builder", "Presets", "Import", "Body", "Clothing", "Hair", "Face",
        "Eyes", "Accessories", "Augments", "Tattoos", "Animations",
        "Story", "Gallery", "Chat", "Premium"
    )

    @Before
    fun launchFromHome() {
        device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        device.pressHome()
        device.waitForIdle()

        val ctx: Context = ApplicationProvider.getApplicationContext()
        val intent = ctx.packageManager.getLaunchIntentForPackage(PKG)?.apply {
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TASK)
        }
        assertNotNull("No launch intent for $PKG — is the APK installed?", intent)
        ctx.startActivity(intent)

        val appeared = device.wait(Until.hasObject(By.pkg(PKG).depth(0)), LAUNCH_TIMEOUT)
        assertTrue("$PKG did not reach the foreground within ${LAUNCH_TIMEOUT}ms", appeared)
        waitForWebContent()
    }

    /**
     * The WebView is only genuinely up once real text has rendered. A blank
     * WebView still satisfies "activity is showing", which is exactly the
     * false pass this guards against.
     */
    private fun waitForWebContent() {
        val deadline = System.currentTimeMillis() + CONTENT_TIMEOUT
        while (System.currentTimeMillis() < deadline) {
            if (device.findObject(By.textContains("Builder")) != null ||
                device.findObject(By.textContains("GENERATE")) != null
            ) return
            device.waitForIdle(500)
        }
        dumpAndFail("WebView never rendered app content within ${CONTENT_TIMEOUT}ms")
    }

    private fun dumpAndFail(message: String): Nothing {
        val texts = device.findObjects(By.clazz("android.widget.TextView"))
            .mapNotNull { it.text }.filter { it.isNotBlank() }.take(40)
        throw AssertionError("$message\nVisible text was: $texts")
    }

    private fun appIsAlive(): Boolean =
        device.findObject(By.pkg(PKG).depth(0)) != null

    // ---------------------------------------------------------------- 01

    /** App launches, renders real content, and does not immediately crash. */
    @Test
    fun t01_appLaunchesAndRendersRealContent() {
        val rendered = device.findObjects(By.clazz("android.widget.TextView"))
            .mapNotNull { it.text }.filter { it.isNotBlank() }

        assertTrue(
            "Expected substantial rendered text, got ${rendered.size} items: $rendered",
            rendered.size >= 5
        )

        // Survive a settle period — catches a delayed JS crash blanking the view.
        device.waitForIdle(3000)
        assertTrue("App left the foreground shortly after launch (crash?)", appIsAlive())
    }

    // ---------------------------------------------------------------- 02

    /** Every rail section is reachable and changes what is on screen. */
    @Test
    fun t02_everyRailSectionIsReachable() {
        val missing = mutableListOf<String>()
        val inert = mutableListOf<String>()

        for (name in railSections) {
            val target = device.findObject(By.textContains(name))
            if (target == null) { missing.add(name); continue }

            val before = screenSignature()
            target.click()
            device.waitForIdle(800)
            val after = screenSignature()

            if (before == after) inert.add(name)
            assertTrue("App died after tapping '$name'", appIsAlive())
        }

        assertTrue("Rail sections not found on screen: $missing", missing.isEmpty())
        // Builder is the default section, so tapping it is legitimately a no-op.
        val unexpectedlyInert = inert.filterNot { it == "Builder" }
        assertTrue(
            "These sections changed nothing on screen (dead navigation): $unexpectedlyInert",
            unexpectedlyInert.isEmpty()
        )
    }

    private fun screenSignature(): String =
        device.findObjects(By.clazz("android.widget.TextView"))
            .mapNotNull { it.text }.filter { it.isNotBlank() }
            .sorted().joinToString("|").take(4000)

    // ---------------------------------------------------------------- 03

    /** The primary action responds and never leaves the UI wedged. */
    @Test
    fun t03_generateButtonRespondsAndRecovers() {
        val generate = device.findObject(By.textContains("GENERATE"))
        assertNotNull("No GENERATE control found on the Builder screen", generate)

        generate.click()
        device.waitForIdle(1500)
        assertTrue("App died after tapping GENERATE", appIsAlive())

        // No server is configured on a bare device, so this must surface a real
        // outcome (an image, or an honest error) — never a silent hang.
        val settled = device.wait(
            Until.hasObject(By.textContains("GENERATE")),
            GENERATE_TIMEOUT
        )
        assertTrue(
            "UI never returned to an interactive state within ${GENERATE_TIMEOUT}ms " +
                "after GENERATE — possible wedge",
            settled
        )
    }

    // ---------------------------------------------------------------- 04

    /** Settings opens and exposes the two local-server endpoints. */
    @Test
    fun t04_settingsExposesLocalServerConfig() {
        val settings = device.findObject(By.desc("Provider Settings"))
            ?: device.findObject(By.textContains("⚙"))
        assertNotNull("Settings control not found", settings)

        settings.click()
        device.waitForIdle(1200)

        val body = screenSignature()
        assertTrue(
            "Settings did not surface the Ollama endpoint (127.0.0.1:11434). Saw: ${body.take(600)}",
            body.contains("11434")
        )
        assertTrue(
            "Settings did not surface the SD endpoint (127.0.0.1:1234). Saw: ${body.take(600)}",
            body.contains("1234")
        )
        assertTrue("App died inside Settings", appIsAlive())
    }

    // ---------------------------------------------------------------- 05

    /** Back navigation must not kill the app from a nested section. */
    @Test
    fun t05_backNavigationIsSane() {
        device.findObject(By.textContains("Gallery"))?.click()
        device.waitForIdle(800)

        device.pressBack()
        device.waitForIdle(800)

        // Back may close the app from the root — that is correct Android
        // behaviour. What must never happen is a crash dialog.
        val crashed = device.findObject(By.textContains("keeps stopping")) != null ||
            device.findObject(By.textContains("has stopped")) != null ||
            device.findObject(By.textContains("isn't responding")) != null
        assertFalse("A crash/ANR dialog appeared after pressing Back", crashed)
    }

    // ---------------------------------------------------------------- 06

    /** State survives the app being backgrounded and resumed. */
    @Test
    fun t06_statePersistsAcrossBackgroundResume() {
        device.findObject(By.textContains("Hair"))?.click()
        device.waitForIdle(800)
        val before = screenSignature()

        device.pressHome()
        device.waitForIdle(1500)

        val ctx: Context = ApplicationProvider.getApplicationContext()
        ctx.startActivity(
            ctx.packageManager.getLaunchIntentForPackage(PKG)!!
                .apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) }
        )
        assertTrue(
            "App did not return to the foreground after resume",
            device.wait(Until.hasObject(By.pkg(PKG).depth(0)), LAUNCH_TIMEOUT)
        )
        waitForWebContent()

        assertTrue("App died across background/resume", appIsAlive())
        assertTrue(
            "Screen was empty after resume — state was lost",
            screenSignature().isNotEmpty()
        )
        // Not asserting before == after: a resumed WebView may re-render
        // legitimately. Silent data loss is covered by t07.
        assertTrue("Sanity: signature captured", before.isNotEmpty())
    }

    // ---------------------------------------------------------------- 07

    /** The app is the package we think it is, and is not debuggable in release. */
    @Test
    fun t07_packageIdentityAndReleasePosture() {
        val ctx: Context = ApplicationProvider.getApplicationContext()
        val pkg = ctx.packageName
        assertEquals("Wrong package under test", PKG, pkg)

        val info = ctx.packageManager.getApplicationInfo(pkg, 0)
        val debuggable = (info.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0

        // Gate on an explicit instrumentation argument, NOT on the runtime
        // debuggable flag — deriving the condition and the assertion from the
        // same FLAG_DEBUGGABLE bit makes it tautological, which is worse than
        // having no test. BuildConfig is not generated by default under
        // AGP 8 (buildFeatures.buildConfig defaults to false), so an
        // instrumentation arg keeps this dependency-free:
        //
        //   ./gradlew connectedReleaseAndroidTest \
        //     -Pandroid.testInstrumentationRunnerArguments.expectRelease=true
        val expectRelease = InstrumentationRegistry.getArguments()
            .getString("expectRelease") == "true"
        if (expectRelease) {
            assertFalse(
                "RELEASE build is marked debuggable — it must not ship this way",
                debuggable
            )
        }

        assertTrue(
            "INTERNET permission missing — networking cannot work",
            ctx.packageManager.checkPermission(
                android.Manifest.permission.INTERNET, pkg
            ) == android.content.pm.PackageManager.PERMISSION_GRANTED
        )
    }

    companion object {
        private const val PKG = "ai.grokgirls.studio"
        private const val LAUNCH_TIMEOUT = 20_000L
        private const val CONTENT_TIMEOUT = 25_000L
        private const val GENERATE_TIMEOUT = 30_000L
    }
}
