package com.angkor.makongcore.gui;

import com.angkor.makongcore.MakongCore;
import com.angkor.makongcore.model.*;
import com.angkor.makongcore.service.TeamService;
import com.angkor.makongcore.util.Text;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.OfflinePlayer;
import org.bukkit.entity.Player;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.inventory.meta.SkullMeta;

import java.util.*;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

public final class GuiManager {
    private final MakongCore plugin;
    private final TeamService teams;
    private final GuiConfig config;
    private Map<String,String> vars=Map.of();

    public GuiManager(MakongCore plugin, TeamService teams) { this.plugin=plugin; this.teams=teams; this.config=new GuiConfig(plugin); }
    public GuiConfig config(){ return config; }
    public int slot(String path,int def){ return config.slot(path,def); }
    private int guiBase(String path,int def){return config.slot("items."+path+".slot",def);}
    public void reloadConfig(){ config.reload(); }

    private ItemStack cfgItem(String path, Material defMaterial, String defName, String... defLore){
        Material mat=config.material("items."+path+".material",defMaterial);
        String name=render(config.text("items."+path+".name",defName));
        List<String> lore=config.lore("items."+path+".lore",Arrays.asList(defLore));
        return item(mat,loreRender(name),lore.stream().map(this::render).toArray(String[]::new));
    }
    private String render(String s){ if(s==null)return null; String x=s; for(var e:vars.entrySet()) x=x.replace("{"+e.getKey()+"}",e.getValue()==null?"":e.getValue()); return x; }
    private String loreRender(String s){ return render(s); }
    private void vars(Object... pairs){ Map<String,String> m=new HashMap<>(); for(int i=0;i+1<pairs.length;i+=2)m.put(String.valueOf(pairs[i]),String.valueOf(pairs[i+1])); vars=m; }
    private int cfgSlot(String path,int def){return config.slot("items."+path+".slot",def);}
    private String title(String key,String def){return render(config.title(key,def));}

    private ItemStack item(Material material,String name,String... lore){
        ItemStack i=new ItemStack(material);
        ItemMeta m=i.getItemMeta();
        m.displayName(Text.mm(name));
        if(lore.length>0)m.lore(Arrays.stream(lore).filter(Objects::nonNull).map(Text::mm).toList());
        i.setItemMeta(m);
        return i;
    }

    private ItemStack head(OfflinePlayer p,String name,String... lore){
        ItemStack i=new ItemStack(Material.PLAYER_HEAD);
        SkullMeta m=(SkullMeta)i.getItemMeta();
        m.setOwningPlayer(p);
        m.displayName(Text.mm(name));
        if(lore.length>0)m.lore(Arrays.stream(lore).filter(Objects::nonNull).map(Text::mm).toList());
        i.setItemMeta(m);
        return i;
    }

    private void fill(Inventory inv){
        if(!config.bool("filler.enabled",true))return;
        ItemStack f=item(config.material("filler.material",Material.GRAY_STAINED_GLASS_PANE),config.text("filler.name"," "));
        for(int i=0;i<inv.getSize();i++)if(inv.getItem(i)==null)inv.setItem(i,f);
    }

    private void fillRange(Inventory inv,int from,int to){
        if(!config.bool("filler.enabled",true))return;
        ItemStack f=item(config.material("filler.material",Material.GRAY_STAINED_GLASS_PANE),config.text("filler.name"," "));
        for(int i=Math.max(0,from);i<=Math.min(inv.getSize()-1,to);i++)if(inv.getItem(i)==null)inv.setItem(i,f);
    }

    private ItemStack selected(ItemStack i){
        ItemMeta m=i.getItemMeta();
        m.addEnchant(org.bukkit.enchantments.Enchantment.UNBREAKING,1,true);
        m.addItemFlags(org.bukkit.inventory.ItemFlag.HIDE_ENCHANTS);
        i.setItemMeta(m);
        return i;
    }

    private void open(Player p,Inventory inv){p.openInventory(inv);}

    public void open(Player p){Team t=teams.byPlayer(p.getUniqueId());if(t==null)openNoTeam(p);else openTeam(p,t);}

