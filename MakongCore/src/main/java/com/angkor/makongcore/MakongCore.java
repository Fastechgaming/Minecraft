package com.angkor.makongcore;

import com.angkor.makongcore.command.AdminCommand;
import com.angkor.makongcore.command.TeamAdminCommand;
import com.angkor.makongcore.command.TeamCommand;
import com.angkor.makongcore.config.Settings;
import com.angkor.makongcore.config.ModuleConfig;
import com.angkor.makongcore.config.ConfigUpdater;
import com.angkor.makongcore.service.MaTierService;
import com.angkor.makongcore.service.MaTierAuraService;
import com.angkor.makongcore.service.AccountLinkService;
import com.angkor.makongcore.command.MaTierCommand;
import com.angkor.makongcore.command.MaLinkCommand;
import com.angkor.makongcore.data.Database;
import com.angkor.makongcore.gui.GuiManager;
import com.angkor.makongcore.hook.FloodgateHook;
import com.angkor.makongcore.hook.MaTierPlaceholders;
import com.angkor.makongcore.hook.TeamPlaceholders;
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
    private ModuleConfig verificationConfig;
    private WebsiteBridgeService websiteBridge;
    private TeamPlaceholders teamPlaceholders;
    private MaTierPlaceholders matierPlaceholders;

    // Ships the bundled default the first time (fresh install), or - for an
    // existing file - splices in any key the bundled default has that the
    // on-disk file doesn't (a newer MakongCore version added it since this
    // server last updated). Comments, formatting and every existing value
    // are left untouched either way - see ConfigUpdater for how.
    private void syncBundledFile(String name) {
        java.io.File file = new java.io.File(getDataFolder(), name);
        if (!file.exists()) { saveResource(name, false); return; }
        try (java.io.InputStream in = getResource(name)) {
            if (in != null) ConfigUpdater.update(file, in, getLogger());
        } catch (java.io.IOException e) {
            getLogger().warning("Could not check " + name + " for missing config keys: " + e.getMessage());
        }
    }

    // Same idea as syncBundledFile(), but for config.yml specifically -
    // that one goes through Bukkit's own getConfig()/reloadConfig() rather
    // than a ModuleConfig, so a successful update needs a reloadConfig()
    // afterward to actually pick up what was just written to disk.
    private void syncConfig() {
        java.io.File file = new java.io.File(getDataFolder(), "config.yml");
        try (java.io.InputStream in = getResource("config.yml")) {
            if (in != null && ConfigUpdater.update(file, in, getLogger())) reloadConfig();
        } catch (java.io.IOException e) {
            getLogger().warning("Could not check config.yml for missing config keys: " + e.getMessage());
        }
    }

    @Override public void onEnable() {
        saveDefaultConfig();
        syncConfig();
        syncBundledFile("messages.yml");
        syncBundledFile("gui.yml");
        syncBundledFile("module/team.yml");
        syncBundledFile("module/matier.yml");
        syncBundledFile("module/autorestart.yml");
        syncBundledFile("module/verification.yml");
        teamConfig=new ModuleConfig(getDataFolder(),"team.yml");
        matierConfig=new ModuleConfig(getDataFolder(),"matier.yml");
        autoRestartConfig=new ModuleConfig(getDataFolder(),"autorestart.yml");
        verificationConfig=new ModuleConfig(getDataFolder(),"verification.yml");
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
        // Wipes any stale registration left over from a previous
        // registerRuntime() call (reload) - Messenger accumulates listeners
        // per channel rather than replacing them, and accountLinks below is
        // about to be recreated.
        getServer().getMessenger().unregisterIncomingPluginChannel(this);
        TeamCommand tc=new TeamCommand(this,teams,gui);
        getCommand("team").setExecutor(tc);getCommand("team").setTabCompleter(tc);
        TeamAdminCommand tac=new TeamAdminCommand(this,teams);
        getCommand("mateam").setExecutor(tac);getCommand("mateam").setTabCompleter(tac);
        matier=new MaTierService(this,database,matierConfig.get());
        matierAura=new MaTierAuraService(this,matier);
        MaTierCommand mc=new MaTierCommand(this,matier);
        getCommand("matier").setExecutor(mc); getCommand("matier").setTabCompleter(mc);
        accountLinks=new AccountLinkService(this,database,floodgate,verificationConfig.get());
        getServer().getPluginManager().registerEvents(accountLinks,this);
        // Lets the optional MakongVelocity companion (see ../MakongVelocity)
        // forward nLogin's premium/cracked/bedrock classification for a
        // player straight to this server on join, skipping this service's
        // own best-effort Mojang API guess entirely when it's available.
        getServer().getMessenger().registerIncomingPluginChannel(this,"makong:accounttype",accountLinks);
        MaLinkCommand mlc=new MaLinkCommand(this,accountLinks);
        getCommand("malink").setExecutor(mlc); getCommand("malink").setTabCompleter(mlc);
        AdminCommand ac=new AdminCommand(this,teams,tac,mc,matier,accountLinks,mlc);
        getCommand("makongcore").setExecutor(ac);getCommand("makongcore").setTabCompleter(ac);
        getCommand("verify").setExecutor((sender,command,label,args)->{if(!(sender instanceof org.bukkit.entity.Player p)){sender.sendMessage("Players only.");return true;}accountLinks.optionalLink(p);return true;});
        getServer().getPluginManager().registerEvents(matier,this);

        getServer().getPluginManager().registerEvents(new GuiListener(this,teams,gui),this);
        getServer().getPluginManager().registerEvents(new ChatListener(this,teams),this);
        getServer().getPluginManager().registerEvents(new com.angkor.makongcore.listener.TeamPvpListener(teams),this);
        matierAura.start();
        accountLinks.start();
        weeklyRewards=new WeeklyRewardService(this,teams); weeklyRewards.start();
        teamStats=new TeamStatsListener(this,teams); getServer().getPluginManager().registerEvents(teamStats,this); teamStats.start();
        autoRestart=new AutoRestartService(this,autoRestartConfig.get()); autoRestart.start();
        matier.start();
        websiteBridge=new WebsiteBridgeService(this,getConfig()); websiteBridge.start();
        registerPlaceholders();
        getLogger().info("MakongCore enabled. Teams loaded: "+teams.all().size());
    }

    // Optional PlaceholderAPI integration (%team_tag%, %team_star%, %matier%,
    // %matier_star% - see the hook classes). No-op if PlaceholderAPI isn't
    // installed. Re-registering on every registerRuntime() call (including
    // reloads) matters: teams/matier are recreated on each reload, and a
    // stale expansion instance would keep querying the old, now-discarded
    // service objects forever.
    private void registerPlaceholders() {
        if (getServer().getPluginManager().getPlugin("PlaceholderAPI") == null) return;
        if (teamPlaceholders != null) teamPlaceholders.unregister();
        if (matierPlaceholders != null) matierPlaceholders.unregister();
        teamPlaceholders = new TeamPlaceholders(teams, teamConfig);
        matierPlaceholders = new MaTierPlaceholders(matier);
        teamPlaceholders.register();
        matierPlaceholders.register();
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
        reloadConfig();syncConfig();syncBundledFile("messages.yml");syncBundledFile("gui.yml");syncBundledFile("module/team.yml");syncBundledFile("module/matier.yml");
        syncBundledFile("module/autorestart.yml");syncBundledFile("module/verification.yml");
        teamConfig.reload();matierConfig.reload();autoRestartConfig.reload();verificationConfig.reload();
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

    // Modules that can be safely reloaded on their own, without the full
    // reload's database reconnect and team-data reload - both just re-read
    // their YAML and swap it into the still-running service (team's Settings
    // snapshot, autorestart's stop/recreate/start), no event listeners or
    // other services depend on the object identity being replaced.
    private static final java.util.Set<String> LIGHTWEIGHT_MODULES = java.util.Set.of("team", "autorestart");
    private static final java.util.Set<String> KNOWN_MODULES = java.util.Set.of("team", "autorestart", "matier", "verification", "gui");

    /** Used by /makongcore reload &lt;module&gt; (see AdminCommand) - and so, relayed, by MakongVelocity's /mcvlc reload &lt;module&gt;. */
    public void reloadModule(String module, CommandSender sender) {
        if(!Bukkit.isPrimaryThread()){Bukkit.getScheduler().runTask(this,()->reloadModule(module,sender));return;}
        String m = module.toLowerCase(java.util.Locale.ROOT);
        if(!KNOWN_MODULES.contains(m)){
            sendAdmin(sender,"<red>Unknown module '"+module+"'. Valid: team, autorestart, matier, verification, gui.</red>");
            return;
        }
        if(!LIGHTWEIGHT_MODULES.contains(m)){
            // matier/verification are registered event listeners and gui backs
            // the open GUI manager - swapping their config in isolation would
            // need the same listener re-registration dance the full reload
            // already does safely, so just do that instead of duplicating it.
            sendAdmin(sender,"<yellow>'"+m+"' needs a full reload to apply safely - reloading everything...</yellow>");
            reloadMakongCore(sender);
            return;
        }
        switch(m){
            case "team" -> {
                teamConfig.reload();
                if(teams!=null) teams.updateSettings(Settings.load(teamConfig.get()));
            }
            case "autorestart" -> {
                autoRestartConfig.reload();
                if(autoRestart!=null) autoRestart.stop();
                autoRestart=new AutoRestartService(this,autoRestartConfig.get());
                autoRestart.start();
            }
        }
        sendAdmin(sender,"<green>Reloaded module <white>"+m+"</white>.</green>");
    }

    private void sendAdmin(CommandSender s,String m){s.sendMessage(Text.mm("<green>[ᴍᴀᴛᴇᴀᴍ]</green> "+m));}
    @Override public void onDisable(){HandlerList.unregisterAll(this);if(teamStats!=null)teamStats.stop();if(autoRestart!=null)autoRestart.stop();if(matierAura!=null)matierAura.stop();if(accountLinks!=null)accountLinks.stop();if(websiteBridge!=null)websiteBridge.stop();if(teamPlaceholders!=null)teamPlaceholders.unregister();if(matierPlaceholders!=null)matierPlaceholders.unregister();if(database!=null)database.close();}
    public TeamService teams(){return teams;} public GuiManager gui(){return gui;} public FloodgateHook floodgate(){return floodgate;} public ModuleConfig teamConfig(){return teamConfig;} public ModuleConfig matierConfig(){return matierConfig;} public MaTierService matier(){return matier;} public WebsiteBridgeService websiteBridge(){return websiteBridge;} public AutoRestartService autoRestart(){return autoRestart;}
}
