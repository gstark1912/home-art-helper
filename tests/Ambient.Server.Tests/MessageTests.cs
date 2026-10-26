using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
namespace Ambient.Server.Tests;

public class MessageTests
{
    // Reloj controlable: el servidor usa este TimeProvider para fechas y para el
    // temporizador de expiración, de modo que la prueba avanza el tiempo sin esperas.
    private sealed class Clock : TimeProvider
    {
        private readonly List<(long Due,TimerCallback Callback,object? State)> timers=new();
        public DateTimeOffset Now=DateTimeOffset.Parse("2026-10-25T18:00:00.000Z");
        public override DateTimeOffset GetUtcNow()=>Now;
        public override ITimer CreateTimer(TimerCallback callback,object? state,TimeSpan dueTime,TimeSpan period)
            =>new FakeTimer(this,callback,state,dueTime);
        internal void Register(long due,TimerCallback cb,object? state) { lock(timers) timers.Add((due,cb,state)); }
        internal void Remove(TimerCallback cb) { lock(timers) timers.RemoveAll(t=>ReferenceEquals(t.Callback,cb)); }
        /// Avanza el reloj y dispara los temporizadores vencidos (una sola vez).
        public void Advance(TimeSpan by)
        {
            Now=Now.Add(by);
            (long Due,TimerCallback Callback,object? State)[] due;
            lock(timers) { due=timers.Where(t=>t.Due<=Now.UtcTicks).ToArray(); timers.RemoveAll(t=>t.Due<=Now.UtcTicks); }
            foreach(var t in due) t.Callback(t.State);
        }
        private sealed class FakeTimer : ITimer
        {
            private readonly Clock clock; private readonly TimerCallback cb;
            public FakeTimer(Clock clock,TimerCallback cb,object? state,TimeSpan due)
            { this.clock=clock; this.cb=cb; clock.Register(clock.Now.Add(due).UtcTicks,cb,state); }
            public bool Change(TimeSpan dueTime,TimeSpan period)=>true;
            public void Dispose()=>clock.Remove(cb);
            public ValueTask DisposeAsync() { clock.Remove(cb); return ValueTask.CompletedTask; }
        }
    }
    private sealed class Factory(Clock clock) : ServerFactory
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        { base.ConfigureWebHost(builder); builder.ConfigureServices(s=>s.AddSingleton<TimeProvider>(clock)); }
    }

    private static async Task<JsonElement> Post(HttpClient c,object body)
        => (await (await c.PostAsJsonAsync("/api/display/message",body)).Content.ReadFromJsonAsync<JsonElement>());

    [Fact]
    public async Task Accepted_message_increments_version_and_matches_contract_shape()
    {
        var clock=new Clock(); using var app=new Factory(clock); using var c=HttpTests.Client(app); await HttpTests.Login(c);
        var response=await c.PostAsJsonAsync("/api/display/message",new {text="La cena está lista",priority=1,durationSeconds=30});
        Assert.Equal(HttpStatusCode.OK,response.StatusCode);
        var snapshot=await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(1,snapshot.GetProperty("version").GetInt64());
        var message=snapshot.GetProperty("message");
        Assert.Equal("La cena está lista",message.GetProperty("text").GetString());
        Assert.Equal(1,message.GetProperty("priority").GetInt32());
        Assert.True(Guid.TryParse(message.GetProperty("id").GetString(),out _));
        var created=message.GetProperty("createdAtUtc").GetDateTime();
        var expires=message.GetProperty("expiresAtUtc").GetDateTime();
        Assert.Equal(30,(expires-created).TotalSeconds,0);
    }

    [Fact]
    public async Task Message_allows_line_breaks_and_tabs_but_rejects_other_controls()
    {
        var clock=new Clock(); using var app=new Factory(clock); using var c=HttpTests.Client(app); await HttpTests.Login(c);
        Assert.Equal(HttpStatusCode.OK,(await c.PostAsJsonAsync("/api/display/message",new {text="línea1\nlínea2\tfin",priority=0,durationSeconds=10})).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,(await c.PostAsJsonAsync("/api/display/message",new {text="texto\u0000nulo",priority=0,durationSeconds=10})).StatusCode);
    }

    [Fact]
    public async Task Priority_equal_replaces_higher_interrupts_lower_conflicts()
    {
        var clock=new Clock(); using var app=new Factory(clock); using var c=HttpTests.Client(app); await HttpTests.Login(c);
        var first=await Post(c,new {text="base",priority=1,durationSeconds=60});
        var firstId=first.GetProperty("message").GetProperty("id").GetString();
        Assert.Equal(1,first.GetProperty("version").GetInt64());

        // Igual prioridad reemplaza: nuevo id, versión +1.
        var equal=await Post(c,new {text="reemplazo",priority=1,durationSeconds=60});
        Assert.NotEqual(firstId,equal.GetProperty("message").GetProperty("id").GetString());
        Assert.Equal("reemplazo",equal.GetProperty("message").GetProperty("text").GetString());
        Assert.Equal(2,equal.GetProperty("version").GetInt64());

        // Menor prioridad: 409 sin mutar (versión no cambia).
        var conflict=await c.PostAsJsonAsync("/api/display/message",new {text="bajo",priority=0,durationSeconds=60});
        Assert.Equal(HttpStatusCode.Conflict,conflict.StatusCode);
        Assert.Equal("message_priority_conflict",(await conflict.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("error").GetProperty("code").GetString());
        Assert.Equal(2,(await c.GetFromJsonAsync<JsonElement>("/api/display/status")).GetProperty("version").GetInt64());

        // Mayor prioridad interrumpe y descarta.
        var higher=await Post(c,new {text="urgente",priority=2,durationSeconds=60});
        Assert.Equal("urgente",higher.GetProperty("message").GetProperty("text").GetString());
        Assert.Equal(2,higher.GetProperty("message").GetProperty("priority").GetInt32());
        Assert.Equal(3,higher.GetProperty("version").GetInt64());
    }

    [Fact]
    public async Task Server_timer_expires_the_message_once_and_returns_to_base()
    {
        var clock=new Clock(); using var app=new Factory(clock); using var c=HttpTests.Client(app); await HttpTests.Login(c);
        var posted=await Post(c,new {text="temporal",priority=0,durationSeconds=30});
        Assert.Equal(1,posted.GetProperty("version").GetInt64());
        Assert.Equal(JsonValueKind.Object,posted.GetProperty("message").ValueKind);

        // Antes de vencer sigue vigente.
        clock.Advance(TimeSpan.FromSeconds(29));
        Assert.Equal(JsonValueKind.Object,(await c.GetFromJsonAsync<JsonElement>("/api/display/status")).GetProperty("message").ValueKind);

        // Al vencer, el temporizador del servidor lo elimina (mutación +1).
        clock.Advance(TimeSpan.FromSeconds(1));
        var afterExpiry=await c.GetFromJsonAsync<JsonElement>("/api/display/status");
        Assert.Equal(JsonValueKind.Null,afterExpiry.GetProperty("message").ValueKind);
        Assert.Equal(2,afterExpiry.GetProperty("version").GetInt64());
    }

    [Fact]
    public async Task A_replacement_cancels_the_previous_expiry_without_dropping_the_new_message()
    {
        var clock=new Clock(); using var app=new Factory(clock); using var c=HttpTests.Client(app); await HttpTests.Login(c);
        await Post(c,new {text="viejo",priority=1,durationSeconds=10});
        // Reemplazo con mayor duración antes de que venza el primero.
        var replacement=await Post(c,new {text="nuevo",priority=1,durationSeconds=120});
        var newId=replacement.GetProperty("message").GetProperty("id").GetString();

        // Pasa el vencimiento del PRIMER mensaje: su temporizador no debe borrar el reemplazo.
        clock.Advance(TimeSpan.FromSeconds(11));
        var status=await c.GetFromJsonAsync<JsonElement>("/api/display/status");
        Assert.Equal(newId,status.GetProperty("message").GetProperty("id").GetString());
        Assert.Equal("nuevo",status.GetProperty("message").GetProperty("text").GetString());
    }
}
