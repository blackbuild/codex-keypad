using CodexKeypad.Core;
using Loupedeck;
using Loupedeck.CodexKeypadPlugin;

var fallback = Render(WorkingVisual(), null);
var missingIcon = Render(WorkingVisual(), "/missing/codex-keypad-icon.png");
Expect(fallback.Length > 100);
Expect(fallback.SequenceEqual(missingIcon));

var customIconPath = Path.Combine(AppContext.BaseDirectory, "Icon256x256.png");
var customIcon = Render(WorkingVisual(), customIconPath);
Expect(!fallback.SequenceEqual(customIcon));

var concurrent = Render(new VisualPresentation(
    "task",
    "T",
    "failed",
    "#7F1D1D",
    "#FFFFFF",
    ["#F87171", "#FACC15", "#60A5FA"],
    "!AI+2"), null);
Expect(!fallback.SequenceEqual(concurrent));

using var unavailableImage = ControlSurfaceBitmapRenderer.RenderUnavailable(
    PluginImageSize.Width90Pixels);
Expect(unavailableImage.ToArray(BitmapImageFormat.Png).Length > 100);

Console.WriteLine("Adapter bitmap tests passed.");

static Byte[] Render(VisualPresentation visual, String? iconPath)
{
    using var image = ControlSurfaceBitmapRenderer.Render(
        "Task · Working",
        iconPath,
        visual,
        PluginImageSize.Width90Pixels);
    return image.ToArray(BitmapImageFormat.Png);
}

static VisualPresentation WorkingVisual() => new(
    "task",
    "T",
    "working",
    "#075985",
    "#FFFFFF",
    ["#38BDF8"],
    ">");

static void Expect(Boolean condition)
{
    if (!condition)
    {
        throw new InvalidOperationException("adapter bitmap expectation was false");
    }
}
