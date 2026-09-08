package com.angkor.makongcore.util;
import net.kyori.adventure.text.Component; import net.kyori.adventure.text.minimessage.MiniMessage;
import java.util.Map;
public final class Text { private static final MiniMessage MM=MiniMessage.miniMessage(); private Text(){} public static Component mm(String s){return MM.deserialize(s==null?"":s);} public static Component mm(String s,Map<String,String> p){if(s==null)return Component.empty(); for(var e:p.entrySet())s=s.replace("<"+e.getKey()+">",e.getValue()); return MM.deserialize(s);} }
