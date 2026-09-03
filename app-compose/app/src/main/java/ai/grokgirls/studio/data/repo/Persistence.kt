package ai.grokgirls.studio.data.repo

import ai.grokgirls.studio.data.model.*
import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.File

@Serializable
data class StudioSnapshot(
    val personas: List<Persona> = emptyList(),
    val activeId: String = "",
    val gallery: List<GalleryItem> = emptyList(),
    val messages: List<ChatMessage> = emptyList(),
    val settings: RenderSettings = RenderSettings(),
    val server: ServerConfig = ServerConfig(),
    val stats: Stats = Stats(),
    val adultMode: Boolean = false,
    val chapter: Int = 0,
)

/** JSON-file persistence for the whole session, plus image storage. */
class Persistence(private val ctx: Context) {

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        prettyPrint = false
    }

    private val file: File get() = File(ctx.filesDir, "studio-state.json")
    private val imageDir: File get() = File(ctx.filesDir, "renders").apply { mkdirs() }

    suspend fun load(): StudioSnapshot? = withContext(Dispatchers.IO) {
        runCatching {
            if (!file.exists()) return@runCatching null
            json.decodeFromString<StudioSnapshot>(file.readText())
        }.getOrNull()
    }

    suspend fun save(snapshot: StudioSnapshot) = withContext(Dispatchers.IO) {
        runCatching {
            val tmp = File(file.parentFile, "studio-state.json.tmp")
            tmp.writeText(json.encodeToString(snapshot))
            tmp.renameTo(file)
        }
        Unit
    }

    /** Writes render bytes to internal storage and returns an absolute path. */
    suspend fun writeImage(id: String, bytes: ByteArray, ext: String = "png"): String =
        withContext(Dispatchers.IO) {
            val f = File(imageDir, "$id.$ext")
            f.writeBytes(bytes)
            f.absolutePath
        }

    suspend fun deleteImage(path: String) = withContext(Dispatchers.IO) {
        runCatching { if (path.startsWith("/")) File(path).delete() }
        Unit
    }

    fun exportJson(snapshot: StudioSnapshot): String = json.encodeToString(snapshot)

    fun importJson(text: String): StudioSnapshot = json.decodeFromString(text)

    suspend fun reset() = withContext(Dispatchers.IO) {
        runCatching {
            file.delete()
            imageDir.deleteRecursively()
        }
        Unit
    }
}
