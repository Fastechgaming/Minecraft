package com.angkor.makongcore.command;

import com.angkor.makongcore.MakongCore;
import com.angkor.makongcore.model.Team;
import com.angkor.makongcore.service.AccountLinkService;
import com.angkor.makongcore.service.MaTierService;
import com.angkor.makongcore.service.TeamService;
import com.angkor.makongcore.util.Text;
import org.bukkit.Bukkit;
import org.bukkit.command.*;
import java.util.*;
import java.util.concurrent.CompletableFuture;

// /makongcore's (and its /macore alias's) handler - the GLOBAL, all-features
// admin command. Server-wide actions (reload/info/list/ping/autorestart/
// reset) are handled directly here; team, MaTier and account-link admin
// subcommands are delegated to TeamAdminCommand (/mateam's own handler),
// MaTierCommand (/matier's own handler) and MaLinkCommand (/malink's own
// handler) respectively, so that logic lives in exactly one place each -
// /mateam, /matier and /malink stay scoped to their own module only, while
// this command reaches everything.
public final class AdminCommand implements CommandExecutor, TabCompleter {
    private final MakongCore plugin;
    private final TeamService teams;
    private final TeamAdminCommand teamAdmin;
    private final MaTierCommand maTier;
    private final MaTierService matierService;
    private final AccountLinkService links;
    private final MaLinkCommand maLink;

    public AdminCommand(MakongCore plugin, TeamService teams, TeamAdminCommand teamAdmin, MaTierCommand maTier, MaTierService matierService, AccountLinkService links, MaLinkCommand maLink) {
        this.plugin = plugin;
        this.teams = teams;
        this.teamAdmin = teamAdmin;
        this.maTier = maTier;
        this.matierService = matierService;
        this.links = links;
        this.maLink = maLink;
    }

    private void send(CommandSender s, String message) {
        s.sendMessage(Text.mm("<green>[ᴍᴀᴋᴏɴɢᴄᴏʀᴇ]</green> " + message));
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (!sender.hasPermission("makongcore.admin")) {
            send(sender, "<red>You don't have permission to use this command.</red>");
            return true;
        }

        if (args.length == 0 || args[0].equalsIgnoreCase("help")) {
            help(sender);
            return true;
        }

        String sub = args[0].toLowerCase(Locale.ROOT);
        if (sub.equals("matier")) {
            maTier.onCommand(sender, command, label, Arrays.copyOfRange(args, 1, args.length));
            return true;
        }
        if (sub.equals("malink")) {
            maLink.onCommand(sender, command, label, Arrays.copyOfRange(args, 1, args.length));
            return true;
        }
        if (TeamAdminCommand.handles(sub)) {
            teamAdmin.onCommand(sender, command, label, args);
            return true;
        }

        switch (sub) {
            case "reload" -> reload(sender, args);
            case "info" -> info(sender);
            case "list" -> list(sender);
            case "ping" -> ping(sender, args);
            case "autorestart" -> autorestart(sender, args);
            case "reset" -> reset(sender, args);
            default -> send(sender, "<red>Unknown command. Use <yellow>/makongcore help</yellow>.</red>");
        }
        return true;
    }

    private void help(CommandSender s) {
        send(s, """
                <gray><bold>MakongCore Global Admin Commands</bold>
                <yellow>/makongcore reload [module]</yellow> <gray>- Reload everything, or just team|autorestart|matier|verification|gui
                <yellow>/makongcore info</yellow> <gray>- Plugin/database/team statistics
                <yellow>/makongcore list</yellow> <gray>- List all teams
                <yellow>/makongcore ping <server-id></yellow> <gray>- Ping another server on the website bridge
                <yellow>/makongcore autorestart <seconds|stop></yellow> <gray>- Broadcast a countdown and restart this server after it elapses, or cancel a pending one
                <yellow>/makongcore reset <mateam|matier|verification|all> confirm</yellow> <gray>- <red>Irreversible.</red> Wipes that module's data entirely - see help output for exactly what
                <gray>Team admin (team/disband/forcejoin/forceleave/addstars/setstars) works here too - see <yellow>/mateam help</yellow>
                <yellow>/makongcore matier <...></yellow> <gray>- Everything /matier's admin subcommands do - see <yellow>/matier</yellow>
                <yellow>/makongcore malink <...></yellow> <gray>- Everything /malink does - see <yellow>/malink help</yellow>""");
    }

    private static final Set<String> RESET_SCOPES = Set.of("mateam", "matier", "verification", "all");

    private void reset(CommandSender s, String[] args) {
        if (args.length < 2 || !RESET_SCOPES.contains(args[1].toLowerCase(Locale.ROOT))) {
            send(s, "<red>Usage: /makongcore reset <mateam|matier|verification|all> confirm</red>");
            return;
        }
        String scope = args[1].toLowerCase(Locale.ROOT);
        if (args.length < 3 || !args[2].equalsIgnoreCase("confirm")) {
            send(s, "<red><bold>This cannot be undone.</bold></red> <gray>" + resetWarning(scope)
                    + " Run <yellow>/makongcore reset " + scope + " confirm</yellow> to actually do it.</gray>");
            return;
        }
        List<CompletableFuture<Void>> ops = new ArrayList<>();
        if (scope.equals("mateam") || scope.equals("all")) ops.add(teams.disbandAll());
        if (scope.equals("matier") || scope.equals("all")) ops.add(matierService.wipeAll());
        if (scope.equals("verification") || scope.equals("all")) ops.add(links.resetAllLinks());
        CompletableFuture.allOf(ops.toArray(CompletableFuture[]::new)).whenComplete((v, err) ->
                Bukkit.getScheduler().runTask(plugin, () -> {
                    if (err != null) {
                        send(s, "<red>Reset failed: " + err.getMessage() + "</red>");
                        return;
                    }
                    send(s, "<green>Reset complete for <white>" + scope + "</white>.</green>");
                }));
    }

