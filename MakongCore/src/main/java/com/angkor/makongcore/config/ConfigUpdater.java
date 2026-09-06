package com.angkor.makongcore.config;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.logging.Logger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Adds any config key present in a bundled default resource but missing
 * from the corresponding on-disk file - e.g. a website: section added to
 * config.yml in a later MakongCore version, or a new sub-key added to an
 * already-existing module/*.yml section. Existing keys (their values,
 * comments and formatting) are left completely untouched; only whole new
 * key "blocks" - the key's own line, everything nested under it, and its
 * immediately preceding comment lines - are spliced in, verbatim from the
 * bundled resource, right back where they sit in the shipped default:
 * anchored just before whichever later sibling key still exists on disk
 * (falling back to the end of the parent section, or end of file for a
 * top-level key, only if every later sibling is also new).
 *
 * This works on raw text rather than round-tripping through
 * YamlConfiguration, since Bukkit's YAML writer silently drops every #
 * comment on save - unacceptable for files this heavily documented.
 * Deliberately has no Bukkit dependency so it can be unit-tested standalone.
 */
public final class ConfigUpdater {
    private static final Pattern KEY_LINE = Pattern.compile("^(\\s*)([A-Za-z0-9_.-]+):(?:\\s.*)?$");

    private ConfigUpdater() {}

    /** Returns true (and rewrites the file) if any key was added. */
    public static boolean update(File onDisk, InputStream bundled, Logger logger) {
        List<String> defaultLines, diskLines;
        try {
            defaultLines = readLines(bundled);
            diskLines = readLines(new FileInputStream(onDisk));
        } catch (IOException e) {
            logger.warning("Could not check " + onDisk.getName() + " for missing config keys: " + e.getMessage());
            return false;
        }

        Set<String> existingPaths = collectPaths(diskLines);
        Result parsed = findNewBlocks(defaultLines, existingPaths, diskLines.isEmpty());
        List<Block> newBlocks = parsed.blocks;
        if (newBlocks.isEmpty()) return false;

        List<String> merged = new ArrayList<>(diskLines);
        int[] insertAt = new int[newBlocks.size()];
        for (int i = 0; i < newBlocks.size(); i++) {
            Block b = newBlocks.get(i);
            insertAt[i] = insertionIndex(merged, b, parsed.childOrder, existingPaths);
        }

        List<Integer> order = new ArrayList<>();
        for (int i = 0; i < newBlocks.size(); i++) order.add(i);
        // Apply furthest-down insertion first so earlier (not-yet-applied)
        // indices stay valid as the list grows. Two new siblings that both
        // fall back to the same "end of section" anchor tie on insertAt -
        // break ties by bundled-file order descending too (process the one
        // that appears LATER in the bundled file first), so repeatedly
        // inserting at the same growing position still ends up in original
        // top-to-bottom order rather than reversed.
        order.sort((a, z) -> {
            int cmp = Integer.compare(insertAt[z], insertAt[a]);
            return cmp != 0 ? cmp : Integer.compare(z, a);
        });

        List<String> added = new ArrayList<>();
        for (int idx : order) {
            Block b = newBlocks.get(idx);
            int at = Math.max(0, Math.min(insertAt[idx], merged.size()));
            List<String> toInsert = new ArrayList<>(b.lines);
            if (b.trailingBlank && at < merged.size() && !merged.get(at).isBlank()) toInsert.add("");
            if (b.leadingBlank && at > 0 && !merged.get(at - 1).isBlank()) toInsert.add(0, "");
            merged.addAll(at, toInsert);
            added.add(b.path);
        }

        try {
            Files.write(onDisk.toPath(), merged, StandardCharsets.UTF_8);
        } catch (IOException e) {
            logger.warning("Could not write updated " + onDisk.getName() + ": " + e.getMessage());
            return false;
        }
        Collections.reverse(added);
        logger.info(onDisk.getName() + ": added missing config key(s): " + String.join(", ", added));
        return true;
    }

    private static List<String> readLines(InputStream in) throws IOException {
        try (BufferedReader r = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
            List<String> lines = new ArrayList<>();
            String line;
            while ((line = r.readLine()) != null) lines.add(line);
            return lines;
        }
    }

