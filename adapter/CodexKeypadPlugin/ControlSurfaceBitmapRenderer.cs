namespace Loupedeck.CodexKeypadPlugin;

using System.Diagnostics;
using CodexKeypad.Core;
using Loupedeck;

public static class ControlSurfaceBitmapRenderer
{
    private const Int64 MaximumIconBytes = 1024 * 1024;

    public static BitmapImage Render(
        String label,
        String? iconPath,
        VisualPresentation visual,
        PluginImageSize imageSize)
    {
        using var builder = new BitmapBuilder(imageSize);
        var background = ParseColor(visual.BackgroundColor);
        var foreground = ParseColor(visual.ForegroundColor);
        builder.Clear(background);

        if (TryLoadIcon(iconPath, out var icon))
        {
            builder.SetBackgroundImage(icon!, true);
        }
        else
        {
            builder.DrawText(
                visual.Glyph,
                0,
                5,
                builder.Width,
                Math.Max(1, builder.Height / 2 - 5),
                foreground,
                fontSize: 24);
        }

        DrawAttentionSegments(builder, visual.BorderColors);
        DrawBadge(builder, visual.Badge, background, foreground);

        var labelTop = builder.Height / 2;
        builder.FillRectangle(0, labelTop, builder.Width, builder.Height - labelTop, background);
        builder.DrawText(
            label,
            3,
            labelTop + 2,
            Math.Max(1, builder.Width - 6),
            Math.Max(1, builder.Height - labelTop - 4),
            foreground,
            fontSize: 12);
        return builder.ToImage();
    }

    public static BitmapImage RenderUnavailable(PluginImageSize imageSize)
    {
        using var builder = new BitmapBuilder(imageSize);
        builder.Clear(BitmapColor.FromRgb(0x3F3F46));
        builder.DrawText("?\nCodex unavailable", BitmapColor.White, fontSize: 16);
        return builder.ToImage();
    }

    private static Boolean TryLoadIcon(String? iconPath, out BitmapImage? icon)
    {
        icon = null;
        try
        {
            if (iconPath is null
                || !File.Exists(iconPath)
                || new FileInfo(iconPath).Length > MaximumIconBytes
                || !HasPngSignature(iconPath)
                || !BitmapImage.TryCreateFromFile(iconPath, out icon)
                || icon.Width <= 0
                || icon.Height <= 0)
            {
                return false;
            }
            return true;
        }
        catch (Exception error)
        {
            Trace.TraceWarning($"Unable to load a Codex Keypad custom icon: {error}");
            return false;
        }
    }

    private static Boolean HasPngSignature(String path)
    {
        ReadOnlySpan<Byte> expected = [137, 80, 78, 71, 13, 10, 26, 10];
        Span<Byte> actual = stackalloc Byte[expected.Length];
        using var stream = File.OpenRead(path);
        return stream.Read(actual) == actual.Length && actual.SequenceEqual(expected);
    }

    private static void DrawAttentionSegments(
        BitmapBuilder builder,
        IReadOnlyList<String> colors)
    {
        for (var index = 0; index < colors.Count; index += 1)
        {
            var start = index * builder.Width / colors.Count;
            var end = (index + 1) * builder.Width / colors.Count;
            builder.FillRectangle(start, 0, Math.Max(1, end - start), 4, ParseColor(colors[index]));
        }
    }

    private static void DrawBadge(
        BitmapBuilder builder,
        String badge,
        BitmapColor background,
        BitmapColor foreground)
    {
        if (badge.Length == 0)
        {
            return;
        }
        var badgeWidth = Math.Min(builder.Width, Math.Max(24, badge.Length * 9 + 6));
        builder.FillRectangle(builder.Width - badgeWidth, 4, badgeWidth, 20, background);
        builder.DrawText(
            badge,
            builder.Width - badgeWidth,
            5,
            badgeWidth,
            18,
            foreground,
            fontSize: 12);
    }

    private static BitmapColor ParseColor(String color) =>
        BitmapColor.FromRgb(Convert.ToUInt32(color[1..], 16));
}
