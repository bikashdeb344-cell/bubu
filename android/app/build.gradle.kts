plugins {
  alias(libs.plugins.android.application)
}

android {
  namespace = "com.example.mmuphotoportal"
  compileSdk = 35

  defaultConfig {
    applicationId = "com.example.mmuphotoportal"
    minSdk = 24
    targetSdk = 35
    versionCode = 1
    versionName = "1.0"
  }

  buildTypes {
    release {
      isMinifyEnabled = false
      proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
    }
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }

  buildFeatures {
    compose = false
    aidl = false
    buildConfig = false
    shaders = false
  }
}

dependencies {
  // No external runtime dependencies needed; standard Android framework APIs used
}
