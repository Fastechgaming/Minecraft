package com.angkor.makongcore.service;

import com.angkor.makongcore.MakongCore;
import com.angkor.makongcore.data.Database;
import com.angkor.makongcore.model.Team;
import com.angkor.makongcore.web.WebsiteBridge;
import org.bukkit.Bukkit;
import org.bukkit.command.CommandSender;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.scheduler.BukkitTask;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;

/**
 * Connects this server to the Makong Network website's multi-server command
 * bridge (see MakongWeb/lib/pluginBridge.js and routes/plugin.js). This
 * server dials out to the website on a repeating timer - there is nothing to
 * open on the Minecraft side, so this works the same whether the website and
 * this server share a box or sit on entirely different hosts.
 *
 * Two things this gets you once configured: the website's /admin/servers
 * page can send this server a console command on demand (or automatically
 * when a Telegram store order is Accepted for this server's gamemode), and
 * /makongcore ping &lt;server-id&gt; can reach any other connected server,
 * relayed through the website.
 */
public final class WebsiteBridgeService {
    private final MakongCore plugin;
    private final FileConfiguration c;
    private WebsiteBridge bridge;
    private String serverId;
    private volatile boolean connected = false;
    private BukkitTask task;

    // Command senders currently waiting on a pong from a given target server
    // id, so /makongcore ping can report back to whoever asked and not just
    // the console log. Best-effort - a sender who logs off before the pong
    // arrives (usually well under a second) just misses the reply.
    private final ConcurrentHashMap<String, Set<CommandSender>> pendingPings = new ConcurrentHashMap<>();

    // Every server this proxy/plugin knows about as of the last poll tick -
    // used by requestProfile() below to find the connected "velocity" server
    // (the only one with nLogin registration/last-login and true
    // whole-network online status - see /profile in AccountLinkService).
    private volatile List<WebsiteBridge.ServerInfo> knownServers = List.of();

    // /profile lookups awaiting an answer relayed back through the website
    // (see requestProfile() below) - keyed by the request id WebsiteBridge
    // handed back when the request was queued. Same best-effort shape as
    // pendingPings above: a request that never gets answered just times out
    // via its own runTaskLater() rather than leaking forever.
    private final ConcurrentHashMap<String, Consumer<Map<String, Object>>> pendingProfileRequests = new ConcurrentHashMap<>();

    public WebsiteBridgeService(MakongCore plugin, FileConfiguration c) {
        this.plugin = plugin;
        this.c = c;
    }

    public void start() {
        if (!c.getBoolean("website.enabled", false)) return;

        String url = c.getString("website.url", "");
        String secret = c.getString("website.secret", "");
        serverId = c.getString("website.server_id", "");
        if (serverId == null || serverId.isBlank()) {
            // Reuse the id already configured for MySQL "network mode" -
            // most multi-server setups will have set this either way.
            serverId = plugin.getConfig().getString("network.server_id", "server");
        }
        long intervalTicks = Math.max(1, c.getLong("website.poll_interval_seconds", 5)) * 20L;

        if (url.isBlank() || secret.isBlank() || secret.equals("change-me")) {
            plugin.getLogger().warning("config.yml's website.url / website.secret are not set - the website bridge is disabled.");
            return;
        }

        bridge = new WebsiteBridge(url, secret, serverId, "paper", plugin.getLogger()::info, plugin.getLogger()::warning);
        task = Bukkit.getScheduler().runTaskTimerAsynchronously(plugin, this::pollOnce, 20L, intervalTicks);
        plugin.getLogger().info("Website bridge starting - server id '" + serverId + "', polling every " + (intervalTicks / 20) + "s.");
    }

    public void stop() {
        if (task != null) {
            task.cancel();
            task = null;
        }
        bridge = null;
        connected = false;
    }

    public boolean isEnabled() {
        return bridge != null;
    }

    public boolean isConnected() {
        return connected;
    }

    public String serverId() {
        return serverId;
    }

    private void pollOnce() {
        if (!connected) {
            if (!bridge.connect()) return; // will retry on the next tick
            connected = true;
            plugin.getLogger().info("Connected to the Makong Network website as '" + serverId + "'.");
        }

        reportRankings();

        WebsiteBridge.PollResult result = bridge.poll();
        if (result == null) return; // network hiccup - just retry next tick
        knownServers = result.servers;

        if (!result.commands.isEmpty()) {
            Bukkit.getScheduler().runTask(plugin, () -> {
                for (WebsiteBridge.QueuedCommand cmd : result.commands) {
                    boolean ok;
                    String message;
                    try {
                        ok = Bukkit.dispatchCommand(Bukkit.getConsoleSender(), cmd.command);
                        message = ok ? "executed" : "command returned false";
                    } catch (Exception e) {
                        ok = false;
                        message = e.getMessage();
                    }
                    plugin.getLogger().info((ok ? "Ran" : "Failed to run") + " queued command: " + cmd.command);
                    boolean finalOk = ok;
                    String finalMessage = message;
                    Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> bridge.ack(cmd.id, finalOk, finalMessage));
                }
            });
        }

        for (WebsiteBridge.Ping ping : result.pings) {
            plugin.getLogger().info("Ping from '" + ping.from + "' - answering.");
            bridge.pong(ping.from, ping.id);
        }

