package com.angkor.makongvelocity.web;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

/**
 * Talks to the Makong Network website's /api/plugin bridge - see
 * MakongWeb/lib/pluginBridge.js and MakongWeb/routes/plugin.js for the server
 * side of this protocol. Platform-agnostic (no Bukkit/Velocity imports).
 * Deliberately duplicated (not shared via a build dependency) from
 * MakongCore/src/.../web/WebsiteBridge.java, since Velocity's own restart
 * relay (queueCommand) has no equivalent use on Paper and Paper's rankings
 * reporting has no equivalent use here - keep both copies in sync for the
 * connect/poll/ack/ping/pong methods they do share.
 *
 * The plugin always initiates: it registers once via connect(), then calls
 * poll() on a repeating timer. There is no inbound port to open on the
 * Minecraft side - this makes the multi-server setup work identically
 * whether every backend is on one box or scattered across different hosts.
 */
public final class WebsiteBridge {

  private final String baseUrl;
  private final String secret;
  private final String serverId;
  private final String kind;
  private final Consumer<String> logInfo;
  private final Consumer<String> logWarn;
  private final HttpClient http = HttpClient.newBuilder()
      .connectTimeout(Duration.ofSeconds(8))
      .build();

  public WebsiteBridge(String baseUrl, String secret, String serverId, String kind,
                        Consumer<String> logInfo, Consumer<String> logWarn) {
    this.baseUrl = baseUrl.replaceAll("/+$", "");
    this.secret = secret;
    this.serverId = serverId;
    this.kind = kind;
    this.logInfo = logInfo;
    this.logWarn = logWarn;
  }

  /** Registers (or re-registers) this server. Safe to call repeatedly. */
  public boolean connect() {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("serverId", serverId);
    body.put("kind", kind);
    Map<String, Object> res = post("/api/plugin/connect", body);
    return res != null && Boolean.TRUE.equals(res.get("ok"));
  }

  // Sending `kind` here (not just once in connect()) matters: a website
  // restart wipes its in-memory server registry, and nothing else ever
  // re-sends this server's kind afterward since connect() only runs once
  // per plugin process lifetime - without it, the website's registry would
  // silently default this server to "paper" (its entry() fallback) and
  // never self-correct until this plugin itself restarts, permanently
  // breaking anything that specifically looks for the "velocity" server
  // (like MakongCore's /profile network lookup).
  /** The repeating heartbeat/work call - also doubles as a liveness ping. */
  public PollResult poll() {
    Map<String, Object> res = get("/api/plugin/poll?serverId=" + urlEncode(serverId) + "&kind=" + urlEncode(kind));
    if (res == null) return null;
    PollResult result = new PollResult();
    result.servers = parseServers(listOf(res.get("servers")));
    result.commands = parseCommands(listOf(res.get("commands")));
    result.pings = parsePings(listOf(res.get("pings")));
    result.pongs = parsePongs(listOf(res.get("pongs")));
    result.profileRequests = parseProfileRequests(listOf(res.get("profileRequests")));
    result.profileAnswers = parseProfileAnswers(listOf(res.get("profileAnswers")));
    return result;
  }

  /** Reports back after running a command handed out by poll(). */
  public void ack(String commandId, boolean ok, String message) {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("serverId", serverId);
    body.put("commandId", commandId);
    body.put("ok", ok);
    if (message != null) body.put("result", message);
    post("/api/plugin/ack", body);
  }

  /** Asks the website to queue a ping for `target`'s next poll. */
  public void ping(String target) {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("serverId", serverId);
    body.put("target", target);
    post("/api/plugin/ping", body);
  }

  /** Answers a ping this server saw in its own poll(). */
  public void pong(String target, String pingId) {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("serverId", serverId);
    body.put("target", target);
    body.put("pingId", pingId);
    post("/api/plugin/pong", body);
  }

  /**
   * Asks the website to queue a profile lookup for `target`'s next poll -
   * same relay shape as ping()/pong() above, used by MakongCore's /profile
   * Discord command to ask this server (the one with nLogin registration/
   * last-login data and true whole-network online status, via ProxyServer)
   * about a player. Returns the request id to watch for in a later poll()'s
   * profileAnswers, or null if the website call itself failed.
   */
  public String requestProfile(String target, String playerName) {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("serverId", serverId);
    body.put("target", target);
    body.put("playerName", playerName);
    Map<String, Object> res = post("/api/plugin/profile-request", body);
    return res == null ? null : str(res, "requestId");
  }

  /** Answers a profile-request this server saw in its own poll(). */
  public void answerProfile(String target, String requestId, Map<String, Object> data) {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("serverId", serverId);
    body.put("target", target);
    body.put("requestId", requestId);
    body.put("data", data);
    post("/api/plugin/profile-answer", body);
  }

  /**
   * Sends a console command for `targetServerId` to run right now - used by
   * /mcvlc autorestart to fan a restart-warning-then-restart command out to
   * every connected backend at once. Same trust model as everything else on
   * this bridge: whoever holds the shared secret can already do this via the
   * website's own admin panel, this is just a second caller of the identical
   * command queue. The website itself refuses (and this returns false) when
   * `targetServerId` isn't currently connected, rather than accepting a
   * command that would just sit there forever.
   */
  public boolean queueCommand(String targetServerId, String command) {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("serverId", serverId);
    body.put("targetServerId", targetServerId);
    body.put("command", command);
    return post("/api/plugin/command", body) != null;
  }

