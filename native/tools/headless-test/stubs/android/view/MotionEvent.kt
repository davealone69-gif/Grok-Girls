package android.view

class MotionEvent {
    val actionMasked: Int = 0
    val pointerCount: Int = 1
    val x: Float = 0f
    val y: Float = 0f
    fun getX(pointerIndex: Int): Float = 0f
    fun getY(pointerIndex: Int): Float = 0f

    companion object {
        const val ACTION_DOWN = 0
        const val ACTION_MOVE = 2
        const val ACTION_POINTER_DOWN = 5
        const val ACTION_POINTER_UP = 6
    }
}
