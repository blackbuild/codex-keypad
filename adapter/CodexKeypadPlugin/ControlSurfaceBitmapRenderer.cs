namespace Loupedeck.CodexKeypadPlugin;

using System.Diagnostics;
using CodexKeypad.Core;
using Loupedeck;

public static class ControlSurfaceBitmapRenderer
{
    private const Int32 AttentionSegmentHeight = 4;
    private const Int64 MaximumIconBytes = 1024 * 1024;

    public static BitmapImage Render(
        String? iconPath,
        VisualPresentation visual,
        PluginImageSize imageSize)
    {
        using var builder = new BitmapBuilder(imageSize);
        var background = ParseColor(visual.BackgroundColor);
        var foreground = ParseColor(visual.ForegroundColor);
        var badgeFontSize = Math.Clamp(builder.Width / 4, 16, 20);
        var badgeWidth = BadgeWidth(builder.Width, visual.Badge, badgeFontSize);
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
                badgeWidth > 0 ? Math.Max(1, builder.Width - badgeWidth) : builder.Width,
                Math.Max(1, builder.Height / 2 - 5),
                foreground,
                fontSize: 24);
        }

        DrawAttentionSegments(builder, visual.BorderColors);
        DrawBadge(
            builder,
            visual.Badge,
            badgeWidth,
            badgeFontSize,
            background,
            foreground);
        return builder.ToImage();
    }

    public static BitmapImage RenderUnavailable(PluginImageSize imageSize)
    {
        using var builder = new BitmapBuilder(imageSize);
        builder.Clear(BitmapColor.FromRgb(0x3F3F46));
        builder.DrawText("?", BitmapColor.White, fontSize: 32);
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
            builder.FillRectangle(
                start,
                0,
                Math.Max(1, end - start),
                AttentionSegmentHeight,
                ParseColor(colors[index]));
        }
    }

    private static Int32 BadgeWidth(Int32 imageWidth, String badge, Int32 fontSize) =>
        badge.Length == 0
            ? 0
            : Math.Min(
                imageWidth,
                Math.Max(34, badge.Length * (fontSize / 2 + 2) + 8));

    private static void DrawBadge(
        BitmapBuilder builder,
        String badge,
        Int32 badgeWidth,
        Int32 fontSize,
        BitmapColor background,
        BitmapColor foreground)
    {
        if (badge.Length == 0)
        {
            return;
        }
        var badgeTop = AttentionSegmentHeight + 4;
        var badgeHeight = fontSize + 10;
        builder.FillRectangle(
            builder.Width - badgeWidth,
            badgeTop,
            badgeWidth,
            badgeHeight,
            background);
        builder.DrawText(
            badge,
            builder.Width - badgeWidth,
            badgeTop + 1,
            badgeWidth,
            badgeHeight - 2,
            foreground,
            fontSize: fontSize);
    }

    private static BitmapColor ParseColor(String color) =>
        BitmapColor.FromRgb(Convert.ToUInt32(color[1..], 16));
}
