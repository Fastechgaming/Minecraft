package com.angkor.makongcore.service;

import com.angkor.makongcore.MakongCore;
import com.angkor.makongcore.data.Database;
import com.angkor.makongcore.util.Text;
import org.bukkit.Bukkit;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.PlayerDeathEvent;
import org.bukkit.event.player.PlayerJoinEvent;

import java.time.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public final class MaTierService implements Listener {
    // One shared palette for every tier badge (in-game text, PlaceholderAPI,
    // the website's Ranking page) so M9 (dull stone gray, "the beginning")
    // through M1 (pure Minecraft green, the top) always match, wherever a
    // tier gets shown. Not admin-configurable on purpose - see the website's
    // matching public/js/ranking.js TIER_COLORS, which has to be kept in
    // sync by hand since it's a different codebase; a config option here
    // would just be one more place the two could drift apart.
    public static final Map<String,String> TIER_HEX = Map.ofEntries(
            Map.entry("M9", "#AAAAAA"), Map.entry("M8", "#8B9A7A"),
            Map.entry("M7", "#6F9B4A"), Map.entry("M6", "#5FAF45"),
            Map.entry("M5", "#4CAF50"), Map.entry("M4", "#43A047"),
            Map.entry("M3", "#2E8B57"), Map.entry("M2", "#00A86B"),
            Map.entry("M1", "#55FF55"));
    public static String tierHex(String tier) { return TIER_HEX.getOrDefault(tier, TIER_HEX.get("M9")); }
    // Ready to splice into a MiniMessage template (e.g. replacing a {tier}
    // placeholder) - the tag pair colors just the tier text itself, so it
    // still nests correctly inside whatever surrounding tags the template
    // already has.
    public static String coloredTier(String tier) { String hex = tierHex(tier); return "<" + hex + ">" + tier + "</" + hex + ">"; }

    private final MakongCore plugin; private final Database db; private final FileConfiguration c;
    private final Map<UUID,Database.PlayerStar> players=new ConcurrentHashMap<>();
    private final Map<String,Long> farmCooldown=new ConcurrentHashMap<>();
    private volatile long lastResetCheck=0;
    public MaTierService(MakongCore plugin,Database db,FileConfiguration c){this.plugin=plugin;this.db=db;this.c=c;}
    public void start(){if(!c.getBoolean("matier.enabled",true))return; db.loadPlayers().thenAccept(m->{players.clear();players.putAll(m); Bukkit.getScheduler().runTask(plugin,this::checkReset);}); Bukkit.getScheduler().runTaskTimerAsynchronously(plugin,this::checkReset,20L,1200L);}
    private void checkReset(){long now=System.currentTimeMillis();if(now-lastResetCheck<30000)return;lastResetCheck=now;processInactivity(now);if(!c.getBoolean("matier.new_year_reset.enabled",true))return;ZonedDateTime z=ZonedDateTime.now();int month=c.getInt("matier.new_year_reset.month",1),day=c.getInt("matier.new_year_reset.day",1),hour=Math.max(0,Math.min(23,c.getInt("matier.new_year_reset.hour",0))),minute=Math.max(0,Math.min(59,c.getInt("matier.new_year_reset.minute",0)));if(z.getMonthValue()!=month||z.getDayOfMonth()<day)return;if(z.getDayOfMonth()==day && (z.getHour()<hour || (z.getHour()==hour&&z.getMinute()<minute)))return;int year=z.getYear();db.meta("matier_season_year").thenAccept(v->{if(String.valueOf(year).equals(v))return;Map<UUID,String> tiers=new HashMap<>();Map<UUID,Integer> ranks=new HashMap<>();List<Database.PlayerStar> list=sorted();for(int i=0;i<list.size();i++){Database.PlayerStar p=list.get(i);tiers.put(p.uuid(),tierForRanked(i,p.stars()));ranks.put(p.uuid(),i+1);}db.resetMatier(year,new HashMap<>(players),tiers,ranks).thenRun(()->{long resetNow=System.currentTimeMillis();players.replaceAll((u,p)->new Database.PlayerStar(p.uuid(),p.name(),0,resetNow,0)); Bukkit.getScheduler().runTask(plugin,()->Bukkit.getOnlinePlayers().forEach(p->p.sendMessage(msg("matier.messages.reset").replace("{year}",String.valueOf(year)))));});});}
    public long stars(UUID u){return players.getOrDefault(u,new Database.PlayerStar(u,"",0,0,0)).stars();}
 // matier.inactivity.floor_stars (default 150): inactivity decay never
 // takes a player below this floor, and does nothing at all once they're
 // already at or under it - it only ever reduces toward the floor, never
 // bumps a player who's already below it back up to it.
 private void processInactivity(long now){if(!c.getBoolean("matier.inactivity.enabled",true))return;long graceDays=Math.max(1,c.getLong("matier.inactivity.grace_days",7));long initial=Math.max(0,c.getLong("matier.inactivity.initial_penalty",50));long daily=Math.max(0,c.getLong("matier.inactivity.daily_penalty",10));long floor=Math.max(0,c.getLong("matier.inactivity.floor_stars",150));long dayMs=86400000L;for(Database.PlayerStar p:new ArrayList<>(players.values())){if(Bukkit.getPlayer(p.uuid())!=null||p.lastSeen()<=0)continue;long inactiveDays=(now-p.lastSeen())/dayMs;if(inactiveDays<graceDays)continue;long targetDays=Math.max(graceDays,inactiveDays);if(targetDays<=p.inactivityPenaltyDays())continue;long targetPenalty=initial+Math.max(0,targetDays-graceDays)*daily;long alreadyPenalty=initial+Math.max(0,p.inactivityPenaltyDays()-graceDays)*daily;long extra=Math.max(0,targetPenalty-alreadyPenalty);long nextStars=p.stars()<=floor?p.stars():Math.max(floor,p.stars()-extra);Database.PlayerStar np=new Database.PlayerStar(p.uuid(),p.name(),nextStars,p.lastSeen(),targetDays);players.put(p.uuid(),np);db.applyInactivity(p.uuid(),nextStars,p.lastSeen(),targetDays);}}
 @EventHandler public void onJoin(PlayerJoinEvent e){Player p=e.getPlayer();long now=System.currentTimeMillis();Database.PlayerStar old=players.getOrDefault(p.getUniqueId(),new Database.PlayerStar(p.getUniqueId(),p.getName(),0,now,0));Database.PlayerStar np=new Database.PlayerStar(p.getUniqueId(),p.getName(),old.stars(),now,0);players.put(p.getUniqueId(),np);db.touchPlayer(p.getUniqueId(),p.getName());}
    public String name(UUID u){Database.PlayerStar p=players.get(u);return p==null?Bukkit.getOfflinePlayer(u).getName():p.name();}
    public String tier(UUID u){List<Database.PlayerStar> s=sorted();for(int i=0;i<s.size();i++)if(s.get(i).uuid().equals(u))return tierForRanked(i,s.get(i).stars());return thresholdTier(stars(u));}
    public int rank(UUID u){List<Database.PlayerStar> s=sorted();for(int i=0;i<s.size();i++)if(s.get(i).uuid().equals(u))return i+1;return s.size()+1;}
    public List<Database.PlayerStar> sorted(){List<Database.PlayerStar> s=new ArrayList<>(players.values());s.sort(Comparator.comparingLong(Database.PlayerStar::stars).reversed().thenComparing(Database.PlayerStar::name,String.CASE_INSENSITIVE_ORDER));return s;}
    public String tierForRanked(int index,long stars){if(c.getBoolean("matier.m1.enabled",true)&&stars>=c.getLong("matier.m1.minimum_stars",1000)&&index<c.getInt("matier.m1.max_players",10))return "M1";return thresholdTier(stars);}
    private String thresholdTier(long stars){String[] tiers={"M9","M8","M7","M6","M5","M4","M3","M2","M1"};String best="M9";for(String t:tiers)if(stars>=c.getLong("matier.tiers."+t,0))best=t;return best.equals("M1")&&(!c.getBoolean("matier.m1.enabled",true))?"M1":best;}
    private int tierIndex(String t){return switch(t){case "M9"->0;case "M8"->1;case "M7"->2;case "M6"->3;case "M5"->4;case "M4"->5;case "M3"->6;case "M2"->7;case "M1"->8;default->0;};}
    public void addStars(UUID u,String playerName,long delta,boolean announce){Database.PlayerStar old=players.getOrDefault(u,new Database.PlayerStar(u,playerName,0,0,0));long next=Math.max(0,old.stars()+delta);Database.PlayerStar np=new Database.PlayerStar(u,playerName==null||playerName.isBlank()?old.name():playerName,next,old.lastSeen(),old.inactivityPenaltyDays());players.put(u,np);db.upsertPlayerStars(u,np.name(),next).thenRun(()->{if(announce){Player p=Bukkit.getPlayer(u);if(p!=null&&delta!=0)p.sendMessage(Text.mm(msg(delta>0?"matier.messages.kill":"matier.messages.death").replace("{stars}",String.valueOf(Math.abs(delta))).replace("{player}",old.name())));}});}
    @EventHandler public void onDeath(PlayerDeathEvent e){if(!c.getBoolean("matier.enabled",true))return;Player victim=e.getEntity();Player killer=victim.getKiller();if(killer==null||killer.getUniqueId().equals(victim.getUniqueId()))return;String key=killer.getUniqueId()+":"+victim.getUniqueId();long now=System.currentTimeMillis(),cool=c.getLong("matier.anti_farming.same_player_cooldown_seconds",60)*1000L;boolean repeat=now-farmCooldown.getOrDefault(key,0L)<cool;farmCooldown.put(key,now);String vt=tier(victim.getUniqueId()),kt=tier(killer.getUniqueId());int diff=tierIndex(kt)-tierIndex(vt);long gain=c.getLong("matier.kill.base_stars",5)+diff;if(repeat)gain=c.getLong("matier.anti_farming.repeat_kill_reward",0);gain=Math.max(c.getLong("matier.kill.minimum_reward",0),Math.min(c.getLong("matier.kill.maximum_reward",999999),gain));long loss=c.getLong("matier.death.base_loss",4)+(-diff);if(diff>0)loss=Math.max(c.getLong("matier.death.minimum_loss",0),c.getLong("matier.death.base_loss",4)-diff);loss=Math.max(c.getLong("matier.death.minimum_loss",0),Math.min(c.getLong("matier.death.maximum_loss",999999),loss));long oldK=stars(killer.getUniqueId()),oldV=stars(victim.getUniqueId());addStars(killer.getUniqueId(),killer.getName(),gain,false);addStars(victim.getUniqueId(),victim.getName(),-loss,false);final long finalGain=gain, finalLoss=loss;final Player finalKiller=killer, finalVictim=victim;Bukkit.getScheduler().runTaskLater(plugin,()->{announceChanges(finalKiller,oldK,finalGain,finalVictim.getName());announceChanges(finalVictim,oldV,-finalLoss,finalKiller.getName());},1L);}
    private void announceChanges(Player p,long old,long delta,String opponent){String oldTier=tierAt(p.getUniqueId(),old);String newTier=tier(p.getUniqueId());if(delta>0)p.sendMessage(Text.mm(msg("matier.messages.kill").replace("{stars}",String.valueOf(delta)) .replace("{player}",opponent)));else if(delta<0)p.sendMessage(Text.mm(msg("matier.messages.death").replace("{stars}",String.valueOf(-delta)).replace("{player}",opponent)));if(!oldTier.equals(newTier)&&tierIndex(newTier)>tierIndex(oldTier))p.sendMessage(Text.mm(msg("matier.messages.tier_up").replace("{tier}",coloredTier(newTier)).replace("{stars}",String.valueOf(stars(p.getUniqueId())))));if(newTier.equals("M1")&&!oldTier.equals("M1"))p.sendMessage(Text.mm(msg("matier.messages.m1_achieved").replace("{player}",p.getName()).replace("{stars}",String.valueOf(stars(p.getUniqueId()))).replace("{rank}",String.valueOf(rank(p.getUniqueId())))));}
    private String tierAt(UUID u,long st){Database.PlayerStar old=players.get(u);if(old==null)return thresholdTier(st);players.put(u,new Database.PlayerStar(u,old.name(),st,old.lastSeen(),old.inactivityPenaltyDays()));String t=tier(u);players.put(u,new Database.PlayerStar(u,old.name(),old.stars(),old.lastSeen(),old.inactivityPenaltyDays()));return t;}
    public String msg(String path){return c.getString(path,path);}
    public FileConfiguration config(){return c;}
    public void setStars(UUID u,String name,long stars){Database.PlayerStar old=players.getOrDefault(u,new Database.PlayerStar(u,name,0,0));players.put(u,new Database.PlayerStar(u,name,Math.max(0,stars),old.lastSeen(),old.inactivityPenaltyDays()));db.upsertPlayerStars(u,name,Math.max(0,stars));}
    // /makongcore reset matier - full wipe (Stars AND every season's
    // tier-history record), unlike /matier resetall which only zeroes Stars.
    public java.util.concurrent.CompletableFuture<Void> wipeAll(){players.clear();return db.wipeMatier();}
}
