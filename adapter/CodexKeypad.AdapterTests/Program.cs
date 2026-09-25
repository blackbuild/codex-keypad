using CodexKeypad.Core;
using Loupedeck;
using Loupedeck.CodexKeypadPlugin;
using System.Reflection;

String? invalidatedAction = "not called";
String? invalidatedParameter = "not called";
var affectsAllParameters = false;
Action<String, String, Boolean> captureInvalidation = (action, parameter, allParameters) =>
{
    invalidatedAction = action;
    invalidatedParameter = parameter;
    affectsAllParameters = allParameters;
};
typeof(CodexDynamicFolder)
    .GetMethod("InvalidateRootImageAtPluginScope", BindingFlags.Static | BindingFlags.NonPublic)!
    .Invoke(null, [captureInvalidation]);
Expect(invalidatedAction is null);
Expect(invalidatedParameter is null);
Expect(affectsAllParameters);

var fallback = Render(WorkingVisual(), null);
Expect(fallback.Png.Length > 100);
Expect(fallback.Pixels.Length == fallback.Width * fallback.Height * 2);
Expect(ContainsColor(fallback, "#FFFFFF", 0, fallback.Width * 2 / 3, 35, 70));
var taskIconPixels = ColorStats(
    fallback,
    "#FFFFFF",
    0,
    fallback.Width,
    0,
    fallback.Height);
Expect(taskIconPixels.Count > 20);
Expect(taskIconPixels.Right - taskIconPixels.Left + 1 > 20);
Expect(taskIconPixels.Bottom - taskIconPixels.Top + 1 > 35);

var missingIcon = Render(WorkingVisual(), "/missing/codex-keypad-icon.png");
Expect(fallback.Png.SequenceEqual(missingIcon.Png));

var corruptIconPath = Path.Combine(Path.GetTempPath(), $"codex-keypad-corrupt-{Guid.NewGuid():N}.png");
var oversizedIconPath = Path.Combine(Path.GetTempPath(), $"codex-keypad-oversized-{Guid.NewGuid():N}.png");
try
{
    File.WriteAllText(corruptIconPath, "not a png");
    using (var oversized = File.Create(oversizedIconPath))
    {
        oversized.SetLength(1024 * 1024 + 1);
    }
    Expect(fallback.Png.SequenceEqual(Render(WorkingVisual(), corruptIconPath).Png));
    Expect(fallback.Png.SequenceEqual(Render(WorkingVisual(), oversizedIconPath).Png));
}
finally
{
    File.Delete(corruptIconPath);
    File.Delete(oversizedIconPath);
}

var customIconPath = Path.Combine(AppContext.BaseDirectory, "CodexMark256x256.png");
var packagedCodexIcon = Render(IconVisual("entry", "C"), customIconPath);
Expect(!fallback.Png.SequenceEqual(packagedCodexIcon.Png));
Expect(!packagedCodexIcon.Png.SequenceEqual(Render(IconVisual("entry", "C"), null).Png));
Expect(ContainsColor(
    packagedCodexIcon,
    "#0B0D12",
    10,
    packagedCodexIcon.Width - 10,
    10,
    packagedCodexIcon.Height - 10));
var packagedCodexMarkPixels = ColorStats(
    packagedCodexIcon,
    "#FFFFFF",
    10,
    packagedCodexIcon.Width - 10,
    2,
    packagedCodexIcon.Height - 2);
Expect(packagedCodexMarkPixels.Count > 0);
Expect(packagedCodexMarkPixels.Top >= 18);
ExpectPixel(packagedCodexIcon, 2, 2, "#0B0D12");
ExpectPixel(packagedCodexIcon, 5, 5, "#0B0D12");

var concurrent = Render(new VisualPresentation(
    "project",
    "T",
    "failed",
    "#7F1D1D",
    "#FFFFFF",
    ["#F87171", "#FACC15", "#60A5FA"],
    "!AI+2",
    [
        new("failed", 2, "#F87171", "left"),
        new("waiting-for-approval", 4, "#FACC15", "left"),
        new("working", 4, "#38BDF8", "right"),
    ]), null);
Expect(ContainsColor(concurrent, "#F87171", 0, concurrent.Width / 5, 5, concurrent.Height - 5));
Expect(ContainsColor(
    concurrent,
    "#05070B",
    0,
    concurrent.Width / 10,
    5,
    concurrent.Height - 5));
