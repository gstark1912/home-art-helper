using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace Ambient.Server.Tests;

public class ServerFactory : WebApplicationFactory<Program>
{
    internal const string Key = "local-test-pairing-key";
    protected override void ConfigureWebHost(IWebHostBuilder builder) => builder.UseEnvironment("Development")
        .ConfigureAppConfiguration((_, c) => c.AddInMemoryCollection(new Dictionary<string,string?> {
            ["Ambient:PairingKey"] = Key, ["Ambient:Transport"] = "DevelopmentHttp",
            ["AllowedHosts"] = "localhost;127.0.0.1;10.0.2.2"
        }));
}

public class HttpTests
{
    internal static HttpClient Client(ServerFactory app) => app.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = true, AllowAutoRedirect = false });
    internal static async Task<string> Csrf(HttpClient client)
    {
        var json = await client.GetFromJsonAsync<JsonElement>("/api/auth/csrf");
        var token = json.GetProperty("csrfToken").GetString()!;
        client.DefaultRequestHeaders.Remove("X-CSRF-Token");
        client.DefaultRequestHeaders.Add("X-CSRF-Token", token);
        return token;
    }
    internal static async Task Login(HttpClient client)
    {
        client.DefaultRequestHeaders.Add("Origin", "http://localhost");
        await Csrf(client);
        var response = await client.PostAsJsonAsync("/api/auth/login", new { pairingKey = ServerFactory.Key });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        await Csrf(client);
    }
    [Fact]
    public async Task Protected_api_and_hub_require_session()
    {
        using var app = new ServerFactory(); using var c = Client(app);
        Assert.Equal(HttpStatusCode.Unauthorized, (await c.GetAsync("/api/display/status")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await c.PostAsync("/hubs/display/negotiate?negotiateVersion=1", null)).StatusCode);
        Assert.False((await c.GetFromJsonAsync<JsonElement>("/api/auth/session")).GetProperty("authenticated").GetBoolean());
    }
    [Fact]
    public async Task Login_requires_origin_and_real_antiforgery_then_rotates_identity()
    {
        using var app = new ServerFactory(); using var c = Client(app);
        Assert.Equal(HttpStatusCode.Forbidden, (await c.PostAsJsonAsync("/api/auth/login", new { pairingKey = ServerFactory.Key })).StatusCode);
        c.DefaultRequestHeaders.Add("Origin", "http://localhost");
        c.DefaultRequestHeaders.Add("X-CSRF-Token", "forged");
        Assert.Equal(HttpStatusCode.Forbidden, (await c.PostAsJsonAsync("/api/auth/login", new { pairingKey = ServerFactory.Key })).StatusCode);
        await Csrf(c);
        Assert.Equal(HttpStatusCode.Unauthorized, (await c.PostAsJsonAsync("/api/auth/login", new { pairingKey = "wrong" })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await c.PostAsJsonAsync("/api/auth/login", new { pairingKey = ServerFactory.Key })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await c.PostAsJsonAsync("/api/display/screen/off", new {})).StatusCode);
        await Csrf(c);
        Assert.Equal(HttpStatusCode.OK, (await c.PostAsJsonAsync("/api/display/screen/off", new {})).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await c.PostAsJsonAsync("/api/auth/logout", new {})).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await c.GetAsync("/api/display/status")).StatusCode);
    }
    [Fact]
    public async Task Mutations_preserve_state_increment_once_and_reject_invalid_commands()
    {
        using var app = new ServerFactory(); using var c = Client(app); await Login(c);
        var initial = await c.GetFromJsonAsync<JsonElement>("/api/display/status");
        Assert.Equal(0, initial.GetProperty("version").GetInt64());
        Assert.True(initial.GetProperty("screenOn").GetBoolean());
        Assert.Equal("aurora", initial.GetProperty("animation").GetProperty("palette").GetString());
        var response = await c.PostAsJsonAsync("/api/display/animation", new {style="particles",palette="ocean",speed=1.4,intensity=0.6,bpm=(int?)null});
        Assert.Equal(HttpStatusCode.OK,response.StatusCode);
        var changed = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(1,changed.GetProperty("version").GetInt64());
        Assert.Equal(initial.GetProperty("epoch").GetString(),changed.GetProperty("epoch").GetString());
        Assert.Equal(HttpStatusCode.BadRequest,(await c.PostAsJsonAsync("/api/display/animation",new {style="particles",palette="ocean",speed=4,intensity=0.5,bpm=(int?)null})).StatusCode);
        Assert.Equal(HttpStatusCode.NotImplemented,(await c.PostAsJsonAsync("/api/display/mode",new {mode="music"})).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,(await c.PostAsJsonAsync("/api/display/screen/off",new {extra=true})).StatusCode);
        await c.PostAsJsonAsync("/api/display/screen/off",new {});
        await c.PostAsJsonAsync("/api/display/screen/off",new {});
        var final = await c.GetFromJsonAsync<JsonElement>("/api/display/status");
        Assert.Equal(3,final.GetProperty("version").GetInt64());
        Assert.False(final.GetProperty("screenOn").GetBoolean());
        Assert.Equal("ocean",final.GetProperty("animation").GetProperty("palette").GetString());
    }
}

