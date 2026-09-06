package com.angkor.makongcore.model;

import java.util.UUID;

public record TeamMember(UUID uuid, String name, TeamRole role, long joinedAt, long lastSeen, String server,
                         long points, long kills, long deaths, long playtimeMinutes) {
    public TeamMember(UUID uuid, String name, TeamRole role, long joinedAt, long lastSeen, String server) {
        this(uuid,name,role,joinedAt,lastSeen,server,0L,0L,0L,0L);
    }
    public TeamMember(UUID uuid, String name, TeamRole role, long joinedAt, long lastSeen, String server, long points) {
        this(uuid,name,role,joinedAt,lastSeen,server,points,0L,0L,0L);
    }
}