    public void openNoTeam(Player p){
        vars();
        Inventory inv=Bukkit.createInventory(new TeamHolder("no-team"),config.size("sizes.no_team",27),Text.mm(title("no_team","ᴛᴇᴀᴍ ᴍᴇɴᴜ")));
        inv.setItem(cfgSlot("no_team.create",11),cfgItem("no_team.create",Material.WRITABLE_BOOK,"<aqua><bold>ᴄʀᴇᴀᴛᴇ ᴀ ᴛᴇᴀᴍ</bold>","<gray>Create a team for you and your friends.","","<yellow>Click to begin.</yellow>"));
        inv.setItem(cfgSlot("no_team.browse",13),cfgItem("no_team.browse",Material.BEACON,"<aqua><bold>ʙʀᴏᴡsᴇ ᴛᴇᴀᴍs</bold>","<gray>Browse every team on the server.","","<yellow>Click to browse.</yellow>"));
        inv.setItem(cfgSlot("no_team.top",15),cfgItem("no_team.top",Material.EMERALD,"<green><bold>ᴛᴏᴘ ᴛᴇᴀᴍs</bold>","<gray>View Stars, Kills and KDR.","","<yellow>Click to view.</yellow>"));
        inv.setItem(cfgSlot("no_team.invites",22),cfgItem("no_team.invites",Material.PAPER,"<yellow><bold>ɪɴᴠɪᴛᴀᴛɪᴏɴs</bold>","<gray>View pending invitations.","","<yellow>Click to view.</yellow>"));
        fill(inv);open(p,inv);
    }

    public void openTeam(Player p,Team t){ openTeam(p,t,"join_date"); }

    public void openTeam(Player p,Team t,String filter){
        vars("team",t.name(),"tag",t.tag(),"members",t.members().size(),"max",teams.settings().maxSize(),"kills",t.kills(),"deaths",t.deaths(),"kdr",kdr(t),"stars",t.stars(),"pvp",t.pvp()?"<green>ON":"<red>OFF");
        List<String> filterModes=config.cfgList("items.team.filter.modes",List.of("join_date","kills","name"));
        String mode=filterModes.contains(filter)?filter:(filterModes.isEmpty()?"join_date":filterModes.get(0));
        List<TeamMember> members=new ArrayList<>(t.members());
        Comparator<TeamMember> cmp=switch(mode){
            case "kills" -> Comparator.comparingLong(TeamMember::kills).reversed()
                    .thenComparingLong(TeamMember::joinedAt)
                    .thenComparing(m->safeName(m,Bukkit.getOfflinePlayer(m.uuid())),String.CASE_INSENSITIVE_ORDER);
            case "name" -> Comparator.comparing((TeamMember m)->safeName(m,Bukkit.getOfflinePlayer(m.uuid())),String.CASE_INSENSITIVE_ORDER)
                    .thenComparingLong(TeamMember::joinedAt);
            default -> Comparator.comparingLong(TeamMember::joinedAt)
                    .thenComparing((TeamMember m)->safeName(m,Bukkit.getOfflinePlayer(m.uuid())),String.CASE_INSENSITIVE_ORDER);
        };
        members.sort(cmp);

        Inventory inv=Bukkit.createInventory(new TeamHolder("team",1,mode),54,
                Text.mm(title("team","<aqua>"+t.name()+" <gray>["+t.tag()+"] <dark_gray>• <white>"+t.members().size()+"/"+teams.settings().maxSize())));
        int slot=0;
        for(TeamMember m:members){
            if(slot>=36)break;
            OfflinePlayer op=Bukkit.getOfflinePlayer(m.uuid());
            String role=m.role()==TeamRole.OWNER?"<gold>♛ OWNER":m.role()==TeamRole.ADMIN?"<aqua>★ ADMIN":"<gray>• MEMBER";
            String status=op.isOnline()?"<green>● Online":"<gray>● Offline";
            boolean canManage=teams.byPlayer(p.getUniqueId())!=null
                    && teams.byPlayer(p.getUniqueId()).member(p.getUniqueId())!=null
                    && teams.byPlayer(p.getUniqueId()).member(p.getUniqueId()).role()!=TeamRole.MEMBER
                    && !m.uuid().equals(p.getUniqueId());
            String manage=canManage?"<yellow>Click to manage.":null;
            inv.setItem(slot++,head(op,role+" <white>"+safeName(m,op),status,
                    "<gray>Joined: <white>"+formatDate(m.joinedAt()),
                    "<gray>Kills: <white>"+m.kills(),
                    "<gray>Deaths: <white>"+m.deaths(),
                    "<gray>Playtime: <white>"+m.playtimeMinutes()+"m",manage));
        }
        TeamMember me=t.member(p.getUniqueId());
        boolean manager=me!=null&&me.role()!=TeamRole.MEMBER;

        inv.setItem(cfgSlot("team.info",45),cfgItem("team.info",Material.NETHER_STAR,"<aqua><bold>ᴛᴇᴀᴍ ɪɴғᴏ</bold>",
                "<gray>Members: <white>"+t.members().size()+"/"+teams.settings().maxSize(),
                "<gray>Kills: <white>"+t.kills(),
                "<gray>Deaths: <white>"+t.deaths(),"<gray>KDR: <white>"+kdr(t),"<gray>Stars: <yellow>⭐ "+t.stars()));

        inv.setItem(cfgSlot("team.pvp",46),cfgItem("team.pvp",Material.DIAMOND_SWORD,"<aqua><bold>ᴛᴇᴀᴍ ᴘᴠᴘ</bold>",
                "<gray>Status: "+(t.pvp()?"<green>ON":"<red>OFF"),"","<yellow>Click to toggle."));

        inv.setItem(cfgSlot("team.requests",47),cfgItem("team.requests",manager?Material.SOUL_LANTERN:Material.LANTERN,
                manager?"<aqua><bold>ᴊᴏɪɴ ʀᴇǫᴜᴇsᴛs</bold>":"<dark_gray><bold>ᴊᴏɪɴ ʀᴇǫᴜᴇsᴛs</bold>",
                manager?"<gray>View pending requests.":"<gray>Owner or admin only."));

        inv.setItem(cfgSlot("team.allies",48),cfgItem("team.allies",Material.TOTEM_OF_UNDYING,"<aqua><bold>ᴀʟʟɪᴇs</bold>",
                "<gray>Manage team alliances.","","<yellow>Click to open."));

        List<String> modes=filterModes;
        List<String> filterLore=new ArrayList<>();
        for(String f:modes){
            String label=switch(f){
                case "kills"->"Kills";
                case "name"->"Name A-Z";
                default->"Join Date";
            };
            filterLore.add((f.equals(mode)?"<green>• ":"<gray>• ")+label);
        }
        filterLore.add(""); filterLore.add(config.text("items.team.filter.click_lore","<yellow>Click to change."));
        inv.setItem(cfgSlot("team.filter",49),cfgItem("team.filter",Material.HOPPER,"<yellow><bold>ғɪʟᴛᴇʀ</bold>",filterLore.toArray(String[]::new)));

        inv.setItem(cfgSlot("team.settings",50),cfgItem("team.settings",manager?Material.COMPARATOR:Material.GRAY_DYE,
                manager?"<aqua><bold>ᴛᴇᴀᴍ sᴇᴛᴛɪɴɢs</bold>":"<dark_gray><bold>ᴛᴇᴀᴍ sᴇᴛᴛɪɴɢs</bold>",
                manager?"<yellow>Click to manage.":"<gray>Owner or admin only."));

        inv.setItem(cfgSlot("team.browse",51),cfgItem("team.browse",Material.SPYGLASS,"<aqua><bold>ʙʀᴏᴡsᴇ ᴛᴇᴀᴍs</bold>",
                "<gray>Browse other teams.","","<yellow>Click to browse."));

        inv.setItem(cfgSlot("team.leaderboard",52),cfgItem("team.leaderboard",Material.EMERALD,"<green><bold>ʟᴇᴀᴅᴇʀʙᴏᴀʀᴅ</bold>",
                "<gray>View the top teams.","<gray>Stars, Kills and KDR.","","<yellow>Click to view."));

        inv.setItem(cfgSlot("team.leave",53),cfgItem("team.leave",me!=null&&me.role()==TeamRole.OWNER?Material.TNT:Material.DARK_OAK_DOOR,
                me!=null&&me.role()==TeamRole.OWNER?"<red><bold>ᴅɪsʙᴀɴᴅ ᴛᴇᴀᴍ</bold>":"<red><bold>ʟᴇᴀᴠᴇ ᴛᴇᴀᴍ</bold>","<gray>Click to continue."));
        fillRange(inv,36,44);
        open(p,inv);
    }

