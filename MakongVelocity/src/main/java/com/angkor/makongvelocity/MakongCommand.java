package com.angkor.makongvelocity;

import com.angkor.makongvelocity.web.WebsiteBridge;
import com.velocitypowered.api.command.SimpleCommand;
import com.velocitypowered.api.proxy.server.RegisteredServer;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

/**
 * /mc - MakongVelocity's own commands:
 * - /mc clients checks every backend actually running MakongCore (i.e.
 *   currently connected to the website bridge) is reachable right now (a
 *   real status ping, not just "the bridge saw a heartbeat recently") and
 *   reports each one's live player count. Requires the website bridge to be
 *   configured - that's the only source of truth this proxy has for which
 *   of its velocity.toml servers actually run MakongCore.
 * - /mc ping <server-id> mirrors MakongCore's own /mateam ping, relayed
 *   through the website bridge.
 * - /mc autorestart <seconds> fans a restart warning out to every backend
 *   connected to the website bridge at once - see AdminCommand#autorestart
 *   on the Paper side and MakongVelocity's README for the intended
 *   panel-scheduling use.
 */
final class MakongCommand implements SimpleCommand {
    private static final int BOX_WIDTH = 70;
    private static final Duration PING_TIMEOUT = Duration.ofSeconds(5);

    private final MakongVelocity plugin;

    MakongCommand(MakongVelocity plugin) {
        this.plugin = plugin;
    }

    @Override
    public void execute(Invocation invocation) {
        String[] args = invocation.arguments();
        if (args.length < 1) {
            usage(invocation);
            return;
        }
        switch (args[0].toLowerCase(Locale.ROOT)) {
            case "clients" -> clients(invocation);
            case "ping" -> ping(invocation, args);
            case "autorestart" -> autorestart(invocation, args);
            default -> usage(invocation);
        }
    }

    private void usage(Invocation invocation) {
        invocation.source().sendMessage(Component.text("Usage: /mc <clients|ping|autorestart> ...", NamedTextColor.RED));
    }

    private void clients(Invocation invocation) {
        if (!requireBridge(invocation)) return;

        // refreshKnownServersNow() is a blocking HTTP call (same as
        // ping()/autorestart()'s), so the whole thing runs off the command
        // thread. It gets knownBackends() as fresh as this proxy can make
        // it - otherwise this command would be reading a server list up to
        // website.poll_interval_seconds stale from the last scheduled tick.
        plugin.proxyServer().getScheduler().buildTask(plugin, () -> {
            plugin.refreshKnownServersNow();
            clientsAfterRefresh(invocation);
        }).schedule();
    }

    private void clientsAfterRefresh(Invocation invocation) {
        // The website bridge's live roster is the only source of truth for
        // "which of my velocity.toml servers actually run MakongCore" - a
        // plain Velocity ping can't tell a MakongCore backend apart from any
        // other server the proxy happens to route to (auth, lobby-hub,
        // build, test, ...). Match by serverId against velocity.toml's own
        // server names, since that's what a MakongCore backend's config.yml
        // website.server_id is meant to line up with.
        java.util.Set<String> makongCoreIds = new java.util.HashSet<>();
        for (WebsiteBridge.ServerInfo backend : plugin.knownBackends()) {
            makongCoreIds.add(backend.serverId.toLowerCase(Locale.ROOT));
        }

        List<RegisteredServer> servers = plugin.proxyServer().getAllServers().stream()
                .filter(s -> makongCoreIds.contains(s.getServerInfo().getName().toLowerCase(Locale.ROOT)))
                .sorted(Comparator.comparing(s -> s.getServerInfo().getName(), String.CASE_INSENSITIVE_ORDER))
                .collect(java.util.stream.Collectors.toList());

        if (servers.isEmpty()) {
            invocation.source().sendMessage(Component.text(
                    "No MakongCore backends are currently connected to the website bridge.", NamedTextColor.RED));
            return;
        }

        List<CompletableFuture<Boolean>> checks = new ArrayList<>();
        for (RegisteredServer server : servers) {
            checks.add(server.ping()
                    .orTimeout(PING_TIMEOUT.toSeconds(), TimeUnit.SECONDS)
                    .handle((ping, error) -> error == null));
        }

        CompletableFuture.allOf(checks.toArray(new CompletableFuture<?>[0])).whenComplete((v, error) -> {
            int reachable = 1; // the proxy itself, always - this command only runs because it's up
            StringBuilder sb = new StringBuilder();
            sb.append('\n').append(box("CLIENTS")).append('\n');
            List<String> lines = new ArrayList<>();
            lines.add("✔ velocity");
            for (int i = 0; i < servers.size(); i++) {
                RegisteredServer server = servers.get(i);
                boolean ok = Boolean.TRUE.equals(checks.get(i).getNow(false));
                if (ok) reachable++;
                lines.add((ok ? "✔ " : "✖ ") + server.getServerInfo().getName()
                        + " · " + server.getServerInfo().getAddress()
                        + " · " + server.getPlayersConnected().size() + " players");
            }
            sb.append("Summary\n");
            sb.append("Connected: ").append(reachable).append('\n').append('\n');
            sb.append("Sections\n");
            for (String line : lines) sb.append(line).append('\n');
            invocation.source().sendMessage(Component.text(sb.toString()));
        });
    }

