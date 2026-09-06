// Parent build config for the MakongCore multi-module project - see
// README.md for what each module is and how to build/install them.
plugins {
    java
}

allprojects {
    group = "network.makong"
    version = "1.0.0"

    repositories {
        mavenCentral()
    }
}

subprojects {
    apply(plugin = "java")

    java {
        // Paper 1.20.x and Velocity 3.x both need Java 17+. Targeting the
        // bytecode level directly (rather than a strict toolchain) lets this
        // build with whatever JDK 17+ you already have installed, no
        // toolchain auto-provisioning/network access required.
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    tasks.withType<JavaCompile> {
        options.encoding = "UTF-8"
    }
}