ExpectPixel(concurrent, 0, 0, "#0B0D12");
ExpectPixel(concurrent, concurrent.Width - 1, 0, "#0B0D12");
ExpectPixel(concurrent, 0, concurrent.Height - 1, "#0B0D12");
ExpectPixel(concurrent, concurrent.Width - 1, concurrent.Height - 1, "#0B0D12");
ExpectPixel(concurrent, 1, 1, "#0B0D12");
ExpectPixel(concurrent, 2, 2, "#05070B");
Expect(ContainsColor(
    concurrent,
    "#7F1D1D",
    concurrent.Width / 3,
    concurrent.Width * 2 / 3,
    2,
    concurrent.Height / 6));
Expect(ContainsApproximateColor(
    concurrent,
    "#FACC15",
    0,
    concurrent.Width / 5,
    5,
    concurrent.Height - 5));
var compressedCountPixels = ApproximateColorStats(
    concurrent,
    "#FACC15",
    0,
    concurrent.Width / 4,
    5,
    concurrent.Height - 5);
Expect(compressedCountPixels.Count > 0);
Expect(compressedCountPixels.Bottom - compressedCountPixels.Top + 1 >= 9);
var precedingBlobPixels = ApproximateColorStats(
    concurrent,
    "#F87171",
    0,
    concurrent.Width / 4,
    5,
    concurrent.Height - 5);
Expect(precedingBlobPixels.Count > 0);
Expect(compressedCountPixels.Top - precedingBlobPixels.Bottom >= 2);
var rightCompressedCountPixels = ApproximateColorStats(
    concurrent,
    "#38BDF8",
    concurrent.Width * 3 / 4,
    concurrent.Width,
    5,
    concurrent.Height - 5);
Expect(rightCompressedCountPixels.Count > 0);
Expect(rightCompressedCountPixels.Right >= concurrent.Width - 6);
Expect(rightCompressedCountPixels.Bottom - rightCompressedCountPixels.Top + 1 >= 8);
Expect(ContainsColor(
    concurrent,
    "#38BDF8",
    concurrent.Width * 4 / 5,
    concurrent.Width,
    5,
    concurrent.Height - 5));
Expect(ContainsColor(
    concurrent,
    "#0B0D12",
    0,
    concurrent.Width,
    concurrent.Height / 2,
    concurrent.Height));

var tenWorkers = Render(ProjectVisual([
    new("working", 10, "#38BDF8", "left"),
    new("failed", 10, "#F87171", "right"),
]), null);
var elevenWorkers = Render(ProjectVisual([
    new("working", 11, "#38BDF8", "left"),
    new("failed", 11, "#F87171", "right"),
]), null);
Expect(tenWorkers.Png.SequenceEqual(elevenWorkers.Png));
var leftOverflowGlyph = ApproximateColorStats(
    tenWorkers,
    "#38BDF8",
    0,
    tenWorkers.Width / 4,
    5,
    tenWorkers.Height - 5);
Expect(leftOverflowGlyph.Count > 0);
Expect(leftOverflowGlyph.Left > 0);
var rightOverflowGlyph = ApproximateColorStats(
    tenWorkers,
    "#F87171",
    tenWorkers.Width * 3 / 4,
    tenWorkers.Width,
    5,
    tenWorkers.Height - 5);
Expect(rightOverflowGlyph.Count > 0);
Expect(rightOverflowGlyph.Right < tenWorkers.Width - 1);

var projectIcon = Render(IconVisual("project", "P"), null);
var entryIcon = Render(IconVisual("entry", "C"), null);
var hiveIcon = Render(WorkingVisual(), null, "coordinator");
var taskStateIcons = new[]
{
    "working",
    "idle",
    "waiting-for-input",
    "waiting-for-approval",
    "interrupted",
    "failed",
    "unavailable",
    "stale",
}.Select(state => Render(TaskStateVisual(state), null)).ToArray();
var upIcon = Render(new VisualPresentation(
    "back",
    "^",
    "navigation",
    "#111827",
    "#FFFFFF",
    [],
    "",
    []), null);
Expect(!fallback.Png.SequenceEqual(projectIcon.Png));
Expect(ContainsColor(
    projectIcon,
    "#075985",
    projectIcon.Width / 3,
    projectIcon.Width * 2 / 3,
    2,
    projectIcon.Height / 6));
