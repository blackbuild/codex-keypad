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
        String? role,
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
            DrawDefaultIcon(
                builder,
                role == "coordinator" ? "hive" : visual.Icon,
                visual.Glyph,
                foreground);
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

    private static void DrawDefaultIcon(
        BitmapBuilder builder,
        String icon,
        String fallbackGlyph,
        BitmapColor color)
    {
        switch (icon)
        {
            case "entry":
                DrawEntryIcon(builder, color);
                break;
            case "project":
                DrawProjectIcon(builder, color);
                break;
            case "task":
                DrawTaskIcon(builder, color);
                break;
            case "hive":
                DrawHiveIcon(builder, color);
                break;
            case "back":
                DrawUpIcon(builder, color);
                break;
            default:
                builder.DrawText(fallbackGlyph, color, fontSize: 32);
                break;
        }
    }

    private static void DrawEntryIcon(BitmapBuilder builder, BitmapColor color)
    {
        var stroke = Stroke(builder, 3);
        DrawRectangle(builder, 18, 44, 72, 80, color, stroke);
        Line(builder, 18, 54, 72, 54, color, stroke);
        builder.FillCircle(X(builder, 24), Y(builder, 49), Scale(builder, 2), color);
        builder.FillCircle(X(builder, 31), Y(builder, 49), Scale(builder, 2), color);
        Line(builder, 29, 61, 36, 67, color, stroke);
        Line(builder, 36, 67, 29, 73, color, stroke);
        Line(builder, 43, 73, 58, 73, color, stroke);
    }

    private static void DrawProjectIcon(BitmapBuilder builder, BitmapColor color)
    {
        var stroke = Stroke(builder, 4);
        Line(builder, 17, 51, 17, 80, color, stroke);
        Line(builder, 17, 51, 37, 51, color, stroke);
        Line(builder, 37, 51, 43, 45, color, stroke);
        Line(builder, 43, 45, 57, 45, color, stroke);
        Line(builder, 57, 45, 62, 51, color, stroke);
        Line(builder, 62, 51, 73, 51, color, stroke);
        Line(builder, 73, 51, 73, 80, color, stroke);
        Line(builder, 73, 80, 17, 80, color, stroke);
    }

    private static void DrawTaskIcon(BitmapBuilder builder, BitmapColor color)
    {
        var stroke = Stroke(builder, 3);
        Line(builder, 27, 42, 55, 42, color, stroke);
        Line(builder, 55, 42, 64, 51, color, stroke);
        Line(builder, 64, 51, 64, 81, color, stroke);
        Line(builder, 64, 81, 27, 81, color, stroke);
        Line(builder, 27, 81, 27, 42, color, stroke);
        Line(builder, 55, 42, 55, 51, color, stroke);
        Line(builder, 55, 51, 64, 51, color, stroke);
        Line(builder, 35, 61, 56, 61, color, stroke);
        Line(builder, 35, 68, 56, 68, color, stroke);
        Line(builder, 35, 75, 50, 75, color, stroke);
    }

    private static void DrawHiveIcon(BitmapBuilder builder, BitmapColor color)
    {
        var stroke = Stroke(builder, 3);
        DrawHexagon(builder, 45, 49, 11, color, stroke);
        DrawHexagon(builder, 34, 68, 11, color, stroke);
        DrawHexagon(builder, 56, 68, 11, color, stroke);
    }

    private static void DrawUpIcon(BitmapBuilder builder, BitmapColor color)
    {
        var stroke = Stroke(builder, 6);
        Line(builder, 45, 73, 45, 22, color, stroke);
        Line(builder, 45, 22, 23, 44, color, stroke);
        Line(builder, 45, 22, 67, 44, color, stroke);
    }

    private static void DrawHexagon(
        BitmapBuilder builder,
        Single centerX,
        Single centerY,
        Single radius,
        BitmapColor color,
        Single stroke)
    {
        var points = Enumerable.Range(0, 6)
            .Select(index => (Angle: MathF.PI / 3 * index, Index: index))
            .Select(point => (
                X: centerX + radius * MathF.Cos(point.Angle),
                Y: centerY + radius * MathF.Sin(point.Angle)))
            .ToArray();
        for (var index = 0; index < points.Length; index += 1)
        {
            var next = points[(index + 1) % points.Length];
            Line(
                builder,
                points[index].X,
                points[index].Y,
                next.X,
                next.Y,
                color,
                stroke);
        }
    }

    private static void DrawRectangle(
        BitmapBuilder builder,
        Single left,
        Single top,
        Single right,
        Single bottom,
        BitmapColor color,
        Single stroke)
    {
        Line(builder, left, top, right, top, color, stroke);
        Line(builder, right, top, right, bottom, color, stroke);
        Line(builder, right, bottom, left, bottom, color, stroke);
        Line(builder, left, bottom, left, top, color, stroke);
    }

    private static void Line(
        BitmapBuilder builder,
        Single x1,
        Single y1,
        Single x2,
        Single y2,
        BitmapColor color,
        Single stroke) =>
        builder.DrawLine(
            X(builder, x1),
            Y(builder, y1),
            X(builder, x2),
            Y(builder, y2),
            color,
            stroke);

    private static Single X(BitmapBuilder builder, Single coordinate) =>
        coordinate * builder.Width / 90F;

    private static Single Y(BitmapBuilder builder, Single coordinate) =>
        coordinate * builder.Height / 90F;

    private static Single Scale(BitmapBuilder builder, Single value) =>
        value * Math.Min(builder.Width, builder.Height) / 90F;

    private static Single Stroke(BitmapBuilder builder, Single value) =>
        Math.Max(2F, Scale(builder, value));

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
