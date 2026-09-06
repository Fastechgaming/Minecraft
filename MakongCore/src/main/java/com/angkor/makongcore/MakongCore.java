package com.angkor.makongcore;

import com.angkor.makongcore.command.AdminCommand;
import com.angkor.makongcore.command.TeamCommand;
import com.angkor.makongcore.config.Settings;
import com.angkor.makongcore.config.ModuleConfig;
import com.angkor.makongcore.service.MaTierService;
import com.angkor.makongcore.service.MaTierAuraService;
import com.angkor.makongcore.service.AccountLinkService;
import com.angkor.makongcore.command.MaTierCommand;
import com.angkor.makongcore.data.Database;
import com.angkor.makongcore.gui.GuiManager;
import com.angkor.makongcore.hook.FloodgateHook;
import com.angkor.makongcore.listener.ChatListener;
import com.angkor.makongcore.listener.GuiListener;
import com.angkor.makongcore.service.TeamService;
import com.angkor.makongcore.service.WeeklyRewardService;
import com.angkor.makongcore.service.AutoRestartService;
import com.angkor.makongcore.service.WebsiteBridgeService;
import com.angkor.makongcore.listener.TeamStatsListener;
import com.angkor.makongcore.util.Text;
import org.bukkit.Bukkit;
import org.bukkit.command.CommandSender;
import org.bukkit.event.HandlerList;
import org.bukkit.plugin.java.JavaPlugin;

public final class MakongCore extends JavaPlugin {
    private Database database;
    private TeamService teams;
    private GuiManager gui;
    private FloodgateHook floodgate;
    private WeeklyRewardService weeklyRewards;
    private ModuleConfig teamConfig;
    private ModuleConfig matierConfig;
    private ModuleConfig autoRestartConfig;
    private AutoRestartService autoRestart;
    private TeamStatsListener teamStats;
    private MaTierService matier;
    private MaTierAuraService matierAura;
    private AccountLinkService accountLinks;
    private ModuleConfig discordConfig;
    private ModuleConfig websiteConfig;
    private WebsiteBridgeService websiteBridge;

    private void saveBundledFileIfMissing(String name) {
        java.io.File file = new java.io.File(getDataFolder(), name);
        if (!file.exists()) saveResource(name, false);
    }

    @Override public void onEnable() {
        saveDefaultConfig();
        saveBundledFileIfMissing("messages.yml");
        saveBundledFileIfMissing("gui.yml");
        saveBundledFileIfMissing("module/team.yml");
        saveBundledFileIfMissing("module/matier.yml");
        saveBundledFileIfMissing("module/autorestart.yml");
        saveBundledFileIfMissing("module/discord.yml");
        saveBundledFileIfMissing("module/website.yml");
        teamConfig=new ModuleConfig(getDataFolder(),"team.yml");
        matierConfig=new ModuleConfig(getDataFolder(),"matier.yml");
        autoRestartConfig=new ModuleConfig(getDataFolder(),"autorestart.yml");
        discordConfig=new ModuleConfig(getDataFolder(),"discord.yml");
        websiteConfig=new ModuleConfig(getDataFolder(),"website.yml");
        initialize();
    }

    private void initialize() {
        floodgate=new FloodgateHook(this);
        if(floodgate.enable())getLogger().info("Floodgate detected: Bedrock support enabled.");
        else getLogger().info("Floodgate not detected: Java-only server detected; MakongCore remains fully functional.");

        try {
            database=new Database(getConfig(),getDataFolder());
            teams=new TeamService(database,Settings.load(teamConfig.get()));
            gui=new GuiManager(this,teams); weeklyRewards=null;
            teams.load().thenRun(()->Bukkit.getScheduler().runTask(this,this::registerRuntime));
        } catch(Exception e) {
            getLogger().severe("Database startup failed: "+e.getMessage());
            getServer().getPluginManager().disablePlugin(this);
        }
    }

