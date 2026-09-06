package com.angkor.makongvelocity;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Properties;

/**
 * Plain java.util.Properties config - Velocity ships no YAML/JSON library
 * guaranteed on the classpath, and this plugin only has a handful of flat
 * settings, so a dependency is not worth adding for it.
 */
final class VelocityConfig {
    private final Properties props;

    private VelocityConfig(Properties props) {
        this.props = props;
    }

    static VelocityConfig loadOrCreate(Path dataDirectory) throws IOException {
        Files.createDirectories(dataDirectory);
        Path file = dataDirectory.resolve("config.properties");
        Properties props = new Properties();
        if (Files.exists(file)) {
            try (InputStream in = Files.newInputStream(file)) {
                props.load(in);
            }
        } else {
            props.setProperty("website.enabled", "false");
            props.setProperty("website.url", "https://makongmc.com");
            props.setProperty("website.secret", "change-me");
            props.setProperty("website.server_id", "proxy");
            props.setProperty("website.poll_interval_seconds", "3");
            props.setProperty("nlogin.forward_account_type", "true");
            props.setProperty("announcements.enabled", "true");
            try (OutputStream out = Files.newOutputStream(file)) {
                props.store(out, "MakongVelocity - see ../MakongVelocity/README.md for what each key does."
                        + "\nwebsite.secret must match the website's MAKONGCORE_SECRET exactly."
                        + "\nnlogin.forward_account_type requires nLogin to be installed and running in proxy mode."
                        + "\nannouncements.enabled turns the periodic broadcasts in announcements.yml on/off.");
            }
        }
        return new VelocityConfig(props);
    }

    boolean websiteEnabled() {
        return Boolean.parseBoolean(props.getProperty("website.enabled", "false"));
    }

    String websiteUrl() {
        return props.getProperty("website.url", "");
    }

    String websiteSecret() {
        return props.getProperty("website.secret", "");
    }

    String serverId() {
        return props.getProperty("website.server_id", "proxy");
    }

    long pollIntervalSeconds() {
        try {
            return Math.max(1, Long.parseLong(props.getProperty("website.poll_interval_seconds", "3")));
        } catch (NumberFormatException e) {
            return 5;
        }
    }

    boolean forwardAccountType() {
        return Boolean.parseBoolean(props.getProperty("nlogin.forward_account_type", "true"));
    }

    boolean announcementsEnabled() {
        return Boolean.parseBoolean(props.getProperty("announcements.enabled", "true"));
    }
}
