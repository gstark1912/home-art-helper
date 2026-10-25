using System.Net;
using System.Net.Http.Json;
using Xunit;
namespace Ambient.Server.Tests;
public class FutureValidationTests
{
    [Fact]
    public async Task Music_rejects_a_track_id_with_trailing_newline()
    {
        using var app=new ServerFactory();using var c=HttpTests.Client(app);await HttpTests.Login(c);
        Assert.Equal(HttpStatusCode.BadRequest,(await c.PostAsJsonAsync("/api/display/music",new {trackId="demo-01\n",title="Song",artist="Local",artworkId="cover-01",isPlaying=true})).StatusCode);
    }
}
