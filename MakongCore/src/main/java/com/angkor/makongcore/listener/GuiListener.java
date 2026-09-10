package com.angkor.makongcore.listener;

import com.angkor.makongcore.MakongCore;
import com.angkor.makongcore.gui.GuiManager;
import com.angkor.makongcore.gui.TeamHolder;
import com.angkor.makongcore.model.*;
import com.angkor.makongcore.service.TeamService;
import com.angkor.makongcore.util.Text;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.event.*;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.SkullMeta;

import java.util.*;

public final class GuiListener implements Listener {
    private final MakongCore plugin; private final TeamService ts; private final GuiManager gui;
    public GuiListener(MakongCore plugin,TeamService ts,GuiManager gui){this.plugin=plugin;this.ts=ts;this.gui=gui;}

    @EventHandler(priority=EventPriority.NORMAL)
    public void click(InventoryClickEvent e){
        if(!(e.getWhoClicked() instanceof Player p))return;
        if(!(e.getView().getTopInventory().getHolder() instanceof TeamHolder h))return;
        e.setCancelled(true);
        if(e.getClickedInventory()!=e.getView().getTopInventory())return;
        int slot=e.getRawSlot();
        String type=h.type();

        switch(type){
            case "no-team" -> noTeam(p,slot);
            case "create-color" -> createColor(p,h,slot);
            case "team" -> team(p,h,slot,e.getCurrentItem());
            case "leaderboard" -> leaderboard(p,h,slot);
            case "browse" -> browse(p,h,slot);
            case "team-info" -> teamInfo(p,h,slot);
            case "invites" -> invites(p,slot,e.isLeftClick());
            case "settings" -> settings(p,slot);
            case "member" -> member(p,h,slot);
            case "join-requests" -> requests(p,slot,e.isLeftClick());
            case "allies" -> allies(p,slot);
            default -> { if(type.startsWith("confirm:")) confirm(p,type.substring(8),h.data(),slot); }
        }
    }

    private void noTeam(Player p,int slot){
        if(slot==gui.slot("items.no_team.create.slot",11)){ChatListener.beginCreate(p);p.closeInventory();}
        else if(slot==gui.slot("items.no_team.browse.slot",13))gui.openBrowse(p,1);
        else if(slot==gui.slot("items.no_team.top.slot",15))gui.openLeaderboard(p,1,"stars");
        else if(slot==gui.slot("items.no_team.invites.slot",22))gui.openInvites(p);
    }

    private void createColor(Player p,TeamHolder h,int slot){
        Team t=teamByData(h.data()); if(t==null||!t.hasMember(p.getUniqueId())){p.closeInventory();return;}
        if(slot==gui.slot("items.color.cancel.slot",22)){p.closeInventory();p.sendMessage(Text.mm("<yellow>Team creation cancelled.</yellow>"));return;}
        String color=gui.colorForSlot(slot); if(color==null)return;
        t.setColor(color);ts.save(t);
        p.sendMessage(Text.mm("<green>Team color selected: <white>"+color+"</white>.</green>"));
        gui.openTeam(p,t);
    }

