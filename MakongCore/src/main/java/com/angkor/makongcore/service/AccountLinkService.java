package com.angkor.makongcore.service;

import com.angkor.makongcore.MakongCore;
import com.angkor.makongcore.data.Database;
import com.angkor.makongcore.hook.FloodgateHook;
import com.angkor.makongcore.model.Team;
import com.angkor.makongcore.util.ProfileCard;
import com.angkor.makongcore.web.WebsiteBridge;
import net.dv8tion.jda.api.*;
import net.dv8tion.jda.api.entities.*;
import net.dv8tion.jda.api.entities.channel.concrete.TextChannel;
import net.dv8tion.jda.api.interactions.InteractionHook;
import net.dv8tion.jda.api.utils.FileUpload;
import net.dv8tion.jda.api.events.interaction.ModalInteractionEvent;
import net.dv8tion.jda.api.events.interaction.command.SlashCommandInteractionEvent;
import net.dv8tion.jda.api.events.interaction.command.CommandAutoCompleteInteractionEvent;
import net.dv8tion.jda.api.events.interaction.component.ButtonInteractionEvent;
import net.dv8tion.jda.api.events.interaction.component.StringSelectInteractionEvent;
import net.dv8tion.jda.api.components.selections.StringSelectMenu;
import net.dv8tion.jda.api.events.session.ReadyEvent;
import net.dv8tion.jda.api.hooks.ListenerAdapter;
import net.dv8tion.jda.api.interactions.commands.OptionType;
import net.dv8tion.jda.api.interactions.commands.OptionMapping;
import net.dv8tion.jda.api.interactions.commands.Command;
import net.dv8tion.jda.api.interactions.commands.build.Commands;
import net.dv8tion.jda.api.interactions.callbacks.IReplyCallback;
import net.dv8tion.jda.api.modals.Modal;
import net.dv8tion.jda.api.components.textinput.TextInput;
import net.dv8tion.jda.api.components.textinput.TextInputStyle;
import net.dv8tion.jda.api.components.buttons.Button;
import net.dv8tion.jda.api.components.actionrow.ActionRow;
import net.dv8tion.jda.api.components.label.Label;
import org.bukkit.*;
import org.bukkit.entity.Player;
import org.bukkit.event.*;
import org.bukkit.event.block.*;
import org.bukkit.event.entity.*;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.event.player.*;
import org.bukkit.event.vehicle.VehicleMoveEvent;
import org.bukkit.event.player.PlayerInteractEvent;
import org.bukkit.event.player.PlayerDropItemEvent;
import org.bukkit.event.player.PlayerAttemptPickupItemEvent;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.net.URI;
import java.net.http.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.imageio.ImageIO;

public final class AccountLinkService extends ListenerAdapter implements Listener, org.bukkit.plugin.messaging.PluginMessageListener {
    private final MakongCore plugin; private final Database db; private final FloodgateHook floodgate;
    private final FileConfigurationBridge cfg;
    private final Map<String,Pending> pending=new ConcurrentHashMap<>();
    // Requests awaiting a higher-tier staff member's Accept/Deny click (the
    // moderation-request embed's buttons) - see staffTier()/requiredApprover()
    // and onSlashCommandInteraction()'s /ban, /unban handling below. Keyed by
    // a short random id embedded in the button's component id.
    private final Map<String,ModRequest> modRequests=new ConcurrentHashMap<>();
    private final Map<UUID,String> playerCodes=new ConcurrentHashMap<>(); private final Set<UUID> frozen=ConcurrentHashMap.newKeySet();
    // Populated by the optional MakongVelocity companion's "makong:accounttype"
    // plugin message, keyed by player UUID - "java"|"cracked"|"bedrock". When
    // present for a joining player, onJoin() trusts it instead of running its
    // own async Mojang API guess. Absent entirely on a standalone server (no
    // Velocity, or Velocity without nLogin/this forwarding disabled) - nothing
    // here changes in that case.
    private final Map<UUID,String> externalAccountType=new ConcurrentHashMap<>();
    // Last time each player successfully ran /verify - gates
    // linking.request_cooldown_seconds in displayOptionalCode() below.
    private final Map<UUID,Long> lastVerifyRequest=new ConcurrentHashMap<>();
    private final HttpClient http=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private JDA jda; private ScheduledExecutorService telegram; private org.bukkit.scheduler.BukkitTask reminderTask; private org.bukkit.scheduler.BukkitTask statusTask;
    private static final Pattern CODE=Pattern.compile("^\\d{6}$");

    public AccountLinkService(MakongCore p,Database d,FloodgateHook f,org.bukkit.configuration.file.FileConfiguration c){plugin=p;db=d;floodgate=f;cfg=new FileConfigurationBridge(c);}

    // Also governs how often a frozen player's reminder (title/subtitle/
    // action bar/chat message, see sendReminder()) repeats - see
    // linking.reminder.interval_seconds in module/verification.yml.
    // discord.hub gates only whether THIS server opens its own JDA
    // connection - discord.enabled (checked separately throughout this
    // class) keeps controlling whether linking is required/available and
    // whether /verify works, regardless of which server actually holds the
    // live connection. See module/verification.yml's discord.hub comment
    // for why: multiple servers all connecting the same bot_token race
    // each other to acknowledge every interaction.
    public void start(){long intervalTicks=Math.max(1,cfg.l("linking.reminder.interval_seconds",3))*20L;reminderTask=plugin.getServer().getScheduler().runTaskTimer(plugin,this::tickPending,intervalTicks,intervalTicks);if(!cfg.b("discord.enabled",false)&&!cfg.b("telegram.enabled",false))return; if(cfg.b("discord.enabled",false)&&cfg.b("discord.hub",true))startDiscord(); if(cfg.b("telegram.enabled",false))startTelegram();}
    // shutdownNow() only requests shutdown - it returns immediately while JDA's
    // WebSocket threads are still tearing down in the background. onDisable()
    // returning right after that lets Paper close this plugin's classloader
    // (the jar's zip file handle) while those threads are still alive, so the
    // next class they need to lazy-load throws "IllegalStateException: zip
    // file closed" instead of a clean shutdown. Blocking here until JDA
    // actually finishes (bounded, so a stuck shutdown can't hang the server)
    // avoids the race.
    public void stop(){if(reminderTask!=null){reminderTask.cancel();reminderTask=null;}if(statusTask!=null){statusTask.cancel();statusTask=null;}if(jda!=null){JDA j=jda;jda=null;j.shutdownNow();try{j.awaitShutdown(5,TimeUnit.SECONDS);}catch(InterruptedException e){Thread.currentThread().interrupt();}}if(telegram!=null){telegram.shutdownNow();telegram=null;}}
    // A player can finish verifying via a DIFFERENT server's Discord/Telegram
    // connection than the one they're frozen on (see verifyDiscord/
    // verifyTelegram's db.findPending fallback) - that other server can't
    // unfreeze them locally since they're not online there. So on every
    // tick, re-check the shared account_links table for each locally frozen
    // player and release them if a link now exists, regardless of which
    // server actually completed it.
    private void tickPending(){
        long now=System.currentTimeMillis();
        for(Pending x:new ArrayList<>(pending.values())){if(x.expiresAt<now){pending.remove(x.code);db.removePending(x.code);if(frozen.contains(x.uuid)){Player p=Bukkit.getPlayer(x.uuid);if(p!=null)freezeAndCode(p,x.accountType);}}}
        for(UUID u:new ArrayList<>(frozen)){
            if(Bukkit.getPlayer(u)==null)continue;
            db.getAccountLink(u).thenAccept(link->Bukkit.getScheduler().runTask(plugin,()->{
                Player p=Bukkit.getPlayer(u); if(p==null)return;
                if(link!=null){pending.values().removeIf(v->v.uuid.equals(u));playerCodes.remove(u);release(u);return;}
                String code=playerCodes.get(u);
                if(code!=null)sendReminder(p,code);
            }));
        }
    }

    // {code}/{discord}/{telegram} substitution, then "&"-style color codes
    // (easier to type in YAML than a literal section sign) translated to
    // real ones - same convention most Bukkit plugin configs use.
    private String placeholders(String s,String code){
        String out=s.replace("{code}",code)
            .replace("{discord}",cfg.s("discord.invite","discord.gg/makong"))
            .replace("{telegram}","@"+cfg.s("telegram.username","makongmcbot"));
        return org.bukkit.ChatColor.translateAlternateColorCodes('&',out);
    }