var projectTabTopWidth = CountColorInRow(projectIcon, "#075985", 3);
var projectTabBottomWidth = CountColorInRow(projectIcon, "#075985", 11);
Expect(projectTabTopWidth >= 32);
Expect(projectTabTopWidth >= projectTabBottomWidth + 5);
Expect(ContainsColor(
    projectIcon,
    "#0B0D12",
    projectIcon.Width / 4,
    projectIcon.Width * 3 / 4,
    projectIcon.Height / 2,
    projectIcon.Height - 4));
Expect(!fallback.Png.SequenceEqual(entryIcon.Png));
Expect(!fallback.Png.SequenceEqual(hiveIcon.Png));
Expect(!fallback.Png.SequenceEqual(upIcon.Png));
for (var left = 0; left < taskStateIcons.Length; left += 1)
{
    for (var right = left + 1; right < taskStateIcons.Length; right += 1)
    {
        Expect(!taskStateIcons[left].Png.SequenceEqual(taskStateIcons[right].Png));
    }
}
var upIconPixels = ColorStats(
    upIcon,
    "#FFFFFF",
    0,
    upIcon.Width,
    0,
    upIcon.Height);
Expect(upIconPixels.Right - upIconPixels.Left + 1 > 35);
Expect(upIconPixels.Bottom - upIconPixels.Top + 1 > 45);

var badgeOnly = Render(new VisualPresentation(
    "task",
    "",
    "failed",
    "#7F1D1D",
    "#FFFFFF",
    ["#F87171", "#FACC15", "#60A5FA"],
    "!AI+2",
    []), null, "coordinator");
var badgePixels = ColorStats(
    badgeOnly,
    "#FFFFFF",
    2,
    badgeOnly.Width - 2,
    2,
    badgeOnly.Height / 2);
Expect(badgePixels.Count > 0);
Expect(badgePixels.Top >= 8);
Expect(badgePixels.Bottom - badgePixels.Top + 1 >= 14);

using var unavailableImage = ControlSurfaceBitmapRenderer.RenderUnavailable(
    PluginImageSize.Width90Pixels);
var unavailable = Snapshot(unavailableImage);
Expect(unavailable.Png.Length > 100);
ExpectPixel(unavailable, 0, 0, "#3F3F46");
var unavailableCue = ColorStats(
    unavailable,
    "#FFFFFF",
    0,
    unavailable.Width,
    0,
    unavailable.Height);
Expect(unavailableCue.Count > 0);
Expect(unavailableCue.Right - unavailableCue.Left + 1 <= 24);

Console.WriteLine("Adapter bitmap tests passed.");

static (Byte[] Png, Byte[] Pixels, Int32 Width, Int32 Height) Render(
    VisualPresentation visual,
    String? iconPath,
    String? role = null)
{
    using var image = ControlSurfaceBitmapRenderer.Render(
        iconPath,
        role,
        visual,
        PluginImageSize.Width90Pixels);
    return Snapshot(image);
}

static (Byte[] Png, Byte[] Pixels, Int32 Width, Int32 Height) Snapshot(
    BitmapImage image) =>
    (
        image.ToArray(BitmapImageFormat.Png),
        image.ToArray(BitmapImageFormat.Rgb565),
        image.Width,
        image.Height);

static VisualPresentation WorkingVisual() => new(
    "task",
    "T",
    "working",
    "#075985",
    "#FFFFFF",
    ["#38BDF8"],
    ">",
    []);

static VisualPresentation IconVisual(String icon, String glyph) => new(
    icon,
    glyph,
    "working",
    "#075985",
    "#FFFFFF",
    ["#38BDF8"],
    ">",
    []);

static VisualPresentation ProjectVisual(
    IReadOnlyList<WorkerIndicatorPresentation> indicators) => new(
    "project",
    "P",
    "working",
    "#075985",
    "#FFFFFF",
    ["#38BDF8"],
    ">",
    indicators);

static VisualPresentation TaskStateVisual(String state) => new(
    "task",
    "T",
    state,
    "#075985",
    "#FFFFFF",
    [],
    "",
    []);

static void ExpectPixel(
    (Byte[] Png, Byte[] Pixels, Int32 Width, Int32 Height) image,
    Int32 x,
    Int32 y,
    String color) =>
    Expect(ReadPixel(image, x, y) == Rgb565(color));

static Boolean ContainsColor(
    (Byte[] Png, Byte[] Pixels, Int32 Width, Int32 Height) image,
    String color,
    Int32 left,
    Int32 right,
    Int32 top,
    Int32 bottom)
{
    var expected = Rgb565(color);
    for (var y = top; y < bottom; y += 1)
    {
        for (var x = left; x < right; x += 1)
        {
            if (ReadPixel(image, x, y) == expected)
            {
                return true;
            }
        }
    }
    return false;
}

