using System.Text.Json;
using System.Text.RegularExpressions;
namespace Ambient.Server;

public sealed class RequestFault(int status, string code) : Exception(code)
{
    public int Status { get; } = status;
    public string Code { get; } = code;
}
public static partial class Commands
{
    public static async Task<JsonElement> Read(HttpRequest request, params string[] fields)
    {
        if (!request.HasJsonContentType()) throw new RequestFault(415,"unsupported_media_type");
        if (request.ContentLength > 16384) throw new RequestFault(413,"payload_too_large");
        using var bytes = new MemoryStream();
        var buffer = new byte[4096];
        int n;
        while ((n=await request.Body.ReadAsync(buffer,request.HttpContext.RequestAborted))>0)
        {
            if(bytes.Length+n>16384) throw new RequestFault(413,"payload_too_large");
            bytes.Write(buffer,0,n);
        }
        JsonDocument doc;
        try { doc=JsonDocument.Parse(bytes.ToArray(),new JsonDocumentOptions { MaxDepth=16 }); }
        catch(JsonException) { throw new RequestFault(400,"invalid_request"); }
        using(doc)
        {
            var root=doc.RootElement;
            if(root.ValueKind!=JsonValueKind.Object) throw new RequestFault(400,"invalid_request");
            string[] names;
            try
            {
                names=root.EnumerateObject().Select(p=>p.Name).ToArray();
                // JsonDocument defers decoding escapes until names/strings are accessed.
                foreach(var property in root.EnumerateObject())
                    if(property.Value.ValueKind==JsonValueKind.String) _=property.Value.GetString();
            }
            catch(InvalidOperationException) { throw new RequestFault(400,"invalid_request"); }
            if(names.Length!=fields.Length || names.Distinct(StringComparer.Ordinal).Count()!=names.Length || names.Except(fields,StringComparer.Ordinal).Any()) throw new RequestFault(400,"invalid_request");
            return root.Clone();
        }
    }
    public static string Text(JsonElement j,string name,int max,bool whitespace=false)
    {
        var p=j.GetProperty(name);
        if(p.ValueKind!=JsonValueKind.String) throw new RequestFault(400,"invalid_request");
        var s=p.GetString()!;
        if(s.Length<1||s.Length>max||(!whitespace&&string.IsNullOrWhiteSpace(s))) throw new RequestFault(400,"invalid_request");
        return s;
    }
    public static double Number(JsonElement j,string name,double min,double max,bool integer=false)
    {
        var p=j.GetProperty(name);
        if(p.ValueKind!=JsonValueKind.Number||!p.TryGetDouble(out var n)||!double.IsFinite(n)||n<min||n>max||(integer&&n!=Math.Truncate(n))) throw new RequestFault(400,"invalid_request");
        return n;
    }
    public static string Choice(JsonElement j,string name,params string[] choices)
    {
        var s=Text(j,name,256);
        if(!choices.Contains(s,StringComparer.Ordinal)) throw new RequestFault(400,"invalid_request");
        return s;
    }
    public static Animation Animation(JsonElement j) => new(
        Choice(j,"style","particles"),Choice(j,"palette","aurora","sunset","ocean"),
        Number(j,"speed",0.1,3),Number(j,"intensity",0,1),
        j.GetProperty("bpm").ValueKind==JsonValueKind.Null?null:(int)Number(j,"bpm",40,240,true));
    public static void Music(JsonElement j)
    {
        var id=Text(j,"trackId",64);
        if(!TrackId().IsMatch(id)) throw new RequestFault(400,"invalid_request");
        Text(j,"title",120); Text(j,"artist",120); Choice(j,"artworkId","cover-01","cover-02");
        if(j.GetProperty("isPlaying").ValueKind is not (JsonValueKind.True or JsonValueKind.False)) throw new RequestFault(400,"invalid_request");
    }
    public static MessageCommand Message(JsonElement j)
    {
        var text=Text(j,"text",500);
        if(text.Any(c=>char.IsControl(c)&&c!='\n'&&c!='\t')) throw new RequestFault(400,"invalid_request");
        var priority=(int)Number(j,"priority",0,2,true);
        var durationSeconds=(int)Number(j,"durationSeconds",1,300,true);
        return new MessageCommand(text,priority,durationSeconds);
    }
    [GeneratedRegex(@"\A[A-Za-z0-9_-]+\z",RegexOptions.CultureInvariant)] private static partial Regex TrackId();
}

