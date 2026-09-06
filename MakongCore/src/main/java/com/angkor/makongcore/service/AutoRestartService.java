package com.angkor.makongcore.service;

import com.angkor.makongcore.MakongCore;
import org.bukkit.Bukkit;
import org.bukkit.scheduler.BukkitTask;
import org.bukkit.configuration.file.FileConfiguration;

import java.time.*;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class AutoRestartService {
    private static final Pattern TYPE=Pattern.compile("^\\[(normal|time|proxy|proxydelay)(?::(\\d+))?\\]\\s*(.*)$",Pattern.CASE_INSENSITIVE);
    private final MakongCore plugin;
    private final FileConfiguration c;
    private BukkitTask task;
    private BukkitTask adHocTask;
    private long nextRestart=-1;
    private final Set<String> executed=new HashSet<>();
    private boolean afterBoot;

    public AutoRestartService(MakongCore plugin, FileConfiguration c){this.plugin=plugin;this.c=c;}

    public void start(){
        if(!enabled())return;
        scheduleNext();
        runAfterReboot();
        task=Bukkit.getScheduler().runTaskTimer(plugin,this::tick,20L,20L);
    }
    public void stop(){if(task!=null){task.cancel();task=null;}if(adHocTask!=null){adHocTask.cancel();adHocTask=null;}}

    // A one-off restart outside the configured schedule - used by
    // /mateam autorestart <seconds> (see AdminCommand), itself normally
    // triggered by the MakongVelocity companion's /mc autorestart relayed
    // through the website bridge. Reuses the same interval-broadcast
    // messages and "normal" restartCommands the scheduled path uses, just
    // counting down from `seconds` instead of down to a wall-clock target.
    public void triggerAdHocRestart(long seconds){
        long target=System.currentTimeMillis()+Math.max(0,seconds)*1000L;
        if(adHocTask!=null)adHocTask.cancel();
        adHocTask=Bukkit.getScheduler().runTaskTimer(plugin,new Runnable(){
            @Override public void run(){
                long remaining=(target-System.currentTimeMillis()+999)/1000;
                if(remaining<=0){
                    String day=ZonedDateTime.now().getDayOfWeek().name();
                    for(String raw:commands("settings.restartCommands")){
                        Parsed p=parseCommand(raw,day);
                        if(p!=null&&p.type.equals("normal"))execute(p.command,false);
                    }
                    if(adHocTask!=null){adHocTask.cancel();adHocTask=null;}
                    return;
                }
                announce(remaining);
            }
        },0L,20L);
    }

    private boolean enabled(){return c.getBoolean("settings.enabled",true);}

    private List<String> commands(String path){return c.getStringList(path);}

    private void scheduleNext(){
        ZonedDateTime now=ZonedDateTime.now();
        long best=Long.MAX_VALUE;
        for(String raw:c.getStringList("settings.restarts")){
            String[] a=raw.split(";");
            if(a.length!=3)continue;
            String day=a[0].trim(); int hour=parse(a[1],-1), minute=parse(a[2],-1);
            if(hour<0||hour>23||minute<0||minute>59)continue;
            for(int add=0;add<8;add++){
                LocalDate date=now.toLocalDate().plusDays(add);
                if(!day.equalsIgnoreCase("Daily")&&!day.equalsIgnoreCase(date.getDayOfWeek().name()))continue;
                ZonedDateTime target=date.atTime(hour,minute).atZone(now.getZone());
                if(target.isAfter(now.plusSeconds(1))&&target.toInstant().toEpochMilli()<best)best=target.toInstant().toEpochMilli();
            }
        }
        nextRestart=best==Long.MAX_VALUE?-1:best;
        executed.clear();
        if(nextRestart>0)plugin.getLogger().info("AutoRestart scheduled for "+Instant.ofEpochMilli(nextRestart));
    }

    private void tick(){
        if(nextRestart<0){scheduleNext();return;}
        long remaining=(nextRestart-System.currentTimeMillis()+999)/1000;
        if(remaining<=0){executeAtRestart();return;}
        String day=ZonedDateTime.ofInstant(Instant.ofEpochMilli(nextRestart),ZoneId.systemDefault()).getDayOfWeek().name();
        for(String raw:commands("settings.restartCommands")){
            Parsed p=parseCommand(raw,day); if(p==null)continue;
            if(p.type.equals("time")&&remaining<=p.seconds&&remaining>=1){
                String key=raw+"@"+p.seconds;
                if(executed.add(key))execute(p.command,false);
            } else if((p.type.equals("proxy")||p.type.equals("proxydelay"))&&remaining<=p.seconds&&remaining>=1){
                String key=raw+"@"+p.seconds;
                if(executed.add(key))execute(p.command,p.type.equals("proxy"));
            } else if(p.type.equals("normal")&&remaining<=0)execute(p.command,false);
        }
        announce(remaining);
    }

    private void executeAtRestart(){
        String day=ZonedDateTime.ofInstant(Instant.ofEpochMilli(nextRestart),ZoneId.systemDefault()).getDayOfWeek().name();
        for(String raw:commands("settings.restartCommands")){
            Parsed p=parseCommand(raw,day); if(p==null)continue;
            if(p.type.equals("normal")||(!p.type.equals("time")&&!p.type.equals("proxy")&&!p.type.equals("proxydelay")))execute(p.command,false);
        }
        scheduleNext();
    }

    private void runAfterReboot(){
        if(afterBoot)return; afterBoot=true;
        for(String raw:commands("settings.commandsAfterReboot")){
            Parsed p=parseCommand(raw,ZonedDateTime.now().getDayOfWeek().name()); if(p==null)continue;
            if(p.type.equals("time")){
                long delay=Math.max(1,p.seconds)*20L;
                Bukkit.getScheduler().runTaskLater(plugin,()->execute(p.command,false),delay);
            } else if(p.type.equals("proxy")||p.type.equals("proxydelay")){
                long delay=p.type.equals("proxydelay")?Math.max(1,p.seconds):0;
                Bukkit.getScheduler().runTaskLater(plugin,()->execute(p.command,p.type.equals("proxy")),delay*20L);
            } else execute(p.command,false);
        }
    }

    private void announce(long seconds){
        for(String value:c.getStringList("settings.messageAtIntervals")){
            try{
                long n=Long.parseLong(value.trim());
                if(seconds==n){
                    String msg=c.getString("messages.interval","<yellow>server restarting in {time}</yellow>")
                            .replace("{time}",format(seconds));
                    Bukkit.broadcast(com.angkor.makongcore.util.Text.mm(msg));
                    break;
                }
            }catch(NumberFormatException ignored){}
        }
    }

    private String format(long seconds){
        if(seconds<60)return seconds+c.getString("format.seconds","s");
        if(seconds<3600)return (seconds/60)+c.getString("format.minutes","m ");
        return (seconds/3600)+c.getString("format.hours","h ");
    }

    private void execute(String command,boolean proxy){
        if(command==null||command.isBlank())return;
        // proxy/proxydelay entries are dispatched through the server console unless
        // a proxy bridge plugin is installed. This keeps the module dependency-free.
        String cmd=command.trim();
        if(cmd.startsWith("/"))cmd=cmd.substring(1);
        Bukkit.dispatchCommand(Bukkit.getConsoleSender(),cmd);
    }

    private Parsed parseCommand(String raw,String day){
        if(raw==null)return null;
        String x=raw.trim(); if(x.isEmpty())return null;
        Matcher m=TYPE.matcher(x);
        String type="normal"; long seconds=0;
        if(m.matches()){type=m.group(1).toLowerCase(Locale.ROOT);seconds=m.group(2)==null?0:Long.parseLong(m.group(2));x=m.group(3).trim();}
        Matcher dm=Pattern.compile("^\\[([A-Z]+DAY)\\]\\s*(.*)$",Pattern.CASE_INSENSITIVE).matcher(x);
        if(dm.matches()){if(!dm.group(1).equalsIgnoreCase(day))return null;x=dm.group(2).trim();}
        return new Parsed(type,seconds,x);
    }
    private record Parsed(String type,long seconds,String command){}
    private int parse(String s,int def){try{return Integer.parseInt(s.trim());}catch(Exception e){return def;}}
}
