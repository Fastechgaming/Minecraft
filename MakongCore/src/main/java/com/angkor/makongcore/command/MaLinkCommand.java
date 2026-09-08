package com.angkor.makongcore.command;

import com.angkor.makongcore.MakongCore;
import com.angkor.makongcore.data.Database;
import com.angkor.makongcore.service.AccountLinkService;
import com.angkor.makongcore.util.Text;
import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.bukkit.command.*;
import org.bukkit.entity.Player;
import java.util.*;

// /malink - account-linking admin actions. Separate from /mateam and
// /matier's own admin surfaces since this is about the verification
// module, not either of theirs; reachable globally too via
// /makongcore malink <...> (see AdminCommand).
public final class MaLinkCommand implements CommandExecutor, TabCompleter {
    private final MakongCore plugin;
    private final AccountLinkService links;

    public MaLinkCommand(MakongCore plugin, AccountLinkService links) {
        this.plugin = plugin;
        this.links = links;
    }

    private void send(CommandSender s, String message) {
        s.sendMessage(Text.mm("<green>[ᴍᴀʟɪɴᴋ]</green> " + message));
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
        switch (args[0].toLowerCase(Locale.ROOT)) {
            case "reset" -> reset(sender, args);
            case "bypass" -> bypass(sender, args, true);
            case "unbypass" -> bypass(sender, args, false);
            case "bypasslist" -> bypassList(sender);
            default -> send(sender, "<red>Unknown command. Use <yellow>/malink help</yellow>.</red>");
        }
        return true;
    }

    private void help(CommandSender s) {
        send(s, """
                <gray><bold>MakongCore Account-Link Admin Commands</bold>
                <yellow>/malink reset <player></yellow> <gray>- Unlink their Discord/Telegram; if they're online, re-checks them for verification immediately
                <yellow>/malink bypass <player></yellow> <gray>- Let a cracked player skip the linking requirement entirely
                <yellow>/malink unbypass <player></yellow> <gray>- Remove a player's bypass
                <yellow>/malink bypasslist</yellow> <gray>- List every currently-bypassed player""");
    }

    private void reset(CommandSender s, String[] args) {
        if (args.length < 2) {
            send(s, "<red>Usage: /malink reset <player></red>");
            return;
        }
        OfflinePlayer target = Bukkit.getOfflinePlayer(args[1]);
        Player online = Bukkit.getPlayerExact(args[1]);
        links.resetLink(target.getUniqueId(), online);
        String name = target.getName() == null ? args[1] : target.getName();
        send(s, "<green>Unlinked <white>" + name + "</white>." + (online != null ? " <gray>(online - re-checking them now)</gray>" : "") + "</green>");
    }

    private void bypass(CommandSender s, String[] args, boolean add) {
        if (args.length < 2) {
            send(s, "<red>Usage: /malink " + (add ? "bypass" : "unbypass") + " <player></red>");
            return;
        }
        OfflinePlayer target = Bukkit.getOfflinePlayer(args[1]);
        String name = target.getName() == null ? args[1] : target.getName();
        if (add) {
            links.addBypass(target.getUniqueId(), name).thenRun(() -> Bukkit.getScheduler().runTask(plugin,
                    () -> send(s, "<green><white>" + name + "</white> can now play without linking.</green>")));
        } else {
            links.removeBypass(target.getUniqueId()).thenAccept(removed -> Bukkit.getScheduler().runTask(plugin,
                    () -> send(s, removed ? "<green><white>" + name + "</white>'s bypass was removed.</green>" : "<yellow><white>" + name + "</white> wasn't bypassed.</yellow>")));
        }
    }

    private void bypassList(CommandSender s) {
        links.listBypass().thenAccept(list -> Bukkit.getScheduler().runTask(plugin, () -> {
            if (list.isEmpty()) {
                send(s, "<gray>No players are currently bypassed.");
                return;
            }
            send(s, "<gray>Bypassed players (" + list.size() + "):");
            for (Database.BypassEntry e : list) {
                s.sendMessage(Text.mm(" <dark_gray>• <white>" + e.name()));
            }
        }));
    }

    @Override
    public List<String> onTabComplete(CommandSender sender, Command command, String alias, String[] args) {
        if (!sender.hasPermission("makongcore.admin")) return List.of();
        if (args.length == 1) {
            return List.of("help", "reset", "bypass", "unbypass", "bypasslist")
                    .stream().filter(x -> x.startsWith(args[0].toLowerCase(Locale.ROOT))).toList();
        }
        if (args.length == 2 && List.of("reset", "bypass", "unbypass").contains(args[0].toLowerCase(Locale.ROOT))) {
            return Bukkit.getOnlinePlayers().stream().map(Player::getName)
                    .filter(x -> x.toLowerCase(Locale.ROOT).startsWith(args[1].toLowerCase(Locale.ROOT))).sorted().toList();
        }
        return List.of();
    }
}
