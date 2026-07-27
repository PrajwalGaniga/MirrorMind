allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir = java.io.File(System.getenv("LOCALAPPDATA") ?: "C:/tmp", "MirrorMind-build")
rootProject.layout.buildDirectory.set(newBuildDir)

subprojects {
    project.layout.buildDirectory.set(java.io.File(newBuildDir, project.name))
}
subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}

subprojects {
    plugins.withId("com.android.library") {
        extensions.configure<com.android.build.gradle.LibraryExtension>("android") {
            compileSdk = 36
        }
    }
}
