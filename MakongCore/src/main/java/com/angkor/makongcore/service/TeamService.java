package com.angkor.makongcore.service;
import org.bukkit.Bukkit;
import com.angkor.makongcore.config.Settings; import com.angkor.makongcore.data.Database; import com.angkor.makongcore.model.*;
import java.util.*; import java.util.concurrent.*; import java.util.function.*;
public final class TeamService {
 public record Invite(UUID team,UUID inviter,long expiresAt){} public record Request(UUID team,UUID player,long expiresAt){}
 // A team can have multiple pending outgoing/incoming alliance requests at
 // once (to/from different teams), unlike Invite/Request above which are
 // keyed by a single player - so this is a flat list, not a Map, scanned
 // linearly (team counts are small; matches this class's existing style).
 public record AllyRequest(UUID fromTeam,UUID toTeam,long expiresAt){}
 private final Database db; private volatile Settings s; private final Map<UUID,Team> teams=new ConcurrentHashMap<>(); private final Map<String,UUID> tags=new ConcurrentHashMap<>(),names=new ConcurrentHashMap<>(); private final Map<UUID,Invite> invites=new ConcurrentHashMap<>(); private final Map<UUID,Request> requests=new ConcurrentHashMap<>(); private final List<AllyRequest> allyRequests=new CopyOnWriteArrayList<>();
 public TeamService(Database db,Settings s){this.db=db;this.s=s;}
 // Lets /makongcore reload team (and /mcvlc reload team, relayed from MakongVelocity)
 // pick up new limits/PvP/chat settings without the full reload's database
 // reconnect and team-data reload - team membership is untouched.
 public void updateSettings(Settings s){this.s=s;}
 public CompletableFuture<Void> load(){return db.loadTeams().thenAccept(list->{for(Team t:list){teams.put(t.id(),t);tags.put(t.tag().toLowerCase(Locale.ROOT),t.id());names.put(t.name().toLowerCase(Locale.ROOT),t.id());}});}
 public Team team(UUID id){return teams.get(id);} public Team byTag(String tag){UUID id=tags.get(tag.toLowerCase(Locale.ROOT));return id==null?null:team(id);} public Team byPlayer(UUID u){for(Team t:teams.values())if(t.hasMember(u))return t;return null;} public Collection<Team> all(){return Collections.unmodifiableCollection(teams.values());}
 public synchronized Team create(UUID owner,String tag,String name,String color){String tl=tag.toLowerCase(Locale.ROOT),nl=name.toLowerCase(Locale.ROOT);if(tags.containsKey(tl)||names.containsKey(nl))return null;Team t=new Team(UUID.randomUUID(),tag,name,descriptionForCreate(),color,true,s.pvpDefault());
long now=System.currentTimeMillis();
String ownerName=Bukkit.getOfflinePlayer(owner).getName();
if(ownerName==null||ownerName.isBlank())ownerName=owner.toString();
t.addMember(new TeamMember(owner,ownerName,TeamRole.OWNER,now,now,Bukkit.getServer().getName()));
teams.put(t.id(),t);tags.put(tl,t.id());names.put(nl,t.id());
try {
    db.save(t).join();
} catch (CompletionException ex) {
    teams.remove(t.id());
    tags.remove(tl);
    names.remove(nl);
    Throwable cause = ex.getCause() != null ? ex.getCause() : ex;
    db.logSaveFailure(tag, cause);
    return null;
}
return t;}
 private String descriptionForCreate(){return s.defaultDescription();}
 public boolean addMember(Team t,UUID u,String name,TeamRole role){if(t==null||t.members().size()>=s.maxSize()||byPlayer(u)!=null)return false;t.addMember(new TeamMember(u,name,role,System.currentTimeMillis(),System.currentTimeMillis(),null));db.save(t);return true;}
 public boolean removeMember(Team t,UUID u){if(t==null||!t.hasMember(u))return false;t.removeMember(u);db.save(t);return true;}
 public CompletableFuture<Void> disband(Team t){if(t==null)return CompletableFuture.completedFuture(null);teams.remove(t.id());tags.remove(t.tag().toLowerCase(Locale.ROOT));names.remove(t.name().toLowerCase(Locale.ROOT));allyRequests.removeIf(r->r.fromTeam().equals(t.id())||r.toTeam().equals(t.id()));return db.delete(t.id());}
 // /makongcore reset mateam - deletes every team entirely, not just their Stars.
 public CompletableFuture<Void> disbandAll(){teams.clear();tags.clear();names.clear();invites.clear();requests.clear();allyRequests.clear();return db.deleteAllTeams();}
 public void invite(UUID player,UUID team,UUID inviter){invites.put(player,new Invite(team,inviter,System.currentTimeMillis()+s.inviteExpire()*1000));}
 public Invite invite(UUID player){Invite i=invites.get(player);if(i!=null&&i.expiresAt()<System.currentTimeMillis()){invites.remove(player);return null;}return i;}
 public void clearInvite(UUID p){invites.remove(p);}
 public void request(UUID player,UUID team){requests.put(player,new Request(team,player,System.currentTimeMillis()+s.inviteExpire()*1000));}
 public Request request(UUID p){Request r=requests.get(p);if(r!=null&&r.expiresAt()<System.currentTimeMillis()){requests.remove(p);return null;}return r;}
 public List<Request> requestsFor(UUID team){long now=System.currentTimeMillis();List<Request> out=new ArrayList<>();for(var e:requests.entrySet()){Request r=e.getValue();if(r.expiresAt()<now){requests.remove(e.getKey(),r);continue;}if(r.team().equals(team))out.add(r);}return out;}
 public void clearRequest(UUID p){requests.remove(p);}
 // /team ally <tag> - queues an alliance request from `from` to `to`,
 // unless the other team already asked first (that just accepts
 // immediately instead of leaving two mirrored requests pending). Returns
 // false without creating anything for the cases that make a request
 // meaningless: allying yourself, an already-existing alliance, either
 // team already at team.allies.max_allies, or a request already pending
 // in this exact direction (re-sending just refreshes nothing - the
 // caller should tell the player it's already pending, not silently
 // duplicate the entry).
 public enum AllyResult{OK,SELF,ALREADY_ALLIED,LIMIT_REACHED,ALREADY_PENDING,AUTO_ACCEPTED}
 public AllyResult requestAlly(Team from,Team to){
  if(from==null||to==null||from.id().equals(to.id()))return AllyResult.SELF;
  if(from.allies().contains(to.id()))return AllyResult.ALREADY_ALLIED;
  if(from.allies().size()>=s.maxAllies()||to.allies().size()>=s.maxAllies())return AllyResult.LIMIT_REACHED;
  long now=System.currentTimeMillis();
  allyRequests.removeIf(r->r.expiresAt()<now);
  if(allyRequests.stream().anyMatch(r->r.fromTeam().equals(from.id())&&r.toTeam().equals(to.id())))return AllyResult.ALREADY_PENDING;
  AllyRequest reverse=allyRequests.stream().filter(r->r.fromTeam().equals(to.id())&&r.toTeam().equals(from.id())).findFirst().orElse(null);
  if(reverse!=null){allyRequests.remove(reverse);acceptAlly(from,to);return AllyResult.AUTO_ACCEPTED;}
  allyRequests.add(new AllyRequest(from.id(),to.id(),now+s.inviteExpire()*1000));
  return AllyResult.OK;
 }
 // Incoming requests FOR `team` - see GuiManager#openAllies.
 public List<AllyRequest> allyRequestsFor(UUID team){
  long now=System.currentTimeMillis();
  allyRequests.removeIf(r->r.expiresAt()<now);
  List<AllyRequest> out=new ArrayList<>();
  for(AllyRequest r:allyRequests)if(r.toTeam().equals(team))out.add(r);
  return out;
 }
 public void clearAllyRequest(UUID from,UUID to){allyRequests.removeIf(r->r.fromTeam().equals(from)&&r.toTeam().equals(to));}
 public void acceptAlly(Team from,Team to){from.addAlly(to.id());to.addAlly(from.id());clearAllyRequest(from.id(),to.id());db.save(from);db.save(to);}
 public synchronized boolean renameTag(Team t,String newTag){if(t==null)return false;String key=newTag.toLowerCase(Locale.ROOT);UUID existing=tags.get(key);if(existing!=null&&!existing.equals(t.id()))return false;tags.remove(t.tag().toLowerCase(Locale.ROOT));t.setTag(newTag);tags.put(key,t.id());db.save(t);return true;}
 // Real-time, MaTier-style: stars are awarded straight to the team the
 // instant they're earned (kill/death/playtime events), not accumulated
 // toward a weekly payout - see TeamStatsListener.
 public boolean addMemberStats(Team t,UUID u,long stars,long kills,long deaths,long minutes){
  if(t==null)return false;
  TeamMember m=t.member(u); if(m==null)return false;
  long nextKills=Math.max(0,m.kills()+kills);
  long nextDeaths=Math.max(0,m.deaths()+deaths);
  long nextMinutes=Math.max(0,m.playtimeMinutes()+minutes);
  t.removeMember(u);
  t.addMember(new TeamMember(m.uuid(),m.name(),m.role(),m.joinedAt(),m.lastSeen(),m.server(),
      nextKills,nextDeaths,nextMinutes));
  long teamKills=Math.max(0,t.kills()+kills);
  long teamDeaths=Math.max(0,t.deaths()+deaths);
  long teamPlaytime=Math.max(0,t.playtime()+minutes);
  t.setStats(teamKills,teamDeaths,teamPlaytime);
  if(stars!=0)t.addStars(stars);
  db.save(t);
  return true;
 }
 public boolean addStars(Team t,long amount){if(t==null)return false;t.addStars(amount);db.save(t);return true;}
 public boolean setStars(Team t,long amount){if(t==null)return false;t.setStars(amount);db.save(t);return true;}
 public CompletableFuture<Void> resetAllStars(){List<CompletableFuture<Void>> saves=new ArrayList<>();for(Team t:teams.values()){t.setStars(0);saves.add(db.save(t));}return CompletableFuture.allOf(saves.toArray(CompletableFuture[]::new));}
 public Database database(){return db;} public Settings settings(){return s;} public CompletableFuture<Void> save(Team t){return db.save(t);} public CompletableFuture<Void> delete(Team t){return disband(t);}
}
