package ai.grokgirls.studio.data.net

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.BufferedReader
import java.net.HttpURLConnection
import java.net.URL

/** Minimal JSON-over-HTTP helper built on HttpURLConnection (no extra deps). */
object Http {

    suspend fun postJson(
        url: String,
        body: JSONObject,
        headers: Map<String, String> = emptyMap(),
        timeoutMs: Int = 180_000,
    ): JSONObject = withContext(Dispatchers.IO) {
        val conn = (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            doOutput = true
            connectTimeout = 15_000
            readTimeout = timeoutMs
            setRequestProperty("Content-Type", "application/json")
            headers.forEach { (k, v) -> setRequestProperty(k, v) }
        }
        try {
            conn.outputStream.use { it.write(body.toString().toByteArray()) }
            readResponse(conn)
        } finally {
            conn.disconnect()
        }
    }

    suspend fun getJson(
        url: String,
        headers: Map<String, String> = emptyMap(),
        timeoutMs: Int = 30_000,
    ): JSONObject = withContext(Dispatchers.IO) {
        val conn = (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 10_000
            readTimeout = timeoutMs
            headers.forEach { (k, v) -> setRequestProperty(k, v) }
        }
        try {
            readResponse(conn)
        } finally {
            conn.disconnect()
        }
    }

    private fun readResponse(conn: HttpURLConnection): JSONObject {
        val code = conn.responseCode
        val stream = if (code in 200..299) conn.inputStream else conn.errorStream
        val text = stream?.bufferedReader()?.use(BufferedReader::readText).orEmpty()
        if (code !in 200..299) {
            throw EngineException("HTTP $code — ${text.take(300).ifBlank { conn.responseMessage }}")
        }
        // Some endpoints return a bare array; wrap so callers always get an object.
        return if (text.trimStart().startsWith("[")) {
            JSONObject().put("items", org.json.JSONArray(text))
        } else {
            JSONObject(text.ifBlank { "{}" })
        }
    }
}

class EngineException(message: String, cause: Throwable? = null) : Exception(message, cause)
