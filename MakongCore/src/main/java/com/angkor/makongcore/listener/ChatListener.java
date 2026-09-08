package com.angkor.makongcore.listener;

import com.angkor.makongcore.MakongCore;
import com.angkor.makongcore.model.Team;
import com.angkor.makongcore.service.TeamService;
import com.angkor.makongcore.util.Text;
import org.bukkit.entity.Player;
import net.kyori.adventure.text.Component;
import org.bukkit.event.*;
import org.bukkit.event.player.AsyncPlayerChatEvent;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public final class ChatListener implements Listener {
    private static final Set<UUID> TEAM_CHAT=ConcurrentHashMap.newKeySet();
    private static final Map<UUID,Step> INPUT=new ConcurrentHashMap<>();
    private static final Map<UUID,String> DATA=new ConcurrentHashMap<>();
    private enum Step{TAG,NAME,DESCRIPTION,CHANGE_TAG}
    private final MakongCore plugin; private final TeamService ts;

    public ChatListener(MakongCore plugin,TeamService ts){this.plugin=plugin;this.ts=ts;}
    public static void toggle(UUID u){if(!TEAM_CHAT.add(u))TEAM_CHAT.remove(u);}
    public static boolean enabled(UUID u){return TEAM_CHAT.contains(u);}
    // Name first, then tag, then (once the team actually exists) color via
    // the GUI color-picker createAsync() opens at the end - matches how a
    // player naturally thinks about a team ("what's it called" before
    // "what's its short tag").
    public static void beginCreate(Player p){
        INPUT.put(p.getUniqueId(),Step.NAME);
        p.sendTitle("team name","type your team name in chat.",10,60,10);
        p.sendMessage(Text.mm("<yellow>enter your team name <gray>("+tsLengthPlaceholderName()+"), or type <white>cancel</white>.</yellow>"));
    }
    private static String tsLengthPlaceholder(){return "2-5 characters";}
    private static String tsLengthPlaceholderName(){return "3-15 characters";}
    private static void showTagPrompt(Player p){
        p.sendTitle("team tag","type your team tag in chat.",10,60,10);
        p.sendMessage(Text.mm("<yellow>set name: <white>"+DATA.getOrDefault(p.getUniqueId(),"")+"</white>"));
        p.sendMessage(Text.mm("<yellow>enter your team tag <gray>("+tsLengthPlaceholder()+"), or type <white>cancel</white>.</yellow>"));
    }
    public static void beginDescription(Player p){INPUT.put(p.getUniqueId(),Step.DESCRIPTION);p.sendMessage(Text.mm("<yellow>Enter your team description, or type <white>cancel</white>.</yellow>"));}
    public static void beginChangeTag(Player p){INPUT.put(p.getUniqueId(),Step.CHANGE_TAG);p.sendMessage(Text.mm("<yellow>Enter your new team tag, or type <white>cancel</white>.</yellow>"));}
    public static void cancel(UUID u){INPUT.remove(u);DATA.remove(u);}

    @EventHandler(priority=EventPriority.HIGHEST,ignoreCancelled=true)
    public void chat(AsyncPlayerChatEvent e){
        Player p=e.getPlayer(); UUID u=p.getUniqueId(); Step step=INPUT.get(u);
        if(step!=null){
            e.setCancelled(true); String m=e.getMessage().trim();
            if(m.equalsIgnoreCase("cancel")){cancel(u);p.sendMessage(Text.mm("<gray>Cancelled.</gray>"));return;}
            if(step==Step.NAME){
                if(m.length()<ts.settings().minName()){
                    p.sendMessage(Text.mm("<red>Name rejected: <white>too short; minimum is "+ts.settings().minName()+" characters.</white></red>"));return;
                }
                if(m.length()>ts.settings().maxName()){
                    p.sendMessage(Text.mm("<red>Name rejected: <white>too long; maximum is "+ts.settings().maxName()+" characters.</white></red>"));return;
                }
                DATA.put(u,m);INPUT.put(u,Step.TAG);showTagPrompt(p);return;
            }
            if(step==Step.TAG){
                if(!m.matches("[A-Za-z0-9_]+")){
                    p.sendMessage(Text.mm("<red>Tag rejected: <white>only A-Z, a-z, 0-9 and _ are allowed.</white></red>"));return;
                }
                if(m.length()<ts.settings().minTag()||m.length()>ts.settings().maxTag()){
                    p.sendMessage(Text.mm("<red>Tag rejected: <white>must be "+ts.settings().minTag()+"-"+ts.settings().maxTag()+" characters.</white></red>"));return;
                }
                if(ts.byTag(m)!=null){p.sendMessage(Text.mm("<red>That team tag is already in use.</red>"));return;}
                String name=DATA.remove(u);INPUT.remove(u);
                p.sendMessage(Text.mm("<yellow>set name: <white>"+name+"</white>"));
                p.sendMessage(Text.mm("<yellow>set tag: <white>"+m+"</white>"));
                p.sendMessage(Text.mm("<green>creating team...</green>"));
                createAsync(p,m,name);return;
            }
            if(step==Step.DESCRIPTION){
                Team t=ts.byPlayer(u);if(t==null){cancel(u);return;}
                if(m.length()>ts.settings().maxDescription()){p.sendMessage(Text.mm("<red>Description is too long.</red>"));return;}
                INPUT.remove(u);plugin.getServer().getScheduler().runTask(plugin,()->{Team current=ts.byPlayer(u);if(current==null)return;current.setDescription(m);ts.save(current);p.sendMessage(Text.mm("<green>Description updated.</green>"));plugin.gui().openSettings(p,current);});return;
            }
            if(step==Step.CHANGE_TAG){
                Team t=ts.byPlayer(u);if(t==null){cancel(u);return;}
                if(!m.matches("[A-Za-z0-9_]+")){
                    p.sendMessage(Text.mm("<red>Tag rejected: <white>only A-Z, a-z, 0-9 and _ are allowed.</white></red>"));return;
                }
                if(m.length()<ts.settings().minTag()||m.length()>ts.settings().maxTag()){
                    p.sendMessage(Text.mm("<red>Tag rejected: <white>must be "+ts.settings().minTag()+"-"+ts.settings().maxTag()+" characters.</white></red>"));return;
                }
                if(!m.equalsIgnoreCase(t.tag())&&ts.byTag(m)!=null){p.sendMessage(Text.mm("<red>That team tag is already in use.</red>"));return;}
                INPUT.remove(u);plugin.getServer().getScheduler().runTask(plugin,()->{Team current=ts.byPlayer(u);if(current==null)return;if(!ts.renameTag(current,m)){p.sendMessage(Text.mm("<red>That team tag is already in use.</red>"));return;}p.sendMessage(Text.mm("<green>Team tag changed to <white>"+m+"</white>.</green>"));plugin.gui().openSettings(p,current);});return;
            }
            return;
        }

        if(TEAM_CHAT.contains(u)){
            sendTeamChat(e,p);return;
        }
        if(ts.settings().chatPrefix()&&e.getMessage().startsWith(ts.settings().chatChar())){
            e.setCancelled(true);Team t=ts.byPlayer(u);if(t==null)return;
            String msg=e.getMessage().substring(ts.settings().chatChar().length()).trim();if(msg.isEmpty())return;
            broadcast(t,p,msg);
        }
    }

    private void sendTeamChat(AsyncPlayerChatEvent e,Player p){
        e.setCancelled(true);Team t=ts.byPlayer(p.getUniqueId());if(t==null){TEAM_CHAT.remove(p.getUniqueId());return;}broadcast(t,p,e.getMessage());
    }
    private void broadcast(Team t,Player sender,String msg){for(var m:t.members()){Player q=plugin.getServer().getPlayer(m.uuid());if(q!=null)q.sendMessage(Text.mm("<gray>[<aqua>Team</aqua>] <white>"+sender.getName()+"<gray>: <white>"+msg));}}
    private void createAsync(Player p,String tag,String name){
        plugin.getServer().getScheduler().runTask(plugin,()->{
            if(ts.byPlayer(p.getUniqueId())!=null){p.sendMessage(Text.mm("<red>you are already in a team.</red>"));return;}
            Team t=ts.create(p.getUniqueId(),tag,name,"aqua");
            if(t==null){p.sendMessage(Text.mm("<red>team could not be created. <white>check the server console for the database error.</white></red>"));return;}
            p.sendMessage(Text.mm("<green>Team created! Choose your team color.</green>"));
            plugin.gui().openColor(p,t);
        });
    }
}
