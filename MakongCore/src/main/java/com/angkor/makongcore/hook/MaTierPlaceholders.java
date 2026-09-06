package com.angkor.makongcore.hook;

import com.angkor.makongcore.service.MaTierService;
import me.clip.placeholderapi.expansion.PlaceholderExpansion;
import org.bukkit.OfflinePlayer;
import org.jetbrains.annotations.NotNull;

import java.util.Locale;

/**
 * Optional PlaceholderAPI integration: %matier% (current tier, M9-M1) and
 * %matier_star% (current Star count). Only ever loaded if PlaceholderAPI is
 * installed - see plugin.yml's softdepend and MakongCore#registerRuntime,
 * which is the only place this class is referenced.
 */
public final class MaTierPlaceholders extends PlaceholderExpansion {
    private final MaTierService matier;

    public MaTierPlaceholders(MaTierService matier) {
        this.matier = matier;
    }

    @Override public @NotNull String getIdentifier() { return "matier"; }
    @Override public @NotNull String getAuthor() { return "Angkor"; }
    @Override public @NotNull String getVersion() { return "1.0"; }
    @Override public boolean persist() { return true; }

    @Override
    public String onRequest(OfflinePlayer player, @NotNull String params) {
        if (player == null) return "";
        return switch (params.toLowerCase(Locale.ROOT)) {
            case "", "tier" -> matier.tier(player.getUniqueId());
            case "star", "stars" -> String.valueOf(matier.stars(player.getUniqueId()));
            default -> null;
        };
    }
}
