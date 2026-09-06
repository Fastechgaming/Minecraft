package network.makong.core.velocity;

import com.velocitypowered.api.command.CommandSource;
import com.velocitypowered.api.command.SimpleCommand;
import com.velocitypowered.api.proxy.ConsoleCommandSource;
import net.kyori.adventure.text.Component;

public final class MakongCommand implements SimpleCommand {

  private final MakongCoreVelocityPlugin plugin;

  public MakongCommand(MakongCoreVelocityPlugin plugin) {
    this.plugin = plugin;
  }

  @Override
  public void execute(Invocation invocation) {
    CommandSource source = invocation.source();
    String[] args = invocation.arguments();
    if (args.length == 0) {
      source.sendMessage(Component.text("Usage: /makong <status|ping <server-id>>"));
      return;
    }
    switch (args[0].toLowerCase()) {
      case "status" -> source.sendMessage(Component.text("MakongCore: server id '" + plugin.serverId() + "', " +
          (plugin.isConnected() ? "connected" : "not connected yet")));
      case "ping" -> {
        if (args.length < 2) {
          source.sendMessage(Component.text("Usage: /makong ping <server-id>"));
          return;
        }
        source.sendMessage(Component.text("Pinging '" + args[1] + "'..."));
        plugin.sendPing(args[1], source);
      }
      default -> source.sendMessage(Component.text("Usage: /makong <status|ping <server-id>>"));
    }
  }

  @Override
  public boolean hasPermission(Invocation invocation) {
    return invocation.source() instanceof ConsoleCommandSource
        || invocation.source().hasPermission("makongcore.admin");
  }
}