    private static int indentOf(String line) {
        int i = 0;
        while (i < line.length() && line.charAt(i) == ' ') i++;
        return i;
    }

    private static boolean isBlank(String line) { return line.isBlank(); }
    private static boolean isComment(String line) { return line.strip().startsWith("#"); }

    /** Every dotted key path present anywhere in `lines` (list items excluded). */
    private static Set<String> collectPaths(List<String> lines) {
        Set<String> paths = new HashSet<>();
        List<String> pathStack = new ArrayList<>();
        List<Integer> indentStack = new ArrayList<>();
        for (String line : lines) {
            if (isBlank(line) || isComment(line)) continue;
            Matcher m = KEY_LINE.matcher(line);
            if (!m.matches()) continue; // list item or malformed - ignore
            int indent = m.group(1).length();
            String key = m.group(2);
            while (!indentStack.isEmpty() && indentStack.get(indentStack.size() - 1) >= indent) {
                indentStack.remove(indentStack.size() - 1);
                pathStack.remove(pathStack.size() - 1);
            }
            String path = pathStack.isEmpty() ? key : pathStack.get(pathStack.size() - 1) + "." + key;
            indentStack.add(indent);
            pathStack.add(path);
            paths.add(path);
        }
        return paths;
    }

    // leadingBlank/trailingBlank: whether the bundled *source* file itself
    // had a blank line right before/after this key's block - a child key
    // sitting directly under its parent with no gap (e.g. the first entry
    // in a nested map) must NOT gain a blank line it never had just because
    // it happens to land next to non-blank content on disk.
    private record Block(String path, String parentPath, List<String> lines, boolean leadingBlank, boolean trailingBlank) {}

    // blocks: every new key found, in bundled-file order. childOrder: for
    // every parent path (including "" for top-level), the full ordered list
    // of its direct children as they appear in the bundled file - existing
    // and new alike - used afterwards to anchor a new key's placement to
    // whichever of its original neighbors still exists on disk.
    private record Result(List<Block> blocks, java.util.Map<String, List<String>> childOrder) {}

    private static Result findNewBlocks(List<String> lines, Set<String> existingPaths, boolean diskWasEmpty) {
        List<Block> blocks = new ArrayList<>();
        java.util.Map<String, List<String>> childOrder = new java.util.HashMap<>();
        List<String> pathStack = new ArrayList<>();
        List<Integer> indentStack = new ArrayList<>();
        List<String> pending = new ArrayList<>();
        int i = 0;
        while (i < lines.size()) {
            String line = lines.get(i);
            if (isBlank(line) || isComment(line)) { pending.add(line); i++; continue; }
            Matcher m = KEY_LINE.matcher(line);
            if (!m.matches()) { pending.clear(); i++; continue; }
            int indent = m.group(1).length();
            String key = m.group(2);
            while (!indentStack.isEmpty() && indentStack.get(indentStack.size() - 1) >= indent) {
                indentStack.remove(indentStack.size() - 1);
                pathStack.remove(pathStack.size() - 1);
            }
            String parentPath = pathStack.isEmpty() ? "" : pathStack.get(pathStack.size() - 1);
            String path = parentPath.isEmpty() ? key : parentPath + "." + key;
            childOrder.computeIfAbsent(parentPath, k -> new ArrayList<>()).add(path);

            if (existingPaths.contains(path)) {
                indentStack.add(indent);
                pathStack.add(path);
                pending.clear();
                i++;
                continue;
            }

            // New key - its whole subtree (list items, nested maps, whatever
            // follows at a deeper indent) is new too, so grab it as one block
            // instead of recursing key-by-key into it.
            int end = i + 1;
            while (end < lines.size()) {
                String next = lines.get(end);
                if (isBlank(next)) { end++; continue; }
                if (indentOf(next) > indent) { end++; continue; }
                break;
            }
            int trimmedEnd = end;
            while (trimmedEnd > i + 1 && lines.get(trimmedEnd - 1).isBlank()) trimmedEnd--;

            // Only the trailing *contiguous* run of comment lines in
            // `pending` is this key's own leading comment - a blank line
            // anywhere in `pending` marks the boundary of an unrelated,
            // earlier block (up to and including the whole file's own
            // header banner, if this new key happens to be the first key
            // in the file), which must NOT be dragged along too. Exception:
            // if the on-disk file was completely empty, there's nothing it
            // could duplicate against, so the very first key found may as
            // well keep the whole leading comment - otherwise a purely
            // decorative top-of-file header banner would be silently lost
            // when rebuilding a wiped-out file from scratch.
            int start;
            if (diskWasEmpty && blocks.isEmpty()) {
                start = 0;
                while (start < pending.size() && isBlank(pending.get(start))) start++;
            } else {
                start = pending.size();
                while (start > 0 && isComment(pending.get(start - 1))) start--;
            }
            int blockAbsStart = (i - pending.size()) + start;
            boolean leadingBlank = blockAbsStart > 0 && isBlank(lines.get(blockAbsStart - 1));
            boolean trailingBlank = trimmedEnd < end;

            List<String> block = new ArrayList<>();
            for (int k = start; k < pending.size(); k++) block.add(pending.get(k));
            block.addAll(lines.subList(i, trimmedEnd));

            blocks.add(new Block(path, parentPath, block, leadingBlank, trailingBlank));
            pending.clear();
            i = end;
        }
        return new Result(blocks, childOrder);
    }

