using System.Net;
using Microsoft.AspNetCore.Hosting;
using Xunit;
namespace Ambient.Server.Tests;
public class SpaTests
{
    private sealed class SpaFactory(string root) : ServerFactory
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder) { base.ConfigureWebHost(builder); builder.UseWebRoot(root); }
    }
    [Fact]
    public async Task Frontend_is_served_without_masking_api_methods_or_unknown_routes()
    {
        var root=Path.Combine(Path.GetTempPath(),"ambient-spa-"+Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root); await File.WriteAllTextAsync(Path.Combine(root,"index.html"),"<!doctype html><title>Fixture</title>");
        try
        {
            using var app=new SpaFactory(root); using var c=HttpTests.Client(app);
            var page=await c.GetAsync("/display"); Assert.Equal(HttpStatusCode.OK,page.StatusCode);
            Assert.Equal("text/html",page.Content.Headers.ContentType?.MediaType);
            Assert.Equal(HttpStatusCode.NotFound,(await c.GetAsync("/api/absent")).StatusCode);
            Assert.Equal(HttpStatusCode.MethodNotAllowed,(await c.GetAsync("/api/display/screen/on")).StatusCode);
            Assert.Equal(HttpStatusCode.NotFound,(await c.GetAsync("/hubs/absent")).StatusCode);
        }
        finally { File.Delete(Path.Combine(root,"index.html")); Directory.Delete(root); }
    }
}
