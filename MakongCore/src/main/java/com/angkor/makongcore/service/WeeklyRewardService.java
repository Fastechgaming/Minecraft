package com.angkor.makongcore.service;

import com.angkor.makongcore.MakongCore;
import com.angkor.makongcore.model.Team;
import org.bukkit.Bukkit;

import java.time.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.CompletableFuture;

public final class WeeklyRewardService {
    private static final String PAYOUT_META_KEY = "team.weekly_rewards.last_payout_week";
    private static final String WEEKLY_RESET_META_KEY = "team.weekly_points.last_reset_week";
    private static final String STAR_RESET_META_KEY = "team.annual_star_reset.last_reset_year";

    private final MakongCore plugin;
    private final TeamService teams;
    private final AtomicBoolean running = new AtomicBoolean();

    public WeeklyRewardService(MakongCore plugin, TeamService teams) {
        this.plugin = plugin;
        this.teams = teams;
    }

    public void start() {
        boolean weeklyReset = plugin.teamConfig().get().getBoolean("team.weekly_points.reset_enabled", true);
        boolean rewards = plugin.teamConfig().get().getBoolean("team.weekly_rewards.enabled", true);
        boolean annual = plugin.teamConfig().get().getBoolean("team.annual_star_reset.enabled", true);
        if (!weeklyReset && !rewards && !annual) return;
        Bukkit.getScheduler().runTaskTimerAsynchronously(plugin, this::check, 20L, 1200L);
    }

    private void check() {
        LocalDate today = LocalDate.now();

        // Team Stars are permanent during the year and are cleared once on the configured annual reset date.
        checkAnnualStarReset(today);

        boolean weeklyResetEnabled = plugin.teamConfig().get().getBoolean("team.weekly_points.reset_enabled", true);
        boolean rewardsEnabled = plugin.teamConfig().get().getBoolean("team.weekly_rewards.enabled", true);
        if (!weeklyResetEnabled && !rewardsEnabled) return;

        DayOfWeek resetDay = configuredDay("team.weekly_points.reset_day", "SUNDAY");
        int resetHour = clamp(plugin.teamConfig().get().getInt("team.weekly_points.reset_hour", 0), 0, 23);
        int resetMinute = clamp(plugin.teamConfig().get().getInt("team.weekly_points.reset_minute", 0), 0, 59);

        if (today.getDayOfWeek() != resetDay) return;
        if (LocalTime.now().isBefore(LocalTime.of(resetHour, resetMinute))) return;

        if (!running.compareAndSet(false, true)) return;

        String completedWeek = today.minusWeeks(1).toString();
        String resetWeek = today.toString();

        teams.database().meta(WEEKLY_RESET_META_KEY).thenAccept(lastReset -> {
            if (resetWeek.equals(lastReset)) {
                running.set(false);
                return;
            }

            Bukkit.getScheduler().runTask(plugin, () -> processWeekly(completedWeek, resetWeek));
        }).exceptionally(x -> {
            plugin.getLogger().severe("Weekly Points reset check failed: " + x.getMessage());
            running.set(false);
            return null;
        });
    }

    private void processWeekly(String completedWeek, String resetWeek) {
        boolean rewardsEnabled = plugin.teamConfig().get().getBoolean("team.weekly_rewards.enabled", true);

        if (rewardsEnabled) {
            teams.database().meta(PAYOUT_META_KEY).thenAccept(lastPayout -> {
                if (completedWeek.equals(lastPayout)) {
                    resetPoints(resetWeek, completedWeek, 0, false);
                    return;
                }

                payout(completedWeek).thenRun(() -> resetPoints(resetWeek, completedWeek, 0, true));
            }).exceptionally(x -> {
                plugin.getLogger().severe("Weekly reward check failed: " + x.getMessage());
                running.set(false);
                return null;
            });
        } else {
            resetPoints(resetWeek, completedWeek, 0, false);
        }
    }

    private void resetPoints(String resetWeek, String completedWeek, int ignored, boolean rewardsPaid) {
        teams.resetWeeklyPoints().thenCompose(v -> teams.database().setMeta(WEEKLY_RESET_META_KEY, resetWeek))
                .thenRun(() -> {
                    plugin.getLogger().info("Weekly Points reset completed for " + resetWeek + ".");
                    running.set(false);
                })
                .exceptionally(x -> {
                    plugin.getLogger().severe("Weekly Points reset failed: " + x.getMessage());
                    running.set(false);
                    return null;
                });
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

    private CompletableFuture<Void> payout(String week) {
        return CompletableFuture.runAsync(() -> {
            List<Team> list = new ArrayList<>(teams.all());
            list.sort(Comparator.comparingLong(Team::points).reversed()
                    .thenComparing(Team::name, String.CASE_INSENSITIVE_ORDER));

            int paid = 0;
            for (int i = 0; i < Math.min(20, list.size()); i++) {
                long reward = reward(i + 1);
                if (reward <= 0) continue;

                Team t = list.get(i);
                t.addStars(reward);
                teams.save(t);

                final int rank = i + 1;
                final long stars = reward;
                Bukkit.getScheduler().runTask(plugin, () -> {
                    for (var member : t.members()) {
                        var online = Bukkit.getPlayer(member.uuid());
                        if (online != null) {
                            online.sendMessage(com.angkor.makongcore.util.Text.mm(
                                    "<yellow>⭐ Weekly reward!</yellow> <gray>Your team <white>" + t.name()
                                            + "</white> finished #" + rank + " and received <yellow>" + stars + " Stars</yellow>."));
                        }
                    }
                });

                plugin.getLogger().info("Weekly Stars: #" + rank + " " + t.tag() + " received " + stars + " Stars.");
                paid++;
            }

            teams.database().setMeta(PAYOUT_META_KEY, week).join();
            plugin.getLogger().info("Weekly Stars payout completed for " + week + ". Teams rewarded: " + paid);
        });
    }

    private long reward(int rank) {
        if (rank == 1) return plugin.teamConfig().get().getLong("team.weekly_rewards.top_1_stars", 50);
        if (rank == 2) return plugin.teamConfig().get().getLong("team.weekly_rewards.top_2_stars", 30);
        if (rank == 3) return plugin.teamConfig().get().getLong("team.weekly_rewards.top_3_stars", 25);
        if (rank <= 5) return plugin.teamConfig().get().getLong("team.weekly_rewards.top_4_5_stars", 20);
        if (rank <= 20) {
            long start = plugin.teamConfig().get().getLong("team.weekly_rewards.top_6_20_stars_start", 15);
            long decrement = plugin.teamConfig().get().getLong("team.weekly_rewards.top_6_20_stars_decrement", 1);
            return Math.max(0, start - ((long) rank - 6) * decrement);
        }
        return 0;
    }

    private DayOfWeek configuredDay(String path, String fallback) {
        try {
            return DayOfWeek.valueOf(plugin.teamConfig().get()
                    .getString(path, fallback).toUpperCase(Locale.ROOT));
        } catch (Exception ignored) {
            return DayOfWeek.valueOf(fallback);
        }
    }

    private int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }
}
