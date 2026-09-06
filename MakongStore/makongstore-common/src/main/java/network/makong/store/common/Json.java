package network.makong.store.common;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * A tiny, dependency-free JSON reader/writer for the flat request/response
 * shapes used by the website's /api/plugin bridge (see WebsiteBridge). Not a
 * general-purpose JSON library - deliberately minimal so neither plugin needs
 * to depend on (and hope the server provides) a JSON library at runtime.
 */
public final class Json {

  private Json() {}

  @SuppressWarnings("unchecked")
  public static Map<String, Object> parseObject(String json) {
    Object value = new Parser(json).parseValue();
    return value instanceof Map ? (Map<String, Object>) value : new LinkedHashMap<>();
  }

  public static String write(Map<String, ?> object) {
    StringBuilder sb = new StringBuilder();
    writeValue(object, sb);
    return sb.toString();
  }

  private static void writeValue(Object value, StringBuilder sb) {
    if (value == null) {
      sb.append("null");
    } else if (value instanceof String s) {
      writeString(s, sb);
    } else if (value instanceof Boolean || value instanceof Number) {
      sb.append(value);
    } else if (value instanceof Map<?, ?> map) {
      sb.append('{');
      boolean first = true;
      for (Map.Entry<?, ?> e : map.entrySet()) {
        if (!first) sb.append(',');
        first = false;
        writeString(String.valueOf(e.getKey()), sb);
        sb.append(':');
        writeValue(e.getValue(), sb);
      }
      sb.append('}');
    } else if (value instanceof List<?> list) {
      sb.append('[');
      boolean first = true;
      for (Object item : list) {
        if (!first) sb.append(',');
        first = false;
        writeValue(item, sb);
      }
      sb.append(']');
    } else {
      writeString(String.valueOf(value), sb);
    }
  }

  private static void writeString(String s, StringBuilder sb) {
    sb.append('"');
    for (int i = 0; i < s.length(); i++) {
      char c = s.charAt(i);
      switch (c) {
        case '"' -> sb.append("\\\"");
        case '\\' -> sb.append("\\\\");
        case '\n' -> sb.append("\\n");
        case '\r' -> sb.append("\\r");
        case '\t' -> sb.append("\\t");
        default -> {
          if (c < 0x20) sb.append(String.format("\\u%04x", (int) c));
          else sb.append(c);
        }
      }
    }
    sb.append('"');
  }

  private static final class Parser {
    private final String s;
    private int i = 0;

    Parser(String s) {
      this.s = s == null ? "" : s;
    }

    Object parseValue() {
      skipWhitespace();
      if (i >= s.length()) return null;
      char c = s.charAt(i);
      return switch (c) {
        case '{' -> parseObjectValue();
        case '[' -> parseArrayValue();
        case '"' -> parseStringValue();
        case 't', 'f' -> parseBooleanValue();
        case 'n' -> { i += 4; yield null; }
        default -> parseNumberValue();
      };
    }

    Map<String, Object> parseObjectValue() {
      Map<String, Object> map = new LinkedHashMap<>();
      i++; // {
      skipWhitespace();
      if (peek() == '}') { i++; return map; }
      while (true) {
        skipWhitespace();
        String key = parseStringValue();
        skipWhitespace();
        i++; // :
        Object value = parseValue();
        map.put(key, value);
        skipWhitespace();
        char c = peek();
        if (c == ',') { i++; continue; }
        if (c == '}') { i++; break; }
        break;
      }
      return map;
    }

    List<Object> parseArrayValue() {
      List<Object> list = new ArrayList<>();
      i++; // [
      skipWhitespace();
      if (peek() == ']') { i++; return list; }
      while (true) {
        Object value = parseValue();
        list.add(value);
        skipWhitespace();
        char c = peek();
        if (c == ',') { i++; continue; }
        if (c == ']') { i++; break; }
        break;
      }
      return list;
    }

    String parseStringValue() {
      i++; // opening quote
      StringBuilder sb = new StringBuilder();
      while (i < s.length()) {
        char c = s.charAt(i++);
        if (c == '"') break;
        if (c == '\\' && i < s.length()) {
          char esc = s.charAt(i++);
          switch (esc) {
            case '"' -> sb.append('"');
            case '\\' -> sb.append('\\');
            case '/' -> sb.append('/');
            case 'n' -> sb.append('\n');
            case 'r' -> sb.append('\r');
            case 't' -> sb.append('\t');
            case 'b' -> sb.append('\b');
            case 'f' -> sb.append('\f');
            case 'u' -> {
              String hex = s.substring(i, i + 4);
              sb.append((char) Integer.parseInt(hex, 16));
              i += 4;
            }
            default -> sb.append(esc);
          }
        } else {
          sb.append(c);
        }
      }
      return sb.toString();
    }

    Boolean parseBooleanValue() {
      if (s.startsWith("true", i)) { i += 4; return Boolean.TRUE; }
      i += 5; // false
      return Boolean.FALSE;
    }

    Double parseNumberValue() {
      int start = i;
      while (i < s.length() && "-+.eE0123456789".indexOf(s.charAt(i)) >= 0) i++;
      return Double.parseDouble(s.substring(start, i));
    }

    void skipWhitespace() {
      while (i < s.length() && Character.isWhitespace(s.charAt(i))) i++;
    }

    char peek() {
      return i < s.length() ? s.charAt(i) : 0;
    }
  }
}
