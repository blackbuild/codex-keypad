namespace CodexKeypad.Core;

public static class CodexThreadDeepLink
{
    public static Boolean TryCreate(String threadId, out Uri? uri)
    {
        uri = null;
        if (!ControlSurfaceContract.IsSafeThreadId(threadId))
        {
            return false;
        }

        uri = new Uri($"codex://threads/{threadId}", UriKind.Absolute);
        return true;
    }
}