    // The full "you must verify" nag - title/subtitle/action bar/chat
    // message, every line configurable in module/verification.yml's
    // linking.reminder.*. Called once when a player is first frozen
    // (freezeAndCode() below) and then repeated every tick of this
    // service's scheduler (tickPending() above) for as long as they stay
    // frozen - a title or action bar fades on its own after a few seconds,
    // so without repeating it it would only ever be shown once.
    private void sendReminder(Player p,String code){
        String title=placeholders(cfg.s("linking.reminder.title","{code}"),code);
        String subtitle=placeholders(cfg.s("linking.reminder.subtitle","Send this code to Discord/Telegram to play"),code);
        String actionbar=placeholders(cfg.s("linking.reminder.actionbar","&bDiscord: {discord} &7| &bTelegram: {telegram}"),code);
        String message=placeholders(cfg.s("linking.reminder.message","&cYou must link your account to continue. &7Code: &e{code}"),code);
        p.sendTitle(title,subtitle,10,80,10);
        p.sendActionBar(actionbar);
        p.sendMessage(message);
    }
    private void startDiscord(){String token=cfg.s("discord.bot_token","");if(token.isBlank()||token.startsWith("PUT_")){plugin.getLogger().warning("Discord enabled but bot_token is not configured.");return;}try{jda=JDABuilder.createDefault(token).addEventListeners(this).build();plugin.getLogger().info("Discord hook starting...");}catch(Exception e){plugin.getLogger().severe("Discord hook failed: "+e.getMessage());}}
    @Override public void onReady(ReadyEvent e){registerCommands();sendVerificationPanel();startStatusPanel();plugin.getLogger().info("Discord hook connected as "+e.getJDA().getSelfUser().getName()+".");}
    private void registerCommands(){if(jda==null)return; jda.updateCommands().addCommands(Commands.slash("ban","Ban a Minecraft player").addOption(OptionType.STRING,"name","Minecraft name",true).addOption(OptionType.STRING,"duration","Duration (choose a preset or type your own)",true,true).addOption(OptionType.STRING,"reason","Reason",true),Commands.slash("unban","Unban a Minecraft player").addOption(OptionType.STRING,"name","Minecraft name",true).addOption(OptionType.STRING,"reason","Reason",true),Commands.slash("profile","Show a linked player's Makong Network profile").addOption(OptionType.USER,"user","The Discord user to look up (defaults to you)",false),linkCommand("link"),linkCommand("verify"),Commands.slash("topteam","Top 10 teams by Stars"),Commands.slash("topplayer","Top 10 players by MaTier Stars"),Commands.slash("editprofile","Choose which of your linked accounts is Main, Alt#1 or Alt#2"),Commands.slash("status","Live Makong Network server status")).queue();}
    // /link and /verify are identical aliases - a slash-command shortcut for
    // someone who'd rather not go find the verification channel and click
    // its button. With no `code` given, opens the same modal the "Verify
    // Code" button does; with `code` given, skips the modal entirely and
    // verifies straight from the command itself.
    private net.dv8tion.jda.api.interactions.commands.build.SlashCommandData linkCommand(String name){
        return Commands.slash(name,"Link your Minecraft account to Discord").addOption(OptionType.STRING,"code","Your 6-digit code from /verify in-game (leave blank to open a form instead)",false);
    }
    @Override public void onCommandAutoCompleteInteraction(CommandAutoCompleteInteractionEvent e){
        if(!e.getName().equals("ban")||!e.getFocusedOption().getName().equals("duration"))return;
        String input=e.getFocusedOption().getValue().toLowerCase(Locale.ROOT);
        List<Command.Choice> choices=List.of(
            new Command.Choice("Forever","permanent"),
            new Command.Choice("3d","3d"),
            new Command.Choice("5d","5d"),
            new Command.Choice("7d","7d"),
            new Command.Choice("1month","1mo")
        );
        e.replyChoices(choices.stream().filter(c->c.getName().toLowerCase(Locale.ROOT).contains(input)||c.getAsString().contains(input)).limit(25).toList()).queue();
    }

    private void sendVerificationPanel(){String channelId=cfg.s("discord.verification.channel_id","");if(channelId.isBlank()||jda==null)return;TextChannel ch=jda.getTextChannelById(channelId);if(ch==null)return;var embed=new net.dv8tion.jda.api.EmbedBuilder().setTitle("🔐 Makong Minecraft Verification").setDescription("Link your Minecraft account to Discord securely.\n\n**How to verify:**\n1. Join the Makong Minecraft server.\n2. Use the verification command to receive your **6-digit code**.\n3. Click **Verify Code** below and enter your code - or, from anywhere, run **/link** (or **/verify**) and either fill in the same form or add `code:` to skip it entirely.\n\n> 🔒 Your Discord account will be linked to your Minecraft account after successful verification.").setColor(new java.awt.Color(0x58,0xA6,0xFF)).build();String configured=cfg.s("discord.verification.panel_message_id","");if(!configured.isBlank()){editPanel(ch,configured,embed);return;}db.meta("discord_verification_panel_message_id").thenAccept(id->{if(id!=null&&!id.isBlank())editPanel(ch,id,embed);else ch.sendMessageEmbeds(embed).setComponents(ActionRow.of(Button.primary("makong:verify","Verify Code"))).queue(msg->db.setMeta("discord_verification_panel_message_id",msg.getId()));});}
    private void editPanel(TextChannel ch,String id,net.dv8tion.jda.api.entities.MessageEmbed embed){ch.retrieveMessageById(id).queue(msg->msg.editMessageEmbeds(embed).setComponents(ActionRow.of(Button.primary("makong:verify","Verify Code"))).queue(),err->ch.sendMessageEmbeds(embed).setComponents(ActionRow.of(Button.primary("makong:verify","Verify Code"))).queue(msg->db.setMeta("discord_verification_panel_message_id",msg.getId())));}

    // discord.status - a live network status embed that keeps re-editing
    // itself in discord.status.channel_id every update_interval_seconds
    // (same self-editing-message trick as sendVerificationPanel/editPanel
    // above, its own message id persisted under a different meta key so the
    // two panels never collide), plus /status which anyone can run for the
    // same embed on demand. Both read the exact same data: this server's
    // WebsiteBridgeService#knownServers() (every server the website bridge
    // saw as of this hub's last poll tick, online status + player count +
    // how long each has been continuously online) matched up against
    // discord.status.servers (which serverId maps to which display label/
    // emoji - the network's actual gamemode servers aren't something this
    // plugin could ever infer on its own, so it has to be configured).
    private void startStatusPanel(){
        if(!cfg.b("discord.status.enabled",false))return;
        long intervalTicks=Math.max(15,cfg.l("discord.status.update_interval_seconds",60))*20L;
        updateStatusPanel();
        statusTask=plugin.getServer().getScheduler().runTaskTimerAsynchronously(plugin,this::updateStatusPanel,intervalTicks,intervalTicks);
    }
    private void updateStatusPanel(){
        if(jda==null)return;
        String channelId=cfg.s("discord.status.channel_id","");
        if(channelId.isBlank())return;
        TextChannel ch=jda.getTextChannelById(channelId);
        if(ch==null)return;
        var embed=buildStatusEmbed();
        String configured=cfg.s("discord.status.panel_message_id","");
        if(!configured.isBlank()){editStatusPanel(ch,configured,embed);return;}
        db.meta("discord_status_panel_message_id").thenAccept(id->{
            if(id!=null&&!id.isBlank())editStatusPanel(ch,id,embed);
            else ch.sendMessageEmbeds(embed).queue(msg->db.setMeta("discord_status_panel_message_id",msg.getId()));
        });
    }
    private void editStatusPanel(TextChannel ch,String id,net.dv8tion.jda.api.entities.MessageEmbed embed){ch.retrieveMessageById(id).queue(msg->msg.editMessageEmbeds(embed).queue(),err->ch.sendMessageEmbeds(embed).queue(msg->db.setMeta("discord_status_panel_message_id",msg.getId())));}

