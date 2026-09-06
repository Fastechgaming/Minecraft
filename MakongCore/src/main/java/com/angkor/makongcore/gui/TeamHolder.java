package com.angkor.makongcore.gui;

import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.InventoryHolder;

/** Lightweight holder carrying GUI state without abusing inventory titles. */
public final class TeamHolder implements InventoryHolder {
    private final String type;
    private final int page;
    private final String data;

    public TeamHolder(String type) {
        this(type, 1, null);
    }

    public TeamHolder(String type, int page, String data) {
        this.type = type;
        this.page = Math.max(1, page);
        this.data = data;
    }

    public String type() { return type; }
    public int page() { return page; }
    public String data() { return data; }

    @Override
    public Inventory getInventory() { return null; }
}
