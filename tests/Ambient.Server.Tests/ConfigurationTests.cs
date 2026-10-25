using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Xunit;
namespace Ambient.Server.Tests;
public class ConfigurationTests
{
    private sealed class ConfigFactory(Dictionary<string,string?> settings) : ServerFactory
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            base.ConfigureWebHost(builder);
            builder.ConfigureAppConfiguration((_,c)=>c.AddInMemoryCollection(settings));
        }
    }
    [Theory]
    [InlineData("Ambient:PairingKey","")]
    [InlineData("Ambient:Transport","invalid")]
    [InlineData("AllowedHosts","*")]
    [InlineData("urls","http://0.0.0.0:5000")]
    public void Unsafe_configuration_prevents_start(string name,string value)
    {
        using var app=new ConfigFactory(new(){[name]=value});
        Assert.Throws<InvalidOperationException>(()=>app.CreateClient());
    }
    [Fact]
    public async Task Login_is_rate_limited_with_retry_after()
    {
        using var app=new ServerFactory(); using var c=HttpTests.Client(app);
        c.DefaultRequestHeaders.Add("Origin","http://localhost"); await HttpTests.Csrf(c);
        for(var i=0;i<10;i++) Assert.Equal(HttpStatusCode.Unauthorized,(await c.PostAsJsonAsync("/api/auth/login",new {pairingKey="incorrect"})).StatusCode);
        var r=await c.PostAsJsonAsync("/api/auth/login",new {pairingKey="incorrect"});
        Assert.Equal(HttpStatusCode.TooManyRequests,r.StatusCode);
        Assert.NotNull(r.Headers.RetryAfter);
    }
}
