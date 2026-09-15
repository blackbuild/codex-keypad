namespace CodexKeypad.Core;

using Newtonsoft.Json;

public static class ControlSurfaceActionPublisher
{
    public static void Publish(String path, SemanticAction action)
    {
        var request = new ActionRequest(Guid.NewGuid().ToString("N"), action);
        var temporaryPath = $"{path}.{Environment.ProcessId}.tmp";
        File.WriteAllText(temporaryPath, JsonConvert.SerializeObject(request));
        File.Move(temporaryPath, path, overwrite: true);
    }

    private sealed record ActionRequest(
        [property: JsonProperty("requestId")] String RequestId,
        [property: JsonProperty("action")] SemanticAction Action)
    {
        [JsonProperty("schemaVersion")]
        public Int32 SchemaVersion => 1;
    }
}
