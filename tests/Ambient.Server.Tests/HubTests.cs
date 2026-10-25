using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Channels;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.SignalR.Client;
using Xunit;
namespace Ambient.Server.Tests;
public class HubTests
{
    private sealed class CookieHandler(HttpMessageHandler inner) : DelegatingHandler(inner)
    {
        internal CookieContainer Jar {get;}=new();
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken cancellationToken)
        {
            var cookie=Jar.GetCookieHeader(request.RequestUri!);
            if(cookie.Length>0) request.Headers.TryAddWithoutValidation("Cookie",cookie);
            var r=await base.SendAsync(request,cancellationToken);
            if(r.Headers.TryGetValues("Set-Cookie",out var values)) foreach(var value in values) Jar.SetCookies(request.RequestUri!,value);
            return r;
        }
    }
    private static HubConnection Connect(ServerFactory app,CookieContainer jar,string csrf)
        =>new HubConnectionBuilder().WithUrl("http://localhost/hubs/display",options=>
        {
            options.Transports=HttpTransportType.LongPolling;
            options.HttpMessageHandlerFactory=_=>app.Server.CreateHandler();
            options.Headers["Cookie"]=jar.GetCookieHeader(new Uri("http://localhost"));
            options.Headers["Origin"]="http://localhost";
            options.Headers["X-CSRF-Token"]=csrf;
        }).Build();
    [Fact]
    public async Task Initial_snapshot_and_concurrent_broadcasts_are_ordered_then_logout_closes_socket()
    {
        using var app=new ServerFactory();
        using var handler=new CookieHandler(app.Server.CreateHandler());
        using var c=new HttpClient(handler) {BaseAddress=new Uri("http://localhost")};
        await HttpTests.Login(c);
        var csrf=await HttpTests.Csrf(c);
        await using var hub=Connect(app,handler.Jar,csrf);
        var events=Channel.CreateUnbounded<JsonElement>();
        hub.On<JsonElement>("StateChanged",s=>events.Writer.TryWrite(s));
        var closed=new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        hub.Closed+=_=> {closed.TrySetResult();return Task.CompletedTask;};
        await hub.StartAsync();
        using var timeout=new CancellationTokenSource(TimeSpan.FromSeconds(15));
        var initial=await events.Reader.ReadAsync(timeout.Token);
        Assert.Equal(0,initial.GetProperty("version").GetInt64());
        var snapshot=await hub.InvokeAsync<JsonElement>("GetSnapshot",timeout.Token);
        Assert.Equal(initial.GetProperty("epoch").GetString(),snapshot.GetProperty("epoch").GetString());
        var commands=Enumerable.Range(0,12).Select(_=>c.PostAsJsonAsync("/api/display/screen/off",new {})).ToArray();
        await Task.WhenAll(commands);
        for(var i=1;i<=12;i++)
        {
            var e=await events.Reader.ReadAsync(timeout.Token);
            Assert.Equal(i,e.GetProperty("version").GetInt64());
            Assert.False(e.GetProperty("screenOn").GetBoolean());
        }
        Assert.Equal(12,(await hub.InvokeAsync<JsonElement>("GetSnapshot",timeout.Token)).GetProperty("version").GetInt64());
        // A second independent connection gets current state, without requiring a new mutation.
        await using(var second=Connect(app,handler.Jar,csrf))
        {
            var first=new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
            second.On<JsonElement>("StateChanged",s=>first.TrySetResult(s));
            await second.StartAsync(timeout.Token);
            Assert.Equal(12,(await first.Task.WaitAsync(timeout.Token)).GetProperty("version").GetInt64());
        }
        var replayCookie=handler.Jar.GetCookieHeader(new Uri("http://localhost"));
        Assert.Equal(HttpStatusCode.NoContent,(await c.PostAsJsonAsync("/api/auth/logout",new {})).StatusCode);
        await closed.Task.WaitAsync(timeout.Token);
        using var replay=new HttpClient(app.Server.CreateHandler()){BaseAddress=new Uri("http://localhost")};
        replay.DefaultRequestHeaders.Add("Cookie",replayCookie);
        Assert.Equal(HttpStatusCode.Unauthorized,(await replay.GetAsync("/api/display/status")).StatusCode);
    }
}
