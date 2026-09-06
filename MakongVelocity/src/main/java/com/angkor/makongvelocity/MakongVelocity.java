package com.angkor.makongvelocity;

import com.angkor.makongvelocity.web.WebsiteBridge;
import com.google.common.io.ByteArrayDataOutput;
import com.google.common.io.ByteStreams;
import com.google.inject.Inject;
import com.nickuc.login.api.enums.AccountType;
import com.nickuc.login.api.event.velocity.auth.AuthenticateEvent;
import com.nickuc.login.api.nLoginAPI;
import com.nickuc.login.api.types.AccountData;
import com.nickuc.login.api.types.Identity;
import com.velocitypowered.api.event.Subscribe;
import com.velocitypowered.api.event.player.ServerConnectedEvent;
import com.velocitypowered.api.event.proxy.ProxyInitializeEvent;
import com.velocitypowered.api.event.proxy.ProxyShutdownEvent;
import com.velocitypowered.api.command.CommandSource;
import com.velocitypowered.api.plugin.Plugin;
import com.velocitypowered.api.plugin.annotation.DataDirectory;
import com.velocitypowered.api.proxy.Player;
import com.velocitypowered.api.proxy.ProxyServer;
import com.velocitypowered.api.proxy.messages.MinecraftChannelIdentifier;
import com.velocitypowered.api.scheduler.ScheduledTask;
import net.kyori.adventure.text.Component;
import org.slf4j.Logger;

import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Velocity companion to the MakongCore Paper plugin - see README.md. Two
 * independent features, both optional and off unless configured:
 *
 * 1. Forwards nLogin's premium/cracked/bedrock classification (nLogin must be
 *    installed on this proxy in "proxy mode") to whichever backend a player
 *    connects to, so MakongCore's account linking trusts it instead of
 *    guessing via a Mojang API lookup.
 * 2. Connects to the Makong Network website bridge (same protocol MakongCore
 *    itself uses) purely to relay /mc autorestart <seconds> to every
 *    connected backend at once.
 */
@Plugin(id = "makongvelocity", name = "MakongVelocity", version = "1.2.0", authors = {"Angkor"})
public final class MakongVelocity {

    static final MinecraftChannelIdentifier ACCOUNT_TYPE_CHANNEL = MinecraftChannelIdentifier.create("makong", "accounttype");

    private final ProxyServer server;
    private final Logger logger;
    private final Path dataDirectory;
    private final Map<UUID, String> pendingAccountTypes = new ConcurrentHashMap<>();
    // Command senders currently waiting on a pong from a given target server
    // id, so /mc ping can report back to whoever asked - mirrors
    // MakongCore's WebsiteBridgeService#ping on the Paper side exactly.
    private final Map<String, Set<CommandSource>> pendingPings = new ConcurrentHashMap<>();

    private VelocityConfig config;
    private WebsiteBridge bridge;
    private volatile boolean connected;
    private volatile List<WebsiteBridge.ServerInfo> knownServers = List.of();
    private ScheduledTask pollTask;

    @Inject
    public MakongVelocity(ProxyServer server, Logger logger, @DataDirectory Path dataDirectory) {
        this.server = server;
        this.logger = logger;
        this.dataDirectory = dataDirectory;
    }

    @Subscribe
    public void onProxyInitialize(ProxyInitializeEvent event) {
        try {
            config = VelocityConfig.loadOrCreate(dataDirectory);
        } catch (Exception e) {
            logger.error("Failed to load config.properties", e);
            config = null;
            return;
        }

        server.getChannelRegistrar().register(ACCOUNT_TYPE_CHANNEL);
        server.getCommandManager().register(
                server.getCommandManager().metaBuilder("mc").build(),
                new MakongCommand(this));

        if (config.websiteEnabled()) startWebsiteBridge();
    }

    @Subscribe
    public void onProxyShutdown(ProxyShutdownEvent event) {
        if (pollTask != null) pollTask.cancel();
    }

