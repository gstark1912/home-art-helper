using Microsoft.AspNetCore.SignalR;
namespace Ambient.Server;

public sealed record Animation(string Style,string Palette,double Speed,double Intensity,int? Bpm);
// Mensaje temporal vigente. Expiración = creación + duración; el servidor
// controla el vencimiento con un temporizador propio, independiente de clientes.
public sealed record Message(Guid Id,string Text,int Priority,DateTime CreatedAtUtc,DateTime ExpiresAtUtc);
// Cuerpo validado de POST /api/display/message. El cliente no envía id ni fechas.
public sealed record MessageCommand(string Text,int Priority,int DurationSeconds);
public sealed record Snapshot(Guid Epoch,long Version,DateTime ServerTimeUtc,bool ScreenOn,string BaseMode,Animation Animation,object? Music=null,Message? Message=null);

// The same gate orders registration, snapshots, mutations, awaited broadcasts and message expiration.
public sealed class DisplayState(IHubContext<DisplayHub> hub,ILogger<DisplayState> logger,TimeProvider clock) : IDisposable
{
    private readonly SemaphoreSlim gate=new(1,1);
    private Snapshot state=new(Guid.NewGuid(),0,DateTime.UtcNow,true,"art",new("particles","aurora",1,0.5,null));
    private ITimer? expiry;
    private Snapshot Capture() => state with { ServerTimeUtc=clock.GetUtcNow().UtcDateTime };
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
        try { return await Publish(Advance(change)); }
        finally { gate.Release(); }
    }

    /// <summary>
    /// Aplica el mensaje recibido según la política de prioridad del contrato.
    /// En la misma cola serializada: primero expira cualquier mensaje vencido
    /// (mutación propia), luego evalúa el comando. Prioridad igual reemplaza,
    /// mayor interrumpe y descarta, menor rechaza con 409 sin mutar.
    /// </summary>
    public async Task<Snapshot> PostMessage(MessageCommand command)
    {
        await gate.WaitAsync();
        try
        {
            await DropExpired();
            var current=state.Message;
            if(current!=null&&command.Priority<current.Priority) throw new RequestFault(409,"message_priority_conflict");
            var now=clock.GetUtcNow().UtcDateTime;
            var message=new Message(Guid.NewGuid(),command.Text,command.Priority,now,now.AddSeconds(command.DurationSeconds));
            var snapshot=await Publish(Advance(s=>s with { Message=message }));
            ScheduleExpiry();
            return snapshot;
        }
        finally { gate.Release(); }
    }

    // Avanza versión y reloj; no publica. Debe llamarse con la cola tomada.
    private Snapshot Advance(Func<Snapshot,Snapshot> change)
    {
        if(state.Version>=9007199254740991L) throw new RequestFault(503,"version_exhausted");
        state=change(state) with { Version=state.Version+1,ServerTimeUtc=clock.GetUtcNow().UtcDateTime };
        return Capture();
    }

    // Publica la instantánea ya avanzada. No revierte si falla una entrega.
    private async Task<Snapshot> Publish(Snapshot result)
    {
        try { await hub.Clients.All.SendAsync("StateChanged",result); }
        catch(Exception e) when(e is not OutOfMemoryException) { logger.LogWarning("State publication failed; clients must resynchronize."); }
        return result;
    }

    // Elimina el mensaje vigente si ya venció, publicando su expiración como
    // mutación separada. Debe llamarse con la cola tomada.
    private async Task DropExpired()
    {
        var message=state.Message;
        if(message!=null&&clock.GetUtcNow().UtcDateTime>=message.ExpiresAtUtc)
            await Publish(Advance(s=>s with { Message=null }));
    }

    // Arma el temporizador del próximo vencimiento. Comprueba el id vigente al
    // disparar para que un temporizador viejo no borre un reemplazo.
    private void ScheduleExpiry()
    {
        expiry?.Dispose();
        expiry=null;
        var message=state.Message;
        if(message==null) return;
        var id=message.Id;
        var delay=message.ExpiresAtUtc-clock.GetUtcNow().UtcDateTime;
        if(delay<TimeSpan.Zero) delay=TimeSpan.Zero;
        expiry=clock.CreateTimer(_=>_=ExpireNow(id),null,delay,Timeout.InfiniteTimeSpan);
    }

    // Disparo del temporizador: expira sólo si el mensaje sigue siendo el mismo.
    private async Task ExpireNow(Guid id)
    {
        await gate.WaitAsync();
        try
        {
            var message=state.Message;
            if(message==null||message.Id!=id) return;
            await Publish(Advance(s=>s with { Message=null }));
            expiry?.Dispose();
            expiry=null;
        }
        catch(Exception e) when(e is not OutOfMemoryException) { logger.LogWarning("Message expiry failed."); }
        finally { gate.Release(); }
    }
    public void Dispose() { expiry?.Dispose(); gate.Dispose(); }
}