    private static String formatDate(long millis){
        return DateTimeFormatter.ofPattern("dd MMM yyyy",Locale.ENGLISH)
                .withZone(ZoneId.systemDefault()).format(Instant.ofEpochMilli(millis));
    }

    public void openColor(Player p,Team t){
        vars("team",t.name(),"tag",t.tag());
        Inventory inv=Bukkit.createInventory(new TeamHolder("create-color",1,t.id().toString()),27,
                Text.mm(title("color","<aqua>ᴄʜᴏᴏsᴇ ᴛᴇᴀᴍ ᴄᴏʟᴏʀ")));

        // Organized like the reference:
        // Row 1: White, Light Gray, Gray, Black, Brown, Red, Orange
        // Row 2: Yellow, Lime, Green, Cyan, Light Blue, Blue, Purple, Magenta, Pink
        Material[] row1={Material.WHITE_DYE,Material.LIGHT_GRAY_DYE,Material.GRAY_DYE,Material.BLACK_DYE,
                Material.BROWN_DYE,Material.RED_DYE,Material.ORANGE_DYE};
        String[] names1={"<white>White","<gray>Light Gray","<gray>Gray","<dark_gray>Black",
                "<gold>Brown","<red>Red","<gold>Orange"};

        Material[] row2={Material.YELLOW_DYE,Material.LIME_DYE,Material.GREEN_DYE,Material.CYAN_DYE,
                Material.LIGHT_BLUE_DYE,Material.BLUE_DYE,Material.PURPLE_DYE,Material.MAGENTA_DYE,Material.PINK_DYE};
        String[] names2={"<yellow>Yellow","<green>Lime","<dark_green>Green","<aqua>Cyan",
                "<aqua>Light Blue","<blue>Blue","<dark_purple>Purple","<light_purple>Magenta","<light_purple>Pink"};

        String[] colors={"white","light_gray","gray","black","brown","red","orange","yellow","lime","green","cyan","light_blue","blue","purple","magenta","pink"};
        int[] defaults={1,2,3,4,5,6,7,9,10,11,12,13,14,15,16,17};
        for(int i=0;i<colors.length;i++){
            String c=colors[i];
            inv.setItem(cfgSlot("color."+c,defaults[i]),cfgItem("color."+c,colorMaterial(c),c,"<gray>Select this color.","<yellow>Click to select.</yellow>"));
        }
        inv.setItem(cfgSlot("color.cancel",22),cfgItem("color.cancel",Material.BARRIER,"<red><bold>ᴄᴀɴᴄᴇʟ</bold>","<gray>Cancel creation."));
        fillRange(inv,18,26);
        open(p,inv);
    }

