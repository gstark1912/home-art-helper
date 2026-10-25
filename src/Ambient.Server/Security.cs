using System.Net;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.SignalR;
namespace Ambient.Server;

public sealed class AmbientSettings(IConfiguration configuration,IHostEnvironment environment)
{
    public string Key { get; } = configuration["Ambient:PairingKey"] is {Length:>0 and <=256} key&&!string.IsNullOrWhiteSpace(key) ? key : throw new InvalidOperationException("Configure Ambient:PairingKey locally (1-256 characters).");
    public bool Secure { get; } = Transport(configuration,environment);
    public string? PublicOrigin { get; } = configuration["Ambient:PublicOrigin"];
    private static bool Transport(IConfiguration config,IHostEnvironment env)
    {
        var hosts=config["AllowedHosts"]?.Split(';',StringSplitOptions.RemoveEmptyEntries|StringSplitOptions.TrimEntries);
        if(hosts is null||hosts.Length==0||hosts.Any(h=>h.Contains('*'))) throw new InvalidOperationException("AllowedHosts must list explicit hostnames.");
        var mode=config["Ambient:Transport"];
        if(mode=="LanHttps") return true;
        if(mode!="DevelopmentHttp"||!env.IsDevelopment()) throw new InvalidOperationException("Select LanHttps or DevelopmentHttp in Development.");
        // Explicit Kestrel endpoints are disallowed in HTTP development so loopback cannot be overridden.
        if(config.GetSection("Kestrel:Endpoints").GetChildren().Any()) throw new InvalidOperationException("Use loopback URLs for DevelopmentHttp.");
        foreach(var url in (config["urls"]??"http://localhost:5000").Split(';'))
            if(!Uri.TryCreate(url,UriKind.Absolute,out var uri)||uri.Scheme!="http"||!(uri.Host=="localhost"||IPAddress.TryParse(uri.Host,out var ip)&&IPAddress.IsLoopback(ip)))
                throw new InvalidOperationException("DevelopmentHttp requires HTTP loopback listeners.");
        return false;
    }
    public bool OwnOrigin(HttpRequest request)
    {
        var origin=request.Headers.Origin.ToString();
        var expected=PublicOrigin??$"{request.Scheme}://{request.Host}";
        return origin.Length>0&&origin!="null"&&string.Equals(origin,expected,StringComparison.Ordinal);
    }
    public bool Matches(string supplied) => CryptographicOperations.FixedTimeEquals(SHA256.HashData(Encoding.UTF8.GetBytes(Key)),SHA256.HashData(Encoding.UTF8.GetBytes(supplied)));
}

// Registration and revocation share a lock so logout cannot miss an in-flight connection.
public sealed class Sessions(TimeProvider clock) : BackgroundService
{
    private sealed class Session(DateTimeOffset expires)
    {
        public DateTimeOffset Expires {get;}=expires;
        public Dictionary<string,Action> Connections {get;}=[];
    }
    private readonly object sync=new();
    private readonly Dictionary<string,Session> sessions=[];
    public string Create()
    {
        lock(sync) { var id=Guid.NewGuid().ToString("N"); sessions.Add(id,new(clock.GetUtcNow().AddHours(12))); return id; }
    }
    public bool Valid(ClaimsPrincipal? principal)
    {
        var id=principal?.FindFirstValue(ClaimTypes.NameIdentifier);
        lock(sync) return id!=null&&sessions.TryGetValue(id,out var s)&&s.Expires>clock.GetUtcNow();
    }
    public bool Register(HubCallerContext context)
    {
        var id=context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        lock(sync)
        {
            if(id==null||!sessions.TryGetValue(id,out var s)||s.Expires<=clock.GetUtcNow()) return false;
            s.Connections[context.ConnectionId]=context.Abort; return true;
        }
    }
    public void Disconnect(HubCallerContext context)
    {
        var id=context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        lock(sync) if(id!=null&&sessions.TryGetValue(id,out var s)) s.Connections.Remove(context.ConnectionId);
    }
    public void Revoke(ClaimsPrincipal? principal)
    {
        var id=principal?.FindFirstValue(ClaimTypes.NameIdentifier);
        if(id!=null) Revoke(id);
    }
    private void Revoke(string id)
    {
        Action[] aborts;
        lock(sync) { if(!sessions.Remove(id,out var s)) return; aborts=s.Connections.Values.ToArray(); }
        foreach(var abort in aborts) abort();
    }
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer=new PeriodicTimer(TimeSpan.FromSeconds(1),clock);
        try
        {
            while(await timer.WaitForNextTickAsync(stoppingToken))
            {
                string[] expired;
                lock(sync) expired=sessions.Where(p=>p.Value.Expires<=clock.GetUtcNow()).Select(p=>p.Key).ToArray();
                foreach(var id in expired) Revoke(id);
            }
        }
        catch(OperationCanceledException) when(stoppingToken.IsCancellationRequested) { }
    }
}
public sealed class SessionCookieEvents(Sessions sessions) : CookieAuthenticationEvents
{
    public override Task ValidatePrincipal(CookieValidatePrincipalContext context)
    {
        if(!sessions.Valid(context.Principal)) context.RejectPrincipal();
        return Task.CompletedTask;
    }
    public override Task RedirectToLogin(RedirectContext<CookieAuthenticationOptions> context) => Api.Error(context.HttpContext,401,"unauthenticated");
    public override Task RedirectToAccessDenied(RedirectContext<CookieAuthenticationOptions> context) => Api.Error(context.HttpContext,403,"origin_rejected");
}
