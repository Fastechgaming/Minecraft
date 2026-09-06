package com.angkor.makongcore.gui;

import com.angkor.makongcore.MakongCore;
import org.bukkit.Material;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.configuration.file.YamlConfiguration;

import java.io.File;
import java.util.List;

public final class GuiConfig {
    private final MakongCore plugin;
    private FileConfiguration cfg;

    public GuiConfig(MakongCore plugin) { this.plugin=plugin; reload(); }
    public void reload() {
        File f=new File(plugin.getDataFolder(),"gui.yml");
        if(!f.exists()) plugin.saveResource("gui.yml",false);
        cfg=YamlConfiguration.loadConfiguration(f);
    }
    public String text(String path,String def){return cfg.getString(path,def);}
    public List<String> lore(String path,List<String> def){return cfg.isList(path)?cfg.getStringList(path):def;}
    public int slot(String path,int def){return cfg.getInt(path,def);}
    public int size(String path,int def){return cfg.getInt(path,def);}
    public boolean bool(String path,boolean def){return cfg.getBoolean(path,def);}
    public List<String> cfgList(String path,List<String> def){return cfg.isList(path)?cfg.getStringList(path):def;}
    public Material material(String path,Material def){try{return Material.valueOf(cfg.getString(path,def.name()).toUpperCase());}catch(Exception e){return def;}}
    public String title(String path,String def){return text("titles."+path,def);}
}
