package ai.grokgirls.studio

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.atomic.AtomicInteger

class OllamaRequestStateTest {
    private class RecordingConnection : HttpURLConnection(URL("http://127.0.0.1")) {
        val disconnectCount = AtomicInteger()

        override fun disconnect() {
            disconnectCount.incrementAndGet()
        }

        override fun usingProxy(): Boolean = false

        override fun connect() = Unit
    }

    @Test
    fun cancellationBeforeConnectionAttachmentDisconnectsOnAttach() {
        val state = OllamaRequestState()
        val connection = RecordingConnection()

        state.cancel()
        state.attach(connection)

        assertTrue(state.isCancelled)
        assertTrue("late-attached connection was not disconnected", connection.disconnectCount.get() > 0)
    }

    @Test
    fun cancellationAfterConnectionAttachmentDisconnectsImmediately() {
        val state = OllamaRequestState()
        val connection = RecordingConnection()

        state.attach(connection)
        assertFalse(state.isCancelled)
        assertTrue(connection.disconnectCount.get() == 0)

        state.cancel()

        assertTrue(state.isCancelled)
        assertTrue("attached connection was not disconnected", connection.disconnectCount.get() > 0)
    }
}