    // Grace period (discord.status.starting_grace_seconds) a server shows
    // "Starting" instead of "Online" right after its FIRST heartbeat of a
    // fresh connect/reconnect - see WebsiteBridge.ServerInfo#onlineSince and
    // MakongWeb/lib/pluginBridge.js's markSeen(). A rough stand-in for "the
    // process is up but the world probably hasn't finished loading yet",
    // since the plugin has no real boot-phase signal to report - not exact,
    // but self-correcting within one grace window either way.
    private net.dv8tion.jda.api.entities.MessageEmbed buildStatusEmbed(){
        String title=cfg.s("discord.status.title","🌿 MAKONG NETWORK");
        long graceMs=Math.max(0,cfg.l("discord.status.starting_grace_seconds",30))*1000L;
        List<FileConfigurationBridge.StatusServerEntry> configured=cfg.statusServers("discord.status.servers");
        List<WebsiteBridge.ServerInfo> known=plugin.websiteBridge()==null?List.of():plugin.websiteBridge().knownServers();
        long now=System.currentTimeMillis();

        int labelWidth="Website".length();
        for(var se:configured)labelWidth=Math.max(labelWidth,se.label().length());
        int statusWidth="Maintenance".length();

        StringBuilder body=new StringBuilder("━━━━━━━━━━━━━━━━━━━━\n\n```\n");
        boolean websiteOnline=plugin.websiteBridge()!=null&&plugin.websiteBridge().isConnected();
        body.append(statusRow("🌐","Website",labelWidth,websiteOnline?"🟢":"🔴",websiteOnline?"Online":"Offline",statusWidth,null)).append('\n');

        long proxyCount=-1,backendTotal=0;
        for(var se:configured){
            WebsiteBridge.ServerInfo info=null;
            for(WebsiteBridge.ServerInfo s:known)if(se.serverId().equals(s.serverId)){info=s;break;}
            String statusEmoji,statusText;Long count=null;
            if(se.maintenance()){statusEmoji="🟠";statusText="Maintenance";}
            else if(info==null){statusEmoji="⚪";statusText="Unknown";}
            else if(!info.online){statusEmoji="🔴";statusText="Offline";}
            else if(info.onlineSince>0&&now-info.onlineSince<graceMs){statusEmoji="🟡";statusText="Starting";count=(long)info.playerCount;}
            else{statusEmoji="🟢";statusText="Online";count=(long)info.playerCount;}
            if(info!=null&&info.online&&!se.maintenance()){
                if("velocity".equals(info.kind))proxyCount=info.playerCount;
                else backendTotal+=info.playerCount;
            }
            body.append(statusRow(se.emoji(),se.label(),labelWidth,statusEmoji,statusText,statusWidth,count)).append('\n');
        }
        body.append("```\n━━━━━━━━━━━━━━━━━━━━\n");
        body.append("👥 **Network Players:** ").append(proxyCount>=0?proxyCount:backendTotal).append("\n\n");
        body.append("🟢 Online\n🟡 Starting\n🟠 Maintenance\n🔴 Offline\n⚪ Unknown");

        return new net.dv8tion.jda.api.EmbedBuilder().setTitle(title).setDescription(body.toString()).setColor(0x2ECC71).build();
    }
    private String statusRow(String emoji,String label,int labelWidth,String statusEmoji,String statusText,int statusWidth,Long count){
        StringBuilder sb=new StringBuilder().append(emoji).append(' ').append(pad(label,labelWidth)).append("  ").append(statusEmoji).append(' ').append(pad(statusText,statusWidth));
        if(count!=null)sb.append(" • ").append(count);
        return sb.toString();
    }
    private String pad(String s,int width){StringBuilder sb=new StringBuilder(s);while(sb.length()<width)sb.append(' ');return sb.toString();}
    @Override public void onButtonInteraction(ButtonInteractionEvent e){
        if(e.getComponentId().equals("makong:verify")){TextInput code=TextInput.create("code",TextInputStyle.SHORT).setPlaceholder("123456").setMinLength(6).setMaxLength(6).build();e.replyModal(Modal.create("makong:verify","Minecraft Verification").addComponents(Label.of("Verification Code",code)).build()).queue();return;}
        if(e.getComponentId().startsWith("makong:modreq:"))onModRequestButton(e);
    }
    // makong:modreq:accept:<id> / makong:modreq:deny:<id> - the pending
    // moderation-request embed's buttons (see onSlashCommandInteraction()'s
    // /ban, /unban handling below). Whoever clicks needs staffTier() at
    // least the request's minApprover to act on it; the request is consumed
    // (removed from modRequests) on the first valid click either way, so a
    // second click - even from someone equally qualified - just sees "no
    // longer pending".
    private void onModRequestButton(ButtonInteractionEvent e){
        String[] parts=e.getComponentId().split(":");
        String action=parts.length>2?parts[2]:"";
        String id=parts.length>3?parts[3]:"";
        ModRequest req=modRequests.get(id);
        if(req==null){e.reply("❌ This request is no longer pending (already handled or expired).").setEphemeral(true).queue();return;}
        StaffTier clicker=staffTier(e.getMember(),e.getGuild());
        if(clicker==StaffTier.NONE||clicker.ordinal()<req.minApprover().ordinal()){e.reply("❌ You don't have permission to decide this request.").setEphemeral(true).queue();return;}
        modRequests.remove(id);
        String clickerMention="<@"+e.getUser().getId()+">";
        String staffMention="<@"+req.requester().discordId()+">";
        if(action.equals("deny")){
            var embed=modEmbed(req.ban(),true,req.target(),req.duration(),req.reason(),staffMention,"🔴","Denied by "+clickerMention,0xE74C3C);
            e.editMessageEmbeds(embed.build()).setComponents(List.of()).queue();
            return;
        }
        runModCommand(req.ban(),req.target(),req.duration(),req.reason(),req.requester(),ok->{
            var embed=ok
                ?modEmbed(req.ban(),false,req.target(),req.duration(),req.reason(),staffMention,"🟢","Accepted by "+clickerMention,0x2ECC71)
                :modEmbed(req.ban(),true,req.target(),req.duration(),req.reason(),staffMention,"🔴","Accepted by "+clickerMention+", but failed to apply - check console",0xE74C3C);
            e.editMessageEmbeds(embed.build()).setComponents(List.of()).queue();
        });
    }
    @Override public void onModalInteraction(ModalInteractionEvent e){if(!e.getModalId().equals("makong:verify"))return;String code=e.getValue("code")==null?"":e.getValue("code").getAsString().trim();if(!CODE.matcher(code).matches()){e.reply("❌ Invalid code.").setEphemeral(true).queue();return;} verifyDiscord(e,code);}
    // Shared by the verification-channel modal (either opened by its button
    // or by /link's/verify's own no-argument form) AND /link's/verify's
    // `code` option, which skips the modal entirely - both a
    // ModalInteractionEvent and a SlashCommandInteractionEvent implement
    // IReplyCallback (and, through it, Interaction's getUser/getMember/
    // getGuild), so one code path replies correctly either way.
    // Every Discord-enabled server shares the same bot token and connection,
    // so this can land on a different server than the one that generated
    // the code (see Database#putPending's javadoc). Try the local, fast
    // in-memory map first; only fall back to the shared DB lookup if this
    // server doesn't recognize the code itself.
    private void verifyDiscord(IReplyCallback e,String code){
        Pending local=pending.get(code);
        if(local!=null){verifyDiscord(e,local);return;}
        db.findPending(code).thenAccept(row->{
            if(row==null){e.reply("❌ Code expired or not found. Join the server again for a new code.").setEphemeral(true).queue();return;}
            verifyDiscord(e,new Pending(row.uuid(),row.name(),code,row.expiresAt(),row.accountType(),row.discordOnly()));
        });
    }
    // Alt accounts: a Discord id may link more than one Minecraft account
    // (Main, slot 0, plus up to two alts) once it clears BOTH gates - the
    // base discordAllowed() eligibility above (unchanged, still gates
    // whether this Discord account may link ANYTHING at all) and the
    // separate, additive maxAccountsFor() tier below (how many TOTAL
    // accounts it currently qualifies for). Re-verifying an account this
    // Discord id already has linked (at any slot) just re-completes at that
    // same slot - it never counts against or re-checks the alt-tier cap.
    private void verifyDiscord(IReplyCallback e,Pending x){
        if(x.expiresAt<System.currentTimeMillis()){e.reply("❌ Code expired or not found. Join the server again for a new code.").setEphemeral(true).queue();return;}
        if(!discordAllowed(e.getUser(),e.getMember(),e.getGuild())){e.reply("❌ Your Discord account does not meet the server/account-age requirements.").setEphemeral(true).queue();return;}
        String discordId=e.getUser().getId();
        db.linkedAccounts(discordId).thenAccept(links->{
            Database.LinkedAccount mine=links.stream().filter(l->l.uuid().equals(x.uuid)).findFirst().orElse(null);
            if(mine!=null){completeDiscord(e,x,mine.slot(),mine.telegramChatId());return;}
            long accountAgeDays=Duration.between(e.getUser().getTimeCreated().toInstant(),Instant.now()).toDays();
            Member m=e.getMember();
            long membershipDays=m==null||m.getTimeJoined()==null?0:Duration.between(m.getTimeJoined().toInstant(),Instant.now()).toDays();
            int maxAllowed=maxAccountsFor(accountAgeDays,membershipDays);
            if(links.size()>=maxAllowed){
                e.reply("❌ This Discord account is already linked to the maximum number of accounts it currently qualifies for ("+maxAllowed+"). See the alt-account requirements for a higher limit.").setEphemeral(true).queue();
                return;
            }
            completeDiscord(e,x,nextFreeSlot(links),null);
        });
    }
    private void completeDiscord(IReplyCallback e,Pending x,int slot,String preserveTelegram){
        String discordId=e.getUser().getId();
        CompletableFuture<Void> op=slot==0
                ?db.linkAccount(x.uuid,x.name(),discordId,preserveTelegram,x.accountType)
                :db.linkAlt(x.uuid,x.name(),discordId,x.accountType,slot);
        op.thenRun(()->{
            pending.remove(x.code);db.removePending(x.code);playerCodes.remove(x.uuid);frozen.remove(x.uuid);
            Bukkit.getScheduler().runTask(plugin,()->release(x.uuid));
            Guild g=e.getGuild();
            String roleKey=x.accountType.equals("cracked")?"roles.crack":x.accountType.equals("bedrock")?"roles.bedrock":"roles.java";
            String roleId=cfg.s("discord."+roleKey,"");
            if(g!=null&&!roleId.isBlank()){Role role=g.getRoleById(roleId);if(role!=null)g.addRoleToMember(e.getUser(),role).queue();}
            e.reply("✅ Successfully connected to **"+x.name()+"** ("+slotLabel(slot)+").").setEphemeral(true).queue();
        });
    }
    // How many TOTAL Minecraft accounts (Main + alts) this Discord id may
    // have linked, based on ITS OWN age and time in this guild - see
    // discord.alts.tiers in module/verification.yml. Independent of
    // discordAllowed()'s eligibility_tiers, which still separately gates
    // whether this Discord account may link at all; this only controls how
    // many. The highest matching tier wins; 1 (Main only, no alts) if none
    // match or discord.alts.enabled is false.
    private int maxAccountsFor(long accountAgeDays,long membershipDays){
        if(!cfg.b("discord.alts.enabled",true))return 1;
        int max=1;
        for(long[] tier:cfg.altTiers("discord.alts.tiers")){
            if(accountAgeDays>=tier[0]&&membershipDays>=tier[1]&&tier[2]>max)max=(int)tier[2];
        }
        return max;
    }
    // The lowest unused slot among {1 (Alt#1), 2 (Alt#2)} - or 0 (Main) if
    // nothing's linked yet at all. Only ever called after maxAccountsFor()
    // has already confirmed there's room for one more.
    private int nextFreeSlot(List<Database.LinkedAccount> links){
        if(links.isEmpty())return 0;
        Set<Integer> used=new HashSet<>();
        for(Database.LinkedAccount l:links)used.add(l.slot());
        for(int s=1;s<=2;s++)if(!used.contains(s))return s;
        return -1;
    }
    private static String slotLabel(int slot){return switch(slot){case 0->"Main";case 1->"Alt#1";case 2->"Alt#2";default->"Alt#"+slot;};}
    // Player-verification gate only - account-age/membership eligibility
    // tiers plus the optional discord.guild.required_role_id. Staff
    // permission for /ban and /unban is a completely separate, unrelated
    // check - see staffTier() below - since a moderator shouldn't need
    // to satisfy "my Discord account is 6 months old" just to do their job.
    private boolean discordAllowed(User u,Member m,Guild g){
        if(g==null||m==null)return false;
        String guildId=cfg.s("discord.guild.id","");
        boolean guildRequired=cfg.b("discord.guild.required",true);
        if(guildRequired&&!guildId.isBlank()&&!g.getId().equals(guildId))return false;
        long accountAgeDays=Duration.between(u.getTimeCreated().toInstant(),Instant.now()).toDays();
        long membershipDays=m.getTimeJoined()==null?-1:Duration.between(m.getTimeJoined().toInstant(),Instant.now()).toDays();
        if(!eligible(accountAgeDays,membershipDays))return false;
        String req=cfg.s("discord.guild.required_role_id","");
        return req.isBlank()||m.getRoles().stream().anyMatch(r->r.getId().equals(req));
    }

