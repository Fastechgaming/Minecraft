package com.angkor.makongvelocity;

import org.yaml.snakeyaml.Yaml;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Loads announcements.yml - see that file (bundled as the default) for the format. */
final class AnnouncementsConfig {

    record Announcement(String id, String link, long intervalSeconds, String sound, String message, String actionBar) {}

    private AnnouncementsConfig() {}

    static List<Announcement> loadOrCreate(Path dataDirectory) throws IOException {
        Files.createDirectories(dataDirectory);
        Path file = dataDirectory.resolve("announcements.yml");
        if (!Files.exists(file)) {
            try (InputStream in = AnnouncementsConfig.class.getResourceAsStream("/announcements.yml")) {
                if (in == null) throw new IOException("bundled announcements.yml resource is missing");
                Files.copy(in, file);
            }
        }

        Map<String, Object> root;
        try (InputStream in = Files.newInputStream(file)) {
            Object parsed = new Yaml().load(in);
            root = parsed instanceof Map ? castMap(parsed) : Map.of();
        }

        Object announcementsNode = root.get("announcements");
        if (!(announcementsNode instanceof Map)) return List.of();

        List<Announcement> result = new ArrayList<>();
        for (Map.Entry<String, Object> entry : castMap(announcementsNode).entrySet()) {
            if (!(entry.getValue() instanceof Map)) continue;
            Map<String, Object> a = castMap(entry.getValue());
            long interval = Math.max(1, toLong(a.get("interval"), 300));
            result.add(new Announcement(
                    entry.getKey(),
                    String.valueOf(a.getOrDefault("link", "")).trim(),
                    interval,
                    String.valueOf(a.getOrDefault("sound", "")).trim(),
                    String.valueOf(a.getOrDefault("message", "")),
                    String.valueOf(a.getOrDefault("action-bar", "")).trim()));
        }
        return result;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> castMap(Object o) {
        return o instanceof Map ? (Map<String, Object>) o : new LinkedHashMap<>();
    }

    private static long toLong(Object o, long def) {
        if (o instanceof Number n) return n.longValue();
        try {
            return o == null ? def : Long.parseLong(String.valueOf(o).trim());
        } catch (NumberFormatException e) {
            return def;
        }
    }
}