    public String colorForSlot(int slot){
        String[] colors={"white","light_gray","gray","black","brown","red","orange","yellow","lime","green","cyan","light_blue","blue","purple","magenta","pink"};
        int[] defaults={1,2,3,4,5,6,7,9,10,11,12,13,14,15,16,17};
        for(int i=0;i<colors.length;i++) if(cfgSlot("color."+colors[i],defaults[i])==slot) return colors[i];
        return null;
    }

    public void openLeaderboard(Player p,int page,String mode){
        vars("page",page,"pages",1);
        String m=Set.of("stars","kills","kdr").contains(mode)?mode:"stars";
        List<Team> list=new ArrayList<>(teams.all());
        Comparator<Team> cmp=switch(m){
            case "kills"->Comparator.comparingLong(Team::kills).reversed();
            case "kdr"->Comparator.comparingDouble(GuiManager::kdrValue).reversed();
            default->Comparator.comparingLong(Team::stars).reversed();
        };
        list.sort(cmp.thenComparing(Team::name,String.CASE_INSENSITIVE_ORDER));
        int max=Math.max(1,(list.size()+35)/36);page=Math.min(Math.max(1,page),max);vars("page",page,"pages",max);

        Inventory inv=Bukkit.createInventory(new TeamHolder("leaderboard",page,m),54,
                Text.mm(title("leaderboard","<green>ᴛᴏᴘ ᴛᴇᴀᴍs")));

        fillRange(inv,0,8);
        fillRange(inv,45,53);

        inv.setItem(cfgSlot("leaderboard.star",2),m.equals("stars")
                ?selected(cfgItem("leaderboard.star",Material.NETHER_STAR,"<yellow><bold>Top Star</bold>","<green>Selected"))
                :cfgItem("leaderboard.star",Material.NETHER_STAR,"<yellow><bold>Top Star</bold>","<yellow>Click to select."));
        inv.setItem(cfgSlot("leaderboard.kills",4),m.equals("kills")
                ?selected(cfgItem("leaderboard.kills",Material.SKELETON_SKULL,"<aqua><bold>Top Kill</bold>","<green>Selected"))
                :cfgItem("leaderboard.kills",Material.SKELETON_SKULL,"<aqua><bold>Top Kill</bold>","<yellow>Click to select."));
        inv.setItem(cfgSlot("leaderboard.kdr",6),m.equals("kdr")
                ?selected(cfgItem("leaderboard.kdr",Material.TNT,"<red><bold>Top KDR</bold>","<green>Selected"))
                :cfgItem("leaderboard.kdr",Material.TNT,"<red><bold>Top KDR</bold>","<yellow>Click to select."));

        int selectedSlot=switch(m){case "stars"->cfgSlot("leaderboard.star",2);case "kills"->cfgSlot("leaderboard.kills",4);default->cfgSlot("leaderboard.kdr",6);};
        inv.setItem(selectedSlot-1,cfgItem("leaderboard.selected_left",Material.LIME_STAINED_GLASS_PANE," "));
        inv.setItem(selectedSlot+1,cfgItem("leaderboard.selected_right",Material.LIME_STAINED_GLASS_PANE," "));

        int start=(page-1)*36;
        for(int i=0;i<36&&start+i<list.size();i++){
            Team tm=list.get(start+i);int rank=start+i+1;
            String value=switch(m){
                case "kills"->String.valueOf(tm.kills());
                case "kdr"->String.format(Locale.US,"%.2f",kdrValue(tm));
                default->String.valueOf(tm.stars());
            };
            vars("team",tm.name(),"tag",tm.tag(),"members",tm.members().size(),"max",teams.settings().maxSize(),"metric",m.equals("kills")?"Kills":m.equals("kdr")?"KDR":"Stars","value",value,"rank",rank,"page",page,"pages",max);
            inv.setItem(9+i,cfgItem("leaderboard.entry",Material.BEACON,"<green>#"+rank+" <white>"+tm.name()+" <gray>["+tm.tag()+"]",
                    "<gray>Members: <white>"+tm.members().size()+"/"+teams.settings().maxSize(),
                    "<gray>"+(m.equals("kills")?"Kills":m.equals("kdr")?"KDR":"Stars")+": <white>"+value,
                    "","<yellow>Click for team info.</yellow>"));
        }
        inv.setItem(cfgSlot("leaderboard.previous",45),cfgItem("leaderboard.previous",Material.ARROW,"<yellow>← Previous","<gray>Page "+page+"/"+max));
        inv.setItem(cfgSlot("leaderboard.back",49),cfgItem("leaderboard.back",Material.IRON_DOOR,"<gray>ʙᴀᴄᴋ"));
        inv.setItem(cfgSlot("leaderboard.next",53),cfgItem("leaderboard.next",Material.ARROW,"<yellow>Next →","<gray>Page "+page+"/"+max));
        open(p,inv);
    }

