package com.angkor.makongcore.data;
import com.zaxxer.hikari.*; import com.angkor.makongcore.model.*; import org.bukkit.configuration.file.FileConfiguration;
import java.io.Closeable; import java.sql.*; import java.util.*; import java.util.concurrent.*;
public final class Database implements Closeable {
 private final HikariDataSource ds; private final ExecutorService io=Executors.newVirtualThreadPerTaskExecutor();
 public Database(FileConfiguration c, java.io.File folder) throws Exception {String type=c.getString("storage.type","h2"); HikariConfig h=new HikariConfig(); h.setMaximumPoolSize(c.getInt("storage.mysql.max_pool_size",8));h.setMinimumIdle(c.getInt("storage.mysql.min_idle",1));h.setConnectionTimeout(c.getLong("storage.mysql.connection_timeout",10000));
  if(type.equalsIgnoreCase("mysql")){h.setDriverClassName("com.mysql.cj.jdbc.Driver");String host=c.getString("storage.mysql.host","localhost"),db=c.getString("storage.mysql.database","mateam");h.setJdbcUrl("jdbc:mysql://"+host+":"+c.getInt("storage.mysql.port",3306)+"/"+db+"?useSSL="+c.getBoolean("storage.mysql.use_ssl",false)+"&characterEncoding=utf8mb4&serverTimezone=UTC");h.setUsername(c.getString("storage.mysql.username","root"));h.setPassword(c.getString("storage.mysql.password",""));}
  else {h.setDriverClassName("org.h2.Driver");h.setJdbcUrl("jdbc:h2:"+new java.io.File(folder,"makongcore").getAbsolutePath().replace('\\','/')+";MODE=MySQL;AUTO_SERVER=TRUE");h.setUsername("sa");h.setPassword("");}
  ds=new HikariDataSource(h); init(); }
 private void init() throws SQLException {try(Connection c=ds.getConnection(); Statement s=c.createStatement()){
   s.executeUpdate("CREATE TABLE IF NOT EXISTS teams(id VARCHAR(36) PRIMARY KEY,tag VARCHAR(16) NOT NULL UNIQUE,name VARCHAR(64) NOT NULL UNIQUE,description VARCHAR(255),color VARCHAR(16),public_team BOOLEAN NOT NULL,pvp BOOLEAN NOT NULL,points BIGINT NOT NULL,kills BIGINT NOT NULL,deaths BIGINT NOT NULL,playtime BIGINT NOT NULL,stars BIGINT NOT NULL DEFAULT 0)");
   try{s.executeUpdate("ALTER TABLE teams ADD COLUMN stars BIGINT NOT NULL DEFAULT 0");}catch(SQLException ignored){}
   s.executeUpdate("CREATE TABLE IF NOT EXISTS mateam_meta(k VARCHAR(64) PRIMARY KEY,v VARCHAR(255) NOT NULL)");
   s.executeUpdate("CREATE TABLE IF NOT EXISTS team_members(team_id VARCHAR(36) NOT NULL,uuid VARCHAR(36) NOT NULL,name VARCHAR(64) NOT NULL,role VARCHAR(16) NOT NULL,joined_at BIGINT NOT NULL,last_seen BIGINT NOT NULL,server VARCHAR(64),points BIGINT NOT NULL DEFAULT 0,kills BIGINT NOT NULL DEFAULT 0,deaths BIGINT NOT NULL DEFAULT 0,playtime_minutes BIGINT NOT NULL DEFAULT 0,PRIMARY KEY(team_id,uuid))");
   try{s.executeUpdate("ALTER TABLE team_members ADD COLUMN points BIGINT NOT NULL DEFAULT 0");}catch(SQLException ignored){}
   try{s.executeUpdate("ALTER TABLE team_members ADD COLUMN kills BIGINT NOT NULL DEFAULT 0");}catch(SQLException ignored){}
   try{s.executeUpdate("ALTER TABLE team_members ADD COLUMN deaths BIGINT NOT NULL DEFAULT 0");}catch(SQLException ignored){}
   try{s.executeUpdate("ALTER TABLE team_members ADD COLUMN playtime_minutes BIGINT NOT NULL DEFAULT 0");}catch(SQLException ignored){}
   s.executeUpdate("CREATE TABLE IF NOT EXISTS team_allies(team_id VARCHAR(36) NOT NULL,ally_id VARCHAR(36) NOT NULL,PRIMARY KEY(team_id,ally_id))");
   s.executeUpdate("CREATE INDEX IF NOT EXISTS idx_members_uuid ON team_members(uuid)");
   s.executeUpdate("CREATE TABLE IF NOT EXISTS matier_players(uuid VARCHAR(36) PRIMARY KEY,name VARCHAR(64) NOT NULL,stars BIGINT NOT NULL DEFAULT 0,last_seen BIGINT NOT NULL DEFAULT 0,inactivity_penalty_days BIGINT NOT NULL DEFAULT 0)");
   try{s.executeUpdate("ALTER TABLE matier_players ADD COLUMN inactivity_penalty_days BIGINT NOT NULL DEFAULT 0");}catch(SQLException ignored){}
   s.executeUpdate("CREATE TABLE IF NOT EXISTS matier_history(season_year INT NOT NULL,uuid VARCHAR(36) NOT NULL,name VARCHAR(64) NOT NULL,tier VARCHAR(8) NOT NULL,stars BIGINT NOT NULL,player_rank INT NOT NULL,PRIMARY KEY(season_year,uuid))");
   s.executeUpdate("CREATE TABLE IF NOT EXISTS account_links(uuid VARCHAR(36) PRIMARY KEY,name VARCHAR(64) NOT NULL,discord_id VARCHAR(32) UNIQUE,telegram_chat_id VARCHAR(64) UNIQUE,linked_at BIGINT NOT NULL DEFAULT 0,account_type VARCHAR(16) NOT NULL DEFAULT 'unknown')");
   s.executeUpdate("CREATE INDEX IF NOT EXISTS idx_account_links_discord ON account_links(discord_id)");
   s.executeUpdate("CREATE INDEX IF NOT EXISTS idx_account_links_telegram ON account_links(telegram_chat_id)");
  }}
 public CompletableFuture<List<Team>> loadTeams(){return CompletableFuture.supplyAsync(()->{List<Team> out=new ArrayList<>();try(Connection c=ds.getConnection();PreparedStatement p=c.prepareStatement("SELECT * FROM teams");ResultSet r=p.executeQuery()){while(r.next()){Team t=new Team(UUID.fromString(r.getString("id")),r.getString("tag"),r.getString("name"),r.getString("description"),r.getString("color"),r.getBoolean("public_team"),r.getBoolean("pvp"));t.setStats(r.getLong("points"),r.getLong("kills"),r.getLong("deaths"),r.getLong("playtime"));t.setStars(r.getLong("stars"));loadMembers(c,t);loadAllies(c,t);out.add(t);}}catch(SQLException e){throw new CompletionException(e);}return out;},io);}
 private void loadMembers(Connection c,Team t)throws SQLException{try(PreparedStatement p=c.prepareStatement("SELECT * FROM team_members WHERE team_id=?")){p.setString(1,t.id().toString());try(ResultSet r=p.executeQuery()){while(r.next())t.addMember(new TeamMember(UUID.fromString(r.getString("uuid")),r.getString("name"),TeamRole.valueOf(r.getString("role")),r.getLong("joined_at"),r.getLong("last_seen"),r.getString("server"),r.getLong("points"),r.getLong("kills"),r.getLong("deaths"),r.getLong("playtime_minutes")));}}}
 private void loadAllies(Connection c,Team t)throws SQLException{try(PreparedStatement p=c.prepareStatement("SELECT ally_id FROM team_allies WHERE team_id=?")){p.setString(1,t.id().toString());try(ResultSet r=p.executeQuery()){while(r.next())t.addAlly(UUID.fromString(r.getString(1)));}}}
 public CompletableFuture<Void> save(Team t) {
  return CompletableFuture.runAsync(() -> {
   try (Connection c = ds.getConnection()) {
    c.setAutoCommit(false);
    try {
     int updated;
     try (PreparedStatement p = c.prepareStatement(
        "UPDATE teams SET tag=?,name=?,description=?,color=?,public_team=?,pvp=?,points=?,kills=?,deaths=?,playtime=?,stars=? WHERE id=?")) {
      p.setString(1, t.tag());
      p.setString(2, t.name());
      p.setString(3, t.description());
      p.setString(4, t.color());
      p.setBoolean(5, t.isPublic());
      p.setBoolean(6, t.pvp());
      p.setLong(7, t.points());
      p.setLong(8, t.kills());
      p.setLong(9, t.deaths());
      p.setLong(10, t.playtime());
      p.setLong(11, t.stars());
      p.setString(12, t.id().toString());
      updated=p.executeUpdate();
     }
     if(updated==0){
      try (PreparedStatement p = c.prepareStatement(
        "INSERT INTO teams(id,tag,name,description,color,public_team,pvp,points,kills,deaths,playtime,stars) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)")) {
       p.setString(1, t.id().toString());
       p.setString(2, t.tag());
       p.setString(3, t.name());
       p.setString(4, t.description());
       p.setString(5, t.color());
       p.setBoolean(6, t.isPublic());
       p.setBoolean(7, t.pvp());
       p.setLong(8, t.points());
       p.setLong(9, t.kills());
       p.setLong(10, t.deaths());
       p.setLong(11, t.playtime());
       p.setLong(12, t.stars());
       p.executeUpdate();
      }
     }
     try (PreparedStatement d = c.prepareStatement("DELETE FROM team_members WHERE team_id=?")) {
      d.setString(1, t.id().toString());
      d.executeUpdate();
     }
     try (PreparedStatement p = c.prepareStatement(
       "INSERT INTO team_members(team_id,uuid,name,role,joined_at,last_seen,server,points,kills,deaths,playtime_minutes) VALUES(?,?,?,?,?,?,?,?,?,?,?)")) {
      for (TeamMember m : t.members()) {
       p.setString(1, t.id().toString());
       p.setString(2, m.uuid().toString());
       p.setString(3, m.name());
       p.setString(4, m.role().name());
       p.setLong(5, m.joinedAt());
       p.setLong(6, m.lastSeen());
       p.setString(7, m.server());
       p.setLong(8, m.points());
       p.setLong(9, m.kills());
       p.setLong(10, m.deaths());
       p.setLong(11, m.playtimeMinutes());
       p.addBatch();
      }
      p.executeBatch();
     }
     try (PreparedStatement d = c.prepareStatement("DELETE FROM team_allies WHERE team_id=?")) {
      d.setString(1, t.id().toString());
      d.executeUpdate();
     }
     try (PreparedStatement p = c.prepareStatement("INSERT INTO team_allies(team_id,ally_id) VALUES(?,?)")) {
      for (UUID a : t.allies()) {
       p.setString(1, t.id().toString());
       p.setString(2, a.toString());
       p.addBatch();
      }
      p.executeBatch();
     }
     c.commit();
    } catch (Exception e) {
     try { c.rollback(); } catch (SQLException ignored) {}
     throw e;
    }
   } catch (Exception e) {
    throw new CompletionException(e);
   }
  }, io);
 }
 public CompletableFuture<Void> delete(UUID id){return CompletableFuture.runAsync(()->{try(Connection c=ds.getConnection()){try(PreparedStatement p=c.prepareStatement("DELETE FROM team_members WHERE team_id=?")){p.setString(1,id.toString());p.executeUpdate();}try(PreparedStatement p=c.prepareStatement("DELETE FROM team_allies WHERE team_id=? OR ally_id=?")){p.setString(1,id.toString());p.setString(2,id.toString());p.executeUpdate();}try(PreparedStatement p=c.prepareStatement("DELETE FROM teams WHERE id=?")){p.setString(1,id.toString());p.executeUpdate();}}catch(SQLException e){throw new CompletionException(e);}},io);}
 public void logSaveFailure(String tag, Throwable cause){System.getLogger("MakongCore").log(System.Logger.Level.ERROR,"Failed to save newly created team '"+tag+"': "+cause.getMessage(),cause);}
 public CompletableFuture<String> meta(String key){return CompletableFuture.supplyAsync(()->{try(Connection c=ds.getConnection();PreparedStatement p=c.prepareStatement("SELECT v FROM mateam_meta WHERE k=?")){p.setString(1,key);try(ResultSet r=p.executeQuery()){return r.next()?r.getString(1):null;}}catch(SQLException e){throw new CompletionException(e);}},io);}
 public CompletableFuture<Void> setMeta(String key,String value){return CompletableFuture.runAsync(()->{try(Connection c=ds.getConnection()){try(PreparedStatement p=c.prepareStatement("UPDATE mateam_meta SET v=? WHERE k=?")){p.setString(1,value);p.setString(2,key);if(p.executeUpdate()==0){try(PreparedStatement i=c.prepareStatement("INSERT INTO mateam_meta(k,v) VALUES(?,?)")){i.setString(1,key);i.setString(2,value);i.executeUpdate();}}}}catch(SQLException e){throw new CompletionException(e);}},io);}


