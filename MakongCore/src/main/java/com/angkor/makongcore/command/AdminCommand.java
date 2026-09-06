package com.angkor.makongcore.command;

import com.angkor.makongcore.MakongCore;
import com.angkor.makongcore.model.Team;
import com.angkor.makongcore.model.TeamMember;
import com.angkor.makongcore.model.TeamRole;
import com.angkor.makongcore.service.TeamService;
import com.angkor.makongcore.util.Text;
import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.bukkit.command.*;
import java.util.*;

public final class AdminCommand implements CommandExecutor, TabCompleter {
    private final MakongCore plugin;
    private final TeamService teams;

    public AdminCommand(MakongCore plugin, TeamService teams) {
        this.plugin = plugin;
        this.teams = teams;
    }

    private void send(CommandSender s, String message) {
        s.sendMessage(Text.mm("<green>[ᴍᴀᴛᴇᴀᴍ]</green> " + message));
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (!sender.hasPermission("mateam.admin")) {
            send(sender, "<red>You don't have permission to use this command.</red>");
            return true;
        }

        if (args.length == 0 || args[0].equalsIgnoreCase("help")) {
            help(sender);
            return true;
        }

        switch (args[0].toLowerCase(Locale.ROOT)) {
            case "reload" -> plugin.reloadMakongCore(sender);
            case "info" -> info(sender);
            case "list" -> list(sender);
            case "team" -> team(sender, args);
            case "disband" -> disband(sender, args);
            case "forcejoin" -> forceJoin(sender, args);
            case "forceleave" -> forceLeave(sender, args);
            case "addpoints", "addweeklypoints" -> points(sender, args, false);
            case "setpoints", "setweeklypoints" -> points(sender, args, true);
            case "addstars", "givestars", "givestar" -> stars(sender, args, false);
            case "setstars" -> stars(sender, args, true);
            case "ping" -> ping(sender, args);
            case "autorestart" -> autorestart(sender, args);
            default -> {
                send(sender, "<red>Unknown admin command. Use <yellow>/mateam help</yellow>.</red>");
            }
        }
        return true;
    }