    private static String box(String title) {
        String top = "╔" + "═".repeat(BOX_WIDTH) + "╗";
        String bottom = "╚" + "═".repeat(BOX_WIDTH) + "╝";
        int pad = Math.max(0, BOX_WIDTH - title.length());
        int left = pad / 2, right = pad - left;
        String middle = "║" + " ".repeat(left) + title + " ".repeat(right) + "║";
        return top + "\n" + middle + "\n" + bottom;
    }

    private void ping(Invocation invocation, String[] args) {
        if (!requireBridge(invocation)) return;
        if (args.length < 2) {
            invocation.source().sendMessage(Component.text("Usage: /mc ping <server-id>", NamedTextColor.RED));
            return;
        }
        invocation.source().sendMessage(Component.text("Pinging " + args[1] + "..."));
        plugin.ping(args[1], invocation.source());
    }

    private void autorestart(Invocation invocation, String[] args) {
        if (!requireBridge(invocation)) return;
        if (args.length < 2) {
            invocation.source().sendMessage(Component.text("Usage: /mc autorestart <seconds>", NamedTextColor.RED));
            return;
        }
        long seconds;
        try {
            seconds = Long.parseLong(args[1]);
        } catch (NumberFormatException e) {
            invocation.source().sendMessage(Component.text("Seconds must be a whole number.", NamedTextColor.RED));
            return;
        }

        WebsiteBridge bridge = plugin.bridge();
        List<WebsiteBridge.ServerInfo> backends = plugin.knownBackends();
        if (backends.isEmpty()) {
            invocation.source().sendMessage(Component.text("No MakongCore backends are currently connected to the website bridge.", NamedTextColor.RED));
            return;
        }

        // Sends to every backend right now and waits to find out whether
        // each one actually took it - no queue-and-hope. queueCommand()
        // itself is a blocking HTTP call (same as ping()'s), so this runs
        // off the command thread.
        plugin.proxyServer().getScheduler().buildTask(plugin, () -> {
            List<String> sent = new ArrayList<>();
            List<String> failed = new ArrayList<>();
            for (WebsiteBridge.ServerInfo backend : backends) {
                boolean ok = bridge.queueCommand(backend.serverId, "makongcore autorestart " + seconds);
                (ok ? sent : failed).add(backend.serverId);
            }
            if (!sent.isEmpty()) {
                invocation.source().sendMessage(Component.text(
                        "Sent " + seconds + "s restart warning to: " + String.join(", ", sent), NamedTextColor.GREEN));
            }
            if (!failed.isEmpty()) {
                invocation.source().sendMessage(Component.text("Failed: " + String.join(", ", failed), NamedTextColor.RED));
            }
        }).schedule();
    }

    private boolean requireBridge(Invocation invocation) {
        if (plugin.bridgeEnabled()) return true;
        invocation.source().sendMessage(Component.text("The website bridge is not configured - see config.properties.", NamedTextColor.RED));
        return false;
    }

    @Override
    public boolean hasPermission(Invocation invocation) {
        return invocation.source().hasPermission("makongvelocity.admin");
    }
}
