package com.angkor.makongcore.service;

import com.angkor.makongcore.MakongCore;
import org.bukkit.Bukkit;

import java.time.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;

public final class TeamStarResetService {
    private static final String STAR_RESET_META_KEY = "team.annual_star_reset.last_reset_year";

    private final MakongCore plugin;
    private final TeamService teams;
    private final AtomicBoolean running = new AtomicBoolean();
    private int task = -1;

    public TeamStarResetService(MakongCore plugin, TeamService teams) {
        this.plugin = plugin;
        this.teams = teams;
    }

    public void start() {
        if (!plugin.teamConfig().get().getBoolean("team.annual_star_reset.enabled", true)) return;
        task = Bukkit.getScheduler().runTaskTimerAsynchronously(plugin, this::check, 20L, 1200L).getTaskId();
    }

    public void stop() {
        if (task != -1) Bukkit.getScheduler().cancelTask(task);
    }

    private void check() {
        checkAnnualStarReset(LocalDate.now());
    }

    private void checkAnnualStarReset(LocalDate today) {
        if (!plugin.teamConfig().get().getBoolean("team.annual_star_reset.enabled", true)) return;

        int month = plugin.teamConfig().get().getInt("team.annual_star_reset.month", 1);
        int day = plugin.teamConfig().get().getInt("team.annual_star_reset.day", 1);
        int hour = clamp(plugin.teamConfig().get().getInt("team.annual_star_reset.hour", 0), 0, 23);
        int minute = clamp(plugin.teamConfig().get().getInt("team.annual_star_reset.minute", 0), 0, 59);

        if (today.getMonthValue() != month || today.getDayOfMonth() != day) return;
        if (LocalTime.now().isBefore(LocalTime.of(hour, minute))) return;

        String year = String.valueOf(today.getYear());
        if (!running.compareAndSet(false, true)) return;

        teams.database().meta(STAR_RESET_META_KEY).thenAccept(last -> {
            if (year.equals(last)) {
                running.set(false);
                return;
            }

            Bukkit.getScheduler().runTask(plugin, () ->
                    teams.resetAllStars()
                            .thenCompose(v -> teams.database().setMeta(STAR_RESET_META_KEY, year))
                            .thenRun(() -> {
                                plugin.getLogger().info("Annual Team Star reset completed for " + year + ".");
                                running.set(false);
                            })
                            .exceptionally(x -> {
                                plugin.getLogger().severe("Annual Team Star reset failed: " + x.getMessage());
                                running.set(false);
                                return null;
                            })
            );
        }).exceptionally(x -> {
            plugin.getLogger().severe("Annual Team Star reset check failed: " + x.getMessage());
            running.set(false);
            return null;
        });
    }

    private int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }
}
