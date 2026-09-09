package com.angkor.makongcore.listener;

import com.angkor.makongcore.model.Team;
import com.angkor.makongcore.service.TeamService;
import org.bukkit.entity.Player;
import org.bukkit.entity.Projectile;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.EntityDamageByEntityEvent;

// Enforces each team's own pvp toggle (module/team.yml's team.pvp, the
// GUI's PvP button - only the team owner can flip it, see GuiListener)
// as FRIENDLY FIRE, and only friendly fire: whether two members of the
// SAME team can damage each other. Damage to or from anyone outside the
// attacker's own team is never touched here - team.pvp only ever governs
// what a team's own members can do to one another.
public final class TeamPvpListener implements Listener {
    private final TeamService teams;

    public TeamPvpListener(TeamService teams) {
        this.teams = teams;
    }

    @EventHandler
    public void onDamage(EntityDamageByEntityEvent e) {
        if (!(e.getEntity() instanceof Player victim)) return;
        Player attacker = attacker(e);
        if (attacker == null || attacker.getUniqueId().equals(victim.getUniqueId())) return;
        Team victimTeam = teams.byPlayer(victim.getUniqueId());
        if (victimTeam == null) return;
        Team attackerTeam = teams.byPlayer(attacker.getUniqueId());
        if (attackerTeam == null || !attackerTeam.id().equals(victimTeam.id())) return;
        if (!victimTeam.pvp()) e.setCancelled(true);
    }

    // Resolves the actual attacking player, including indirect damage
    // (arrows, tridents, thrown potions, etc.) via the projectile's shooter.
    private Player attacker(EntityDamageByEntityEvent e) {
        if (e.getDamager() instanceof Player p) return p;
        if (e.getDamager() instanceof Projectile proj && proj.getShooter() instanceof Player p) return p;
        return null;
    }
}
