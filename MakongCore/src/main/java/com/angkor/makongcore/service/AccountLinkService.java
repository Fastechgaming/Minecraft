package com.angkor.makongcore.service;

import com.angkor.makongcore.MakongCore;
import com.angkor.makongcore.data.Database;
import com.angkor.makongcore.hook.FloodgateHook;
import net.dv8tion.jda.api.*;
import net.dv8tion.jda.api.entities.*;
import net.dv8tion.jda.api.entities.channel.concrete.TextChannel;
import net.dv8tion.jda.api.events.interaction.ModalInteractionEvent;
import net.dv8tion.jda.api.events.interaction.command.SlashCommandInteractionEvent;
import net.dv8tion.jda.api.events.interaction.command.CommandAutoCompleteInteractionEvent;
import net.dv8tion.jda.api.events.interaction.component.ButtonInteractionEvent;
import net.dv8tion.jda.api.events.session.ReadyEvent;
import net.dv8tion.jda.api.hooks.ListenerAdapter;
import net.dv8tion.jda.api.interactions.commands.OptionType;
import net.dv8tion.jda.api.interactions.commands.Command;
import net.dv8tion.jda.api.interactions.commands.build.Commands;
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

import java.net.URI;
import java.net.http.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.regex.Pattern;

public final class AccountLinkService extends ListenerAdapter implements Listener, org.bukkit.plugin.messaging.PluginMessageListener {
    private final MakongCore plugin; private final Database db; private final FloodgateHook floodgate;
    private final FileConfigurationBridge cfg;
    private final Map<String,Pending> pending=new ConcurrentHashMap<>();
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
    private JDA jda; private ScheduledExecutorService telegram; private org.bukkit.scheduler.BukkitTask reminderTask;
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
    public void stop(){if(reminderTask!=null){reminderTask.cancel();reminderTask=null;}if(jda!=null){JDA j=jda;jda=null;j.shutdownNow();try{j.awaitShutdown(5,TimeUnit.SECONDS);}catch(InterruptedException e){Thread.currentThread().interrupt();}}if(telegram!=null){telegram.shutdownNow();telegram=null;}}
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
    @Override public void onReady(ReadyEvent e){registerCommands();sendVerificationPanel();plugin.getLogger().info("Discord hook connected as "+e.getJDA().getSelfUser().getName()+".");}
    private void registerCommands(){if(jda==null)return; jda.updateCommands().addCommands(Commands.slash("ban","Ban a Minecraft player").addOption(OptionType.STRING,"name","Minecraft name",true).addOption(OptionType.STRING,"duration","Duration (choose a preset or type your own)",true,true).addOption(OptionType.STRING,"reason","Reason",true),Commands.slash("unban","Unban a Minecraft player").addOption(OptionType.STRING,"name","Minecraft name",true).addOption(OptionType.STRING,"reason","Reason",true)).queue();}
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

