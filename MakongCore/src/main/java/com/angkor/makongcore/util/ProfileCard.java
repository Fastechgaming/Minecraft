package com.angkor.makongcore.util;

import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.Graphics2D;
import java.awt.GradientPaint;
import java.awt.RadialGradientPaint;
import java.awt.RenderingHints;
import java.awt.Shape;
import java.awt.geom.GeneralPath;
import java.awt.geom.Point2D;
import java.awt.geom.RoundRectangle2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import javax.imageio.ImageIO;

/**
 * Renders the /profile Discord card (see AccountLinkService) as a PNG,
 * entirely with the JDK's own Graphics2D - no extra dependency, no external
 * asset beyond the network's own bundled "Minecraft" pixel font (already
 * shipped for MakongWeb, copied here as fonts/minecraft.ttf). Every icon is
 * drawn as a simple flat vector shape rather than an emoji glyph, since a
 * headless server JVM usually has no color-emoji font installed and would
 * otherwise render empty boxes.
 */
public final class ProfileCard {
    private ProfileCard() {}

    private static final int WIDTH = 1200, HEIGHT = 700, LEFT_PANEL = 420, CORNER = 28;
    private static final Color GOLD = new Color(0xFF, 0xC1, 0x0A);
    private static final Color CYAN = new Color(0x4F, 0xC3, 0xF7);
    private static final Color LIME = new Color(0x8B, 0xC3, 0x4A);
    private static final Color ONLINE = new Color(0x2E, 0xCC, 0x71);
    private static final Color OFFLINE = new Color(0x7F, 0x8C, 0x8D);
    private static final Color MUTED = new Color(0x9A, 0xAD, 0xA3);
    private static final Color SUBTLE = new Color(0x8A, 0x9A, 0x92);

    private static Font pixelFont;

    private static synchronized Font pixelFont() throws IOException, java.awt.FontFormatException {
        if (pixelFont == null) {
            try (InputStream in = ProfileCard.class.getResourceAsStream("/fonts/minecraft.ttf")) {
                if (in == null) throw new IOException("bundled fonts/minecraft.ttf resource is missing");
                pixelFont = Font.createFont(Font.TRUETYPE_FONT, in);
            }
        }
        return pixelFont;
    }

    /** Everything the card needs - gathered by AccountLinkService from local + website-bridge data. */
    public record Input(
            String playerName,
            boolean online,
            Integer rank,
            String tier,
            long stars,
            String teamName,
            String accountType,
            Long registeredAtMillis,
            Long lastLoginMillis,
            BufferedImage skinRender
    ) {}

    public static byte[] render(Input in, String quote) throws IOException {
        try {
            return renderUnchecked(in, quote);
        } catch (java.awt.FontFormatException e) {
            throw new IOException(e);
        }
    }