    public void openBrowse(Player p,int page){
        vars("page",page,"pages",1);
        List<Team> list=teams.all().stream().sorted(Comparator.comparing(Team::name,String.CASE_INSENSITIVE_ORDER)).toList();
        int max=Math.max(1,(list.size()+44)/45);page=Math.min(Math.max(page,1),max);vars("page",page,"pages",max);
        Inventory inv=Bukkit.createInventory(new TeamHolder("browse",page,null),config.size("sizes.browse",54),Text.mm(title("browse","<aqua>ʙʀᴏᴡsᴇ ᴛᴇᴀᴍs")));
        int start=(page-1)*45;
        for(int i=0;i<45&&start+i<list.size();i++){
            Team tm=list.get(start+i);
            vars("team",tm.name(),"tag",tm.tag(),"members",tm.members().size(),"max",teams.settings().maxSize(),"status",tm.isPublic()?"<green>Public":"<red>Private","stars",tm.stars());
            inv.setItem(i,cfgItem("browse.entry",Material.BEACON,"<aqua><bold>"+tm.name()+"</bold> <gray>["+tm.tag()+"]",
                    "<gray>Members: <white>"+tm.members().size()+"/"+teams.settings().maxSize(),
                    "<gray>Status: "+(tm.isPublic()?"<green>Public":"<red>Private"),
                    "<gray>Stars: <yellow>⭐ "+tm.stars(),"","<yellow>Click for info.</yellow>"));
        }
        fillRange(inv,45,53);
        inv.setItem(cfgSlot("browse.previous",45),cfgItem("browse.previous",Material.ARROW,"<yellow>← Previous"));
        inv.setItem(cfgSlot("browse.back",49),cfgItem("browse.back",Material.IRON_DOOR,"<gray>ʙᴀᴄᴋ"));
        inv.setItem(cfgSlot("browse.next",53),cfgItem("browse.next",Material.ARROW,"<yellow>Next →"));
        open(p,inv);
    }