    private void team(Player p,TeamHolder h,int slot,ItemStack clicked){
        Team t=ts.byPlayer(p.getUniqueId());if(t==null){gui.openNoTeam(p);return;}
        if(slot<36){
            if(clicked!=null&&clicked.getItemMeta() instanceof SkullMeta sm&&sm.getOwningPlayer()!=null){
                UUID target=sm.getOwningPlayer().getUniqueId();
                TeamMember me=t.member(p.getUniqueId());
                if(me!=null&&me.role()!=TeamRole.MEMBER&&!target.equals(p.getUniqueId()))gui.openMember(p,t,target);
            } return;
        }
        final int infoSlot=gui.slot("items.team.info.slot",45), pvpSlot=gui.slot("items.team.pvp.slot",46), requestsSlot=gui.slot("items.team.requests.slot",47), alliesSlot=gui.slot("items.team.allies.slot",48), filterSlot=gui.slot("items.team.filter.slot",49), settingsSlot=gui.slot("items.team.settings.slot",50), browseSlot=gui.slot("items.team.browse.slot",51), topSlot=gui.slot("items.team.leaderboard.slot",52), leaveSlot=gui.slot("items.team.leave.slot",53);
        if(slot==infoSlot){gui.openTeamInfo(p,t,false);return;}
        if(slot==pvpSlot){if(!ts.settings().pvpEnabled()){p.sendMessage(Text.mm("<red>Team PvP is disabled.</red>"));return;} TeamMember me=t.member(p.getUniqueId());if(me==null||me.role()!=TeamRole.OWNER){p.sendMessage(Text.mm("<red>Only the team owner can toggle PvP.</red>"));return;} t.setPvp(!t.pvp());ts.save(t);p.sendMessage(Text.mm("<green>Team PvP is now "+(t.pvp()?"<white>ON":"<white>OFF")+"</white>.</green>"));gui.openTeam(p,t,h.data()==null?"join_date":h.data());return;}
        if(slot==requestsSlot){TeamMember me=t.member(p.getUniqueId());if(me!=null&&me.role()!=TeamRole.MEMBER)gui.openJoinRequests(p,t);return;}
        if(slot==alliesSlot){if(ts.settings().alliesEnabled())gui.openAllies(p,t);else p.sendMessage(Text.mm("<red>Team allies are disabled.</red>"));return;}
        if(slot==filterSlot){
            String current=h.data()==null?"join_date":h.data();
            List<String> modes=plugin.gui().config().cfgList("items.team.filter.modes",List.of("join_date","kills","name"));
            if(modes.isEmpty()) modes=List.of("join_date","kills","name");
            int idx=modes.indexOf(current); if(idx<0) idx=0;
            String next=modes.get((idx+1)%modes.size());
            gui.openTeam(p,t,next); return;
        }
        if(slot==settingsSlot){TeamMember me=t.member(p.getUniqueId());if(me!=null&&me.role()!=TeamRole.MEMBER)gui.openSettings(p,t);return;}
        if(slot==browseSlot){gui.openBrowse(p,1);return;}
        if(slot==topSlot){gui.openLeaderboard(p,1,"stars");return;}
        if(slot==leaveSlot){TeamMember me=t.member(p.getUniqueId());if(me!=null)gui.openConfirm(p,me.role()==TeamRole.OWNER?"disband":"leave",t.name(),t.id().toString());return;}
        // member head clicks are handled below.
    }

    private void leaderboard(Player p,TeamHolder h,int slot){
        if(slot==gui.slot("items.leaderboard.star.slot",2)){gui.openLeaderboard(p,h.page(),"stars");return;}
        if(slot==gui.slot("items.leaderboard.kills.slot",4)){gui.openLeaderboard(p,h.page(),"kills");return;}
        if(slot==gui.slot("items.leaderboard.kdr.slot",6)){gui.openLeaderboard(p,h.page(),"kdr");return;}
        if(slot==gui.slot("items.leaderboard.previous.slot",45)){gui.openLeaderboard(p,h.page()-1,h.data());return;}
        if(slot==gui.slot("items.leaderboard.next.slot",53)){gui.openLeaderboard(p,h.page()+1,h.data());return;}
        if(slot==gui.slot("items.leaderboard.back.slot",49)){gui.open(p);return;}
        if(slot>=9&&slot<45){int index=(h.page()-1)*36+(slot-9);List<Team> list=leaderboardList(h.data());if(index<list.size())gui.openTeamInfo(p,list.get(index),ts.byPlayer(p.getUniqueId())==null);}
    }

    private List<Team> leaderboardList(String mode){
        List<Team> list=new ArrayList<>(ts.all());
        Comparator<Team> c=switch(mode){case"kills"->Comparator.comparingLong(Team::kills).reversed();case"kdr"->Comparator.comparingDouble(this::kdr).reversed();default->Comparator.comparingLong(Team::stars).reversed();};
        list.sort(c.thenComparing(Team::name,String.CASE_INSENSITIVE_ORDER));return list;
    }
    private double kdr(Team t){return t.deaths()==0?t.kills():(double)t.kills()/t.deaths();}

