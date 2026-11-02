package ai.grokgirls.studio

import java.net.HttpURLConnection
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Cancellation state for one native Ollama request.
 *
 * Cancellation and connection attachment can race: a user may cancel while the
 * HTTP connection is still being created. Keeping the flag and connection in
 * one object guarantees that either ordering disconnects the request.
 */
internal class OllamaRequestState {
    private val cancelled = AtomicBoolean(false)

    @Volatile
    private var connection: HttpURLConnection? = null

    val isCancelled: Boolean
        get() = cancelled.get()

    fun attach(connection: HttpURLConnection) {
        this.connection = connection
        if (cancelled.get()) connection.disconnect()
    }

    fun cancel() {
        cancelled.set(true)
        connection?.disconnect()
    }
}
