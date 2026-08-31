package android.util

/** JVM stub: prints to stdout/stderr. */
object Log {
    @JvmStatic
    fun d(tag: String, msg: String): Int {
        println("D/$tag: $msg")
        return 0
    }

    @JvmStatic
    fun w(tag: String, msg: String): Int {
        println("W/$tag: $msg")
        return 0
    }

    @JvmStatic
    fun e(tag: String, msg: String): Int {
        println("E/$tag: $msg")
        return 0
    }
}