    public void openTeamInfo(Player p,Team t,boolean canJoin){
        vars("team",t.name(),"tag",t.tag(),"members",t.members().size(),"max",teams.settings().maxSize(),"kills",t.kills(),"deaths",t.deaths(),"kdr",kdr(t),"stars",t.stars(),"status",t.isPublic()?"<green>Public":"<red>Private");
        Inventory inv=Bukkit.createInventory(new TeamHolder("team-info",1,t.id().toString()),config.size("sizes.team_info",27),Text.mm(title("team_info","<aqua>"+t.name()+" ["+t.tag()+"]")));
        inv.setItem(cfgSlot("team_info.summary",10),cfgItem("team_info.summary",Material.BEACON,"<aqua><bold>"+t.name()+"</bold>","<gray>Tag: <white>"+t.tag(),"<gray>Members: <white>"+t.members().size()+"/"+teams.settings().maxSize(),"<gray>Status: "+(t.isPublic()?"<green>Public":"<red>Private")));
        TeamMember owner=t.members().stream().filter(m->m.role()==TeamRole.OWNER).findFirst().orElse(null);
        if(owner!=null)inv.setItem(12,head(Bukkit.getOfflinePlayer(owner.uuid()),"<gold>Owner: <white>"+safeName(owner,Bukkit.getOfflinePlayer(owner.uuid()))));
        inv.setItem(cfgSlot("team_info.stats",14),cfgItem("team_info.stats",Material.NETHER_STAR,"<gold><bold>ᴛᴇᴀᴍ sᴛᴀᴛs</bold>","<gray>Kills: <white>"+t.kills(),"<gray>Deaths: <white>"+t.deaths(),"<gray>KDR: <white>"+kdr(t),"<gray>Stars: <yellow>⭐ "+t.stars()));
        inv.setItem(cfgSlot("team_info.description",16),cfgItem("team_info.description",Material.OAK_SIGN,"<yellow><bold>ᴅᴇsᴄʀɪᴘᴛɪᴏɴ</bold>","<gray>"+t.description()));
        if(canJoin&&t.isPublic())inv.setItem(cfgSlot("team_info.join",20),cfgItem("team_info.join",Material.LIME_DYE,"<green><bold>ʀᴇǫᴜᴇsᴛ ᴛᴏ ᴊᴏɪɴ</bold>","<yellow>Click to send a request."));
        inv.setItem(cfgSlot("team_info.back",22),cfgItem("team_info.back",Material.IRON_DOOR,"<gray>ʙᴀᴄᴋ"));fill(inv);open(p,inv);
    }

    public void openInvites(Player p){
        vars();
        TeamService.Invite invite=teams.invite(p.getUniqueId());
        Inventory inv=Bukkit.createInventory(new TeamHolder("invites"),config.size("sizes.invites",27),Text.mm(title("invites","<yellow>ᴘᴇɴᴅɪɴɢ ɪɴᴠɪᴛᴇ")));
        Team t=invite==null?null:teams.team(invite.team());
        if(t==null)inv.setItem(cfgSlot("invites.empty",13),cfgItem("invites.empty",Material.PAPER,"<gray>No pending invitations."));
        else { vars("team",t.name(),"tag",t.tag(),"members",t.members().size(),"max",teams.settings().maxSize()); inv.setItem(cfgSlot("invites.entry",13),cfgItem("invites.entry",Material.DIAMOND,"<aqua><bold>"+t.name()+"</bold>","<gray>Tag: <white>"+t.tag(),"<gray>Members: <white>"+t.members().size()+"/"+teams.settings().maxSize(),"","<green>Left-click: Accept</green>","<red>Right-click: Decline</red>")); }
        inv.setItem(cfgSlot("invites.back",22),cfgItem("invites.back",Material.IRON_DOOR,"<gray>ʙᴀᴄᴋ"));fillRange(inv,18,26);open(p,inv);
    }

    private Material colorMaterial(String color){
        return switch(color==null?"aqua":color.toLowerCase(Locale.ROOT)){
            case "white"->Material.WHITE_DYE; case "light_gray"->Material.LIGHT_GRAY_DYE;
            case "gray"->Material.GRAY_DYE; case "black"->Material.BLACK_DYE;
            case "brown"->Material.BROWN_DYE; case "red"->Material.RED_DYE;
            case "orange"->Material.ORANGE_DYE; case "yellow"->Material.YELLOW_DYE;
            case "lime"->Material.LIME_DYE; case "green"->Material.GREEN_DYE;
            case "cyan"->Material.CYAN_DYE; case "light_blue"->Material.LIGHT_BLUE_DYE;
            case "blue"->Material.BLUE_DYE; case "purple"->Material.PURPLE_DYE;
            case "magenta"->Material.MAGENTA_DYE; case "pink"->Material.PINK_DYE;
            default->Material.CYAN_DYE;
        };
    }

