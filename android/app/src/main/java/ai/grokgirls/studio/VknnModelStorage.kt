package ai.grokgirls.studio

/** Pure, platform-independent checks for VKNN model download storage safety. */
internal object VknnModelStorage {
    fun hasEnoughSpace(usableBytes: Long, requiredBytes: Long): Boolean =
        usableBytes >= 0L && requiredBytes >= 0L && usableBytes >= requiredBytes
}
