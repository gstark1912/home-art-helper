using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
namespace Ambient.Server;
[Authorize]
public sealed class DisplayHub(DisplayState state,Sessions sessions) : Hub
{
    public override async Task OnConnectedAsync() { await state.Connect(Context,sessions); await base.OnConnectedAsync(); }
    public override async Task OnDisconnectedAsync(Exception? exception) { sessions.Disconnect(Context); await base.OnDisconnectedAsync(exception); }
    public async Task<Snapshot> GetSnapshot()
    {
        if(!sessions.Valid(Context.User)) { Context.Abort(); throw new HubException("unauthenticated"); }
        return await state.Get();
    }
}
