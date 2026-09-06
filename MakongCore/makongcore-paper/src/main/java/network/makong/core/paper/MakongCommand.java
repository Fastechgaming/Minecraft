package network.makong.core.paper;

import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabCompleter;

import java.util.Collections;
import java.util.List;

public final class MakongCommand implements CommandExecutor, TabCompleter {

  private final MakongCorePlugin plugin;

  public MakongCommand(MakongCorePlugin plugin) {
    this.plugin = plugin;
  }

  @Override
  public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
    if (args.length == 0) {
      sender.sendMessage("Usage: /makong <status|ping <server-id>>");
      return true;
    }
    switch (args[0].toLowerCase()) {
      case "status" -> sender.sendMessage("MakongCore: server id '" + plugin.serverId() + "', " +
          (plugin.isConnected() ? "connected" : "not connected yet"));
      case "ping" -> {
        if (args.length < 2) {
          sender.sendMessage("Usage: /makong ping <server-id>");
          return true;
        }
        sender.sendMessage("Pinging '" + args[1] + "'...");
        plugin.sendPing(args[1], sender);
      }
      default -> sender.sendMessage("Usage: /makong <status|ping <server-id>>");
    }
    return true;
  }

  @Override
  public List<String> onTabComplete(CommandSender sender, Command command, String alias, String[] args) {
    if (args.length == 1) return List.of("status", "ping");
    return Collections.emptyList();
  }
}