    private void browse(Player p,TeamHolder h,int slot){
        if(slot==gui.slot("items.browse.previous.slot",45)){gui.openBrowse(p,h.page()-1);return;}
        if(slot==gui.slot("items.browse.next.slot",53)){gui.openBrowse(p,h.page()+1);return;}
        if(slot==gui.slot("items.browse.back.slot",49)){gui.open(p);return;}
        if(slot>=0&&slot<45){int index=(h.page()-1)*45+slot;List<Team> list=ts.all().stream().sorted(Comparator.comparing(Team::name,String.CASE_INSENSITIVE_ORDER)).toList();if(index<list.size())gui.openTeamInfo(p,list.get(index),ts.byPlayer(p.getUniqueId())==null);}
    }

    private void teamInfo(Player p,TeamHolder h,int slot){
        if(slot==gui.slot("items.team_info.back.slot",22)){if(ts.byPlayer(p.getUniqueId())==null)gui.openNoTeam(p);else gui.open(p);return;}
        if(slot==gui.slot("items.team_info.join.slot",20)){Team t=teamByData(h.data());if(t==null)return;if(ts.byPlayer(p.getUniqueId())!=null){p.sendMessage(Text.mm("<red>You are already in a team.</red>"));return;}if(!t.isPublic()){p.sendMessage(Text.mm("<red>That team is private.</red>"));return;}ts.request(p.getUniqueId(),t.id());p.sendMessage(Text.mm("<green>Join request sent to <white>"+t.name()+"</white>.</green>"));return;}
    }

    private void invites(Player p,int slot,boolean left){
        if(slot==gui.slot("items.invites.back.slot",22)){gui.open(p);return;}if(slot!=gui.slot("items.invites.entry.slot",13))return;
        TeamService.Invite i=ts.invite(p.getUniqueId());if(i==null){gui.openInvites(p);return;}Team t=ts.team(i.team());
        if(t==null){ts.clearInvite(p.getUniqueId());gui.openInvites(p);return;}
        if(left){if(ts.addMember(t,p.getUniqueId(),p.getName(),TeamRole.MEMBER)){ts.clearInvite(p.getUniqueId());p.sendMessage(Text.mm("<green>You joined <white>"+t.name()+"</white>.</green>"));gui.openTeam(p,t);}else p.sendMessage(Text.mm("<red>Could not join; the team may be full.</red>"));}
        else{ts.clearInvite(p.getUniqueId());p.sendMessage(Text.mm("<gray>Invitation declined.</gray>"));gui.openNoTeam(p);}
    }

    private void settings(Player p,int slot){
        Team t=ts.byPlayer(p.getUniqueId());if(t==null){gui.openNoTeam(p);return;}TeamMember me=t.member(p.getUniqueId());if(me==null||me.role()==TeamRole.MEMBER){gui.openTeam(p,t);return;}
        if(slot==gui.slot("items.settings.tag.slot",10)){ChatListener.beginChangeTag(p);return;}
        if(slot==gui.slot("items.settings.description.slot",12)){ChatListener.beginDescription(p);return;}
        if(slot==gui.slot("items.settings.status.slot",14)){t.setPublic(!t.isPublic());ts.save(t);p.sendMessage(Text.mm("<green>Team is now "+(t.isPublic()?"<white>Public":"<white>Private")+"</white>.</green>"));gui.openSettings(p,t);return;}
        if(slot==gui.slot("items.settings.color.slot",16)){gui.openColor(p,t);return;}
        if(slot==gui.slot("items.settings.back.slot",22))gui.openTeam(p,t);
    }