    public void openSettings(Player p,Team t){
        vars("team",t.name(),"tag",t.tag(),"description",t.description(),"status",t.isPublic()?"<green>Public":"<red>Private","status_info",t.isPublic()?"anyone can send a join request.":"join requests are disabled; invite only.","color",t.color()==null?"aqua":t.color());
        Inventory inv=Bukkit.createInventory(new TeamHolder("settings"),config.size("sizes.settings",27),Text.mm(title("settings","<aqua>ᴛᴇᴀᴍ sᴇᴛᴛɪɴɢs")));
        inv.setItem(cfgSlot("settings.tag",10),cfgItem("settings.tag",Material.NAME_TAG,"<aqua><bold>ᴄʜᴀɴɢᴇ ᴛᴀɢ</bold>",
                "<gray>Current: <white>"+t.tag(),"","<yellow>Click to edit in chat.</yellow>"));
        inv.setItem(cfgSlot("settings.description",12),cfgItem("settings.description",Material.OAK_SIGN,"<aqua><bold>ᴄʜᴀɴɢᴇ ᴅᴇsᴄʀɪᴘᴛɪᴏɴ</bold>",
                "<gray>Current: <white>"+t.description(),"","<yellow>Click to edit in chat.</yellow>"));

        ItemStack status=cfgItem("settings.status",Material.ENDER_EYE,"<aqua><bold>ᴛᴇᴀᴍ sᴛᴀᴛᴜs</bold>",
                "<gray>Currently: "+(t.isPublic()?"<green>Public":"<red>Private"),
                t.isPublic()?"<gray>Anyone can send a join request.":"<gray>Join requests are disabled; invite only.",
                "", "<yellow>Click to toggle.");
        if(!t.isPublic())status=selected(status);
        inv.setItem(cfgSlot("settings.status",14),status);

        inv.setItem(cfgSlot("settings.color",16),cfgItem("settings.color",colorMaterial(t.color()),"<aqua><bold>ᴛᴇᴀᴍ ᴄᴏʟᴏʀ</bold>",
                "<gray>Current: <white>"+(t.color()==null?"aqua":t.color()),
                "","<yellow>Click to change."));

        inv.setItem(cfgSlot("settings.back",22),cfgItem("settings.back",Material.IRON_DOOR,"<gray>ʙᴀᴄᴋ"));fill(inv);open(p,inv);
    }

    public void openMember(Player p,Team t,UUID target){
        TeamMember member=t.member(target);TeamMember me=t.member(p.getUniqueId());
        if(member==null||me==null){openTeam(p,t);return;}
        boolean owner=me.role()==TeamRole.OWNER,admin=me.role()==TeamRole.ADMIN;
        vars("target",member.name(),"role",member.role(),"joined",formatDate(member.joinedAt()),
                "kills",member.kills(),"deaths",member.deaths(),"playtime",member.playtimeMinutes());
        Inventory inv=Bukkit.createInventory(new TeamHolder("member",1,target.toString()),config.size("sizes.member",27),Text.mm(title("member","<aqua>ᴍᴇᴍʙᴇʀ • "+member.name())));
        OfflinePlayer op=Bukkit.getOfflinePlayer(target);
        inv.setItem(cfgSlot("member.profile",10),cfgItem("member.profile",Material.PLAYER_HEAD,
                "<gold><bold>{target}</bold>",
                "<gray>Role: <white>{role}",
                "<gray>Joined: <white>{joined}",
                "<gray>Kills: <white>{kills}",
                "<gray>Deaths: <white>{deaths}",
                "<gray>Playtime: <white>{playtime}m"));
        ItemStack profile=inv.getItem(cfgSlot("member.profile",10));
        if(profile!=null&&profile.getItemMeta() instanceof SkullMeta sm){sm.setOwningPlayer(op);profile.setItemMeta(sm);}
        if(owner&&member.role()==TeamRole.MEMBER)inv.setItem(cfgSlot("member.promote",12),cfgItem("member.promote",Material.LIME_DYE,"<green>ᴘʀᴏᴍᴏᴛᴇ","<yellow>Promote to admin."));
        if(owner&&member.role()==TeamRole.ADMIN)inv.setItem(cfgSlot("member.demote",12),cfgItem("member.demote",Material.GRAY_DYE,"<gray>ᴅᴇᴍᴏᴛᴇ","<yellow>Demote to member."));
        if((owner||admin)&&member.role()!=TeamRole.OWNER&& !target.equals(p.getUniqueId()))inv.setItem(cfgSlot("member.kick",14),cfgItem("member.kick",Material.RED_WOOL,"<red>ᴋɪᴄᴋ","<gray>Remove this member."));
        if(owner&&member.role()!=TeamRole.OWNER)inv.setItem(cfgSlot("member.transfer",16),cfgItem("member.transfer",Material.BEACON,"<gold>ᴛʀᴀɴsғᴇʀ ᴏᴡɴᴇʀsʜɪᴘ","<gray>Make this player owner."));
        inv.setItem(cfgSlot("member.back",22),cfgItem("member.back",Material.IRON_DOOR,"<gray>ʙᴀᴄᴋ"));fill(inv);open(p,inv);
    }

