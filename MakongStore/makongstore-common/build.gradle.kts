// Platform-agnostic HTTP client + JSON for the website's /api/plugin bridge
// (WebsiteBridge, Json) - no Bukkit/Velocity imports here, so no
// dependencies either. Shared as-is by both plugin modules, which pull it
// in as `implementation(project(":makongstore-common"))` and shade it into
// their own jar at build time.
