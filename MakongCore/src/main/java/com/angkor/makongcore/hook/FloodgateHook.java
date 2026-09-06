package com.angkor.makongcore.hook;

import org.bukkit.entity.Player;
import org.bukkit.plugin.Plugin;
import org.bukkit.plugin.java.JavaPlugin;

import java.lang.reflect.Method;
import java.util.UUID;

/** Optional Floodgate integration. Uses reflection so MakongCore has no Floodgate compile-time dependency. */
public final class FloodgateHook {
    private final JavaPlugin plugin;
    private Object api;
    private Method isFloodgatePlayer;
    private Method getPlayer;
    private Method getCorrectUsername;
    private Method getXuid;

    public FloodgateHook(JavaPlugin plugin) {
        this.plugin = plugin;
    }

    public boolean enable() {
        Plugin floodgate = plugin.getServer().getPluginManager().getPlugin("floodgate");
        if (floodgate == null || !floodgate.isEnabled()) return false;
        try {
            Class<?> apiClass = Class.forName("org.geysermc.floodgate.api.FloodgateApi", false,
                    floodgate.getClass().getClassLoader());
            Method getInstance = apiClass.getMethod("getInstance");
            api = getInstance.invoke(null);
            isFloodgatePlayer = apiClass.getMethod("isFloodgatePlayer", UUID.class);
            getPlayer = apiClass.getMethod("getPlayer", UUID.class);
            Class<?> playerClass = Class.forName("org.geysermc.floodgate.api.player.FloodgatePlayer", false,
                    floodgate.getClass().getClassLoader());
            getCorrectUsername = playerClass.getMethod("getCorrectUsername");
            getXuid = playerClass.getMethod("getXuid");
            return true;
        } catch (ReflectiveOperationException | LinkageError ex) {
            plugin.getLogger().warning("Floodgate was found but could not be hooked: " + ex.getClass().getSimpleName());
            api = null;
            return false;
        }
    }

    public boolean isAvailable() { return api != null; }

    public boolean isBedrock(UUID uuid) {
        if (api == null) return false;
        try { return (boolean) isFloodgatePlayer.invoke(api, uuid); }
        catch (ReflectiveOperationException | RuntimeException ex) { return false; }
    }

    public boolean isBedrock(Player player) { return isBedrock(player.getUniqueId()); }

    public String username(UUID uuid, String fallback) {
        if (api == null) return fallback;
        try {
            Object fp = getPlayer.invoke(api, uuid);
            if (fp == null) return fallback;
            Object value = getCorrectUsername.invoke(fp);
            return value instanceof String s && !s.isBlank() ? s : fallback;
        } catch (ReflectiveOperationException | RuntimeException ex) { return fallback; }
    }

    public String xuid(UUID uuid) {
        if (api == null) return null;
        try {
            Object fp = getPlayer.invoke(api, uuid);
            if (fp == null) return null;
            Object value = getXuid.invoke(fp);
            return value instanceof String s ? s : null;
        } catch (ReflectiveOperationException | RuntimeException ex) { return null; }
    }
}
