package com.angkor.makongcore.web;

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
 * side of this protocol. Platform-agnostic (no Bukkit/Velocity imports) so
 * both the Paper and Velocity plugins share this exact class unmodified.
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

  /** The repeating heartbeat/work call - also doubles as a liveness ping. */
  public PollResult poll() {
    Map<String, Object> res = get("/api/plugin/poll?serverId=" + urlEncode(serverId));
    if (res == null) return null;
    PollResult result = new PollResult();
    result.servers = parseServers(listOf(res.get("servers")));
    result.commands = parseCommands(listOf(res.get("commands")));
    result.pings = parsePings(listOf(res.get("pings")));
    result.pongs = parsePongs(listOf(res.get("pongs")));
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

  public static final class PollResult {
    public List<ServerInfo> servers = List.of();
    public List<QueuedCommand> commands = List.of();
    public List<Ping> pings = List.of();
    public List<Pong> pongs = List.of();
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
}
