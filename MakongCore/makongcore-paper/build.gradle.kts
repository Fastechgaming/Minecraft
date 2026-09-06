plugins {
    id("com.gradleup.shadow") version "8.3.5"
}

repositories {
    maven("https://repo.papermc.io/repository/maven-public/")
}

dependencies {
    implementation(project(":makongcore-common"))
    // Bump this to whatever Paper version your server actually runs - the
    // plugin only uses long-stable Bukkit API (scheduler, commands,
    // dispatchCommand), so most recent 1.20+ versions work fine.
    compileOnly("io.papermc.paper:paper-api:1.20.4-R0.1-SNAPSHOT")
}

tasks {
    shadowJar {
        archiveBaseName.set("MakongCore-Paper")
        archiveClassifier.set("")
        // paper-api is compileOnly (provided by the server at runtime), so
        // shadowJar's default runtimeClasspath already excludes it - only
        // our own makongcore-common ends up bundled in.
    }
    build {
        dependsOn(shadowJar)
    }
    processResources {
        val props = mapOf("version" to project.version)
        inputs.properties(props)
        filesMatching("plugin.yml") {
            expand(props)
        }
    }
}
