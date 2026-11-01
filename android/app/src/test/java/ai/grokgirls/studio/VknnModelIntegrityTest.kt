package ai.grokgirls.studio

import java.io.File
import java.net.URL
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class VknnModelIntegrityTest {
    private val fixtureSha256 = "9f64a747e1b97f131fabb6b447296c9b6f0201e79fb3c5356e6c77e89b6a806a"

    @Test
    fun verifyAcceptsExactDigestAndSizeOnly() {
        val file = File.createTempFile("vknn-integrity", ".bin")
        try {
            file.writeBytes(byteArrayOf(1, 2, 3, 4))
            assertTrue(VknnModelIntegrity.verify(file, 4, fixtureSha256))
        } finally {
            assertTrue(file.delete())
        }
    }

    @Test
    fun verifyRejectsWrongSizeAndDigest() {
        val file = File.createTempFile("vknn-integrity", ".bin")
        try {
            file.writeBytes(byteArrayOf(1, 2, 3, 4))
            assertFalse(VknnModelIntegrity.verify(file, 3, fixtureSha256))
            assertFalse(VknnModelIntegrity.verify(file, 4, "0".repeat(64)))
        } finally {
            assertTrue(file.delete())
        }
    }

    @Test
    fun verifiedFileIsReturnedOnlyAfterIntegrityCheck() {
        val file = File.createTempFile("vknn-integrity", ".bin")
        try {
            file.writeBytes(byteArrayOf(1, 2, 3, 4))
            assertEquals(file, VknnModelIntegrity.verifiedFileOrNull(file, 4, fixtureSha256))
            assertNull(VknnModelIntegrity.verifiedFileOrNull(file, 4, "0".repeat(64)))
            assertFalse(file.exists())
        } finally {
            if (file.exists()) assertTrue(file.delete())
        }
    }

    @Test
    fun redirectsAllowHuggingFaceCdnButRejectUnrelatedHosts() {
        val source = URL("https://huggingface.co/model/file")
        assertTrue(VknnModelIntegrity.isTrustedHost("us.aws.cdn.hf.co"))
        assertFalse(VknnModelIntegrity.isTrustedHost("attacker.example"))
        assertTrue(VknnModelIntegrity.resolveRedirect(source, "https://us.aws.cdn.hf.co/object").host == "us.aws.cdn.hf.co")
        assertFalse(runCatching { VknnModelIntegrity.resolveRedirect(source, "https://attacker.example/object") }.isSuccess)
    }
}