    /**
     * Where to splice a new key's block into the on-disk file. Prefers
     * inserting right before whichever of the key's original bundled-file
     * neighbors comes next AND still exists on disk - so a brand new
     * top-level section lands back between the same two sections it sits
     * between in the shipped default, not dumped at the end of the file, and
     * likewise for a new key inside an existing section. Falls back to the
     * end of the parent section (or end of file for a top-level key) only
     * when no later sibling survives on disk to anchor against.
     */
    private static int insertionIndex(List<String> lines, Block block, java.util.Map<String, List<String>> childOrder, Set<String> existingPaths) {
        List<String> siblings = childOrder.getOrDefault(block.parentPath, List.of());
        int myIndex = siblings.indexOf(block.path);
        for (int k = myIndex + 1; k < siblings.size(); k++) {
            if (!existingPaths.contains(siblings.get(k))) continue;
            int at = keyLineIndex(lines, siblings.get(k));
            if (at >= 0) return precedingCommentStart(lines, at);
        }
        return endOfSection(lines, block.parentPath);
    }

    /** Line index of the given (already-existing) path's own key line, or -1. */
    private static int keyLineIndex(List<String> lines, String targetPath) {
        List<String> pathStack = new ArrayList<>();
        List<Integer> indentStack = new ArrayList<>();
        for (int i = 0; i < lines.size(); i++) {
            String line = lines.get(i);
            if (isBlank(line) || isComment(line)) continue;
            Matcher m = KEY_LINE.matcher(line);
            if (!m.matches()) continue;
            int indent = m.group(1).length();
            String key = m.group(2);
            while (!indentStack.isEmpty() && indentStack.get(indentStack.size() - 1) >= indent) {
                indentStack.remove(indentStack.size() - 1);
                pathStack.remove(pathStack.size() - 1);
            }
            String path = pathStack.isEmpty() ? key : pathStack.get(pathStack.size() - 1) + "." + key;
            indentStack.add(indent);
            pathStack.add(path);
            if (path.equals(targetPath)) return i;
        }
        return -1;
    }

    /** Walks back over comment lines immediately above `keyLine` so a key's own leading comment moves with it. */
    private static int precedingCommentStart(List<String> lines, int keyLine) {
        int start = keyLine;
        while (start > 0 && isComment(lines.get(start - 1))) start--;
        return start;
    }

    /** Index in `lines` right after the given (already-existing) parent section's last line, or end-of-file for a top-level key. */
    private static int endOfSection(List<String> lines, String parentPath) {
        if (parentPath.isEmpty()) return lines.size();
        int parentLine = keyLineIndex(lines, parentPath);
        if (parentLine < 0) return lines.size();
        int parentIndent = indentOf(lines.get(parentLine));
        int end = parentLine + 1;
        while (end < lines.size()) {
            String next = lines.get(end);
            if (next.isBlank()) { end++; continue; }
            if (indentOf(next) > parentIndent) { end++; continue; }
            break;
        }
        while (end > parentLine + 1 && lines.get(end - 1).isBlank()) end--;
        return end;
    }
}
