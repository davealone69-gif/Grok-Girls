package android.view

open class View(context: android.content.Context) {
    open fun onTouchEvent(event: MotionEvent): Boolean = true
}