    private void help(CommandSender s) {
        send(s, """
                <gray><bold>MakongCore Admin Commands</bold>
                <yellow>/mateam reload</yellow> <gray>- Reload MakongCore configuration and data
                <yellow>/mateam info</yellow> <gray>- Plugin/database/team statistics
                <yellow>/mateam list</yellow> <gray>- List all teams
                <yellow>/mateam team <tag></yellow> <gray>- Inspect a team
                <yellow>/mateam disband <tag></yellow> <gray>- Force disband a team
                <yellow>/mateam forcejoin <player> <tag></yellow> <gray>- Force a player into a team
                <yellow>/mateam forceleave <player></yellow> <gray>- Remove a player from their team
                <yellow>/mateam addweeklypoints <tag> <amount></yellow> <gray>- Add/subtract Weekly Points
                <yellow>/mateam setweeklypoints <tag> <amount></yellow> <gray>- Set Weekly Points
                <gray>/mateam addpoints and setpoints remain aliases
                <yellow>/mateam givestar <tag> <amount></yellow> <gray>- Give/remove Stars
                <yellow>/mateam setstars <tag> <amount></yellow> <gray>- Set Stars
                <yellow>/mateam ping <server-id></yellow> <gray>- Ping another server on the website bridge
                <yellow>/mateam autorestart <seconds></yellow> <gray>- Broadcast a countdown and restart this server after it elapses""");
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
            send(s, "<red>The website bridge is not configured - see module/website.yml.</red>");
            return;
        }
        if (args.length < 2) {
            send(s, "<red>Usage: /mateam ping <server-id></red>");
            return;
        }
        send(s, "<gray>Pinging <white>" + args[1] + "</white>...");
        plugin.websiteBridge().ping(args[1], s);
    }

    private void autorestart(CommandSender s, String[] args) {
        if (args.length < 2) {
            send(s, "<red>Usage: /mateam autorestart <seconds></red>");
            return;
        }
        long seconds;
        try {
            seconds = Long.parseLong(args[1]);
        } catch (NumberFormatException e) {
            send(s, "<red>Seconds must be a whole number.</red>");
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

    private void team(CommandSender s, String[] args) {
        if (args.length < 2) {
            send(s, "<red>Usage: /mateam team <tag></red>");
            return;
        }
        Team t = teams.byTag(args[1]);
        if (t == null) {
            send(s, "<red>Team not found.</red>");
            return;
        }
        send(s, "<aqua>" + t.name() + " <gray>[" + t.tag() + "]"
                + "\n<gray>ID: <white>" + t.id()
                + "\n<gray>Members: <white>" + t.members().size() + "/" + teams.settings().maxSize()
                + "\n<gray>Public: <white>" + t.isPublic()
                + "\n<gray>PvP: <white>" + t.pvp()
                + "\n<gray>Weekly Points: <white>" + t.points()
                + "\n<gray>Stars: <yellow>⭐ " + t.stars()
                + "\n<gray>Kills: <white>" + t.kills()
                + "\n<gray>Deaths: <white>" + t.deaths()
                + "\n<gray>Allies: <white>" + t.allies().size());
    }

    private void disband(CommandSender s, String[] args) {
        if (args.length < 2) {
            send(s, "<red>Usage: /mateam disband <tag></red>");
            return;
        }
        Team t = teams.byTag(args[1]);
        if (t == null) {
            send(s, "<red>Team not found.</red>");
            return;
        }
        teams.disband(t).thenRun(() -> Bukkit.getScheduler().runTask(plugin,
                () -> send(s, "<green>Team <white>" + t.tag() + "</white> was force-disbanded.</green>")));
    }

    private void forceJoin(CommandSender s, String[] args) {
        if (args.length < 3) {
            send(s, "<red>Usage: /mateam forcejoin <player> <tag></red>");
            return;
        }
        OfflinePlayer player = Bukkit.getOfflinePlayer(args[1]);
        Team target = teams.byTag(args[2]);
        if (target == null) {
            send(s, "<red>Team not found.</red>");
            return;
        }
        if (teams.byPlayer(player.getUniqueId()) != null) {
            send(s, "<red>That player is already in a team.</red>");
            return;
        }
        String name = player.getName() == null ? args[1] : player.getName();
        if (!teams.addMember(target, player.getUniqueId(), name, TeamRole.MEMBER)) {
            send(s, "<red>Could not add player. The team may be full.</red>");
            return;
        }
        send(s, "<green>Added <white>" + name + "</white> to <white>" + target.name() + "</white>.</green>");
    }

    private void forceLeave(CommandSender s, String[] args) {
        if (args.length < 2) {
            send(s, "<red>Usage: /mateam forceleave <player></red>");
            return;
        }
        OfflinePlayer player = Bukkit.getOfflinePlayer(args[1]);
        Team team = teams.byPlayer(player.getUniqueId());
        if (team == null) {
            send(s, "<red>That player is not in a team.</red>");
            return;
        }
        TeamMember member = team.member(player.getUniqueId());
        if (member.role() == TeamRole.OWNER) {
            send(s, "<red>The team owner cannot be force-left. Transfer ownership or disband the team.</red>");
            return;
        }
        teams.removeMember(team, player.getUniqueId());
        send(s, "<green>Removed <white>" + (player.getName() == null ? args[1] : player.getName()) + "</white> from <white>" + team.name() + "</white>.</green>");
    }

    private void points(CommandSender s, String[] args, boolean set) {
        if (args.length < 3) {
            send(s, "<red>Usage: /mateam " + (set ? "setpoints" : "addpoints") + " <tag> <amount></red>");
            return;
        }
        Team t = teams.byTag(args[1]);
        if (t == null) {
            send(s, "<red>Team not found.</red>");
            return;
        }
        final long amount;
        try {
            amount = Long.parseLong(args[2]);
        } catch (NumberFormatException e) {
            send(s, "<red>Amount must be a whole number.</red>");
            return;
        }
        long minimum = plugin.teamConfig().get().getLong("team.scoring.minimum_points", 0L);
        long value = set ? Math.max(minimum, amount) : Math.max(minimum, t.points() + amount);
        t.setStats(value, t.kills(), t.deaths(), t.playtime());
        teams.save(t);
        send(s, "<green>Team <white>" + t.tag() + "</white> points are now <white>" + value + "</white>.</green>");
    }

    private void stars(CommandSender s,String[] args,boolean set){
        if(args.length<3){send(s,"<red>Usage: /mateam "+(set?"setstars":"addstars")+" <tag> <amount></red>");return;}
        Team t=teams.byTag(args[1]);if(t==null){send(s,"<red>Team not found.</red>");return;}
        long amount;try{amount=Long.parseLong(args[2]);}catch(NumberFormatException e){send(s,"<red>Amount must be a whole number.</red>");return;}
        long value=set?Math.max(0,amount):Math.max(0,t.stars()+amount);
        t.setStars(value);teams.save(t);
        send(s,"<green>Team <white>"+t.tag()+"</white> Stars are now <yellow>⭐ "+value+"</gold>.</green>");
    }

    @Override
    public List<String> onTabComplete(CommandSender sender, Command command, String alias, String[] args) {
        if (!sender.hasPermission("mateam.admin")) return List.of();
        if (args.length == 1) {
            return List.of("help", "reload", "info", "list", "team", "disband", "forcejoin", "forceleave", "addweeklypoints", "setweeklypoints", "addpoints", "setpoints", "addstars", "givestars", "givestar", "setstars", "ping", "autorestart")
                    .stream().filter(x -> x.startsWith(args[0].toLowerCase(Locale.ROOT))).toList();
        }
        if (args.length == 2 && List.of("team", "disband", "addweeklypoints", "setweeklypoints", "addpoints", "setpoints", "addstars", "givestars", "givestar", "setstars").contains(args[0].toLowerCase(Locale.ROOT))) {
            return teams.all().stream().map(Team::tag).filter(x -> x.toLowerCase(Locale.ROOT).startsWith(args[1].toLowerCase(Locale.ROOT))).sorted().toList();
        }
        if (args.length == 2 && List.of("forcejoin", "forceleave").contains(args[0].toLowerCase(Locale.ROOT))) {
            return Bukkit.getOnlinePlayers().stream().map(org.bukkit.entity.Player::getName)
                    .filter(x -> x.toLowerCase(Locale.ROOT).startsWith(args[1].toLowerCase(Locale.ROOT))).sorted().toList();
        }
        return List.of();
    }
}
