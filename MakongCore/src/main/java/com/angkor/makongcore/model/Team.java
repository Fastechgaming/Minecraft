package com.angkor.makongcore.model;
import java.util.*;
public final class Team {
    private final UUID id; private String tag,name,description,color; private boolean publicTeam,pvp;
    private long kills,deaths,playtime,stars;
    private final LinkedHashMap<UUID,TeamMember> members=new LinkedHashMap<>();
    private final Set<UUID> allies=new HashSet<>();
    public Team(UUID id,String tag,String name,String description,String color,boolean publicTeam,boolean pvp){this.id=id;this.tag=tag;this.name=name;this.description=description;this.color=color;this.publicTeam=publicTeam;this.pvp=pvp;}
    public UUID id(){return id;} public String tag(){return tag;} public String name(){return name;} public String description(){return description;} public String color(){return color;} public boolean isPublic(){return publicTeam;} public boolean pvp(){return pvp;}
    public long stars(){return stars;} public long kills(){return kills;} public long deaths(){return deaths;} public long playtime(){return playtime;}
    public Collection<TeamMember> members(){return Collections.unmodifiableCollection(members.values());} public TeamMember member(UUID u){return members.get(u);} public boolean hasMember(UUID u){return members.containsKey(u);} public Set<UUID> allies(){return Collections.unmodifiableSet(allies);}
    public void setTag(String v){tag=v;} public void setName(String v){name=v;} public void setDescription(String v){description=v;} public void setColor(String v){color=v;} public void setPublic(boolean v){publicTeam=v;} public void setPvp(boolean v){pvp=v;}
    public void setStats(long k,long d,long pt){kills=k;deaths=d;playtime=pt;} public void addStars(long amount){stars=Math.max(0,stars+amount);} public void setStars(long value){stars=Math.max(0,value);} public void addMember(TeamMember m){members.put(m.uuid(),m);} public void removeMember(UUID u){members.remove(u);} public void addAlly(UUID id){allies.add(id);} public void removeAlly(UUID id){allies.remove(id);}
}
