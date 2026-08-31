package android.opengl

/**
 * JVM stub for headless compile+runtime testing.
 * Constants are real GL values; calls are no-ops.
 */
object GLES30 {
    const val GL_ARRAY_BUFFER = 0x8892
    const val GL_BACK = 0x0405
    const val GL_BLEND = 0x0BE2
    const val GL_CLAMP_TO_EDGE = 0x812F
    const val GL_COLOR_ATTACHMENT0 = 0x8CE0
    const val GL_COLOR_BUFFER_BIT = 0x4000
    const val GL_COMPILE_STATUS = 0x8B81
    const val GL_CULL_FACE = 0x0B44
    const val GL_DEPTH_BUFFER_BIT = 0x0100
    const val GL_DEPTH_TEST = 0x0B71
    const val GL_ELEMENT_ARRAY_BUFFER = 0x8893
    const val GL_FLOAT = 0x1406
    const val GL_FRAGMENT_SHADER = 0x8B30
    const val GL_FRAMEBUFFER = 0x8D40
    const val GL_HALF_FLOAT = 0x140B
    const val GL_LEQUAL = 0x0203
    const val GL_LESS = 0x0201
    const val GL_LINEAR = 0x2601
    const val GL_LINEAR_MIPMAP_LINEAR = 0x2703
    const val GL_LINES = 0x0001
    const val GL_LINK_STATUS = 0x8B82
    const val GL_ONE_MINUS_SRC_ALPHA = 0x0303
    const val GL_RG = 0x8227
    const val GL_RG16F = 0x822F
    const val GL_RGBA = 0x1908
    const val GL_RGBA16F = 0x881A
    const val GL_SRC_ALPHA = 0x0302
    const val GL_STATIC_DRAW = 0x88E4
    const val GL_TEXTURE0 = 0x84C0
    const val GL_TEXTURE1 = 0x84C1
    const val GL_TEXTURE2 = 0x84C2
    const val GL_TEXTURE3 = 0x84C3
    const val GL_TEXTURE4 = 0x84C4
    const val GL_TEXTURE5 = 0x84C5
    const val GL_TEXTURE6 = 0x84C6
    const val GL_TEXTURE7 = 0x84C7
    const val GL_TEXTURE_2D = 0x0DE1
    const val GL_TEXTURE_CUBE_MAP = 0x8513
    const val GL_TEXTURE_CUBE_MAP_POSITIVE_X = 0x8515
    const val GL_TEXTURE_MAG_FILTER = 0x2800
    const val GL_TEXTURE_MIN_FILTER = 0x2801
    const val GL_TEXTURE_WRAP_S = 0x2802
    const val GL_TEXTURE_WRAP_T = 0x2803
    const val GL_TRIANGLES = 0x0004
    const val GL_UNSIGNED_BYTE = 0x1401
    const val GL_UNSIGNED_INT = 0x1405
    const val GL_VERTEX_SHADER = 0x8B31

    fun glActiveTexture(texture: Int) {}
    fun glAttachShader(program: Int, shader: Int) {}
    fun glBindBuffer(target: Int, buffer: Int) {}
    fun glBindFramebuffer(target: Int, framebuffer: Int) {}
    fun glBindTexture(target: Int, texture: Int) {}
    fun glBindVertexArray(array: Int) {}
    fun glBlendFunc(sfactor: Int, dfactor: Int) {}
    fun glBufferData(target: Int, size: Int, data: java.nio.Buffer?, usage: Int) {}
    fun glBufferData(target: Int, size: Int, data: java.nio.FloatBuffer?, usage: Int) {}
    fun glBufferData(target: Int, size: Int, data: java.nio.IntBuffer?, usage: Int) {}
    fun glBufferData(target: Int, size: Int, data: java.nio.ShortBuffer?, usage: Int) {}
    fun glClear(mask: Int) {}
    fun glClearColor(red: Float, green: Float, blue: Float, alpha: Float) {}
    fun glCompileShader(shader: Int) {}
    fun glCreateProgram(): Int = 1
    fun glCreateShader(type: Int): Int = 1
    fun glCullFace(mode: Int) {}
    fun glDeleteBuffers(n: Int, buffers: IntArray?, offset: Int) {}
    fun glDeleteFramebuffers(n: Int, framebuffers: IntArray?, offset: Int) {}
    fun glDeleteProgram(program: Int) {}
    fun glDeleteShader(shader: Int) {}
    fun glDeleteTextures(n: Int, textures: IntArray?, offset: Int) {}
    fun glDeleteVertexArrays(n: Int, arrays: IntArray?, offset: Int) {}
    fun glDepthFunc(func: Int) {}
    fun glDepthMask(flag: Boolean) {}
    fun glDisable(cap: Int) {}
    fun glDisableVertexAttribArray(index: Int) {}
    fun glDrawArrays(mode: Int, first: Int, count: Int) {}
    fun glDrawElements(mode: Int, count: Int, type: Int, offset: Int) {}
    fun glEnable(cap: Int) {}
    fun glEnableVertexAttribArray(index: Int) {}
    fun glFramebufferTexture2D(target: Int, attachment: Int, textarget: Int, texture: Int, level: Int) {}
    fun glGenBuffers(n: Int, buffers: IntArray?, offset: Int) { buffers?.set(offset, 1) }
    fun glGenFramebuffers(n: Int, framebuffers: IntArray?, offset: Int) { framebuffers?.set(offset, 1) }
    fun glGenTextures(n: Int, textures: IntArray?, offset: Int) { textures?.set(offset, 1) }
    fun glGenVertexArrays(n: Int, arrays: IntArray?, offset: Int) { arrays?.set(offset, 1) }
    fun glGenerateMipmap(target: Int) {}
    fun glGetProgramInfoLog(program: Int): String = ""
    fun glGetProgramiv(program: Int, pname: Int, params: IntArray?, offset: Int) { params?.set(offset, 1) }
    fun glGetShaderInfoLog(shader: Int): String = ""
    fun glGetShaderiv(shader: Int, pname: Int, params: IntArray?, offset: Int) { params?.set(offset, 1) }
    fun glGetUniformLocation(program: Int, name: String): Int = -1
    fun glLinkProgram(program: Int) {}
    fun glShaderSource(shader: Int, string: String) {}
    fun glTexImage2D(target: Int, level: Int, internalformat: Int, width: Int, height: Int,
                     border: Int, format: Int, type: Int, pixels: java.nio.Buffer?) {}
    fun glTexParameteri(target: Int, pname: Int, param: Int) {}
    fun glTexStorage2D(target: Int, levels: Int, internalformat: Int, width: Int, height: Int) {}
    fun glUniform1f(location: Int, v0: Float) {}
    fun glUniform1fv(location: Int, count: Int, value: FloatArray?, offset: Int) {}
    fun glUniform1i(location: Int, v0: Int) {}
    fun glUniform3f(location: Int, v0: Float, v1: Float, v2: Float) {}
    fun glUniform4f(location: Int, v0: Float, v1: Float, v2: Float, v3: Float) {}
    fun glUniform4fv(location: Int, count: Int, value: FloatArray?, offset: Int) {}
    fun glUniformMatrix3fv(location: Int, count: Int, transpose: Boolean, value: FloatArray?, offset: Int) {}
    fun glUniformMatrix4fv(location: Int, count: Int, transpose: Boolean, value: FloatArray?, offset: Int) {}
    fun glUseProgram(program: Int) {}
    fun glVertexAttribPointer(index: Int, size: Int, type: Int, normalized: Boolean,
                              stride: Int, offset: Int) {}
    fun glViewport(x: Int, y: Int, width: Int, height: Int) {}
}