  /* ------------------------------- plumbing ------------------------------- */

  private Map<String, Object> post(String path, Map<String, Object> body) {
    try {
      HttpRequest req = HttpRequest.newBuilder(URI.create(baseUrl + path))
          .timeout(Duration.ofSeconds(8))
          .header("Content-Type", "application/json")
          .header("X-Makong-Secret", secret)
          .POST(HttpRequest.BodyPublishers.ofString(Json.write(body), StandardCharsets.UTF_8))
          .build();
      return send(req, path);
    } catch (Exception e) {
      logWarn.accept(path + " failed: " + e.getMessage());
      return null;
    }
  }

  private Map<String, Object> get(String path) {
    try {
      HttpRequest req = HttpRequest.newBuilder(URI.create(baseUrl + path))
          .timeout(Duration.ofSeconds(8))
          .header("X-Makong-Secret", secret)
          .GET()
          .build();
      return send(req, path);
    } catch (Exception e) {
      logWarn.accept(path + " failed: " + e.getMessage());
      return null;
    }
  }

  private Map<String, Object> send(HttpRequest req, String path) throws IOException, InterruptedException {
    HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
    Map<String, Object> json;
    try {
      json = Json.parseObject(res.body());
    } catch (Exception e) {
      logWarn.accept(path + " returned an unparseable response (HTTP " + res.statusCode() + ")");
      return null;
    }
    if (res.statusCode() >= 300) {
      Object error = json.get("error");
      logWarn.accept(path + " -> " + (error != null ? error : "HTTP " + res.statusCode()));
      return null;
    }
    return json;
  }

  private static String urlEncode(String s) {
    return URLEncoder.encode(s, StandardCharsets.UTF_8);
  }

  @SuppressWarnings("unchecked")
  private static List<Object> listOf(Object value) {
    return value instanceof List ? (List<Object>) value : List.of();
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> mapOf(Object value) {
    return value instanceof Map ? (Map<String, Object>) value : Map.of();
  }

  private static String str(Map<String, Object> o, String key) {
    Object v = o.get(key);
    return v == null ? null : String.valueOf(v);
  }

  private static boolean bool(Map<String, Object> o, String key) {
    return Boolean.TRUE.equals(o.get(key));
  }

  private static List<ServerInfo> parseServers(List<Object> arr) {
    List<ServerInfo> list = new ArrayList<>();
    for (Object el : arr) {
      Map<String, Object> o = mapOf(el);
      ServerInfo s = new ServerInfo();
      s.serverId = str(o, "serverId");
      s.kind = str(o, "kind");
      s.online = bool(o, "online");
      list.add(s);
    }
    return list;
  }

  private static List<QueuedCommand> parseCommands(List<Object> arr) {
    List<QueuedCommand> list = new ArrayList<>();
    for (Object el : arr) {
      Map<String, Object> o = mapOf(el);
      QueuedCommand c = new QueuedCommand();
      c.id = str(o, "id");
      c.command = str(o, "command");
      list.add(c);
    }
    return list;
  }

  private static List<Ping> parsePings(List<Object> arr) {
    List<Ping> list = new ArrayList<>();
    for (Object el : arr) {
      Map<String, Object> o = mapOf(el);
      Ping p = new Ping();
      p.id = str(o, "id");
      p.from = str(o, "from");
      list.add(p);
    }
    return list;
  }

  private static List<Pong> parsePongs(List<Object> arr) {
    List<Pong> list = new ArrayList<>();
    for (Object el : arr) {
      Map<String, Object> o = mapOf(el);
      Pong p = new Pong();
      p.id = str(o, "id");
      p.from = str(o, "from");
      list.add(p);
    }
    return list;
  }

  private static List<ProfileRequest> parseProfileRequests(List<Object> arr) {
    List<ProfileRequest> list = new ArrayList<>();
    for (Object el : arr) {
      Map<String, Object> o = mapOf(el);
      ProfileRequest r = new ProfileRequest();
      r.id = str(o, "id");
      r.from = str(o, "from");
      r.playerName = str(o, "playerName");
      list.add(r);
    }
    return list;
  }

  private static List<ProfileAnswer> parseProfileAnswers(List<Object> arr) {
    List<ProfileAnswer> list = new ArrayList<>();
    for (Object el : arr) {
      Map<String, Object> o = mapOf(el);
      ProfileAnswer a = new ProfileAnswer();
      a.id = str(o, "id");
      a.from = str(o, "from");
      a.data = mapOf(o.get("data"));
      list.add(a);
    }
    return list;
  }

  public static final class PollResult {
    public List<ServerInfo> servers = List.of();
    public List<QueuedCommand> commands = List.of();
    public List<Ping> pings = List.of();
    public List<Pong> pongs = List.of();
    public List<ProfileRequest> profileRequests = List.of();
    public List<ProfileAnswer> profileAnswers = List.of();
  }

  public static final class ServerInfo {
    public String serverId;
    public String kind;
    public boolean online;
  }

  public static final class QueuedCommand {
    public String id;
    public String command;
  }

  public static final class Ping {
    public String id;
    public String from;
  }

  public static final class Pong {
    public String id;
    public String from;
  }

  public static final class ProfileRequest {
    public String id;
    public String from;
    public String playerName;
  }

  public static final class ProfileAnswer {
    public String id;
    public String from;
    public Map<String, Object> data = Map.of();
  }
}
