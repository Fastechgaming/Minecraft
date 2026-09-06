package network.makong.store.paper;

import network.makong.store.common.WebsiteBridge;
import org.bukkit.Bukkit;
import org.bukkit.command.CommandSender;
import org.bukkit.plugin.java.JavaPlugin;

import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Connects this server to the Makong Network website's multi-server command
 * bridge - see ../../../../../../MakongWeb/lib/pluginBridge.js and this
 * project's own README.md for the protocol and setup.
 */
public final class MakongStorePlugin extends JavaPlugin {

  private WebsiteBridge bridge;
  private String serverId;
  private volatile boolean connected = false;

  // Command senders currently waiting on a pong from a given target server
  // id, so `/makong ping <target>` can report back to whoever asked, not
  // just the console log. Best-effort - a sender who logs off before the
  // pong arrives (usually well under a second) just misses the reply; it's
  // still logged to console either way.
  private final ConcurrentHashMap<String, Set<CommandSender>> pendingPings = new ConcurrentHashMap<>();

  @Override
  public void onEnable() {
    saveDefaultConfig();

    String url = getConfig().getString("website.url", "");
    String secret = getConfig().getString("website.secret", "");
    serverId = getConfig().getString("server-id", "arcade");
    long intervalTicks = Math.max(1, getConfig().getLong("poll-interval-seconds", 5)) * 20L;

    if (url.isBlank() || secret.isBlank() || secret.equals("change-me")) {
      getLogger().warning("website.url / website.secret are not set in config.yml - MakongStore bridge is disabled.");
      return;
    }

    bridge = new WebsiteBridge(url, secret, serverId, "paper", getLogger()::info, getLogger()::warning);

    MakongCommand command = new MakongCommand(this);
    var makongCommand = getCommand("makong");
    if (makongCommand != null) {
      makongCommand.setExecutor(command);
      makongCommand.setTabCompleter(command);
    }

    Bukkit.getScheduler().runTaskTimerAsynchronously(this, this::pollOnce, 20L, intervalTicks);
    getLogger().info("MakongStore starting - server id '" + serverId + "', polling every " + (intervalTicks / 20) + "s.");
  }

  private void pollOnce() {
    if (!connected) {
      if (!bridge.connect()) return; // will retry on the next tick
      connected = true;
      getLogger().info("Connected to the Makong Network website as '" + serverId + "'.");
    }

    WebsiteBridge.PollResult result = bridge.poll();
    if (result == null) return; // network hiccup - just retry next tick

    if (!result.commands.isEmpty()) {
      Bukkit.getScheduler().runTask(this, () -> {
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
          getLogger().info((ok ? "Ran" : "Failed to run") + " queued command: " + cmd.command);
          boolean finalOk = ok;
          String finalMessage = message;
          Bukkit.getScheduler().runTaskAsynchronously(this, () -> bridge.ack(cmd.id, finalOk, finalMessage));
        }
      });
    }

    for (WebsiteBridge.Ping ping : result.pings) {
      getLogger().info("Ping from '" + ping.from + "' - answering.");
      bridge.pong(ping.from, ping.id);
    }

    for (WebsiteBridge.Pong pong : result.pongs) {
      String msg = "Pong from '" + pong.from + "'!";
      getLogger().info(msg);
      Set<CommandSender> waiting = pendingPings.remove(pong.from);
      if (waiting != null) {
        Bukkit.getScheduler().runTask(this, () -> waiting.forEach(s -> s.sendMessage(msg)));
      }
    }
  }

  void sendPing(String target, CommandSender sender) {
    pendingPings.computeIfAbsent(target, k -> ConcurrentHashMap.newKeySet()).add(sender);
    Bukkit.getScheduler().runTaskAsynchronously(this, () -> bridge.ping(target));
  }

  String serverId() {
    return serverId;
  }

  boolean isConnected() {
    return connected;
  }
}
