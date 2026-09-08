package com.angkor.makongcore.config;

import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.configuration.file.YamlConfiguration;
import java.io.File;
import java.io.IOException;

public final class ModuleConfig {
    private final File file;
    private FileConfiguration config;
    public ModuleConfig(File folder, String name) { this.file=new File(new File(folder,"module"),name); reload(); }
    public void reload() {
        File parent=file.getParentFile(); if(!parent.exists() && !parent.mkdirs()) throw new IllegalStateException("Could not create module directory");
        config=YamlConfiguration.loadConfiguration(file);
    }
    public void saveDefault(java.io.InputStream resource) {
        if(file.exists()) return;
        try(java.io.InputStream in=resource; java.io.OutputStream out=new java.io.FileOutputStream(file)) { in.transferTo(out); }
        catch(IOException e){throw new IllegalStateException("Could not create "+file.getName(),e);}
        reload();
    }
    public FileConfiguration get(){return config;}
    public File file(){return file;}
}
