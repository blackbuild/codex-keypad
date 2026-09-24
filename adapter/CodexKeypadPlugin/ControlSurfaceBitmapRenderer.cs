namespace Loupedeck.CodexKeypadPlugin;

using System.Diagnostics;
using CodexKeypad.Core;
using Loupedeck;

public static class ControlSurfaceBitmapRenderer
{
    private const Int32 AttentionSegmentHeight = 4;
    private const Int32 WorkerBlobDiameter = 8;
    private const Int32 WorkerBlobGap = 2;
    private const Int32 WorkerGroupGap = 2;
    private const Int32 WorkerCountHeight = 10;
    private const Int32 WorkerCompressionThreshold = 4;
    private const Int32 WorkerRailGutterWidth = 10;
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
        var hasWorkerRailFrame = visual.Icon is "entry" or "project" || role == "coordinator";
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
                visual.Tone,
                foreground);
        }

        if (hasWorkerRailFrame)
        {
            DrawWorkerRailGutters(builder);
        }
        DrawAttentionSegments(builder, visual.BorderColors, hasWorkerRailFrame);
        DrawWorkerIndicatorRails(builder, visual.WorkerIndicators, role == "coordinator");
        if (role == "coordinator")
        {
            DrawBadge(
                builder,
                visual.Badge,
                badgeWidth,
                badgeFontSize,
                background,
                foreground,
                hasWorkerRailFrame ? WorkerRailGutterWidth : 0);
        }
        return builder.ToImage();
    }

    private static void DrawDefaultIcon(
        BitmapBuilder builder,
        String icon,
        String fallbackGlyph,
        String tone,
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
                DrawTaskStateIcon(builder, tone, color);
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
        DrawRectangle(builder, 20, 18, 70, 76, color, stroke);
        Line(builder, 20, 31, 70, 31, color, stroke);
        builder.FillCircle(X(builder, 27), Y(builder, 25), Scale(builder, 2), color);
        builder.FillCircle(X(builder, 34), Y(builder, 25), Scale(builder, 2), color);
        Line(builder, 28, 43, 38, 51, color, stroke);
        Line(builder, 38, 51, 28, 59, color, stroke);
        Line(builder, 43, 62, 61, 62, color, stroke);
    }

    private static void DrawProjectIcon(BitmapBuilder builder, BitmapColor color)
    {
        var stroke = Stroke(builder, 4);
        Line(builder, 45, 27, 45, 50, color, stroke);
        Line(builder, 45, 50, 26, 70, color, stroke);
        Line(builder, 45, 50, 64, 70, color, stroke);
        builder.FillCircle(X(builder, 45), Y(builder, 23), Scale(builder, 8), color);
        builder.FillCircle(X(builder, 45), Y(builder, 50), Scale(builder, 8), color);
        builder.FillCircle(X(builder, 24), Y(builder, 72), Scale(builder, 8), color);
        builder.FillCircle(X(builder, 66), Y(builder, 72), Scale(builder, 8), color);
    }

    private static void DrawTaskStateIcon(
        BitmapBuilder builder,
        String state,
        BitmapColor color)
    {
        var stroke = Stroke(builder, 5);
        switch (state)
        {
            case "working":
                Line(builder, 22, 24, 42, 45, color, stroke);
                Line(builder, 42, 45, 22, 66, color, stroke);
                Line(builder, 48, 24, 68, 45, color, stroke);
                Line(builder, 68, 45, 48, 66, color, stroke);
                break;
            case "idle":
                Line(builder, 20, 48, 38, 66, color, stroke);
                Line(builder, 38, 66, 70, 25, color, stroke);
                break;
            case "failed":
                Line(builder, 23, 23, 67, 67, color, stroke);
                Line(builder, 67, 23, 23, 67, color, stroke);
                break;
            case "interrupted":
                Line(builder, 33, 23, 33, 68, color, Stroke(builder, 9));
                Line(builder, 57, 23, 57, 68, color, Stroke(builder, 9));
                break;
            case "waiting-for-input":
                DrawRectangle(builder, 19, 22, 71, 59, color, Stroke(builder, 3));
                Line(builder, 36, 59, 29, 70, color, Stroke(builder, 3));
                Line(builder, 29, 70, 49, 59, color, Stroke(builder, 3));
                builder.DrawText(
                    "?",
                    (Int32)X(builder, 21),
                    (Int32)Y(builder, 22),
                    (Int32)Scale(builder, 48),
                    (Int32)Scale(builder, 37),
                    color,
                    fontSize: (Int32)Scale(builder, 30));
                break;
            case "waiting-for-approval":
                Line(builder, 23, 22, 67, 22, color, Stroke(builder, 3));
                Line(builder, 23, 70, 67, 70, color, Stroke(builder, 3));
                Line(builder, 23, 22, 67, 70, color, Stroke(builder, 3));
                Line(builder, 67, 22, 23, 70, color, Stroke(builder, 3));
                break;
            case "stale":
                DrawHexagon(builder, 45, 46, 25, color, Stroke(builder, 3));
                Line(builder, 45, 46, 45, 30, color, Stroke(builder, 3));
                Line(builder, 45, 46, 59, 54, color, Stroke(builder, 3));
                break;
            default:
                builder.DrawText("?", color, fontSize: 40);
                break;
        }
    }

    private static void DrawHiveIcon(BitmapBuilder builder, BitmapColor color)
    {
        var stroke = Stroke(builder, 3);
        DrawHexagon(builder, 45, 27, 14, color, stroke);
        DrawHexagon(builder, 31, 51, 14, color, stroke);
        DrawHexagon(builder, 59, 51, 14, color, stroke);
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
        IReadOnlyList<String> colors,
        Boolean insetForWorkerRails)
    {
        var inset = insetForWorkerRails ? (Int32)X(builder, WorkerRailGutterWidth) : 0;
        var availableWidth = builder.Width - inset * 2;
        for (var index = 0; index < colors.Count; index += 1)
        {
            var start = inset + index * availableWidth / colors.Count;
            var end = inset + (index + 1) * availableWidth / colors.Count;
            builder.FillRectangle(
                start,
                0,
                Math.Max(1, end - start),
                AttentionSegmentHeight,
                ParseColor(colors[index]));
        }
    }

    private static void DrawWorkerRailGutters(BitmapBuilder builder)
    {
        var gutterWidth = (Int32)X(builder, WorkerRailGutterWidth);
        var gutterColor = BitmapColor.FromRgb(0x05070B);
        builder.FillRectangle(0, 0, gutterWidth, builder.Height, gutterColor);
        builder.FillRectangle(
            builder.Width - gutterWidth,
            0,
            gutterWidth,
            builder.Height,
            gutterColor);
    }

    private static void DrawWorkerIndicatorRails(
        BitmapBuilder builder,
        IReadOnlyList<WorkerIndicatorPresentation> indicators,
        Boolean reserveHiveBadge)
    {
        DrawWorkerIndicatorRail(
            builder,
            indicators.Where(indicator => indicator.Side == "left").ToArray(),
            side: "left",
            top: 8);
        DrawWorkerIndicatorRail(
            builder,
            indicators.Where(indicator => indicator.Side == "right").ToArray(),
            side: "right",
            top: reserveHiveBadge ? 32 : 8);
    }

    private static void DrawWorkerIndicatorRail(
        BitmapBuilder builder,
        IReadOnlyList<WorkerIndicatorPresentation> indicators,
        String side,
        Int32 top)
    {
        if (indicators.Count == 0)
        {
            return;
        }

        const Int32 bottom = 82;
        var layouts = indicators
            .Select(indicator => new WorkerIndicatorLayout(
                indicator,
                indicator.Count >= WorkerCompressionThreshold))
            .ToList();
        while (RailHeight(layouts) > bottom - top)
        {
            var candidate = layouts
                .Where(layout => !layout.Compressed && layout.Indicator.Count > 1)
                .OrderByDescending(layout => BlobGroupHeight(layout.Indicator.Count) - WorkerCountHeight)
                .FirstOrDefault();
            if (candidate is null)
            {
                break;
            }
            candidate.Compressed = true;
        }

        var y = top + Math.Max(0, (bottom - top - RailHeight(layouts)) / 2F);
        foreach (var layout in layouts)
        {
            var color = ParseColor(layout.Indicator.Color);
            if (layout.Compressed)
            {
                var left = side == "left" ? 0 : 80;
                builder.DrawText(
                    layout.Indicator.Count.ToString(),
                    (Int32)X(builder, left),
                    (Int32)Y(builder, y),
                    (Int32)Scale(builder, 10),
                    (Int32)Scale(builder, WorkerCountHeight),
                    color,
                    fontSize: (Int32)Scale(builder, 10));
                y += WorkerCountHeight + WorkerGroupGap;
                continue;
            }

            var centerX = side == "left" ? 4 : 86;
            for (var index = 0; index < layout.Indicator.Count; index += 1)
            {
                builder.FillCircle(
                    X(builder, centerX),
                    Y(builder, y + WorkerBlobDiameter / 2F),
                    Scale(builder, WorkerBlobDiameter / 2F),
                    color);
                y += WorkerBlobDiameter;
                if (index + 1 < layout.Indicator.Count)
                {
                    y += WorkerBlobGap;
                }
            }
            y += WorkerGroupGap;
        }
    }

    private static Int32 RailHeight(IReadOnlyList<WorkerIndicatorLayout> layouts) =>
        layouts.Sum(layout => layout.Compressed
            ? WorkerCountHeight
            : BlobGroupHeight(layout.Indicator.Count))
        + Math.Max(0, layouts.Count - 1) * WorkerGroupGap;

    private static Int32 BlobGroupHeight(Int32 count) =>
        count * WorkerBlobDiameter + Math.Max(0, count - 1) * WorkerBlobGap;

    private sealed class WorkerIndicatorLayout(
        WorkerIndicatorPresentation indicator,
        Boolean compressed)
    {
        public WorkerIndicatorPresentation Indicator { get; } = indicator;
        public Boolean Compressed { get; set; } = compressed;
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
        BitmapColor foreground,
        Int32 rightInset)
    {
        if (badge.Length == 0)
        {
            return;
        }
        var badgeTop = AttentionSegmentHeight + 4;
        var badgeHeight = fontSize + 10;
        builder.FillRectangle(
            builder.Width - (Int32)X(builder, rightInset) - badgeWidth,
            badgeTop,
            badgeWidth,
            badgeHeight,
            background);
        builder.DrawText(
            badge,
            builder.Width - (Int32)X(builder, rightInset) - badgeWidth,
            badgeTop + 1,
            badgeWidth,
            badgeHeight - 2,
            foreground,
            fontSize: fontSize);
    }

    private static BitmapColor ParseColor(String color) =>
        BitmapColor.FromRgb(Convert.ToUInt32(color[1..], 16));
}
