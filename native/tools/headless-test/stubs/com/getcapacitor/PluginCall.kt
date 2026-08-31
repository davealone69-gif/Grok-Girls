package com.getcapacitor

open class PluginCall {
    open fun getString(name: String): String? = null
    open fun resolve() {}
    open fun reject(msg: String) {}
}