    // Fires once per successful login, however the player authenticated
    // (premium session, password, Bedrock/Floodgate) - nLogin has already
    // recorded the account's type by the time this fires, so a single lookup
    // here covers every case instead of juggling nLogin's separate
    // PremiumLoginEvent/BedrockLoginEvent/LoginEvent classes.
    @Subscribe
    public void onAuthenticate(AuthenticateEvent event) {
        if (config == null || !config.forwardAccountType()) return;
        nLoginAPI api = nLoginAPI.getApi();
        if (api == null || !api.isAvailable()) return;

        Player player = event.getPlayer();
        Identity identity = Identity.ofKnownName(player.getUsername());
        AccountType accountType = api.getAccount(identity).map(AccountData::getType).orElse(null);
        if (accountType == null) return;
        String type = switch (accountType) {
            case BEDROCK -> "bedrock";
            case PREMIUM -> "java";
            case OFFLINE -> "cracked";
        };
        pendingAccountTypes.put(player.getUniqueId(), type);
    }

    // The account-type lookup above happens before the player is connected
    // to any backend - forward it once they actually land on one, using
    // their own connection (works even if that backend currently has no
    // other players online).
    @Subscribe
    public void onServerConnected(ServerConnectedEvent event) {
        String type = pendingAccountTypes.remove(event.getPlayer().getUniqueId());
        if (type == null) return;
        ByteArrayDataOutput out = ByteStreams.newDataOutput();
        out.writeUTF(event.getPlayer().getUsername());
        out.writeUTF(event.getPlayer().getUniqueId().toString());
        out.writeUTF(type);
        event.getPlayer().sendPluginMessage(ACCOUNT_TYPE_CHANNEL, out.toByteArray());
    }

    private void startWebsiteBridge() {
        String url = config.websiteUrl();
        String secret = config.websiteSecret();
        if (url.isBlank() || secret.isBlank() || secret.equals("change-me")) {
            logger.warn("config.properties: website.url / website.secret are not set - the website bridge is disabled.");
            return;
        }
        bridge = new WebsiteBridge(url, secret, config.serverId(), "velocity", logger::info, logger::warn);
        long intervalSeconds = config.pollIntervalSeconds();
        pollTask = server.getScheduler().buildTask(this, this::pollOnce)
                .delay(Duration.ofSeconds(1))
                .repeat(Duration.ofSeconds(intervalSeconds))
                .schedule();
        logger.info("Website bridge starting - server id '" + config.serverId() + "', polling every " + intervalSeconds + "s.");
    }

    private void pollOnce() {
        if (!connected) {
            if (!bridge.connect()) return; // will retry on the next tick
            connected = true;
            logger.info("Connected to the Makong Network website as '" + config.serverId() + "'.");
        }
        WebsiteBridge.PollResult result = bridge.poll();
        if (result == null) return; // network hiccup - just retry next tick
        knownServers = result.servers;

        for (WebsiteBridge.QueuedCommand cmd : result.commands) {
            // Nothing on the proxy itself currently queues console commands
            // for it, but ack anyway so the website's admin panel doesn't
            // show it stuck pending forever if that ever changes.
            bridge.ack(cmd.id, false, "MakongVelocity does not execute proxy console commands");
        }
        for (WebsiteBridge.Ping ping : result.pings) {
            bridge.pong(ping.from, ping.id);
        }
        for (WebsiteBridge.Pong pong : result.pongs) {
            String msg = "Pong from '" + pong.from + "'!";
            logger.info(msg);
            Set<CommandSource> waiting = pendingPings.remove(pong.from);
            if (waiting != null) waiting.forEach(s -> s.sendMessage(Component.text(msg)));
        }
    }

    /** Every currently-connected MakongCore backend (excludes this proxy itself). */
    List<WebsiteBridge.ServerInfo> knownBackends() {
        List<WebsiteBridge.ServerInfo> servers = knownServers;
        return servers.stream().filter(s -> !"velocity".equals(s.kind)).toList();
    }

    /** Used by /mc ping <server-id>. */
    void ping(String target, CommandSource sender) {
        pendingPings.computeIfAbsent(target, k -> ConcurrentHashMap.newKeySet()).add(sender);
        server.getScheduler().buildTask(this, () -> bridge.ping(target)).schedule();
    }

    /** Used by /mc clients - purely local proxy state, no website bridge involved. */
    ProxyServer proxyServer() {
        return server;
    }

    WebsiteBridge bridge() {
        return bridge;
    }

    boolean bridgeEnabled() {
        return bridge != null;
    }

    Logger logger() {
        return logger;
    }
}
