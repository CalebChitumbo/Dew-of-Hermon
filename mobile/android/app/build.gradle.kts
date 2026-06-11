plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    namespace = "com.potterswheel.potters_wheel"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.potterswheel.potters_wheel"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        // Firebase requires API 23+; setting it explicitly (instead of
        // Flutter's default of 24) lets Android 6.0 phones install the app.
        minSdk = 23
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        // Committed keystore so every CI build carries the SAME signature —
        // without it each GitHub runner generates a fresh debug key and
        // Android refuses to update an existing install. Test builds only:
        // when publishing to Google Play, enroll in Play App Signing and
        // switch to a private upload key kept out of the repo.
        create("testRelease") {
            storeFile = file("test-signing.jks")
            storePassword = "pw-test-builds"
            keyAlias = "pwtest"
            keyPassword = "pw-test-builds"
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("testRelease")
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