static Int32 CountColorInRow(
    (Byte[] Png, Byte[] Pixels, Int32 Width, Int32 Height) image,
    String color,
    Int32 y)
{
    var expected = Rgb565(color);
    var count = 0;
    for (var x = 0; x < image.Width; x += 1)
    {
        if (ReadPixel(image, x, y) == expected)
        {
            count += 1;
        }
    }
    return count;
}

static Boolean ContainsApproximateColor(
    (Byte[] Png, Byte[] Pixels, Int32 Width, Int32 Height) image,
    String color,
    Int32 left,
    Int32 right,
    Int32 top,
    Int32 bottom)
{
    var expected = Rgb565(color);
    for (var y = top; y < bottom; y += 1)
    {
        for (var x = left; x < right; x += 1)
        {
            if (ColorDistance(ReadPixel(image, x, y), expected) < 100)
            {
                return true;
            }
        }
    }
    return false;
}

static Int32 ColorDistance(UInt16 left, UInt16 right)
{
    var leftRed = ((left >> 11) & 0x1F) * 255 / 31;
    var leftGreen = ((left >> 5) & 0x3F) * 255 / 63;
    var leftBlue = (left & 0x1F) * 255 / 31;
    var rightRed = ((right >> 11) & 0x1F) * 255 / 31;
    var rightGreen = ((right >> 5) & 0x3F) * 255 / 63;
    var rightBlue = (right & 0x1F) * 255 / 31;
    return Math.Abs(leftRed - rightRed)
        + Math.Abs(leftGreen - rightGreen)
        + Math.Abs(leftBlue - rightBlue);
}

static (Int32 Count, Int32 Left, Int32 Right, Int32 Top, Int32 Bottom) ApproximateColorStats(
    (Byte[] Png, Byte[] Pixels, Int32 Width, Int32 Height) image,
    String color,
    Int32 left,
    Int32 right,
    Int32 top,
    Int32 bottom)
{
    var expected = Rgb565(color);
    var count = 0;
    var firstX = right;
    var lastX = left - 1;
    var first = bottom;
    var last = top - 1;
    for (var y = top; y < bottom; y += 1)
    {
        for (var x = left; x < right; x += 1)
        {
            if (ColorDistance(ReadPixel(image, x, y), expected) < 100)
            {
                count += 1;
                firstX = Math.Min(firstX, x);
                lastX = Math.Max(lastX, x);
                first = Math.Min(first, y);
                last = Math.Max(last, y);
            }
        }
    }
    return (count, firstX, lastX, first, last);
}

static (Int32 Count, Int32 Left, Int32 Right, Int32 Top, Int32 Bottom) ColorStats(
    (Byte[] Png, Byte[] Pixels, Int32 Width, Int32 Height) image,
    String color,
    Int32 left,
    Int32 right,
    Int32 top,
    Int32 bottom)
{
    var expected = Rgb565(color);
    var count = 0;
    var firstX = right;
    var lastX = left - 1;
    var first = bottom;
    var last = top - 1;
    for (var y = top; y < bottom; y += 1)
    {
        for (var x = left; x < right; x += 1)
        {
            if (ReadPixel(image, x, y) == expected)
            {
                count += 1;
                firstX = Math.Min(firstX, x);
                lastX = Math.Max(lastX, x);
                first = Math.Min(first, y);
                last = Math.Max(last, y);
            }
        }
    }
    return (count, firstX, lastX, first, last);
}

static UInt16 ReadPixel(
    (Byte[] Png, Byte[] Pixels, Int32 Width, Int32 Height) image,
    Int32 x,
    Int32 y)
{
    var offset = (y * image.Width + x) * 2;
    return (UInt16)(image.Pixels[offset] | image.Pixels[offset + 1] << 8);
}

static UInt16 Rgb565(String color)
{
    var rgb = Convert.ToUInt32(color[1..], 16);
    var red = (rgb >> 16) & 0xFF;
    var green = (rgb >> 8) & 0xFF;
    var blue = rgb & 0xFF;
    return (UInt16)(((red >> 3) << 11) | ((green >> 2) << 5) | (blue >> 3));
}

static void Expect(Boolean condition)
{
    if (!condition)
    {
        throw new InvalidOperationException("adapter bitmap expectation was false");
    }
}
