using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
namespace Ambient.Server.Tests;
public class SessionExpiryTests
{
    private sealed class Clock : TimeProvider
    {
        public DateTimeOffset Now=DateTimeOffset.UtcNow;
        public override DateTimeOffset GetUtcNow()=>Now;
    }
    private sealed class Factory(Clock clock) : ServerFactory
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder) {base.ConfigureWebHost(builder);builder.ConfigureServices(s=>s.AddSingleton<TimeProvider>(clock));}
    }
    [Fact]
    public async Task Expired_server_session_rejects_a_still_present_cookie()
    {
        var clock=new Clock(); using var app=new Factory(clock); using var c=HttpTests.Client(app); await HttpTests.Login(c);
        clock.Now=clock.Now.AddHours(12).AddSeconds(1);
        Assert.Equal(HttpStatusCode.Unauthorized,(await c.GetAsync("/api/display/status")).StatusCode);
    }
    [Fact]
    public async Task Hub_delete_without_origin_is_rejected()
    {
        using var app=new ServerFactory(); using var c=HttpTests.Client(app); await HttpTests.Login(c);
        c.DefaultRequestHeaders.Remove("Origin");
        Assert.Equal(HttpStatusCode.Forbidden,(await c.DeleteAsync("/hubs/display?id=missing")).StatusCode);
    }
}
