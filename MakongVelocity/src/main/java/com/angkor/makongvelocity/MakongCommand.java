package com.angkor.makongvelocity;

import com.angkor.makongvelocity.web.WebsiteBridge;
import com.velocitypowered.api.command.SimpleCommand;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;

import java.util.List;

/**
 * /mc - the website-bridge-relayed commands MakongVelocity offers:
 * - /mc ping <server-id> mirrors MakongCore's own /mateam ping.
 * - /mc autorestart <seconds> fans a restart warning out to every
 *   connected backend at once - see AdminCommand#autorestart on the Paper
 *   side and MakongVelocity's README for the intended panel-scheduling use.
 */
final class MakongCommand implements SimpleCommand {
    private final MakongVelocity plugin;

    MakongCommand(MakongVelocity plugin) {
        this.plugin = plugin;
    }

    @Override
    public void execute(Invocation invocation) {
        String[] args = invocation.arguments();
        if (args.length < 1) {
            invocation.source().sendMessage(Component.text("Usage: /mc <ping|autorestart> ...", NamedTextColor.RED));
            return;
        }
        if (!plugin.bridgeEnabled()) {
            invocation.source().sendMessage(Component.text("The website bridge is not configured - see config.properties.", NamedTextColor.RED));
            return;
        }
        switch (args[0].toLowerCase(java.util.Locale.ROOT)) {
            case "ping" -> ping(invocation, args);
            case "autorestart" -> autorestart(invocation, args);
            default -> invocation.source().sendMessage(Component.text("Usage: /mc <ping|autorestart> ...", NamedTextColor.RED));
        }
    }

    private void ping(Invocation invocation, String[] args) {
        if (args.length < 2) {
            invocation.source().sendMessage(Component.text("Usage: /mc ping <server-id>", NamedTextColor.RED));
            return;
        }
        invocation.source().sendMessage(Component.text("Pinging " + args[1] + "..."));
        plugin.ping(args[1], invocation.source());
    }

    private void autorestart(Invocation invocation, String[] args) {
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

    @Override
    public boolean hasPermission(Invocation invocation) {
        return invocation.source().hasPermission("makongvelocity.admin");
    }
}
