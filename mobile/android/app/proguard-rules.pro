# Firebase / Play Services keep their own consumer rules; these cover the
# reflection-based paths the plugins use.
-keep class io.flutter.** { *; }
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn io.flutter.embedding.**
