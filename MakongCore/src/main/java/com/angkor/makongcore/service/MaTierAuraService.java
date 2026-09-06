package com.angkor.makongcore.service;

import com.angkor.makongcore.MakongCore;
import org.bukkit.Color;
import org.bukkit.Particle;
import org.bukkit.entity.Player;
import org.bukkit.scheduler.BukkitTask;
import org.bukkit.util.Vector;

import java.util.*;

public final class MaTierAuraService {
    private final MakongCore plugin;
    private final MaTierService matier;
    private BukkitTask task;
    public MaTierAuraService(MakongCore plugin, MaTierService matier){this.plugin=plugin;this.matier=matier;}
    public void start(){stop(); if(!matier.config().getBoolean("matier.aura.enabled",true))return; long interval=Math.max(1,matier.config().getLong("matier.aura.interval_ticks",3)); task=plugin.getServer().getScheduler().runTaskTimer(plugin,this::tick,interval,interval);}
    public void stop(){if(task!=null){task.cancel();task=null;}}
    private void tick(){for(Player p:plugin.getServer().getOnlinePlayers()){String tier=matier.tier(p.getUniqueId()); if(!Set.of("M3","M2","M1").contains(tier))continue; String state=p.isGliding()?"elytra":(p.getVelocity().setY(0).lengthSquared()>0.003?"moving":"standing"); String path="matier.aura."+tier+"."+state; String hex=matier.config().getString(path+".color","#FFFFFF"); Color color=parseColor(hex); int count=Math.max(1,matier.config().getInt(path+".count",2)); float size=(float)Math.max(0.01,matier.config().getDouble(path+".size",1.0)); double radius=Math.max(0.0,matier.config().getDouble(path+".radius",0.45)); Particle.DustOptions dust=new Particle.DustOptions(color,size); if(state.equals("elytra")){Vector back=p.getLocation().getDirection().normalize().multiply(-0.8); p.getWorld().spawnParticle(Particle.DUST,p.getLocation().add(back).add(0,0.15,0),count,0.18,0.18,0.18,0,dust);} else {p.getWorld().spawnParticle(Particle.DUST,p.getLocation().add(0,1.0,0),count,radius,0.65,radius,0,dust);}}}
    private Color parseColor(String s){try{String x=s==null?"#FFFFFF":s.trim().replace("#","");if(x.length()==3)x=x.substring(0,1)+x.substring(0,1)+x.substring(1,2)+x.substring(1,2)+x.substring(2)+x.substring(2);return Color.fromRGB(Integer.parseInt(x.substring(0,2),16),Integer.parseInt(x.substring(2,4),16),Integer.parseInt(x.substring(4,6),16));}catch(Exception e){return Color.WHITE;}}
}