    private static byte[] renderUnchecked(Input in, String quote) throws IOException, java.awt.FontFormatException {
        Font pixel = pixelFont();
        BufferedImage img = new BufferedImage(WIDTH, HEIGHT, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = img.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        Shape clip = new RoundRectangle2D.Float(0, 0, WIDTH, HEIGHT, CORNER, CORNER);
        g.setClip(clip);

        g.setPaint(new GradientPaint(0, 0, new Color(0x14, 0x2B, 0x21), WIDTH, HEIGHT, new Color(0x07, 0x11, 0x0D)));
        g.fillRect(0, 0, WIDTH, HEIGHT);
        g.setPaint(new GradientPaint(0, 0, new Color(0x1A, 0x36, 0x29), 0, HEIGHT, new Color(0x0A, 0x18, 0x12)));
        g.fillRect(0, 0, LEFT_PANEL, HEIGHT);

        g.setPaint(new RadialGradientPaint(
                new Point2D.Float(LEFT_PANEL / 2f, HEIGHT * 0.62f), 260,
                new float[]{0f, 1f},
                new Color[]{new Color(0x3A, 0x8A, 0x5C, 120), new Color(0x3A, 0x8A, 0x5C, 0)}));
        g.fillOval(LEFT_PANEL / 2 - 260, (int) (HEIGHT * 0.62) - 260, 520, 520);

        if (in.skinRender() != null) {
            BufferedImage skin = in.skinRender();
            int skinH = 520;
            int skinW = (int) (skin.getWidth() * (skinH / (double) skin.getHeight()));
            g.drawImage(skin, LEFT_PANEL / 2 - skinW / 2, HEIGHT - skinH - 60, skinW, skinH, null);
        }

        drawPill(g, 24, 24, in.online());

        g.setColor(new Color(255, 255, 255, 18));
        g.fillRect(LEFT_PANEL, 0, 2, HEIGHT);

        g.setFont(pixel.deriveFont(20f));
        g.setColor(new Color(255, 255, 255, 90));
        String brand = "MAKONG NETWORK";
        FontMetrics bfm = g.getFontMetrics();
        g.drawString(brand, WIDTH - 40 - bfm.stringWidth(brand), 44);

        int px = LEFT_PANEL + 56;
        int rightW = WIDTH - px - 48;

        g.setFont(pixel.deriveFont(54f));
        g.setColor(Color.WHITE);
        FontMetrics nameFm = g.getFontMetrics();
        String name = in.playerName();
        int nameY = 96;
        g.drawString(name, px, nameY);
        int nameW = nameFm.stringWidth(name);

        g.setColor(in.online() ? ONLINE : OFFLINE);
        g.fillOval(px + nameW + 22, nameY - 18, 16, 16);

        if (in.rank() != null) {
            g.setFont(new Font(Font.SANS_SERIF, Font.PLAIN, 22));
            g.setColor(MUTED);
            g.drawString("#" + in.rank(), px, nameY + 32);
        }

        g.setFont(new Font(Font.SANS_SERIF, Font.ITALIC, 24));
        g.setColor(new Color(0xC9, 0xD6, 0xCF));
        g.drawString("“" + quote + "”", px, nameY + 78);

        g.setColor(new Color(255, 255, 255, 22));
        g.fillRect(px, nameY + 104, rightW, 2);

        int gridY = nameY + 140;
        int cellW = (rightW - 24) / 2;
        int cellH = 118;
        int gapX = 24, gapY = 22;

        String star = String.valueOf(in.stars());
        String team = (in.teamName() == null || in.teamName().isBlank()) ? "No Team" : in.teamName();
        String[] durRegistered = durationParts(in.registeredAtMillis());
        String[] durLastLogin = lastLoginParts(in.lastLoginMillis());

        drawCell(g, pixel, px, gridY, cellW, cellH, "crown", "MATIER", in.tier(), null, GOLD);
        drawCell(g, pixel, px + cellW + gapX, gridY, cellW, cellH, "star", "STAR", star, null, GOLD);
        drawCell(g, pixel, px, gridY + (cellH + gapY), cellW, cellH, "team", "TEAM", team, null, CYAN);
        drawCell(g, pixel, px + cellW + gapX, gridY + (cellH + gapY), cellW, cellH, "cube", "ACCOUNT TYPE",
                in.accountType() == null ? "Unknown" : in.accountType(), null, Color.WHITE);
        drawCell(g, pixel, px, gridY + 2 * (cellH + gapY), cellW, cellH, "calendar", "TIME REGISTERED",
                durRegistered[0], durRegistered[1], Color.WHITE);
        drawCell(g, pixel, px + cellW + gapX, gridY + 2 * (cellH + gapY), cellW, cellH, "clock", "LAST LOGIN",
                durLastLogin[0], durLastLogin[1], Color.WHITE);

        g.dispose();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(img, "png", out);
        return out.toByteArray();
    }

    // {"274d 13h 55m", "12/08/2025 at 22:39:26"} - or {"Unknown", null} if millis is null.
    private static String[] durationParts(Long atMillis) {
        if (atMillis == null) return new String[]{"Unknown", null};
        return new String[]{formatDuration(System.currentTimeMillis() - atMillis, ""), formatAbsolute(atMillis)};
    }

    // {"5h 20m ago", "09/09/2026 at 07:14:14"} - or {"Unknown", null} if millis is null.
    private static String[] lastLoginParts(Long atMillis) {
        if (atMillis == null) return new String[]{"Unknown", null};
        return new String[]{formatDuration(System.currentTimeMillis() - atMillis, " ago"), formatAbsolute(atMillis)};
    }

    private static String formatDuration(long millis, String suffix) {
        long total = Math.max(0, millis) / 1000;
        long days = total / 86400;
        long hours = (total % 86400) / 3600;
        long minutes = (total % 3600) / 60;
        StringBuilder sb = new StringBuilder();
        if (days > 0) sb.append(days).append("d ");
        if (days > 0 || hours > 0) sb.append(hours).append("h ");
        sb.append(minutes).append("m");
        return sb + suffix;
    }

    private static String formatAbsolute(long millis) {
        return DateTimeFormatter.ofPattern("MM/dd/yyyy 'at' HH:mm:ss", Locale.ENGLISH)
                .withZone(ZoneId.systemDefault())
                .format(Instant.ofEpochMilli(millis));
    }

    private static void drawPill(Graphics2D g, int x, int y, boolean online) {
        String text = online ? "ONLINE" : "OFFLINE";
        g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 18));
        FontMetrics fm = g.getFontMetrics();
        int w = fm.stringWidth(text) + 46, h = 34;
        g.setColor(new Color(0, 0, 0, 110));
        g.fillRoundRect(x, y, w, h, h, h);
        g.setColor(online ? ONLINE : OFFLINE);
        g.fillOval(x + 12, y + h / 2 - 6, 12, 12);
        g.setColor(Color.WHITE);
        g.drawString(text, x + 32, y + h - 10);
    }

    private static void drawCell(Graphics2D g, Font pixel, int x, int y, int w, int h,
                                  String icon, String label, String value, String subvalue, Color valueColor) {
        g.setColor(new Color(255, 255, 255, 14));
        g.fillRoundRect(x, y, w, h, 18, 18);
        g.setColor(new Color(255, 255, 255, 24));
        g.setStroke(new BasicStroke(1.5f));
        g.drawRoundRect(x, y, w, h, 18, 18);

        int iconCx = x + 44, iconCy = y + h / 2;
        g.setColor(new Color(255, 255, 255, 20));
        g.fillOval(iconCx - 26, iconCy - 26, 52, 52);
        drawIcon(g, icon, iconCx, iconCy);

        int textX = x + 88;
        g.setFont(new Font(Font.SANS_SERIF, Font.PLAIN, 16));
        g.setColor(MUTED);
        g.drawString(label, textX, y + 38);

        g.setFont(pixel.deriveFont(26f));
        g.setColor(valueColor);
        g.drawString(value, textX, y + 74);

        if (subvalue != null) {
            g.setFont(new Font(Font.SANS_SERIF, Font.PLAIN, 14));
            g.setColor(SUBTLE);
            g.drawString(subvalue, textX, y + 96);
        }
    }

    private static void drawIcon(Graphics2D g, String type, int cx, int cy) {
        switch (type) {
            case "star" -> drawStar(g, cx, cy, 16, 7, GOLD);
            case "crown" -> drawCrown(g, cx, cy, GOLD);
            case "team" -> drawTeam(g, cx, cy, CYAN);
            case "cube" -> drawCube(g, cx, cy, LIME);
            case "calendar" -> drawCalendar(g, cx, cy, Color.WHITE);
            case "clock" -> drawClock(g, cx, cy, Color.WHITE);
            default -> {}
        }
    }

    private static void drawStar(Graphics2D g, int cx, int cy, double outerR, double innerR, Color color) {
        GeneralPath star = new GeneralPath();
        int spikes = 5;
        for (int i = 0; i < spikes * 2; i++) {
            double r = (i % 2 == 0) ? outerR : innerR;
            double ang = Math.PI * i / spikes - Math.PI / 2;
            double x = cx + Math.cos(ang) * r, y = cy + Math.sin(ang) * r;
            if (i == 0) star.moveTo(x, y); else star.lineTo(x, y);
        }
        star.closePath();
        g.setColor(color);
        g.fill(star);
    }

    private static void drawCrown(Graphics2D g, int cx, int cy, Color color) {
        GeneralPath p = new GeneralPath();
        int w = 32, h = 20;
        int x0 = cx - w / 2, y0 = cy + h / 2;
        p.moveTo(x0, y0);
        p.lineTo(x0, y0 - h * 0.5);
        p.lineTo(x0 + w * 0.2, y0 - h * 0.15);
        p.lineTo(x0 + w * 0.5, y0 - h);
        p.lineTo(x0 + w * 0.8, y0 - h * 0.15);
        p.lineTo(x0 + w, y0 - h * 0.5);
        p.lineTo(x0 + w, y0);
        p.closePath();
        g.setColor(color);
        g.fill(p);
        g.fillRect(x0 - 2, y0, w + 4, 4);
    }

    private static void drawTeam(Graphics2D g, int cx, int cy, Color color) {
        g.setColor(color);
        g.fillOval(cx - 16, cy - 6, 16, 16);
        g.fillOval(cx, cy - 6, 16, 16);
        g.setColor(new Color(color.getRed(), color.getGreen(), color.getBlue(), 180));
        g.fillOval(cx - 8, cy - 14, 16, 16);
    }

    private static void drawCube(Graphics2D g, int cx, int cy, Color color) {
        int s = 22;
        g.setColor(color);
        g.fillRoundRect(cx - s / 2, cy - s / 2, s, s, 6, 6);
        g.setColor(color.darker());
        g.fillRoundRect(cx - s / 2, cy + s / 2 - 6, s, 6, 4, 4);
    }

    private static void drawCalendar(Graphics2D g, int cx, int cy, Color color) {
        int w = 26, h = 24;
        int x0 = cx - w / 2, y0 = cy - h / 2;
        g.setColor(color);
        g.setStroke(new BasicStroke(2.5f));
        g.drawRoundRect(x0, y0, w, h, 6, 6);
        g.fillRect(x0, y0 + 4, w, 4);
        g.fillRect(x0 + 4, y0 - 3, 3, 6);
        g.fillRect(x0 + w - 7, y0 - 3, 3, 6);
    }

    private static void drawClock(Graphics2D g, int cx, int cy, Color color) {
        g.setColor(color);
        g.setStroke(new BasicStroke(2.5f));
        g.drawOval(cx - 14, cy - 14, 28, 28);
        g.drawLine(cx, cy, cx, cy - 9);
        g.drawLine(cx, cy, cx + 7, cy + 2);
    }
}