    private void registerRuntime() {
        TeamCommand tc=new TeamCommand(this,teams,gui);
        getCommand("team").setExecutor(tc);getCommand("team").setTabCompleter(tc);
        AdminCommand ac=new AdminCommand(this,teams);
        getCommand("makongcore").setExecutor(ac);getCommand("makongcore").setTabCompleter(ac);
        matier=new MaTierService(this,database,matierConfig.get());
        matierAura=new MaTierAuraService(this,matier);
        MaTierCommand mc=new MaTierCommand(this,matier);
        getCommand("matier").setExecutor(mc); getCommand("matier").setTabCompleter(mc);
        getCommand("link").setExecutor((sender,command,label,args)->{if(!(sender instanceof org.bukkit.entity.Player p)){sender.sendMessage("Players only.");return true;}accountLinks.optionalLink(p);return true;});
        getServer().getPluginManager().registerEvents(matier,this);
        
        getServer().getPluginManager().registerEvents(new GuiListener(this,teams,gui),this);
        getServer().getPluginManager().registerEvents(new ChatListener(this,teams),this);
        matierAura.start();
        accountLinks=new AccountLinkService(this,database,floodgate,discordConfig.get());
        getServer().getPluginManager().registerEvents(accountLinks,this);
        accountLinks.start();
        weeklyRewards=new WeeklyRewardService(this,teams); weeklyRewards.start();
        teamStats=new TeamStatsListener(this,teams); getServer().getPluginManager().registerEvents(teamStats,this); teamStats.start();
        autoRestart=new AutoRestartService(this,autoRestartConfig.get()); autoRestart.start();
        matier.start();
        websiteBridge=new WebsiteBridgeService(this,websiteConfig.get()); websiteBridge.start();
        getLogger().info("MakongCore enabled. Teams loaded: "+teams.all().size());
    }

    public void reloadMakongCore(CommandSender sender) {
        if(!Bukkit.isPrimaryThread()){Bukkit.getScheduler().runTask(this,()->reloadMakongCore(sender));return;}
        sendAdmin(sender,"<yellow>Reloading MakongCore...</yellow>");
        HandlerList.unregisterAll(this);
        if(teamStats!=null) teamStats.stop();
        if(autoRestart!=null) autoRestart.stop();
        if(matierAura!=null) matierAura.stop();
        if(accountLinks!=null) accountLinks.stop();
        if(websiteBridge!=null) websiteBridge.stop();
        if(database!=null)database.close();
        reloadConfig();saveBundledFileIfMissing("messages.yml");saveBundledFileIfMissing("gui.yml");saveBundledFileIfMissing("module/team.yml");saveBundledFileIfMissing("module/matier.yml");
        saveBundledFileIfMissing("module/autorestart.yml");saveBundledFileIfMissing("module/discord.yml");saveBundledFileIfMissing("module/website.yml");
        teamConfig.reload();matierConfig.reload();autoRestartConfig.reload();discordConfig.reload();websiteConfig.reload();
        Bukkit.getScheduler().runTaskAsynchronously(this,()->{
            try {
                Database db=new Database(getConfig(),getDataFolder());
                TeamService ts=new TeamService(db,Settings.load(teamConfig.get()));ts.load().join();
                Bukkit.getScheduler().runTask(this,()->{
                    database=db;teams=ts;gui=new GuiManager(this,teams);gui.reloadConfig(); weeklyRewards=null; matier=new MaTierService(this,database,matierConfig.get());
        matierAura=new MaTierAuraService(this,matier);
                    floodgate=new FloodgateHook(this);floodgate.enable();registerRuntime();
                    sendAdmin(sender,"<green>MakongCore reloaded successfully. Teams loaded: <white>"+teams.all().size()+"</white>.</green>");
                });
            }catch(Exception e){getLogger().severe("Reload failed: "+e.getMessage());Bukkit.getScheduler().runTask(this,()->sendAdmin(sender,"<red>Reload failed: "+e.getMessage()+"</red>"));}
        });
    }

    private void sendAdmin(CommandSender s,String m){s.sendMessage(Text.mm("<green>[ᴍᴀᴛᴇᴀᴍ]</green> "+m));}
    @Override public void onDisable(){HandlerList.unregisterAll(this);if(teamStats!=null)teamStats.stop();if(autoRestart!=null)autoRestart.stop();if(matierAura!=null)matierAura.stop();if(accountLinks!=null)accountLinks.stop();if(websiteBridge!=null)websiteBridge.stop();if(database!=null)database.close();}
    public TeamService teams(){return teams;} public GuiManager gui(){return gui;} public FloodgateHook floodgate(){return floodgate;} public ModuleConfig teamConfig(){return teamConfig;} public ModuleConfig matierConfig(){return matierConfig;} public MaTierService matier(){return matier;} public WebsiteBridgeService websiteBridge(){return websiteBridge;}
}