 public CompletableFuture<AccountLink> getAccountLink(UUID uuid){return CompletableFuture.supplyAsync(()->{try(Connection c=ds.getConnection();PreparedStatement p=c.prepareStatement("SELECT * FROM account_links WHERE uuid=?")){p.setString(1,uuid.toString());try(ResultSet r=p.executeQuery()){if(!r.next())return null;return new AccountLink(uuid,r.getString("name"),r.getString("discord_id"),r.getString("telegram_chat_id"),r.getLong("linked_at"),r.getString("account_type"));}}catch(SQLException e){throw new CompletionException(e);}},io);}
 public CompletableFuture<AccountLink> findByDiscord(String id){return findLink("discord_id",id);}
 public CompletableFuture<AccountLink> findByTelegram(String id){return findLink("telegram_chat_id",id);}
 private CompletableFuture<AccountLink> findLink(String col,String id){return CompletableFuture.supplyAsync(()->{try(Connection c=ds.getConnection();PreparedStatement p=c.prepareStatement("SELECT * FROM account_links WHERE "+col+"=?")){p.setString(1,id);try(ResultSet r=p.executeQuery()){if(!r.next())return null;return new AccountLink(UUID.fromString(r.getString("uuid")),r.getString("name"),r.getString("discord_id"),r.getString("telegram_chat_id"),r.getLong("linked_at"),r.getString("account_type"));}}catch(SQLException e){throw new CompletionException(e);}},io);}
 public CompletableFuture<Void> linkAccount(UUID uuid,String name,String discord,String telegram,String type){return CompletableFuture.runAsync(()->{try(Connection c=ds.getConnection()){c.setAutoCommit(false);try(PreparedStatement p=c.prepareStatement("DELETE FROM account_links WHERE uuid=?")){p.setString(1,uuid.toString());p.executeUpdate();}try(PreparedStatement p=c.prepareStatement("INSERT INTO account_links(uuid,name,discord_id,telegram_chat_id,linked_at,account_type) VALUES(?,?,?,?,?,?)")){p.setString(1,uuid.toString());p.setString(2,name);p.setString(3,discord);p.setString(4,telegram);p.setLong(5,System.currentTimeMillis());p.setString(6,type);p.executeUpdate();}c.commit();}catch(Exception e){throw new CompletionException(e);}},io);}
 public CompletableFuture<Void> setDiscord(UUID uuid,String id){return setLinkField(uuid,"discord_id",id);}
 public CompletableFuture<Void> setTelegram(UUID uuid,String id){return setLinkField(uuid,"telegram_chat_id",id);}
 private CompletableFuture<Void> setLinkField(UUID uuid,String col,String id){return CompletableFuture.runAsync(()->{try(Connection c=ds.getConnection();PreparedStatement p=c.prepareStatement("UPDATE account_links SET "+col+"=?,linked_at=? WHERE uuid=?")){p.setString(1,id);p.setLong(2,System.currentTimeMillis());p.setString(3,uuid.toString());p.executeUpdate();}catch(SQLException e){throw new CompletionException(e);}},io);}
 public record AccountLink(UUID uuid,String name,String discordId,String telegramChatId,long linkedAt,String accountType){}
 public CompletableFuture<Long> getPlayerStars(UUID uuid){return CompletableFuture.supplyAsync(()->{try(Connection c=ds.getConnection();PreparedStatement p=c.prepareStatement("SELECT stars FROM matier_players WHERE uuid=?")){p.setString(1,uuid.toString());try(ResultSet r=p.executeQuery()){return r.next()?r.getLong(1):0L;}}catch(SQLException e){throw new CompletionException(e);}},io);}
 public CompletableFuture<Void> upsertPlayerStars(UUID uuid,String name,long stars){return CompletableFuture.runAsync(()->{try(Connection c=ds.getConnection()){try(PreparedStatement p=c.prepareStatement("UPDATE matier_players SET name=?,stars=? WHERE uuid=?")){p.setString(1,name);p.setLong(2,Math.max(0,stars));p.setString(3,uuid.toString());if(p.executeUpdate()==0){long now=System.currentTimeMillis();try(PreparedStatement i=c.prepareStatement("INSERT INTO matier_players(uuid,name,stars,last_seen,inactivity_penalty_days) VALUES(?,?,?,?,0)")){i.setString(1,uuid.toString());i.setString(2,name);i.setLong(3,Math.max(0,stars));i.setLong(4,now);i.executeUpdate();}}}}catch(SQLException e){throw new CompletionException(e);}},io);}
 public CompletableFuture<Void> touchPlayer(UUID uuid,String name){return CompletableFuture.runAsync(()->{try(Connection c=ds.getConnection()){long now=System.currentTimeMillis();try(PreparedStatement p=c.prepareStatement("UPDATE matier_players SET name=?,last_seen=?,inactivity_penalty_days=0 WHERE uuid=?")){p.setString(1,name);p.setLong(2,now);p.setString(3,uuid.toString());if(p.executeUpdate()==0){try(PreparedStatement i=c.prepareStatement("INSERT INTO matier_players(uuid,name,stars,last_seen,inactivity_penalty_days) VALUES(?,?,0,?,0)")){i.setString(1,uuid.toString());i.setString(2,name);i.setLong(3,now);i.executeUpdate();}}}}catch(SQLException e){throw new CompletionException(e);}},io);}
 public CompletableFuture<Void> applyInactivity(UUID uuid,long stars,long lastSeen,long penaltyDays){return CompletableFuture.runAsync(()->{try(Connection c=ds.getConnection();PreparedStatement p=c.prepareStatement("UPDATE matier_players SET stars=?,inactivity_penalty_days=? WHERE uuid=?")){p.setLong(1,Math.max(0,stars));p.setLong(2,penaltyDays);p.setString(3,uuid.toString());p.executeUpdate();}catch(SQLException e){throw new CompletionException(e);}},io);}
 public CompletableFuture<Map<UUID,PlayerStar>> loadPlayers(){return CompletableFuture.supplyAsync(()->{Map<UUID,PlayerStar> out=new HashMap<>();try(Connection c=ds.getConnection();PreparedStatement p=c.prepareStatement("SELECT uuid,name,stars,last_seen,inactivity_penalty_days FROM matier_players");ResultSet r=p.executeQuery()){while(r.next())out.put(UUID.fromString(r.getString(1)),new PlayerStar(UUID.fromString(r.getString(1)),r.getString(2),r.getLong(3),r.getLong(4),r.getLong(5)));}catch(SQLException e){throw new CompletionException(e);}return out;},io);}
 public CompletableFuture<Void> resetMatier(int year,Map<UUID,PlayerStar> players,Map<UUID,String> tiers,Map<UUID,Integer> ranks){return CompletableFuture.runAsync(()->{try(Connection c=ds.getConnection()){c.setAutoCommit(false);try{try(PreparedStatement h=c.prepareStatement("INSERT INTO matier_history(season_year,uuid,name,tier,stars,player_rank) VALUES(?,?,?,?,?,?)")){for(PlayerStar p:players.values()){h.setInt(1,year);h.setString(2,p.uuid().toString());h.setString(3,p.name());h.setString(4,tiers.getOrDefault(p.uuid(),"M9"));h.setLong(5,p.stars());h.setInt(6,ranks.getOrDefault(p.uuid(),0));h.addBatch();}h.executeBatch();}try(PreparedStatement u=c.prepareStatement("UPDATE matier_players SET stars=0,last_seen=?,inactivity_penalty_days=0")){u.setLong(1,System.currentTimeMillis());u.executeUpdate();}try(PreparedStatement m=c.prepareStatement("UPDATE mateam_meta SET v=? WHERE k=?")){m.setString(1,String.valueOf(year));m.setString(2,"matier_season_year");if(m.executeUpdate()==0){try(PreparedStatement i=c.prepareStatement("INSERT INTO mateam_meta(k,v) VALUES(?,?)")){i.setString(1,"matier_season_year");i.setString(2,String.valueOf(year));i.executeUpdate();}}}c.commit();}catch(Exception e){try{c.rollback();}catch(SQLException ignored){}throw e;}}catch(Exception e){throw new CompletionException(e);}},io);}
 public record PlayerStar(UUID uuid,String name,long stars,long lastSeen,long inactivityPenaltyDays){
  public PlayerStar(UUID uuid,String name,long stars,long lastSeen){this(uuid,name,stars,lastSeen,0);}
 }
 public void close(){io.close();ds.close();}
}