    // Who may use /ban and /unban, and at which of three tiers - see
    // discord.commands.roles in module/verification.yml for the full
    // per-tier behavior table (Manager runs both commands immediately;
    // Helper's /ban runs immediately but /unban needs a Manager to
    // Accept/Deny; Trial Helper needs approval for both). Deliberately
    // fails CLOSED: a member matching none of the three role lists (and not
    // covered by the legacy staff_role_ids/staff_role_id below, which
    // counts as Manager) is StaffTier.NONE and can't use either command at
    // all - moderation commands shouldn't default to open just because an
    // admin never got around to configuring them.
    private enum StaffTier{NONE,TRIAL_HELPER,HELPER,MANAGER}
    // A pending /ban or /unban awaiting a higher-tier staff member's
    // Accept/Deny click. `requester` is who ran the original command (their
    // linked Minecraft account - needed for LiteBans' --sender/--sender-uuid
    // and the embed's "Staff:" line); `minApprover` is the minimum tier
    // allowed to decide it - see requiredApprover().
    private record ModRequest(boolean ban,String target,String duration,String reason,Database.AccountLink requester,StaffTier minApprover){}
    private StaffTier staffTier(Member m,Guild g){
        if(g==null||m==null)return StaffTier.NONE;
        String guildId=cfg.s("discord.guild.id","");
        boolean guildRequired=cfg.b("discord.guild.required",true);
        if(guildRequired&&!guildId.isBlank()&&!g.getId().equals(guildId))return StaffTier.NONE;
        if(hasAnyRole(m,cfg.list("discord.commands.roles.manager_role_ids"))||hasAnyRole(m,staffRoleIds()))return StaffTier.MANAGER;
        if(hasAnyRole(m,cfg.list("discord.commands.roles.helper_role_ids")))return StaffTier.HELPER;
        if(hasAnyRole(m,cfg.list("discord.commands.roles.trial_helper_role_ids")))return StaffTier.TRIAL_HELPER;
        return StaffTier.NONE;
    }
    private boolean hasAnyRole(Member m,List<String> roleIds){
        return roleIds!=null&&!roleIds.isEmpty()&&m.getRoles().stream().anyMatch(r->roleIds.contains(r.getId()));
    }
    private List<String> staffRoleIds(){
        List<String> out=new ArrayList<>(cfg.list("discord.commands.staff_role_ids"));
        String legacy=cfg.s("discord.commands.staff_role_id","");
        if(!legacy.isBlank()&&!out.contains(legacy))out.add(legacy);
        return out;
    }

    // A Discord account qualifies to verify if it satisfies AT LEAST ONE
    // configured tier - each tier needs BOTH its account-age AND its
    // guild-membership-age minimum met (see discord.guild.eligibility_tiers
    // in module/verification.yml, e.g. "6-month-old account + 1 month in
    // the guild" OR "1-year-old account, any membership length"). Discord
    // doesn't expose phone-verification status to bots at all - there's no
    // "verified phone number" signal available here, by design on Discord's
    // side, not a limitation of this plugin.
    private boolean eligible(long accountAgeDays,long membershipDays){
        if(membershipDays<0)return false;
        List<long[]> tiers=cfg.tiers("discord.guild.eligibility_tiers");
        for(long[] tier:tiers){
            if(accountAgeDays>=tier[0]&&membershipDays>=tier[1])return true;
        }
        return false;
    }
    @Override public void onSlashCommandInteraction(SlashCommandInteractionEvent e){
        if(!e.isFromGuild()){e.reply("Guild only.").setEphemeral(true).queue();return;}
        if(e.getName().equals("profile")){handleProfile(e);return;}
        if(e.getName().equals("link")||e.getName().equals("verify")){handleLinkCommand(e);return;}
        if(e.getName().equals("topteam")){handleTopTeam(e);return;}
        if(e.getName().equals("topplayer")){handleTopPlayer(e);return;}
        if(e.getName().equals("editprofile")){handleEditProfile(e);return;}
        if(e.getName().equals("status")){e.replyEmbeds(buildStatusEmbed()).queue();return;}
        if(!e.getName().equals("ban")&&!e.getName().equals("unban"))return;
        boolean ban=e.getName().equals("ban");
        if(!cfg.b("discord.commands."+e.getName()+".enabled",true)){e.reply("❌ This Discord command is disabled.").setEphemeral(true).queue();return;}
        StaffTier tier=staffTier(e.getMember(),e.getGuild());
        if(tier==StaffTier.NONE){e.reply("❌ You don't have a staff role permitted to use this command.").setEphemeral(true).queue();return;}
        String target=e.getOption("name").getAsString();
        String duration=ban?normalizeDuration(e.getOption("duration")==null?"":e.getOption("duration").getAsString()):null;
        String reason=e.getOption("reason")==null?"":e.getOption("reason").getAsString();
        StaffTier minApprover=requiredApprover(ban,tier);
        db.findByDiscord(e.getUser().getId()).thenAccept(staff->{
            if(staff==null){e.reply("❌ Your Discord account is not linked to Minecraft.").setEphemeral(true).queue();return;}
            String staffMention="<@"+staff.discordId()+">";
            if(minApprover==null){
                runModCommand(ban,target,duration,reason,staff,ok->{
                    var embed=ok
                        ?modEmbed(ban,false,target,duration,reason,staffMention,"🟢",(ban?"Ban":"Unban")+" applied successfully",0x2ECC71)
                        :modEmbed(ban,true,target,duration,reason,staffMention,"🔴","Failed to apply - check this server's console",0xE74C3C);
                    e.replyEmbeds(embed.build()).queue();
                });
                return;
            }
            String id=UUID.randomUUID().toString().substring(0,8);
            modRequests.put(id,new ModRequest(ban,target,duration,reason,staff,minApprover));
            var embed=modEmbed(ban,true,target,duration,reason,staffMention,"🟡","Wait for Higher staff to decide",0xF1C40F);
            e.replyEmbeds(embed.build()).setComponents(ActionRow.of(Button.danger("makong:modreq:deny:"+id,"Deny"),Button.success("makong:modreq:accept:"+id,"Accept"))).queue();
        });
    }
    // /link (and its /verify alias) - a slash-command shortcut for the same
    // thing the verification channel's "Verify Code" button does, for anyone
    // who'd rather not go find that channel. No `code` option: opens the
    // identical modal (same modal id, so onModalInteraction() handles it the
    // same way either way it was opened). A `code` option: skips the modal
    // and verifies immediately, straight off this one command.
    private void handleLinkCommand(SlashCommandInteractionEvent e){
        OptionMapping opt=e.getOption("code");
        if(opt==null){
            TextInput code=TextInput.create("code",TextInputStyle.SHORT).setPlaceholder("123456").setMinLength(6).setMaxLength(6).build();
            e.replyModal(Modal.create("makong:verify","Minecraft Verification").addComponents(Label.of("Verification Code",code)).build()).queue();
            return;
        }
        String code=opt.getAsString().trim();
        if(!CODE.matcher(code).matches()){e.reply("❌ Invalid code. It should be exactly 6 digits.").setEphemeral(true).queue();return;}
        verifyDiscord(e,code);
    }
    // /topteam and /topplayer - Discord-side equivalents of /mateam leaderboard
    // (team.stars, GuiManager's default leaderboard mode) and /matier top
    // (player Stars). Both are public, no permission gate - same as their
    // in-game counterparts. Fixed top 10, no page/count option, per how
    // they were asked for.
    private static final String[] TOP_MEDALS = {"🥇","🥈","🥉"};
    private String topRankLabel(int index){return index<TOP_MEDALS.length?TOP_MEDALS[index]:"**#"+(index+1)+"**";}