    private void member(Player p,TeamHolder h,int slot){
        Team t=ts.byPlayer(p.getUniqueId());if(t==null){gui.openNoTeam(p);return;}TeamMember me=t.member(p.getUniqueId());if(me==null)return;
        UUID target=uuid(h.data());TeamMember tm=t.member(target);if(tm==null){gui.openTeam(p,t);return;}
        boolean owner=me.role()==TeamRole.OWNER,admin=me.role()==TeamRole.ADMIN;
        if(slot==gui.slot("items.member.back.slot",22)){gui.openTeam(p,t,h.data()==null?"join_date":h.data());return;}
        if(slot==gui.slot("items.member.promote.slot",12)&&owner){
            if(tm.role()==TeamRole.MEMBER){t.removeMember(target);t.addMember(new TeamMember(tm.uuid(),tm.name(),TeamRole.ADMIN,tm.joinedAt(),tm.lastSeen(),tm.server()));ts.save(t);p.sendMessage(Text.mm("<green>Promoted.</green>"));gui.openMember(p,t,target);}
            else if(tm.role()==TeamRole.ADMIN){t.removeMember(target);t.addMember(new TeamMember(tm.uuid(),tm.name(),TeamRole.MEMBER,tm.joinedAt(),tm.lastSeen(),tm.server()));ts.save(t);p.sendMessage(Text.mm("<green>Demoted.</green>"));gui.openMember(p,t,target);}
        } else if(slot==gui.slot("items.member.kick.slot",14)&&(owner||admin)&&tm.role()!=TeamRole.OWNER&&!target.equals(p.getUniqueId())){
            gui.openConfirm(p,"kick",tm.name(),target.toString());
        } else if(slot==gui.slot("items.member.transfer.slot",16)&&owner&&tm.role()!=TeamRole.OWNER){
            gui.openConfirm(p,"transfer",tm.name(),target.toString());
        }
    }

    private void requests(Player p,int slot,boolean left){
        Team t=ts.byPlayer(p.getUniqueId());if(t==null)return;TeamMember me=t.member(p.getUniqueId());if(me==null||me.role()==TeamRole.MEMBER)return;
        if(slot==gui.slot("items.join_requests.back.slot",49)){gui.openTeam(p,t);return;}if(slot<9||slot>44)return;
        int index=slot-9;List<TeamService.Request> rs=ts.requestsFor(t.id());if(index>=rs.size())return;
        TeamService.Request r=rs.get(index);OfflinePlayerName(p,r.player(),t,left);
    }
    private void OfflinePlayerName(Player p,UUID player,Team t,boolean accept){
        if(accept){
            if(ts.addMember(t,player,Bukkit.getOfflinePlayer(player).getName(),TeamRole.MEMBER)){ts.clearRequest(player);p.sendMessage(Text.mm("<green>Request accepted.</green>"));}else p.sendMessage(Text.mm("<red>Could not accept; team may be full or player is already in a team.</red>"));
        }else{ts.clearRequest(player);p.sendMessage(Text.mm("<gray>Request denied.</gray>"));}
        gui.openJoinRequests(p,t);
    }

    // Slots split into two ranges (see GuiManager#openAllies): existing
    // allies (click to remove, via the confirm screen like everything else
    // destructive) starting at items.allies.entry.slot, and pending
    // incoming requests (click to open the accept/deny confirm screen -
    // two separate tappable items, not a left/right-click distinction on
    // one item, so it works on Bedrock) starting at
    // items.allies.request_entry.slot.
    private void allies(Player p,int slot){
        Team t=ts.byPlayer(p.getUniqueId());if(t==null)return;TeamMember me=t.member(p.getUniqueId());if(me==null||me.role()==TeamRole.MEMBER)return;
        if(slot==gui.slot("items.allies.back.slot",49)){gui.openTeam(p,t);return;}
        int entryBase=gui.slot("items.allies.entry.slot",0),requestBase=gui.slot("items.allies.request_entry.slot",27);
        if(slot>=entryBase&&slot<entryBase+27){
            int index=slot-entryBase;List<UUID> ids=new ArrayList<>(t.allies());if(index>=ids.size())return;
            Team ally=ts.team(ids.get(index));if(ally!=null)gui.openConfirm(p,"ally-remove",ally.name(),ally.id().toString());
            return;
        }
        if(slot>=requestBase&&slot<requestBase+18){
            int index=slot-requestBase;List<TeamService.AllyRequest> reqs=ts.allyRequestsFor(t.id());if(index>=reqs.size())return;
            TeamService.AllyRequest r=reqs.get(index);Team from=ts.team(r.fromTeam());if(from==null)return;
            gui.openConfirm(p,"ally-accept",from.name(),from.id().toString());
        }
    }
    private void notifyOfficers(Team team,String message){for(TeamMember m:team.members()){if(m.role()==TeamRole.MEMBER)continue;Player online=Bukkit.getPlayer(m.uuid());if(online!=null)online.sendMessage(Text.mm(message));}}

