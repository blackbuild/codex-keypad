using CodexKeypad.Core;
using Loupedeck;
using Loupedeck.CodexKeypadPlugin;

var fallback = Render(WorkingVisual(), null);
Expect(fallback.Png.Length > 100);
Expect(fallback.Pixels.Length == fallback.Width * fallback.Height * 2);
Expect(ContainsColor(fallback, "#FFFFFF", 0, fallback.Width * 2 / 3, 5, fallback.Height / 2));
Expect(!ContainsColor(fallback, "#FFFFFF", 0, fallback.Width, fallback.Height / 2, fallback.Height));

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
Expect(!fallback.Png.SequenceEqual(Render(WorkingVisual(), customIconPath).Png));

var concurrent = Render(new VisualPresentation(
    "task",
    "T",
    "failed",
    "#7F1D1D",
    "#FFFFFF",
    ["#F87171", "#FACC15", "#60A5FA"],
    "!AI+2"), null);
ExpectPixel(concurrent, concurrent.Width / 6, 1, "#F87171");
ExpectPixel(concurrent, concurrent.Width / 2, 1, "#FACC15");
ExpectPixel(concurrent, concurrent.Width * 5 / 6, 1, "#60A5FA");
Expect(ContainsColor(
    concurrent,
    "#FFFFFF",
    0,
    concurrent.Width / 4,
    5,
    concurrent.Height / 2));
Expect(ContainsColor(
    concurrent,
    "#FFFFFF",
    concurrent.Width / 2,
    concurrent.Width,
    5,
    24));
Expect(ContainsColor(
    concurrent,
    "#7F1D1D",
    0,
    concurrent.Width,
    concurrent.Height / 2,
    concurrent.Height));
Expect(!ContainsColor(
    concurrent,
    "#FFFFFF",
    0,
    concurrent.Width,
    concurrent.Height / 2,
    concurrent.Height));

var badgeOnly = Render(new VisualPresentation(
    "task",
    "",
    "failed",
    "#7F1D1D",
    "#FFFFFF",
    ["#F87171", "#FACC15", "#60A5FA"],
    "!AI+2"), null);
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
    String? iconPath)
{
    using var image = ControlSurfaceBitmapRenderer.Render(
        iconPath,
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
    ">");

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