        for (WebsiteBridge.Pong pong : result.pongs) {
            String msg = "Pong from '" + pong.from + "'!";
            plugin.getLogger().info(msg);
            Set<CommandSender> waiting = pendingPings.remove(pong.from);
            if (waiting != null) {
                Bukkit.getScheduler().runTask(plugin, () -> waiting.forEach(s -> s.sendMessage(msg)));
            }
        }

        for (WebsiteBridge.ProfileAnswer answer : result.profileAnswers) {
            Consumer<Map<String, Object>> onAnswer = pendingProfileRequests.remove(answer.id);
            if (onAnswer != null) {
                plugin.getLogger().info("/profile: got an answer for request " + answer.id + " from '" + answer.from + "': " + answer.data);
                Bukkit.getScheduler().runTask(plugin, () -> onAnswer.accept(answer.data));
            } else {
                plugin.getLogger().info("/profile: got an answer for request " + answer.id + " from '" + answer.from + "', but it already timed out or was already handled - ignoring.");
            }
        }
    }

    // Sent every poll tick so the public Ranking page can show this server's
    // real Team/MaTier Star standings live - see MakongWeb/lib/pluginBridge.js
    // and the "Website Bridge" section of this project's README. Capped at
    // the top 50 of each (well past what the page ever displays) so the
    // payload stays small; the player list's rank index is taken from the
    // full sorted() list before truncating, since tierForRanked()'s M1
    // top-10-only cap depends on the true rank, not the truncated one.
    private static final int RANKINGS_MAX_ENTRIES = 50;

    private void reportRankings() {
        List<Team> teams = new ArrayList<>(plugin.teams().all());
        teams.sort(Comparator.comparingLong(Team::stars).reversed());
        List<Map<String, Object>> teamsPayload = new ArrayList<>();
        for (Team team : teams.subList(0, Math.min(RANKINGS_MAX_ENTRIES, teams.size()))) {
            Map<String, Object> t = new LinkedHashMap<>();
            t.put("name", team.name());
            t.put("star", team.stars());
            teamsPayload.add(t);
        }

        List<Database.PlayerStar> players = plugin.matier().sorted();
        List<Map<String, Object>> playersPayload = new ArrayList<>();
        for (int i = 0; i < players.size() && i < RANKINGS_MAX_ENTRIES; i++) {
            Database.PlayerStar p = players.get(i);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("name", p.name());
            m.put("star", p.stars());
            m.put("tier", plugin.matier().tierForRanked(i, p.stars()));
            playersPayload.add(m);
        }

        bridge.reportRankings(teamsPayload, playersPayload);
    }

    /** Used by /makongcore ping &lt;server-id&gt;. */
    public void ping(String target, CommandSender sender) {
        if (bridge == null) {
            sender.sendMessage("The website bridge is not configured.");
            return;
        }
        pendingPings.computeIfAbsent(target, k -> ConcurrentHashMap.newKeySet()).add(sender);
        Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> bridge.ping(target));
    }

    /**
     * Used by Discord's /profile command (AccountLinkService) - asks the
     * connected Velocity companion for nLogin registration/last-login data
     * and true whole-network online status for `playerName`, relayed
     * through the website exactly like ping()/pong() above. `onAnswer` is
     * always eventually called on the main thread, with an empty map if
     * there's no bridge/Velocity connected or the request times out
     * without an answer (`timeoutMillis`, rounded up to whole ticks).
     */
    public void requestProfile(String playerName, Consumer<Map<String, Object>> onAnswer, long timeoutMillis) {
        if (bridge == null || !connected) {
            plugin.getLogger().info("/profile " + playerName + ": website bridge not connected - skipping network lookup.");
            onAnswer.accept(Map.of());
            return;
        }
        List<WebsiteBridge.ServerInfo> servers = knownServers;
        String velocityId = servers.stream()
                .filter(s -> "velocity".equals(s.kind))
                .map(s -> s.serverId)
                .findFirst()
                .orElse(null);
        if (velocityId == null) {
            plugin.getLogger().info("/profile " + playerName + ": no connected 'velocity' server in the last poll (saw: "
                    + servers.stream().map(s -> s.serverId + "/" + s.kind).toList() + ") - skipping network lookup.");
            onAnswer.accept(Map.of());
            return;
        }
        Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> {
            String requestId = bridge.requestProfile(velocityId, playerName);
            if (requestId == null) {
                plugin.getLogger().warning("/profile " + playerName + ": POST /api/plugin/profile-request to the website failed.");
                Bukkit.getScheduler().runTask(plugin, () -> onAnswer.accept(Map.of()));
                return;
            }
            plugin.getLogger().info("/profile " + playerName + ": requested from '" + velocityId + "' (request " + requestId + "), waiting for an answer...");
            pendingProfileRequests.put(requestId, onAnswer);
            Bukkit.getScheduler().runTaskLater(plugin, () -> {
                Consumer<Map<String, Object>> stillPending = pendingProfileRequests.remove(requestId);
                if (stillPending != null) {
                    plugin.getLogger().warning("/profile " + playerName + ": request " + requestId + " to '" + velocityId + "' timed out with no answer.");
                    stillPending.accept(Map.of());
                }
            }, Math.max(1, timeoutMillis / 50));
        });
    }
}
