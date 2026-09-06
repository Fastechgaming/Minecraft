package network.makong.store.velocity;

import com.google.inject.Inject;
import com.velocitypowered.api.command.CommandSource;
import com.velocitypowered.api.event.Subscribe;
import com.velocitypowered.api.event.proxy.ProxyInitializeEvent;
import com.velocitypowered.api.plugin.Plugin;
import com.velocitypowered.api.plugin.annotation.DataDirectory;
import com.velocitypowered.api.proxy.ProxyServer;
import net.kyori.adventure.text.Component;
import network.makong.store.common.WebsiteBridge;
import org.slf4j.Logger;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Properties;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Connects this proxy to the Makong Network website's multi-server command
 * bridge - see ../../../../../../MakongWeb/lib/pluginBridge.js and this
 * project's own README.md for the protocol and setup.
 *
 * Velocity has no access to backend-only plugins (LuckPerms, an economy
 * plugin, etc. all run on the backend servers, not here), so a queued
 * command only makes sense here if it's something the proxy itself can run
 * (/send, /alert, and the like). A command meant for a specific gamemode's
 * economy/permissions should be targeted at that backend's own server-id
 * instead of this proxy's.
 */
@Plugin(id = "makongstore", name = "MakongStore", version = "1.0.0",
    description = "Connects this proxy to the Makong Network website's multi-server command bridge.",
    authors = {"Makong Network"})
public final class MakongStoreVelocityPlugin {

  private final ProxyServer proxy;
  private final Logger logger;
  private final Path dataDirectory;

  private WebsiteBridge bridge;
  private String serverId;
  private volatile boolean connected = false;

  // See the matching field in the Paper plugin's MakongStorePlugin for why
  // this exists - best-effort feedback to whoever ran /makong ping.
  private final ConcurrentHashMap<String, Set<CommandSource>> pendingPings = new ConcurrentHashMap<>();

  @Inject
  public MakongStoreVelocityPlugin(ProxyServer proxy, Logger logger, @DataDirectory Path dataDirectory) {
    this.proxy = proxy;
    this.logger = logger;
    this.dataDirectory = dataDirectory;
  }

  @Subscribe
  public void onProxyInitialize(ProxyInitializeEvent event) {
    Properties config = loadConfig();

    String url = config.getProperty("website.url", "");
    String secret = config.getProperty("website.secret", "");
    serverId = config.getProperty("server-id", "proxy");
    long intervalSeconds = parseLong(config.getProperty("poll-interval-seconds", "5"), 5);

    if (url.isBlank() || secret.isBlank() || secret.equals("change-me")) {
      logger.warn("website.url / website.secret are not set in config.properties - MakongStore bridge is disabled.");
      return;
    }

    bridge = new WebsiteBridge(url, secret, serverId, "velocity", logger::info, logger::warn);

    proxy.getCommandManager().register(
        proxy.getCommandManager().metaBuilder("makong").build(),
        new MakongCommand(this)
    );

    proxy.getScheduler().buildTask(this, this::pollOnce)
        .delay(Duration.ofSeconds(1))
        .repeat(Duration.ofSeconds(intervalSeconds))
        .schedule();

    logger.info("MakongStore starting - server id '" + serverId + "', polling every " + intervalSeconds + "s.");
  }

  private void pollOnce() {
    if (!connected) {
      if (!bridge.connect()) return; // will retry on the next tick
      connected = true;
      logger.info("Connected to the Makong Network website as '" + serverId + "'.");
    }

    WebsiteBridge.PollResult result = bridge.poll();
    if (result == null) return; // network hiccup - just retry next tick

    for (WebsiteBridge.QueuedCommand cmd : result.commands) {
      boolean ok;
      String message;
      try {
        ok = proxy.getCommandManager().executeAsync(proxy.getConsoleCommandSource(), cmd.command).join();
        message = ok ? "executed" : "command returned false";
      } catch (Exception e) {
        ok = false;
        message = e.getMessage();
      }
      logger.info((ok ? "Ran" : "Failed to run") + " queued command: " + cmd.command);
      bridge.ack(cmd.id, ok, message);
    }

    for (WebsiteBridge.Ping ping : result.pings) {
      logger.info("Ping from '" + ping.from + "' - answering.");
      bridge.pong(ping.from, ping.id);
    }

    for (WebsiteBridge.Pong pong : result.pongs) {
      String msg = "Pong from '" + pong.from + "'!";
      logger.info(msg);
      Set<CommandSource> waiting = pendingPings.remove(pong.from);
      if (waiting != null) {
        Component component = Component.text(msg);
        waiting.forEach(s -> s.sendMessage(component));
      }
    }
  }

  void sendPing(String target, CommandSource source) {
    pendingPings.computeIfAbsent(target, k -> ConcurrentHashMap.newKeySet()).add(source);
    proxy.getScheduler().buildTask(this, () -> bridge.ping(target)).schedule();
  }

  String serverId() {
    return serverId;
  }

  boolean isConnected() {
    return connected;
  }

  private Properties loadConfig() {
    Properties props = new Properties();
    try {
      Files.createDirectories(dataDirectory);
      Path configFile = dataDirectory.resolve("config.properties");
      if (!Files.exists(configFile)) {
        String defaults = String.join("\n",
            "# MakongStore - connects this proxy to the Makong Network website.",
            "website.url=https://makongmc.com",
            "# Must match MAKONGSTORE_SECRET in the website's .env exactly.",
            "website.secret=change-me",
            "# A short id for this proxy - usually just \"proxy\".",
            "server-id=proxy",
            "# How often (in seconds) to check the website for new commands/pings.",
            "poll-interval-seconds=5",
            ""
        );
        Files.writeString(configFile, defaults);
      }
      try (var in = Files.newInputStream(configFile)) {
        props.load(in);
      }
    } catch (IOException e) {
      logger.warn("Could not read/create config.properties: " + e.getMessage());
    }
    return props;
  }

  private static long parseLong(String s, long fallback) {
    try {
      return Long.parseLong(s.trim());
    } catch (Exception e) {
      return fallback;
    }
  }
}
