package com.angkor.makongcore.listener;

import com.angkor.makongcore.MakongCore;
import com.angkor.makongcore.model.Team;
import com.angkor.makongcore.model.TeamMember;
import com.angkor.makongcore.service.TeamService;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.PlayerDeathEvent;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public final class TeamStatsListener implements Listener {
    private final MakongCore plugin;
    private final TeamService teams;
    private final Map<String,Long> pairCooldown=new ConcurrentHashMap<>();
    private int playtimeTask=-1;

    public TeamStatsListener(MakongCore plugin, TeamService teams){this.plugin=plugin;this.teams=teams;}

    public void start(){
        if(!plugin.teamConfig().get().getBoolean("team.scoring.enabled",true)) return;
        playtimeTask=Bukkit.getScheduler().runTaskTimer(plugin,this::tickPlaytime,1200L,1200L).getTaskId();
    }

    public void stop(){if(playtimeTask!=-1)Bukkit.getScheduler().cancelTask(playtimeTask);}

    @EventHandler public void onDeath(PlayerDeathEvent e){
        if(!plugin.teamConfig().get().getBoolean("team.scoring.enabled",true))return;
        Player victim=e.getEntity(), killer=victim.getKiller();
        Team vt=teams.byPlayer(victim.getUniqueId());
        if(vt!=null) score(vt,victim.getUniqueId(),0,0,1);
        if(killer==null||killer.getUniqueId().equals(victim.getUniqueId()))return;
        Team kt=teams.byPlayer(killer.getUniqueId());
        if(kt==null)return;
        long cooldown=plugin.teamConfig().get().getLong("team.scoring.spam_threshold_seconds",60)*1000L;
        String key=killer.getUniqueId()+":"+victim.getUniqueId();
        long now=System.currentTimeMillis();
        boolean repeat=now-pairCooldown.getOrDefault(key,0L)<cooldown;
        pairCooldown.put(key,now);
        long stars=plugin.teamConfig().get().getLong("team.scoring.events.kill",1);
        if(repeat) stars=plugin.teamConfig().get().getLong("team.scoring.events.kill_spam",0);
        score(kt,killer.getUniqueId(),stars,1,0);
        if(vt!=null){
            long deathStars=plugin.teamConfig().get().getLong("team.scoring.events.death",0);
            if(repeat) deathStars=plugin.teamConfig().get().getLong("team.scoring.events.death_spam",-1);
            score(vt,victim.getUniqueId(),deathStars,0,0);
        }
    }

    private void tickPlaytime(){
        long starsPerHour=plugin.teamConfig().get().getLong("team.scoring.events.playtime_per_hour",1);
        for(Player p:Bukkit.getOnlinePlayers()){
            Team t=teams.byPlayer(p.getUniqueId()); if(t==null)continue;
            TeamMember m=t.member(p.getUniqueId()); if(m==null)continue;
            long next=m.playtimeMinutes()+1;
            long stars=(starsPerHour>0 && next%60==0)?starsPerHour:0;
            score(t,p.getUniqueId(),stars,0,0,1);
        }
    }

    private void score(Team t,UUID u,long stars,long kills,long deaths){score(t,u,stars,kills,deaths,0);}
    private void score(Team t,UUID u,long stars,long kills,long deaths,long minutes){
        long min=plugin.teamConfig().get().getLong("team.scoring.minimum_stars",0);
        if(stars<0) stars=Math.max(stars,-min);
        teams.addMemberStats(t,u,stars,kills,deaths,minutes);
    }
}