    public void openJoinRequests(Player p,Team t){
        vars();
        Inventory inv=Bukkit.createInventory(new TeamHolder("join-requests"),config.size("sizes.join_requests",54),Text.mm(title("join_requests","<aqua>ᴊᴏɪɴ ʀᴇǫᴜᴇsᴛs")));
        List<TeamService.Request> rs=teams.requestsFor(t.id());
        if(rs.isEmpty())inv.setItem(cfgSlot("requests.empty",22),cfgItem("requests.empty",Material.PAPER,"<gray>No pending requests."));
        else for(int i=0;i<Math.min(36,rs.size());i++){var r=rs.get(i);OfflinePlayer op=Bukkit.getOfflinePlayer(r.player());inv.setItem(guiBase("requests.entry",9)+i,head(op,"<yellow>"+(op.getName()==null?"Unknown":op.getName()),"<gray>Wants to join.","","<green>Left-click: Accept</green>","<red>Right-click: Deny</red>"));}
        fillRange(inv,45,53);
        inv.setItem(cfgSlot("requests.back",49),cfgItem("requests.back",Material.IRON_DOOR,"<gray>ʙᴀᴄᴋ"));open(p,inv);
    }

    public void openAllies(Player p,Team t){
        vars();
        Inventory inv=Bukkit.createInventory(new TeamHolder("allies"),config.size("sizes.allies",54),Text.mm(title("allies","<aqua>ᴛᴇᴀᴍ ᴀʟʟɪᴇs")));
        int i=0;
        for(UUID id:t.allies()){
            Team a=teams.team(id);if(a==null)continue;
            vars("team",a.name(),"tag",a.tag(),"members",a.members().size());
            inv.setItem(guiBase("allies.entry",0)+i,cfgItem("allies.entry",Material.TOTEM_OF_UNDYING,"<aqua>"+a.name()+" <gray>["+a.tag()+"]",
                    "<gray>Members: <white>"+a.members().size(),"","<red>Click to remove ally.</red>"));
            if(++i>=27)break;
        }
        if(i==0)inv.setItem(cfgSlot("allies.empty",22),cfgItem("allies.empty",Material.PAPER,"<gray>No allies.","<gray>Use <white>/team ally <tag></white> to request one."));
        // Pending incoming requests get their own slot range (27+) so
        // GuiListener#allies can tell an "accept/deny a request" click
        // apart from a "remove an existing ally" click by slot alone -
        // see TeamService#allyRequestsFor.
        int j=0;
        for(TeamService.AllyRequest r:teams.allyRequestsFor(t.id())){
            Team from=teams.team(r.fromTeam());if(from==null)continue;
            vars("team",from.name(),"tag",from.tag(),"members",from.members().size());
            inv.setItem(guiBase("allies.request_entry",27)+j,cfgItem("allies.request_entry",Material.PAPER,"<yellow>"+from.name()+" <gray>["+from.tag()+"]",
                    "<gray>Wants to ally with your team.","","<green>Left-click: Accept</green>","<red>Right-click: Deny</red>"));
            if(++j>=18)break;
        }
        fillRange(inv,45,53);
        inv.setItem(cfgSlot("allies.back",49),cfgItem("allies.back",Material.IRON_DOOR,"<gray>ʙᴀᴄᴋ"));
        open(p,inv);
    }

    public void openConfirm(Player p,String action,String target){ openConfirm(p,action,target,target); }

    public void openConfirm(Player p,String action,String target,String data){
        vars("target",target);
        String title=switch(action){case"disband"->"<red>ᴅɪsʙᴀɴᴅ ᴛᴇᴀᴍ?";case"leave"->"<red>ʟᴇᴀᴠᴇ ᴛᴇᴀᴍ?";case"transfer"->"<gold>ᴛʀᴀɴsғᴇʀ ᴏᴡɴᴇʀsʜɪᴘ?";case"kick"->"<red>ᴋɪᴄᴋ ᴍᴇᴍʙᴇʀ?";case"ally-remove"->"<red>ʀᴇᴍᴏᴠᴇ ᴀʟʟʏ?";default->"<yellow>ᴄᴏɴғɪʀᴍ";};
        Inventory inv=Bukkit.createInventory(new TeamHolder("confirm:"+action,1,data),config.size("sizes.confirm",27),Text.mm(title("confirm."+action,title)));
        inv.setItem(cfgSlot("confirm.cancel",11),cfgItem("confirm.cancel",Material.RED_WOOL,"<red><bold>ᴄᴀɴᴄᴇʟ</bold>","<gray>Return."));
        inv.setItem(cfgSlot("confirm.confirm",15),cfgItem("confirm.confirm",Material.GREEN_WOOL,"<green><bold>ᴄᴏɴғɪʀᴍ</bold>","<gray>Target: <white>"+target,"","<yellow>Click to confirm.</yellow>"));
        fill(inv);open(p,inv);
    }

    public static String safeName(TeamMember m,OfflinePlayer p){return m.name()!=null&&!m.name().isBlank()?m.name():(p.getName()==null?"Unknown":p.getName());}
    public static String kdr(Team t){return String.format(Locale.US,"%.2f",kdrValue(t));}
    private static double kdrValue(Team t){return t.deaths()==0?t.kills():(double)t.kills()/t.deaths();}
}
