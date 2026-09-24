using CodexKeypad.Core;
using Loupedeck;
using Loupedeck.CodexKeypadPlugin;

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

var customIconPath = Path.Combine(AppContext.BaseDirectory, "Icon256x256.png");
var packagedCodexIcon = Render(IconVisual("entry", "C"), customIconPath);
Expect(!fallback.Png.SequenceEqual(packagedCodexIcon.Png));
Expect(!packagedCodexIcon.Png.SequenceEqual(Render(IconVisual("entry", "C"), null).Png));
Expect(ContainsNeutralDarkPixel(
    packagedCodexIcon,
    10,
    packagedCodexIcon.Width - 10,
    packagedCodexIcon.Height / 3,
    packagedCodexIcon.Height - 8));

var concurrent = Render(new VisualPresentation(
    "task",
    "T",
    "failed",
    "#7F1D1D",
    "#FFFFFF",
    ["#F87171", "#FACC15", "#60A5FA"],
    "!AI+2",
    [
        new("failed", 2, "#F87171", "left"),
        new("waiting-for-approval", 4, "#FACC15", "left"),
        new("working", 3, "#38BDF8", "right"),
    ]), null);
ExpectPixel(concurrent, concurrent.Width / 6, 1, "#F87171");
ExpectPixel(concurrent, concurrent.Width / 2, 1, "#FACC15");
ExpectPixel(concurrent, concurrent.Width * 5 / 6, 1, "#60A5FA");
Expect(ContainsColor(concurrent, "#F87171", 0, concurrent.Width / 5, 5, concurrent.Height - 5));
Expect(ContainsApproximateColor(
    concurrent,
    "#FACC15",
    0,
    concurrent.Width / 5,
    5,
    concurrent.Height - 5));
Expect(ContainsColor(
    concurrent,
    "#38BDF8",
    concurrent.Width * 4 / 5,
    concurrent.Width,
    5,
    concurrent.Height - 5));
Expect(ContainsColor(
    concurrent,
    "#7F1D1D",
    0,
    concurrent.Width,
    concurrent.Height / 2,
    concurrent.Height));

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
    0,
    badgeOnly.Width,
    0,
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

static Boolean ContainsNeutralDarkPixel(
    (Byte[] Png, Byte[] Pixels, Int32 Width, Int32 Height) image,
    Int32 left,
    Int32 right,
    Int32 top,
    Int32 bottom)
{
    for (var y = top; y < bottom; y += 1)
    {
        for (var x = left; x < right; x += 1)
        {
            var pixel = ReadPixel(image, x, y);
            var red = ((pixel >> 11) & 0x1F) * 255 / 31;
            var green = ((pixel >> 5) & 0x3F) * 255 / 63;
            var blue = (pixel & 0x1F) * 255 / 31;
            var darkest = Math.Min(red, Math.Min(green, blue));
            var lightest = Math.Max(red, Math.Max(green, blue));
            if (lightest < 100 && lightest - darkest < 35)
            {
                return true;
            }
        }
    }
    return false;
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
