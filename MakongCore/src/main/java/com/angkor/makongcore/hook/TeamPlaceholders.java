package com.angkor.makongcore.hook;

import com.angkor.makongcore.config.ModuleConfig;
import com.angkor.makongcore.model.Team;
import com.angkor.makongcore.service.TeamService;
import com.angkor.makongcore.util.Text;
import me.clip.placeholderapi.expansion.PlaceholderExpansion;
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;
import org.bukkit.OfflinePlayer;
import org.jetbrains.annotations.NotNull;

import java.util.Locale;
import java.util.Map;

/**
 * Optional PlaceholderAPI integration: %team_tag% (colored) and %team_star%.
 * Only ever loaded if PlaceholderAPI is installed - see plugin.yml's
 * softdepend and MakongCore#registerRuntime, which is the only place this
 * class is referenced.
 */
public final class TeamPlaceholders extends PlaceholderExpansion {
    // Team color is stored as a dye name (see GuiManager#colorMaterial), not
    // a MiniMessage-recognized one (things like "orange"/"lime"/"cyan" aren't
    // valid text colors) - map each to its real Minecraft dye/wool hex so
    // %team_tag% renders in the team's actual chosen color, not a fallback.
    private static final Map<String, String> DYE_HEX = Map.ofEntries(
            Map.entry("white", "#FFFFFF"), Map.entry("light_gray", "#9D9D97"),
            Map.entry("gray", "#474F52"), Map.entry("black", "#1D1D21"),
            Map.entry("brown", "#835432"), Map.entry("red", "#B02E26"),
            Map.entry("orange", "#F9801D"), Map.entry("yellow", "#FED83D"),
            Map.entry("lime", "#80C71F"), Map.entry("green", "#5E7C16"),
            Map.entry("cyan", "#169C9C"), Map.entry("light_blue", "#3AB3DA"),
            Map.entry("blue", "#3C44AA"), Map.entry("purple", "#8932B8"),
            Map.entry("magenta", "#C74EBD"), Map.entry("pink", "#F38BAA"));

    private final TeamService teams;
    // Kept as the ModuleConfig wrapper (not a resolved FileConfiguration or
    // String) so a reload - team.yml's own via ModuleConfig#reload(), or a
    // /mateam reload team - is picked up on the very next placeholder
    // request without needing to re-register this expansion.
    private final ModuleConfig teamConfig;

    public TeamPlaceholders(TeamService teams, ModuleConfig teamConfig) {
        this.teams = teams;
        this.teamConfig = teamConfig;
    }

    @Override public @NotNull String getIdentifier() { return "team"; }
    @Override public @NotNull String getAuthor() { return "Angkor"; }
    @Override public @NotNull String getVersion() { return "1.0"; }
    @Override public boolean persist() { return true; }

    @Override
    public String onRequest(OfflinePlayer player, @NotNull String params) {
        if (player == null) return "";
        Team t = teams.byPlayer(player.getUniqueId());
        return switch (params.toLowerCase(Locale.ROOT)) {
            case "tag" -> t == null ? noTeamText() : coloredTag(t);
            case "star", "stars" -> String.valueOf(t == null ? 0 : t.stars());
            default -> null;
        };
    }

    // Configurable via team.placeholders.no_team in module/team.yml, so
    // server owners can pick what shows in place of %team_tag% for a
    // player who isn't in any team (e.g. "<gray>No Team</gray>", or blank
    // to keep the old behavior).
    private String noTeamText() {
        String raw = teamConfig.get().getString("team.placeholders.no_team", "<gray>No Team</gray>");
        return LegacyComponentSerializer.legacySection().serialize(Text.mm(raw));
    }

    private String coloredTag(Team t) {
        String hex = DYE_HEX.getOrDefault(
                t.color() == null ? "" : t.color().toLowerCase(Locale.ROOT), "#55FFFF");
        return LegacyComponentSerializer.legacySection().serialize(
                Text.mm("<" + hex + ">" + t.tag() + "</" + hex + ">"));
    }
}
