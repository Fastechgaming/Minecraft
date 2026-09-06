package com.angkor.makongcore.service;

import com.angkor.makongcore.MakongCore;
import com.angkor.makongcore.web.WebsiteBridge;
import org.bukkit.Bukkit;
import org.bukkit.command.CommandSender;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.scheduler.BukkitTask;

import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

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
            plugin.getLogger().warning("module/website.yml: website.url / website.secret are not set - the website bridge is disabled.");
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

        WebsiteBridge.PollResult result = bridge.poll();
        if (result == null) return; // network hiccup - just retry next tick

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
}
