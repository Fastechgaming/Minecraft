package com.angkor.makongvelocity;

import com.velocitypowered.api.proxy.Player;
import com.velocitypowered.api.proxy.ProxyServer;
import com.velocitypowered.api.scheduler.ScheduledTask;
import net.kyori.adventure.key.Key;
import net.kyori.adventure.sound.Sound;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.event.ClickEvent;
import net.kyori.adventure.text.event.HoverEvent;
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;
import org.slf4j.Logger;

import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Periodic network-wide announcements (store/Discord plugs, etc.) - see
 * announcements.yml for the format. Each entry runs on its own independent
 * repeating timer at its configured interval. Purely local to the proxy,
 * no website bridge or nLogin involved.
 */
final class AnnouncementService {
    private final ProxyServer server;
    private final Logger logger;
    private final List<ScheduledTask> tasks = new ArrayList<>();
    private List<AnnouncementsConfig.Announcement> announcements = List.of();

    AnnouncementService(ProxyServer server, Logger logger) {
        this.server = server;
        this.logger = logger;
    }

    void start(Path dataDirectory) {
        try {
            announcements = AnnouncementsConfig.loadOrCreate(dataDirectory);
        } catch (Exception e) {
            logger.error("Failed to load announcements.yml", e);
            return;
        }
        if (announcements.isEmpty()) return;

        for (AnnouncementsConfig.Announcement a : announcements) {
            Component message = buildMessage(a);
            Component actionBar = a.actionBar().isBlank() ? null : LegacyComponentSerializer.legacyAmpersand().deserialize(a.actionBar());
            Sound sound = buildSound(a.sound());
            Duration interval = Duration.ofSeconds(a.intervalSeconds());

            ScheduledTask task = server.getScheduler().buildTask(this, () -> {
                server.sendMessage(message);
                if (actionBar != null) server.sendActionBar(actionBar);
                if (sound != null) server.playSound(sound);
            }).delay(interval).repeat(interval).schedule();
            tasks.add(task);
        }
        logger.info("Announcements started: " + announcements.size() + " entr" + (announcements.size() == 1 ? "y" : "ies")
                + " (" + announcements.stream().map(AnnouncementsConfig.Announcement::id).reduce((x, y) -> x + ", " + y).orElse("") + ").");
    }

    void stop() {
        tasks.forEach(ScheduledTask::cancel);
        tasks.clear();
    }

    /** Every loaded entry, e.g. to register an on-demand /store, /discord command per id. */
    List<AnnouncementsConfig.Announcement> announcements() {
        return announcements;
    }

    /** Sends one entry's message/action-bar/sound to a single player on demand (its /<id> command), instead of the whole network. */
    void sendTo(Player player, AnnouncementsConfig.Announcement a) {
        player.sendMessage(buildMessage(a));
        if (!a.actionBar().isBlank()) {
            player.sendActionBar(LegacyComponentSerializer.legacyAmpersand().deserialize(a.actionBar()));
        }
        Sound sound = buildSound(a.sound());
        if (sound != null) player.playSound(sound);
    }

    private Component buildMessage(AnnouncementsConfig.Announcement a) {
        Component message = LegacyComponentSerializer.legacyAmpersand().deserialize(a.message());
        if (a.link().isBlank()) return message;
        return message.clickEvent(ClickEvent.openUrl(a.link()))
                .hoverEvent(HoverEvent.showText(Component.text("Click to open " + a.link())));
    }

    // Accepts either Bukkit-style (ENTITY_PLAYER_LEVELUP) or already-namespaced
    // Adventure-style (entity.player.levelup) sound names, since server owners
    // copying a config from a Paper plugin will have the former.
    private Sound buildSound(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String key = raw.trim().toLowerCase(Locale.ROOT).replace('_', '.');
        try {
            return Sound.sound(Key.key("minecraft", key), Sound.Source.MASTER, 1.0f, 1.0f);
        } catch (Exception e) {
            logger.warn("announcements.yml: '" + raw + "' is not a valid sound name - skipping it.");
            return null;
        }
    }
}