    private void handleTopTeam(SlashCommandInteractionEvent e){
        List<Team> list=new ArrayList<>(plugin.teams().all());
        list.sort(Comparator.comparingLong(Team::stars).reversed().thenComparing(Team::name,String.CASE_INSENSITIVE_ORDER));
        StringBuilder sb=new StringBuilder();
        if(list.isEmpty()){
            sb.append("*No teams yet.*");
        } else {
            int limit=Math.min(10,list.size());
            for(int i=0;i<limit;i++){
                Team t=list.get(i);
                sb.append(topRankLabel(i)).append(" **").append(t.name()).append("** [").append(t.tag())
                        .append("] — ⭐ ").append(t.stars()).append('\n');
            }
        }
        var embed=new net.dv8tion.jda.api.EmbedBuilder().setTitle("🏆 Top Teams").setDescription(sb.toString()).setColor(0xF1C40F);
        e.replyEmbeds(embed.build()).queue();
    }

    private void handleTopPlayer(SlashCommandInteractionEvent e){
        List<Database.PlayerStar> list=plugin.matier().sorted();
        StringBuilder sb=new StringBuilder();
        if(list.isEmpty()){
            sb.append("*No players yet.*");
        } else {
            int limit=Math.min(10,list.size());
            for(int i=0;i<limit;i++){
                Database.PlayerStar p=list.get(i);
                String tier=plugin.matier().tier(p.uuid());
                sb.append(topRankLabel(i)).append(" **").append(p.name()).append("** — ").append(tier)
                        .append(" · ⭐ ").append(p.stars()).append('\n');
            }
        }
        var embed=new net.dv8tion.jda.api.EmbedBuilder().setTitle("🏆 Top Players").setDescription(sb.toString()).setColor(0x3498DB);
        e.replyEmbeds(embed.build()).queue();
    }