    private void sendVerificationPanel(){String channelId=cfg.s("discord.verification.channel_id","");if(channelId.isBlank()||jda==null)return;TextChannel ch=jda.getTextChannelById(channelId);if(ch==null)return;var embed=new net.dv8tion.jda.api.EmbedBuilder().setTitle("🔐 Makong Minecraft Verification").setDescription("Link your Minecraft account to Discord securely.\n\n**How to verify:**\n1. Join the Makong Minecraft server.\n2. Use the verification command to receive your **6-digit code**.\n3. Click **Verify Code** below and enter your code.\n\n> 🔒 Your Discord account will be linked to your Minecraft account after successful verification.").setColor(new java.awt.Color(0x58,0xA6,0xFF)).build();String configured=cfg.s("discord.verification.panel_message_id","");if(!configured.isBlank()){editPanel(ch,configured,embed);return;}db.meta("discord_verification_panel_message_id").thenAccept(id->{if(id!=null&&!id.isBlank())editPanel(ch,id,embed);else ch.sendMessageEmbeds(embed).setComponents(ActionRow.of(Button.primary("makong:verify","Verify Code"))).queue(msg->db.setMeta("discord_verification_panel_message_id",msg.getId()));});}
    private void editPanel(TextChannel ch,String id,net.dv8tion.jda.api.entities.MessageEmbed embed){ch.retrieveMessageById(id).queue(msg->msg.editMessageEmbeds(embed).setComponents(ActionRow.of(Button.primary("makong:verify","Verify Code"))).queue(),err->ch.sendMessageEmbeds(embed).setComponents(ActionRow.of(Button.primary("makong:verify","Verify Code"))).queue(msg->db.setMeta("discord_verification_panel_message_id",msg.getId())));}
    @Override public void onButtonInteraction(ButtonInteractionEvent e){if(!e.getComponentId().equals("makong:verify"))return;TextInput code=TextInput.create("code",TextInputStyle.SHORT).setPlaceholder("123456").setMinLength(6).setMaxLength(6).build();e.replyModal(Modal.create("makong:verify","Minecraft Verification").addComponents(Label.of("Verification Code",code)).build()).queue();}
    @Override public void onModalInteraction(ModalInteractionEvent e){if(!e.getModalId().equals("makong:verify"))return;String code=e.getValue("code")==null?"":e.getValue("code").getAsString().trim();if(!CODE.matcher(code).matches()){e.reply("❌ Invalid code.").setEphemeral(true).queue();return;} verifyDiscord(e,code);}
    // Every Discord-enabled server shares the same bot token and connection,
    // so this modal submit can land on a different server than the one that
    // generated the code (see Database#putPending's javadoc). Try the local,
    // fast in-memory map first; only fall back to the shared DB lookup if
    // this server doesn't recognize the code itself.
    private void verifyDiscord(ModalInteractionEvent e,String code){
        Pending local=pending.get(code);
        if(local!=null){verifyDiscord(e,local);return;}
        db.findPending(code).thenAccept(row->{
            if(row==null){e.reply("❌ Code expired or not found. Join the server again for a new code.").setEphemeral(true).queue();return;}
            verifyDiscord(e,new Pending(row.uuid(),row.name(),code,row.expiresAt(),row.accountType(),row.discordOnly()));
        });
    }
    private void verifyDiscord(ModalInteractionEvent e,Pending x){if(x.expiresAt<System.currentTimeMillis()){e.reply("❌ Code expired or not found. Join the server again for a new code.").setEphemeral(true).queue();return;}if(!discordAllowed(e.getUser(),e.getMember(),e.getGuild())){e.reply("❌ Your Discord account does not meet the server/account-age requirements.").setEphemeral(true).queue();return;}db.findByDiscord(e.getUser().getId()).thenAccept(existing->{if(existing!=null&&!existing.uuid().equals(x.uuid)){e.reply("❌ This Discord account is already linked to another Minecraft account.").setEphemeral(true).queue();return;}completeDiscord(e,x,existing);});}
    private void completeDiscord(ModalInteractionEvent e,Pending x,Database.AccountLink existing){String telegram=existing==null?null:existing.telegramChatId();db.linkAccount(x.uuid,x.name(),e.getUser().getId(),telegram,x.accountType).thenRun(()->{pending.remove(x.code);db.removePending(x.code);playerCodes.remove(x.uuid);frozen.remove(x.uuid);Bukkit.getScheduler().runTask(plugin,()->release(x.uuid));Guild g=e.getGuild();String roleKey=x.accountType.equals("cracked")?"roles.crack":x.accountType.equals("bedrock")?"roles.bedrock":"roles.java";String roleId=cfg.s("discord."+roleKey,"");if(g!=null&&!roleId.isBlank()){Role role=g.getRoleById(roleId);if(role!=null)g.addRoleToMember(e.getUser(),role).queue();}e.reply("✅ Successfully connected to **"+x.name()+"**.").setEphemeral(true).queue();});}
    // Player-verification gate only - account-age/membership eligibility
    // tiers plus the optional discord.guild.required_role_id. Staff
    // permission for /ban and /unban is a completely separate, unrelated
    // check - see staffAllowed() below - since a moderator shouldn't need
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

    // Who may use /ban and /unban - any ONE of discord.commands.staff_role_ids
    // (a list, so multiple staff ranks can each be granted independently).
    // Deliberately fails CLOSED: with no staff roles configured at all,
    // nobody can use these commands - moderation commands shouldn't default
    // to open just because an admin never got around to configuring them.
    // discord.commands.staff_role_id (singular) is the old, pre-list config
    // key - still honored if present, so upgrading an existing config never
    // silently drops an already-working setup.
    private boolean staffAllowed(Member m,Guild g){
        if(g==null||m==null)return false;
        String guildId=cfg.s("discord.guild.id","");
        boolean guildRequired=cfg.b("discord.guild.required",true);
        if(guildRequired&&!guildId.isBlank()&&!g.getId().equals(guildId))return false;
        List<String> roles=staffRoleIds();
        if(roles.isEmpty())return false;
        return m.getRoles().stream().anyMatch(r->roles.contains(r.getId()));
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
    @Override public void onSlashCommandInteraction(SlashCommandInteractionEvent e){if(!e.isFromGuild()){e.reply("Guild only.").setEphemeral(true).queue();return;}if(e.getName().equals("ban")||e.getName().equals("unban")){if(!cfg.b("discord.commands."+e.getName()+".enabled",true)){e.reply("❌ This Discord command is disabled.").setEphemeral(true).queue();return;}if(!staffAllowed(e.getMember(),e.getGuild())){e.reply("❌ You don't have a staff role permitted to use this command.").setEphemeral(true).queue();return;}String target=e.getOption("name").getAsString(),duration=normalizeDuration(e.getOption("duration")==null?"":e.getOption("duration").getAsString()),reason=e.getOption("reason")==null?"":e.getOption("reason").getAsString();String mcName=target;db.findByDiscord(e.getUser().getId()).thenAccept(staff->{if(staff==null){e.reply("❌ Your Discord account is not linked to Minecraft.").setEphemeral(true).queue();return;}String cmd=e.getName().equals("ban")?"ban":"unban";String args=cmd+" "+target+" --sender="+staff.name()+" --sender-uuid="+staff.uuid()+(cmd.equals("ban")?" "+duration+" "+reason:" "+reason);Bukkit.getScheduler().runTask(plugin,()->Bukkit.dispatchCommand(Bukkit.getConsoleSender(),args));e.reply("✅ Executed `/"+args+"` as **"+staff.name()+"**.").setEphemeral(true).queue();});}}
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
    }
}
