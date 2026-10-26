using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Xunit;
namespace Ambient.Server.Tests;
public class BoundaryTests
{
    [Theory]
    [InlineData("animation", "{\"style\":\"particles\",\"palette\":\"ocean\",\"speed\":1,\"intensity\":0.5}")]
    [InlineData("animation", "{\"style\":\"particles\",\"palette\":\"ocean\",\"speed\":\"1\",\"intensity\":0.5,\"bpm\":null}")]
    [InlineData("animation", "{\"style\":\"particles\",\"palette\":\"ocean\",\"speed\":1,\"intensity\":0.5,\"bpm\":40.5}")]
    [InlineData("animation", "{\"style\":null,\"palette\":\"ocean\",\"speed\":1,\"intensity\":0.5,\"bpm\":null}")]
    [InlineData("mode", "{\"mode\":\"Art\"}")]
    [InlineData("mode", "{\"mode\":\"\\uD800\"}")]
    [InlineData("mode", "{\"\\uD800\":\"art\"}")]
    [InlineData("screen/on", "null")]
    [InlineData("screen/on", "{")]
    [InlineData("screen/on", "{\"x\":1}")]
    [InlineData("mode", "{\"mode\":\"art\",\"mode\":\"music\"}")]
    [InlineData("message", "{\"text\":\"hola\",\"priority\":3,\"durationSeconds\":30}")]
    [InlineData("message", "{\"text\":\"hola\",\"priority\":0,\"durationSeconds\":0}")]
    [InlineData("message", "{\"text\":\"hola\",\"priority\":0,\"durationSeconds\":301}")]
    [InlineData("message", "{\"text\":\"hola\\u0007\",\"priority\":0,\"durationSeconds\":30}")]
    [InlineData("message", "{\"text\":\"hola\",\"priority\":1.5,\"durationSeconds\":30}")]
    public async Task Strict_json_rejects_invalid_input_without_mutation(string path,string json)
    {
        using var app=new ServerFactory(); using var c=HttpTests.Client(app); await HttpTests.Login(c);
        var r=await c.PostAsync("/api/display/"+path,new StringContent(json,Encoding.UTF8,"application/json"));
        Assert.Equal(HttpStatusCode.BadRequest,r.StatusCode);
        Assert.Equal("invalid_request",(await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("error").GetProperty("code").GetString());
        Assert.Equal(0,(await c.GetFromJsonAsync<JsonElement>("/api/display/status")).GetProperty("version").GetInt64());
    }
    [Fact]
    public async Task Http_boundaries_and_future_commands_return_public_errors()
    {
        using var app=new ServerFactory(); using var c=HttpTests.Client(app); await HttpTests.Login(c);
        Assert.Equal(HttpStatusCode.UnsupportedMediaType,(await c.PostAsync("/api/display/screen/on",new StringContent("{}"))).StatusCode);
        Assert.Equal(HttpStatusCode.RequestEntityTooLarge,(await c.PostAsync("/api/display/mode",new StringContent(new string(' ',17000),Encoding.UTF8,"application/json"))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,(await c.GetAsync("/api/absent")).StatusCode);
        Assert.Equal(HttpStatusCode.MethodNotAllowed,(await c.GetAsync("/api/display/screen/on")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,(await c.PostAsJsonAsync("/api/display/message",new {text=" ",priority=0,durationSeconds=1})).StatusCode);
        Assert.Equal(HttpStatusCode.NotImplemented,(await c.PostAsJsonAsync("/api/display/music",new {trackId="demo-01",title="Song",artist="Local",artworkId="cover-01",isPlaying=true})).StatusCode);
        c.DefaultRequestHeaders.Remove("Origin"); c.DefaultRequestHeaders.Add("Origin","http://evil.test");
        Assert.Equal(HttpStatusCode.Forbidden,(await c.PostAsJsonAsync("/api/display/screen/on",new {})).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,(await c.GetAsync("/hubs/display")).StatusCode);
    }
    [Fact]
    public async Task Concurrent_commands_have_unique_monotonic_versions()
    {
        using var app=new ServerFactory(); using var c=HttpTests.Client(app); await HttpTests.Login(c);
        var responses=await Task.WhenAll(Enumerable.Range(0,20).Select(_=>c.PostAsJsonAsync("/api/display/screen/on",new {})));
        var versions=new List<long>();
        foreach(var r in responses) { Assert.Equal(HttpStatusCode.OK,r.StatusCode); versions.Add((await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("version").GetInt64()); }
        Assert.Equal(Enumerable.Range(1,20).Select(x=>(long)x),versions.Order());
    }
}