    // /profile @user - looks up the target's linked Minecraft account(s),
    // then gathers Team/MaTier data locally (this server already has it)
    // and nLogin registration/last-login + true whole-network online status
    // via the website bridge (see WebsiteBridgeService#requestProfile -
    // only the connected Velocity companion has that), in parallel with
    // fetching a skin render, before compositing it all into one PNG
    // (ProfileCard). Shows Main by default; with 2+ linked accounts, a
    // dropdown (onProfileSelect below) lets the viewer switch to any alt.
    private void handleProfile(SlashCommandInteractionEvent e){
        OptionMapping opt=e.getOption("user");
        User target=opt!=null?opt.getAsUser():e.getUser();
        boolean self=target.getId().equals(e.getUser().getId());
        db.linkedAccounts(target.getId()).thenAccept(links->{
            if(links.isEmpty()){
                String who=self?"You're":"<@"+target.getId()+"> is";
                String channelId=cfg.s("discord.verification.channel_id","");
                String where=channelId.isBlank()?"in this server":"in <#"+channelId+">";
                e.reply("❌ "+who+" not linked to a Minecraft account yet. Run **/verify** in-game to get a code, then either click **Verify Code** "+where+", or run **/link** (or **/verify**) here and enter it.").queue();
                return;
            }
            e.deferReply().queue();
            buildProfileCard(links.get(0),links,target.getId(),e.getHook());
        });
    }
    // `allLinks` (Main-first, slot order) drives the account-switcher
    // dropdown attached below the card - omitted entirely when there's
    // only one, per how this was asked for ("if have alt only 1, don't
    // display" - a dropdown with a single, unchangeable option is the same
    // uselessness as the single-alt button case that came from).
    private void buildProfileCard(Database.LinkedAccount link,List<Database.LinkedAccount> allLinks,String discordId,InteractionHook hook){
        UUID uuid=link.uuid();
        Team t=plugin.teams().byPlayer(uuid);
        String tier=plugin.matier().tier(uuid);
        long stars=plugin.matier().stars(uuid);
        Integer rank=stars>0?plugin.matier().rank(uuid):null;
        String accountType=displayAccountType(link.accountType());
        String tagline=cfg.s("discord.profile.tagline","Play. Improve. Be Better.");

        CompletableFuture<BufferedImage> skinFuture=fetchSkinRender(uuid,link.accountType());
        CompletableFuture<Map<String,Object>> bridgeFuture=new CompletableFuture<>();
        plugin.websiteBridge().requestProfile(link.name(),bridgeFuture::complete,8000);

        skinFuture.thenCombineAsync(bridgeFuture,(skin,data)->{
            boolean online=Boolean.TRUE.equals(data.get("online"));
            Long registeredAt=asLong(data.get("registeredAt"));
            Long lastLogin=asLong(data.get("lastLogin"));
            ProfileCard.Input input=new ProfileCard.Input(link.name(),online,rank,tier,stars,
                    t==null?null:t.name(),accountType,registeredAt,lastLogin,skin);
            try{return ProfileCard.render(input,tagline);}
            catch(Exception ex){throw new CompletionException(ex);}
        }).whenComplete((png,err)->{
            if(err!=null||png==null){
                plugin.getLogger().warning("/profile card render failed for "+link.name()+": "+(err==null?"unknown error":err.getMessage()));
                hook.editOriginal("❌ Failed to build the profile card - check this server's console.").queue();
                return;
            }
            var embed=new net.dv8tion.jda.api.EmbedBuilder().setTitle(slotLabel(link.slot())+" - "+link.name()).setImage("attachment://profile.png").setColor(0x2ECC71).build();
            var edit=hook.editOriginalAttachments(FileUpload.fromData(png,"profile.png")).setEmbeds(embed);
            edit=allLinks.size()>1?edit.setComponents(ActionRow.of(profileSelectMenu(allLinks,discordId,uuid))):edit.setComponents();
            edit.queue();
        });
    }
    // "Main - PlayerName" / "Alt#1 - PlayerName" / "Alt#2 - PlayerName" -
    // the currently-shown account pre-selected as the default option.
    private StringSelectMenu profileSelectMenu(List<Database.LinkedAccount> links,String discordId,UUID current){
        StringSelectMenu.Builder b=StringSelectMenu.create("makong:profile:select:"+discordId);
        for(Database.LinkedAccount l:links)b.addOption(slotLabel(l.slot())+" - "+l.name(),l.uuid().toString());
        b.setDefaultValues(current.toString());
        return b.build();
    }
    @Override public void onStringSelectInteraction(StringSelectInteractionEvent e){
        String id=e.getComponentId();
        if(id.startsWith("makong:profile:select:")){onProfileSelect(e,id.substring("makong:profile:select:".length()));return;}
        if(id.startsWith("makong:editprofile:main:")){onEditProfileSelect(e,id.substring("makong:editprofile:main:".length()));return;}
    }
    private void onProfileSelect(StringSelectInteractionEvent e,String discordId){
        if(e.getValues().isEmpty())return;
        UUID selected;
        try{selected=UUID.fromString(e.getValues().get(0));}catch(IllegalArgumentException ex){return;}
        UUID finalSelected=selected;
        db.linkedAccounts(discordId).thenAccept(links->{
            Database.LinkedAccount chosen=links.stream().filter(l->l.uuid().equals(finalSelected)).findFirst().orElse(null);
            if(chosen==null){e.reply("❌ That account is no longer linked.").setEphemeral(true).queue();return;}
            e.deferEdit().queue();
            buildProfileCard(chosen,links,discordId,e.getHook());
        });
    }
    // /editprofile - pick which linked account should be Main; the rest
    // shift down preserving their existing relative order (promoting
    // Alt#2 to Main on a 3-account link results in [new Main, old Main,
    // old Alt#1]). Operates only on the caller's own accounts.
    private void handleEditProfile(SlashCommandInteractionEvent e){
        db.linkedAccounts(e.getUser().getId()).thenAccept(links->{
            if(links.size()<2){e.reply("❌ You only have "+links.size()+" linked account"+(links.size()==1?"":"s")+" - nothing to organize.").setEphemeral(true).queue();return;}
            StringSelectMenu.Builder b=StringSelectMenu.create("makong:editprofile:main:"+e.getUser().getId());
            for(Database.LinkedAccount l:links)b.addOption(slotLabel(l.slot())+" - "+l.name(),l.uuid().toString());
            b.setDefaultValues(links.get(0).uuid().toString());
            e.reply("Choose which account should be your **Main**:").setEphemeral(true).setComponents(ActionRow.of(b.build())).queue();
        });
    }
    private void onEditProfileSelect(StringSelectInteractionEvent e,String discordId){
        if(!discordId.equals(e.getUser().getId())){e.reply("❌ This isn't your menu.").setEphemeral(true).queue();return;}
        if(e.getValues().isEmpty())return;
        UUID selected;
        try{selected=UUID.fromString(e.getValues().get(0));}catch(IllegalArgumentException ex){return;}
        UUID finalSelected=selected;
        db.linkedAccounts(discordId).thenAccept(links->{
            Database.LinkedAccount chosen=links.stream().filter(l->l.uuid().equals(finalSelected)).findFirst().orElse(null);
            if(chosen==null){e.reply("❌ That account is no longer linked.").setEphemeral(true).queue();return;}
            if(chosen.slot()==0){e.editMessage("✅ **"+chosen.name()+"** is already your Main.").setComponents(List.of()).queue();return;}
            e.deferEdit().queue();
            List<Database.LinkedAccount> reordered=new ArrayList<>();
            reordered.add(chosen);
            for(Database.LinkedAccount l:links)if(!l.uuid().equals(finalSelected))reordered.add(l);
            db.reassignSlots(discordId,reordered).thenRun(()->
                    e.getHook().editOriginal("✅ **"+chosen.name()+"** is now your Main.").setComponents(List.of()).queue());
        });
    }
    // NameMC's own renders come from this same service (NMSR - see
    // https://github.com/NickAcPT/nmsr-rs) rather than the flatter Crafatar
    // look. A cracked/bedrock account's stored UUID is a local offline-mode
    // UUID with no real skin behind it - rather than let the renderer guess
    // at a fallback, always request the vanilla default Steve skin for
    // those account types (STEVE_UUID is Mojang's own reference "no skin
    // set" UUID, the same one most skin viewers use for this).
    private static final String STEVE_UUID="c06f8906-4c8a-4911-9c29-ea1dbd1aab82";
    private CompletableFuture<BufferedImage> fetchSkinRender(UUID uuid,String accountType){
        boolean hasRealSkin="java".equalsIgnoreCase(accountType);
        String who=hasRealSkin?uuid.toString():STEVE_UUID;
        HttpRequest req=HttpRequest.newBuilder(URI.create("https://nmsr.nickac.dev/fullbody/"+who))
                .timeout(Duration.ofSeconds(6)).GET().build();
        return http.sendAsync(req,HttpResponse.BodyHandlers.ofByteArray())
                .thenApply(res->{
                    try{return res.statusCode()==200?ImageIO.read(new ByteArrayInputStream(res.body())):null;}
                    catch(Exception ex){return null;}
                })
                .exceptionally(ex->null);
    }
    private String displayAccountType(String raw){
        if(raw==null)return "Unknown";
        return switch(raw.toLowerCase(Locale.ROOT)){
            case "java"->"Premium";
            case "cracked"->"Cracked";
            case "bedrock"->"Bedrock";
            default->"Unknown";
        };
    }
    private Long asLong(Object o){
        if(o instanceof Number n)return n.longValue();
        if(o==null)return null;
        try{return Long.parseLong(String.valueOf(o).trim());}catch(NumberFormatException ex){return null;}
    }
    // null = this tier's request runs immediately, no approval needed.
    // Otherwise the MINIMUM tier allowed to Accept/Deny it - see
    // discord.commands.roles in module/verification.yml for the table:
    // Manager needs nothing; Helper's /ban runs immediately but its /unban
    // needs a Manager; Trial Helper needs a Helper-or-above for /ban and a
    // Manager specifically for /unban.
    private StaffTier requiredApprover(boolean ban,StaffTier requester){
        if(requester==StaffTier.MANAGER)return null;
        if(ban)return requester==StaffTier.TRIAL_HELPER?StaffTier.HELPER:null;
        return StaffTier.MANAGER;
    }
    // Runs the actual ban/unban command on this server's console (LiteBans
    // under the hood) and hands the raw success/failure boolean to `onDone`
    // - shared by the immediate-execute path above and the Accept button
    // (onModRequestButton()), which each build their own embed around it.
    private void runModCommand(boolean ban,String target,String duration,String reason,Database.AccountLink staff,java.util.function.Consumer<Boolean> onDone){
        String cmd=ban?"ban":"unban";
        String args=cmd+" "+target+" --sender="+staff.name()+" --sender-uuid="+staff.uuid()+(ban?" "+duration+" "+reason:" "+reason);
        Bukkit.getScheduler().runTask(plugin,()->onDone.accept(Bukkit.dispatchCommand(Bukkit.getConsoleSender(),args)));
    }
    // Builds the moderation-request embed for every state this file uses -
    // pending (Accept/Deny buttons attached separately by the caller), and
    // resolved (executed/accepted, or denied/failed). `pending` picks the
    // title's tense ("Banning"/"Unbanning" vs "Banned"/"Unbanned") since a
    // denied or failed request never actually happened.
    private net.dv8tion.jda.api.EmbedBuilder modEmbed(boolean ban,boolean pending,String target,String duration,String reason,String staffMention,String statusEmoji,String statusText,int color){
        String title=(ban?"🔨 Player ":"🔓 Player ")+(pending?(ban?"Banning":"Unbanning"):(ban?"Banned":"Unbanned"));
        StringBuilder sb=new StringBuilder();
        sb.append("**Player:** ").append(target).append('\n');
        if(ban)sb.append("**Duration:** ").append(durationText(duration)).append('\n');
        sb.append("**Reason:** ").append(reason==null||reason.isBlank()?"*No reason given*":reason).append('\n');
        sb.append("**Staff:** ").append(staffMention).append('\n');
        if(ban)sb.append("**Expires:** ").append(expiresText(duration)).append('\n');
        sb.append('\n').append(statusEmoji).append(" Status: ").append(statusText);
        return new net.dv8tion.jda.api.EmbedBuilder().setTitle(title).setDescription(sb.toString()).setColor(color);
    }
    // Human-readable form of a normalized duration ("7d" -> "7 days",
    // "permanent" -> "Permanent") for the embed's Duration field. Falls back
    // to echoing the raw value if it doesn't match the expected
    // <number><unit> shape - a free-typed /ban duration LiteBans itself
    // understands but this display helper doesn't need to fully parse.
    private String durationText(String duration){
        if(duration==null||duration.isBlank())return "Permanent";
        String d=duration.trim().toLowerCase(Locale.ROOT);
        if(d.equals("permanent")||d.equals("forever")||d.equals("perm"))return "Permanent";
        Matcher m=Pattern.compile("^(\\d+)(mo|[smhdwy])$").matcher(d);
        if(!m.matches())return duration;
        long amount=Long.parseLong(m.group(1));
        String unit=switch(m.group(2)){case "s"->"second";case "m"->"minute";case "h"->"hour";case "d"->"day";case "w"->"week";case "mo"->"month";default->"year";};
        return amount+" "+unit+(amount==1?"":"s");
    }
    // Same <number><unit> duration parsed into a calendar date ("September
    // 16, 2026") for the embed's Expires field - purely cosmetic, LiteBans
    // does its own duration math independently when it actually applies the
    // ban, so this never needs to be exact to the second.
    private String expiresText(String duration){
        if(duration==null||duration.isBlank())return "Never";
        String d=duration.trim().toLowerCase(Locale.ROOT);
        if(d.equals("permanent")||d.equals("forever")||d.equals("perm"))return "Never";
        Matcher m=Pattern.compile("^(\\d+)(mo|[smhdwy])$").matcher(d);
        if(!m.matches())return "Unknown";
        long amount=Long.parseLong(m.group(1));
        ZonedDateTime now=ZonedDateTime.now();
        ZonedDateTime target=switch(m.group(2)){
            case "s"->now.plusSeconds(amount);
            case "m"->now.plusMinutes(amount);
            case "h"->now.plusHours(amount);
            case "d"->now.plusDays(amount);
            case "w"->now.plusWeeks(amount);
            case "mo"->now.plusMonths(amount);
            default->now.plusYears(amount);
        };
        return target.format(java.time.format.DateTimeFormatter.ofPattern("MMMM d, yyyy",Locale.ENGLISH));
    }
    private String normalizeDuration(String duration){
        String d=duration==null?"":duration.trim().toLowerCase(Locale.ROOT);
        if(d.equals("forever")||d.equals("permanent")||d.equals("perm"))return "permanent";
        if(d.matches("\\d+month(s)?"))return d.replaceAll("month(s)?$","mo");
        if(d.matches("\\d+months?"))return d.replaceAll("months?$","mo");
        return d;
    }

    // discord.enabled/telegram.enabled control whether those bots start at
    // all (see start()); linking.required_for_cracked is a separate switch
    // that defaults to true regardless. Without this check, disabling both
    // bots but leaving required_for_cracked untouched (its default) freezes
    // every cracked player with no bot running to ever let them verify -
    // a silent, permanent lockout. Requiring verification only makes sense
    // when there's actually a way to complete it.
    private boolean linkingAvailable(){return cfg.b("discord.enabled",false)||cfg.b("telegram.enabled",false);}
    public void onJoin(Player p){UUID uuid=p.getUniqueId();db.getAccountLink(uuid).thenCombine(db.isBypassed(uuid),(link,bypassed)->{if(link!=null||bypassed)return null;String external=externalAccountType.remove(uuid);if(external!=null){if(external.equals("bedrock"))return null;boolean required=linkingAvailable()&&cfg.b("linking.required_for_cracked",true)&&external.equals("cracked");if(required)Bukkit.getScheduler().runTask(plugin,()->freezeAndCode(p,external));return null;}boolean bedrock=floodgate!=null&&floodgate.isBedrock(uuid);if(bedrock)return null;CompletableFuture.supplyAsync(()->detectPremium(p.getName())).thenAccept(premium->{boolean isPremium=Boolean.TRUE.equals(premium);boolean unknown=premium==null;String type=(isPremium||unknown&&!cfg.b("linking.premium_detection.unknown_as_cracked",true))?"java":"cracked";boolean required=linkingAvailable()&&cfg.b("linking.required_for_cracked",true)&&type.equals("cracked");if(required)Bukkit.getScheduler().runTask(plugin,()->freezeAndCode(p,type));});return null;});}