    private void confirm(Player p,String action,String data,int slot){
        // ally-accept's "cancel" slot is relabeled Deny (GuiManager#openConfirm)
        // and must actually clear the request, not just navigate back like
        // every other confirm screen's cancel button does - handle it before
        // the generic cancel/confirm slot check below.
        if(action.equals("ally-accept")){
            Team t=ts.byPlayer(p.getUniqueId());Team from=teamByData(data);
            if(t==null||from==null){gui.open(p);return;}
            if(slot==gui.slot("items.confirm.cancel.slot",11)){
                ts.clearAllyRequest(from.id(),t.id());
                p.sendMessage(Text.mm("<gray>Alliance request denied.</gray>"));
                gui.openAllies(p,t);
                return;
            }
            if(slot!=gui.slot("items.confirm.confirm.slot",15))return;
            ts.acceptAlly(from,t);
            p.sendMessage(Text.mm("<green>Alliance accepted with <white>"+from.name()+"</white>.</green>"));
            notifyOfficers(from,"<green>Your alliance request to <white>"+t.name()+"</white> was accepted!</green>");
            gui.openAllies(p,t);
            return;
        }
        if(slot==gui.slot("items.confirm.cancel.slot",11)){gui.open(p);return;}if(slot!=gui.slot("items.confirm.confirm.slot",15))return;
        Team t=ts.byPlayer(p.getUniqueId());
        if(action.equals("disband")){
            Team target=teamByData(data);if(target!=null&&t!=null&&t.id().equals(target.id())&&t.member(p.getUniqueId()).role()==TeamRole.OWNER){ts.disband(t);p.closeInventory();p.sendMessage(Text.mm("<green>Team disbanded.</green>"));}return;
        }
        if(action.equals("leave")){
            if(t!=null&&t.member(p.getUniqueId()).role()!=TeamRole.OWNER){ts.removeMember(t,p.getUniqueId());p.closeInventory();p.sendMessage(Text.mm("<green>You left the team.</green>"));}return;
        }
        if(t==null)return;
        if(action.equals("kick")){
            UUID id=uuid(data);TeamMember me=t.member(p.getUniqueId()),target=t.member(id);
            if(target!=null&&me!=null&&me.role()!=TeamRole.MEMBER&&target.role()!=TeamRole.OWNER){ts.removeMember(t,id);p.sendMessage(Text.mm("<green>Member kicked.</green>"));gui.openTeam(p,t);}
        } else if(action.equals("transfer")){
            UUID id=uuid(data);TeamMember me=t.member(p.getUniqueId()),target=t.member(id);
            if(me!=null&&me.role()==TeamRole.OWNER&&target!=null&&target.role()!=TeamRole.OWNER){
                t.removeMember(me.uuid());t.removeMember(id);
                t.addMember(new TeamMember(id,target.name(),TeamRole.OWNER,target.joinedAt(),target.lastSeen(),target.server()));
                t.addMember(new TeamMember(me.uuid(),me.name(),TeamRole.MEMBER,me.joinedAt(),me.lastSeen(),me.server()));
                ts.save(t);p.sendMessage(Text.mm("<green>Ownership transferred.</green>"));gui.openTeam(p,t);
            }
        } else if(action.equals("ally-remove")){
            Team ally=teamByData(data);if(ally!=null&&t.allies().contains(ally.id())){t.removeAlly(ally.id());ally.removeAlly(t.id());ts.save(t);ts.save(ally);p.sendMessage(Text.mm("<green>Alliance removed.</green>"));gui.openAllies(p,t);}
        }
    }

    private Team teamByData(String data){try{return ts.team(UUID.fromString(data));}catch(Exception e){return null;}}
    private UUID uuid(String s){try{return UUID.fromString(s);}catch(Exception e){return new UUID(0,0);}}
}
