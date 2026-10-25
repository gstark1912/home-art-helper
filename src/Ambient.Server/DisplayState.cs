using Microsoft.AspNetCore.SignalR;
namespace Ambient.Server;

public sealed record Animation(string Style,string Palette,double Speed,double Intensity,int? Bpm);
public sealed record Snapshot(Guid Epoch,long Version,DateTime ServerTimeUtc,bool ScreenOn,string BaseMode,Animation Animation,object? Music=null,object? Message=null);

// The same gate orders registration, snapshots, mutations and awaited broadcasts.
public sealed class DisplayState(IHubContext<DisplayHub> hub,ILogger<DisplayState> logger) : IDisposable
{
    private readonly SemaphoreSlim gate=new(1,1);
    private Snapshot state=new(Guid.NewGuid(),0,DateTime.UtcNow,true,"art",new("particles","aurora",1,0.5,null));
    private Snapshot Capture() => state with { ServerTimeUtc=DateTime.UtcNow };
    public async Task<Snapshot> Get()
    {
        await gate.WaitAsync(); try { return Capture(); } finally { gate.Release(); }
    }
    public async Task Connect(HubCallerContext context,Sessions sessions)
    {
        await gate.WaitAsync();
        try
        {
            if(!sessions.Register(context)) { context.Abort(); throw new HubException("unauthenticated"); }
            await hub.Clients.Client(context.ConnectionId).SendAsync("StateChanged",Capture(),context.ConnectionAborted);
        }
        finally { gate.Release(); }
    }
    public async Task<Snapshot> Mutate(Func<Snapshot,Snapshot> change)
    {
        await gate.WaitAsync();
        try
        {
            if(state.Version>=9007199254740991L) throw new RequestFault(503,"version_exhausted");
            state=change(state) with { Version=state.Version+1,ServerTimeUtc=DateTime.UtcNow };
            var result=Capture();
            try { await hub.Clients.All.SendAsync("StateChanged",result); }
            catch(Exception e) when(e is not OutOfMemoryException) { logger.LogWarning("State publication failed; clients must resynchronize."); }
            return result;
        }
        finally { gate.Release(); }
    }
    public void Dispose() => gate.Dispose();
}