    // /malink reset <player> - wipes their persisted Discord/Telegram link
    // so they're treated as never-linked. If they're online right now,
    // re-runs onJoin()'s detection/freeze immediately (same as if they'd
    // just connected) instead of waiting for their next actual join.
    public void resetLink(UUID uuid,Player online){db.deleteAccountLink(uuid).thenRun(()->{if(online!=null&&online.isOnline())Bukkit.getScheduler().runTask(plugin,()->onJoin(online));});}
    // /makongcore reset verification|all - unlinks every player at once.
    public CompletableFuture<Void> resetAllLinks(){return db.deleteAllAccountLinks();}
    // /malink bypass|unbypass|bypasslist - see Database's bypass methods'
    // javadoc for what this does and doesn't affect.
    public CompletableFuture<Void> addBypass(UUID uuid,String name){return db.addBypass(uuid,name);}
    public CompletableFuture<Boolean> removeBypass(UUID uuid){return db.removeBypass(uuid);}
    public CompletableFuture<List<Database.BypassEntry>> listBypass(){return db.listBypass();}
    // /malink status <player> - a human-readable snapshot of whether they've
    // linked yet, plus bypass state and (if they're online on this specific
    // server) frozen/pending-code state. isFrozen()/code() are local to this
    // server only - a player frozen on a different server won't show that
    // part here, same caveat as the rest of this class's local `pending` map.
    public CompletableFuture<String> statusLine(UUID uuid,String name){
        return db.getAccountLink(uuid).thenCombine(db.isBypassed(uuid),(link,bypassed)->{
            StringBuilder sb=new StringBuilder("<aqua>"+name+"</aqua>");
            if(link!=null){
                sb.append("\n<gray>Linked: <green>Yes</green>");
                if(link.discordId()!=null&&!link.discordId().isBlank())sb.append(" <gray>| Discord ID: <white>"+link.discordId()+"</white>");
                if(link.telegramChatId()!=null&&!link.telegramChatId().isBlank())sb.append(" <gray>| Telegram chat: <white>"+link.telegramChatId()+"</white>");
                sb.append(" <gray>| Type: <white>"+link.accountType()+"</white>");
                sb.append("\n<gray>Linked at: <white>"+Instant.ofEpochMilli(link.linkedAt())+"</white>");
            } else {
                sb.append("\n<gray>Linked: <red>No</red>");
            }
            sb.append("\n<gray>Bypassed: "+(bypassed?"<green>Yes</green>":"<white>No</white>")+"</gray>");
            Player online=Bukkit.getPlayer(uuid);
            if(online!=null){
                boolean frozen=isFrozen(uuid);
                sb.append("\n<gray>Online on this server, frozen: "+(frozen?"<yellow>Yes</yellow>":"<white>No</white>"));
                if(frozen){String code=code(uuid);if(code!=null)sb.append(" <gray>| Pending code: <white>"+code+"</white>");}
                sb.append("</gray>");
            }
            return sb.toString();
        });
    }

