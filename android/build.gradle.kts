plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

android {
    namespace = "com.nanofuxion.tamersystemui"
    compileSdk = 35

    defaultConfig {
        minSdk = 28
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
    }
}

dependencies {
    compileOnly("org.lynxsdk.lynx:lynx:3.3.1")
    compileOnly("org.lynxsdk.lynx:lynx-jssdk:3.3.1")
    implementation("androidx.core:core-ktx:1.10.1")
    implementation("androidx.compose.material3:material3:1.3.2")
}