    private String resetWarning(String scope) {
        return switch (scope) {
            case "mateam" -> "This disbands EVERY team - all teams, members, allies and Stars, gone.";
            case "matier" -> "This wipes ALL MaTier data - every player's Stars AND every season's tier-history record, gone.";
            case "verification" -> "This unlinks EVERY player's Discord/Telegram account.";
            case "all" -> "This disbands every team, wipes all MaTier data, AND unlinks every player - everything, gone.";
            default -> "";
        };
    }

    private void reload(CommandSender s, String[] args) {
        if (args.length < 2) {
            plugin.reloadMakongCore(s);
            return;
        }
        plugin.reloadModule(args[1], s);
    }

    private void info(CommandSender s) {
        long members = teams.all().stream().mapToLong(t -> t.members().size()).sum();
        String bridge = !plugin.websiteBridge().isEnabled() ? "disabled"
                : plugin.websiteBridge().isConnected() ? "connected as '" + plugin.websiteBridge().serverId() + "'"
                : "not connected yet";
        send(s, "<gray>Teams: <white>" + teams.all().size()
                + " <gray>| Members: <white>" + members
                + " <gray>| Floodgate: <white>" + (plugin.floodgate().isAvailable() ? "enabled" : "not detected")
                + " <gray>| Website bridge: <white>" + bridge);
    }

    private void ping(CommandSender s, String[] args) {
        if (!plugin.websiteBridge().isEnabled()) {
            send(s, "<red>The website bridge is not configured - see config.yml's website: section.</red>");
            return;
        }
        if (args.length < 2) {
            send(s, "<red>Usage: /makongcore ping <server-id></red>");
            return;
        }
        send(s, "<gray>Pinging <white>" + args[1] + "</white>...");
        plugin.websiteBridge().ping(args[1], s);
    }

    private void autorestart(CommandSender s, String[] args) {
        if (args.length < 2) {
            send(s, "<red>Usage: /makongcore autorestart <seconds|stop></red>");
            return;
        }
        if (args[1].equalsIgnoreCase("stop")) {
            boolean cancelled = plugin.autoRestart().cancelAdHocRestart();
            send(s, cancelled ? "<green>Ad-hoc autorestart cancelled.</green>" : "<yellow>No ad-hoc autorestart is currently pending.</yellow>");
            return;
        }
        long seconds;
        try {
            seconds = Long.parseLong(args[1]);
        } catch (NumberFormatException e) {
            send(s, "<red>Seconds must be a whole number (or 'stop').</red>");
            return;
        }
        plugin.autoRestart().triggerAdHocRestart(seconds);
        send(s, "<green>Restarting in <white>" + seconds + "s</white>.</green>");
    }

    private void list(CommandSender s) {
        if (teams.all().isEmpty()) {
            send(s, "<gray>No teams exist.");
            return;
        }
        send(s, "<gray>Teams (" + teams.all().size() + "):");
        teams.all().stream()
                .sorted(Comparator.comparing(Team::name, String.CASE_INSENSITIVE_ORDER))
                .forEach(t -> s.sendMessage(Text.mm(" <dark_gray>• <white>" + t.tag() + " <gray>- <white>" +
                        t.name() + " <gray>(" + t.members().size() + "/" + teams.settings().maxSize() + ")")));
    }

    @Override
    public List<String> onTabComplete(CommandSender sender, Command command, String alias, String[] args) {
        if (!sender.hasPermission("makongcore.admin")) return List.of();
        if (args.length == 1) {
            return List.of("help", "reload", "info", "list", "ping", "autorestart", "reset", "matier", "malink",
                    "team", "disband", "forcejoin", "forceleave", "addstars", "givestars", "givestar", "setstars")
                    .stream().filter(x -> x.startsWith(args[0].toLowerCase(Locale.ROOT))).toList();
        }
        if (args.length == 2 && args[0].equalsIgnoreCase("reload")) {
            return List.of("team", "autorestart", "matier", "verification", "gui")
                    .stream().filter(x -> x.startsWith(args[1].toLowerCase(Locale.ROOT))).toList();
        }
        if (args.length == 2 && args[0].equalsIgnoreCase("autorestart")) {
            return List.of("stop").stream().filter(x -> x.startsWith(args[1].toLowerCase(Locale.ROOT))).toList();
        }
        if (args.length == 2 && args[0].equalsIgnoreCase("reset")) {
            return RESET_SCOPES.stream().filter(x -> x.startsWith(args[1].toLowerCase(Locale.ROOT))).sorted().toList();
        }
        if (args.length == 3 && args[0].equalsIgnoreCase("reset") && RESET_SCOPES.contains(args[1].toLowerCase(Locale.ROOT))) {
            return List.of("confirm").stream().filter(x -> x.startsWith(args[2].toLowerCase(Locale.ROOT))).toList();
        }
        if (args[0].equalsIgnoreCase("matier")) {
            return maTier.onTabComplete(sender, command, alias, Arrays.copyOfRange(args, 1, args.length));
        }
        if (args[0].equalsIgnoreCase("malink")) {
            return maLink.onTabComplete(sender, command, alias, Arrays.copyOfRange(args, 1, args.length));
        }
        if (TeamAdminCommand.handles(args[0])) {
            return teamAdmin.onTabComplete(sender, command, alias, args);
        }
        return List.of();
    }
}
