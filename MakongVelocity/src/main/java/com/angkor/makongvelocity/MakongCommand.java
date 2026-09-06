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
 * - /mc clients checks every backend configured in velocity.toml is actually
 *   reachable right now (a real status ping, not just "is it in the config")
 *   and reports each one's live player count - a quick "is everything
 *   connected properly" health check. Purely local to this proxy, works
 *   without the website bridge configured at all.
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
        List<RegisteredServer> servers = new ArrayList<>(plugin.proxyServer().getAllServers());
        servers.sort(Comparator.comparing(s -> s.getServerInfo().getName(), String.CASE_INSENSITIVE_ORDER));

        // This is every server velocity.toml routes to - reachability here
        // is a plain Minecraft status ping and has nothing to do with
        // MakongCore. Cross-reference the website bridge's own live roster
        // (only servers that actually registered with the shared secret) so
        // it's obvious which of these are MakongCore backends versus other
        // servers on the network (auth, lobby-hub, build, test, ...) that
        // just happen to also be reachable.
        java.util.Set<String> makongCoreIds = new java.util.HashSet<>();
        if (plugin.bridgeEnabled()) {
            for (WebsiteBridge.ServerInfo backend : plugin.knownBackends()) {
                makongCoreIds.add(backend.serverId.toLowerCase(Locale.ROOT));
            }
        }

        List<CompletableFuture<Boolean>> checks = new ArrayList<>();
        for (RegisteredServer server : servers) {
            checks.add(server.ping()
                    .orTimeout(PING_TIMEOUT.toSeconds(), TimeUnit.SECONDS)
                    .handle((ping, error) -> error == null));
        }

        CompletableFuture.allOf(checks.toArray(new CompletableFuture<?>[0])).whenComplete((v, error) -> {
            int reachable = 1; // the proxy itself, always - this command only runs because it's up
            int makongCoreCount = 0;
            StringBuilder sb = new StringBuilder();
            sb.append('\n').append(box("CLIENTS")).append('\n');
            List<String> lines = new ArrayList<>();
            lines.add("✔ velocity");
            for (int i = 0; i < servers.size(); i++) {
                RegisteredServer server = servers.get(i);
                boolean ok = Boolean.TRUE.equals(checks.get(i).getNow(false));
                if (ok) reachable++;
                boolean hasMakongCore = makongCoreIds.contains(server.getServerInfo().getName().toLowerCase(Locale.ROOT));
                if (hasMakongCore) makongCoreCount++;
                lines.add((ok ? "✔ " : "✖ ") + server.getServerInfo().getName()
                        + " · " + server.getServerInfo().getAddress()
                        + " · " + server.getPlayersConnected().size() + " players"
                        + (hasMakongCore ? " · MakongCore" : ""));
            }
            sb.append("Summary\n");
            sb.append("Connected: ").append(reachable).append('\n');
            sb.append(plugin.bridgeEnabled()
                    ? "MakongCore: " + makongCoreCount + "/" + servers.size() + " (only these are tagged - the rest are other servers on your network with no MakongCore/website bridge)\n"
                    : "MakongCore: unknown - this proxy's own website bridge isn't configured, so it can't tell which backends run it\n");
            sb.append('\n');
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
        for (WebsiteBridge.ServerInfo backend : backends) {
            bridge.queueCommand(backend.serverId, "makongcore autorestart " + seconds);
        }
        invocation.source().sendMessage(Component.text(
                "Queued a " + seconds + "s restart warning for " + backends.size() + " server(s): "
                        + backends.stream().map(s -> s.serverId).reduce((a, b) -> a + ", " + b).orElse(""),
                NamedTextColor.GREEN));
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