    // From MakongVelocity's "makong:accounttype" plugin message - see the
    // externalAccountType field javadoc above. The channel's payload also
    // carries the player's name/UUID for logging, but `player` here is
    // already the correctly-resolved Bukkit Player the message arrived for,
    // so that's what's used to key the map.
    @Override public void onPluginMessageReceived(String channel,Player player,byte[] message){
        if(!channel.equals("makong:accounttype"))return;
        try{
            java.io.DataInputStream in=new java.io.DataInputStream(new java.io.ByteArrayInputStream(message));
            in.readUTF(); // username, informational only
            in.readUTF(); // uuid, informational only - player.getUniqueId() is authoritative
            String type=in.readUTF();
            externalAccountType.put(player.getUniqueId(),type);
        }catch(java.io.IOException ignored){}
    }
    private Boolean detectPremium(String name){if(Bukkit.getOnlineMode())return true;if(!cfg.b("linking.premium_detection.enabled",true))return false;try{HttpRequest r=HttpRequest.newBuilder(URI.create("https://api.mojang.com/users/profiles/minecraft/"+java.net.URLEncoder.encode(name,java.nio.charset.StandardCharsets.UTF_8))).timeout(Duration.ofSeconds(4)).GET().build();HttpResponse<String> x=http.send(r,HttpResponse.BodyHandlers.ofString());if(x.statusCode()==200)return true;if(x.statusCode()==204||x.statusCode()==404)return false;return null;}catch(Exception e){return null;}}
    // linkingAvailable() (Discord OR Telegram), not discord.enabled alone -
    // a Telegram-only server used to tell every player /verify was
    // "disabled" even though Telegram linking was actually available.
    public void optionalLink(Player p){if(!linkingAvailable()){p.sendMessage("§cLinking is currently disabled.");return;}db.getAccountLink(p.getUniqueId()).thenAccept(l->{if(l!=null&&((l.discordId()!=null&&!l.discordId().isBlank())||(l.telegramChatId()!=null&&!l.telegramChatId().isBlank()))){p.sendMessage("§aYour account is already linked.");return;}String type=(floodgate!=null&&floodgate.isBedrock(p.getUniqueId()))?"bedrock":"java";Bukkit.getScheduler().runTask(plugin,()->displayOptionalCode(p,type));});}
    // /verify's own cooldown: within linking.request_cooldown_seconds of the
    // last request, re-shows the SAME still-valid code instead of rolling a
    // new one (and doesn't touch its expiry) - only once the cooldown has
    // elapsed does running /verify again generate a genuinely fresh code
    // with a fresh linking.code_expire_minutes window.
    private void displayOptionalCode(Player p,String type){
        if(!p.isOnline())return;
        UUID u=p.getUniqueId();
        long cooldownMs=Math.max(0,cfg.l("linking.request_cooldown_seconds",60))*1000L;
        Long last=lastVerifyRequest.get(u);
        Pending existing=pending.values().stream().filter(v->v.uuid.equals(u)).findFirst().orElse(null);
        if(existing!=null&&last!=null&&System.currentTimeMillis()-last<cooldownMs){
            sendVerifyPrompt(p,existing.code);
            return;
        }
        pending.values().removeIf(v->v.uuid.equals(u));
        String code=String.format("%06d",ThreadLocalRandom.current().nextInt(1000000));
        long expiry=System.currentTimeMillis()+cfg.l("linking.code_expire_minutes",10)*60000L;
        Pending x=new Pending(u,p.getName(),code,expiry,type,true);
        pending.put(code,x);
        db.putPending(code,u,p.getName(),expiry,type,true);
        playerCodes.put(u,code);
        lastVerifyRequest.put(u,System.currentTimeMillis());
        sendVerifyPrompt(p,code);
        plugin.getServer().getScheduler().runTaskLater(plugin,()->{if(code.equals(playerCodes.get(u)))playerCodes.remove(u);},200L);
    }
    // The /verify title/subtitle/action bar/chat message - all configurable
    // in module/verification.yml's linking.verify_command.*, same
    // {code}/{discord}/{telegram}/&-color convention as sendReminder()'s
    // required-verification nag (reuses the same placeholders() helper).
    private void sendVerifyPrompt(Player p,String code){
        long minutes=cfg.l("linking.code_expire_minutes",10);
        String title=placeholders(cfg.s("linking.verify_command.title","{code}"),code);
        String subtitle=placeholders(cfg.s("linking.verify_command.subtitle","Send this code to Discord/Telegram to link"),code);
        String actionbar=placeholders(cfg.s("linking.verify_command.actionbar","&bDiscord: {discord} &7| &bTelegram: {telegram}"),code);
        String message=placeholders(cfg.s("linking.verify_command.message","&aOptional linking code: &e{code} &7(expires in {expires_minutes}m)"),code).replace("{expires_minutes}",String.valueOf(minutes));
        p.sendTitle(title,subtitle,10,80,10);
        p.sendActionBar(actionbar);
        p.sendMessage(message);
    }
    private void freezeAndCode(Player p,String type){freezeAndCode(p,type,true);}
    private void freezeAndCode(Player p,String type,boolean blocking){if(!p.isOnline())return;pending.values().removeIf(v->v.uuid.equals(p.getUniqueId()));String code=String.format("%06d",ThreadLocalRandom.current().nextInt(1000000));long expiry=System.currentTimeMillis()+cfg.l("linking.code_expire_minutes",10)*60000L;Pending x=new Pending(p.getUniqueId(),p.getName(),code,expiry,type,false);pending.put(code,x);db.putPending(code,p.getUniqueId(),p.getName(),expiry,type,false);playerCodes.put(p.getUniqueId(),code);sendReminder(p,code);if(blocking){frozen.add(p.getUniqueId());p.setWalkSpeed(0f);}}
    private void release(UUID u){frozen.remove(u);Player p=Bukkit.getPlayer(u);if(p!=null){p.setWalkSpeed(0.2f);p.setFlying(false);p.sendTitle("§aVerified","§7You may now play.",5,30,10);}}
    public boolean isFrozen(UUID u){return frozen.contains(u);}
    public String code(UUID u){return playerCodes.get(u);}
    private void deny(Event e){if(e instanceof Cancellable c)c.setCancelled(true);}
    @EventHandler public void join(PlayerJoinEvent e){onJoin(e.getPlayer());}
    @EventHandler public void move(PlayerMoveEvent e){if(!isFrozen(e.getPlayer().getUniqueId()))return;if(e.getTo()!=null&&e.getFrom().getWorld()==e.getTo().getWorld()&&(e.getFrom().getX()!=e.getTo().getX()||e.getFrom().getZ()!=e.getTo().getZ())){e.setTo(e.getFrom());}}
    @EventHandler public void interact(PlayerInteractEvent e){if(isFrozen(e.getPlayer().getUniqueId()))e.setCancelled(true);}
    @EventHandler public void drop(PlayerDropItemEvent e){if(isFrozen(e.getPlayer().getUniqueId()))e.setCancelled(true);}
    @EventHandler public void pickup(PlayerAttemptPickupItemEvent e){if(isFrozen(e.getPlayer().getUniqueId()))e.setCancelled(true);}
    @EventHandler public void breakBlock(BlockBreakEvent e){if(isFrozen(e.getPlayer().getUniqueId()))e.setCancelled(true);}
    @EventHandler public void place(BlockPlaceEvent e){if(isFrozen(e.getPlayer().getUniqueId()))e.setCancelled(true);}
    @EventHandler public void inv(InventoryClickEvent e){if(e.getWhoClicked() instanceof Player p&&isFrozen(p.getUniqueId()))e.setCancelled(true);}
    @EventHandler public void invOpen(org.bukkit.event.inventory.InventoryOpenEvent e){if(e.getPlayer() instanceof Player p&&isFrozen(p.getUniqueId()))e.setCancelled(true);}
    @EventHandler public void damage(org.bukkit.event.entity.EntityDamageByEntityEvent e){if(e.getDamager() instanceof Player p&&isFrozen(p.getUniqueId()))e.setCancelled(true);}
    @EventHandler public void teleport(PlayerTeleportEvent e){if(isFrozen(e.getPlayer().getUniqueId()))e.setCancelled(true);}
    @EventHandler public void command(PlayerCommandPreprocessEvent e){String msg=e.getMessage().toLowerCase(Locale.ROOT);if(isFrozen(e.getPlayer().getUniqueId())&&!msg.startsWith("/verify")&&!msg.startsWith("/link"))e.setCancelled(true);}
    @EventHandler public void chat(AsyncPlayerChatEvent e){if(isFrozen(e.getPlayer().getUniqueId()))e.setCancelled(true);}
    private void startTelegram(){String token=cfg.s("telegram.bot_token","");if(token.isBlank()||token.startsWith("PUT_")){plugin.getLogger().warning("Telegram enabled but bot_token is not configured.");return;}telegram=Executors.newSingleThreadScheduledExecutor();telegram.scheduleWithFixedDelay(()->pollTelegram(token,0),0,1,TimeUnit.SECONDS);}
    private void pollTelegram(String token,int offset){try{
        String url="https://api.telegram.org/bot"+token+"/getUpdates?timeout=20&offset="+offset;
        HttpRequest r=HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(30)).GET().build();
        String body=http.send(r,HttpResponse.BodyHandlers.ofString()).body();
        java.util.regex.Matcher updates=Pattern.compile("\"update_id\"\\s*:\\s*(\\d+).*?\"chat\"\\s*:\\s*\\{\\s*\"id\"\\s*:\\s*(-?\\d+).*?\\}.*?\"text\"\\s*:\\s*\"([^\"]*)\"",Pattern.DOTALL).matcher(body);
        int next=offset;
        while(updates.find()){next=Math.max(next,Integer.parseInt(updates.group(1))+1);String chat=updates.group(2),text=updates.group(3).replace("\\\"","\"").trim();if(text.equals("/start")){telegramSend(token,chat,"Please send the 6 digit Minecraft verification code to verify.");continue;}if(CODE.matcher(text).matches())verifyTelegram(token,chat,text);}
        if(next>offset)pollTelegram(token,next);
    }catch(Exception ignored){}}
    // Same cross-server fallback reasoning as verifyDiscord(String,...) -
    // Telegram polling itself only ever runs on one server at a time (see
    // startTelegram()'s single scheduled poller per JVM), but the code may
    // still have been generated by a different server than the one whose
    // Telegram poller is actually configured/running.
    private void verifyTelegram(String token,String chat,String code){
        Pending local=pending.get(code);
        if(local!=null){verifyTelegram(token,chat,code,local);return;}
        db.findPending(code).thenAccept(row->{
            if(row==null||row.discordOnly()){telegramSend(token,chat,"❌ Code expired or not found. Join the server again.");return;}
            verifyTelegram(token,chat,code,new Pending(row.uuid(),row.name(),code,row.expiresAt(),row.accountType(),row.discordOnly()));
        });
    }
    private void verifyTelegram(String token,String chat,String code,Pending x){if(x.discordOnly||x.expiresAt<System.currentTimeMillis()){telegramSend(token,chat,"❌ Code expired or not found. Join the server again.");return;}db.findByTelegram(chat).thenAccept(existing->{if(existing!=null&&!existing.uuid().equals(x.uuid)){telegramSend(token,chat,"❌ This Telegram account is already linked.");return;}db.linkAccount(x.uuid,x.name(),existing==null?null:existing.discordId(),chat,x.accountType).thenRun(()->{pending.remove(code);db.removePending(code);playerCodes.remove(x.uuid);frozen.remove(x.uuid);Bukkit.getScheduler().runTask(plugin,()->release(x.uuid));telegramSend(token,chat,"✅ Successfully connected to account "+x.name());});});}
    private void telegramSend(String token,String chat,String text){try{String q=java.net.URLEncoder.encode(text,java.nio.charset.StandardCharsets.UTF_8);HttpRequest r=HttpRequest.newBuilder(URI.create("https://api.telegram.org/bot"+token+"/sendMessage?chat_id="+chat+"&text="+q)).GET().build();http.sendAsync(r,HttpResponse.BodyHandlers.discarding());}catch(Exception ignored){}}
    private record Pending(UUID uuid,String name,String code,long expiresAt,String accountType,boolean discordOnly){}
    private static final class FileConfigurationBridge{
        private final org.bukkit.configuration.file.FileConfiguration c;
        FileConfigurationBridge(org.bukkit.configuration.file.FileConfiguration c){this.c=c;}
        String s(String p,String d){return c.getString(p,d);}
        boolean b(String p,boolean d){return c.getBoolean(p,d);}
        long l(String p,long d){return c.getLong(p,d);}
        List<String> list(String p){return c.getStringList(p);}
        // Each map entry is {minimum_account_age_days, minimum_membership_days}
        // in that order. Missing/non-numeric fields default to 0 (no minimum)
        // rather than failing the whole tier.
        List<long[]> tiers(String p){
            List<long[]> out=new ArrayList<>();
            for(java.util.Map<?,?> m:c.getMapList(p)){
                long age=m.get("minimum_account_age_days") instanceof Number n?n.longValue():0L;
                long member=m.get("minimum_membership_days") instanceof Number n?n.longValue():0L;
                out.add(new long[]{age,member});
            }
            return out;
        }
        // Same shape as tiers() above, plus a third field: how many TOTAL
        // accounts (Main + alts) this tier allows once met. See
        // discord.alts.tiers in module/verification.yml.
        List<long[]> altTiers(String p){
            List<long[]> out=new ArrayList<>();
            for(java.util.Map<?,?> m:c.getMapList(p)){
                long age=m.get("minimum_account_age_days") instanceof Number n?n.longValue():0L;
                long member=m.get("minimum_membership_days") instanceof Number n?n.longValue():0L;
                long max=m.get("max_accounts") instanceof Number n?n.longValue():1L;
                out.add(new long[]{age,member,max});
            }
            return out;
        }
        // discord.status.servers - one entry per network server shown in the
        // status embed. server_id must match that server's website.server_id
        // (config.yml), which is how it's matched against
        // WebsiteBridgeService#knownServers(). maintenance is a manual
        // override (not detected automatically - a Minecraft server has no
        // "I'm in maintenance" signal to report): true always shows 🟠
        // Maintenance regardless of actual online state, for taking a
        // gamemode down on purpose without it looking like an outage.
        record StatusServerEntry(String serverId,String label,String emoji,boolean maintenance){}
        List<StatusServerEntry> statusServers(String p){
            List<StatusServerEntry> out=new ArrayList<>();
            for(java.util.Map<?,?> m:c.getMapList(p)){
                String id=String.valueOf(m.getOrDefault("server_id","")).trim();
                if(id.isBlank())continue;
                String label=String.valueOf(m.getOrDefault("label",id));
                String emoji=String.valueOf(m.getOrDefault("emoji","🔷"));
                boolean maintenance=Boolean.TRUE.equals(m.get("maintenance"));
                out.add(new StatusServerEntry(id,label,emoji,maintenance));
            }
            return out;
        }
    }
}
