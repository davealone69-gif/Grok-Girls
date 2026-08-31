package android.app

open class Activity : android.content.Context() {
    var window: android.view.Window = android.view.Window()
    open fun requestWindowFeature(featureId: Int) {}
    open fun onCreate(savedInstanceState: android.os.Bundle?) {}
    open fun setContentView(view: android.view.View) {}
    open fun onResume() {}
    open fun onPause() {}
}
