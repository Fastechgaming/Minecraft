plugins {
    id("com.gradleup.shadow") version "8.3.5"
}

repositories {
    maven("https://repo.papermc.io/repository/maven-public/")
}

// Bump if PaperMC has since published a newer Velocity API version - check
// https://repo.papermc.io/#browse/browse:maven-public:com%2Fvelocitypowered%2Fvelocity-api
val velocityApiVersion = "3.3.0-SNAPSHOT"

dependencies {
    implementation(project(":makongcore-common"))
    compileOnly("com.velocitypowered:velocity-api:$velocityApiVersion")
    // velocity-api ships an annotation processor that reads the @Plugin
    // annotation and generates velocity-plugin.json for us - no hand-written
    // plugin manifest needed, but javac needs it on the processor path too.
    annotationProcessor("com.velocitypowered:velocity-api:$velocityApiVersion")
}

tasks {
    shadowJar {
        archiveBaseName.set("MakongCore-Velocity")
        archiveClassifier.set("")
        // velocity-api is compileOnly (provided by the proxy at runtime), so
        // shadowJar's default runtimeClasspath already excludes it - only
        // our own makongcore-common ends up bundled in.
    }
    build {
        dependsOn(shadowJar)
    }
}
