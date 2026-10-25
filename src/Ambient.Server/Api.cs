namespace Ambient.Server;
public static class Api
{
    public static Task Error(HttpContext context,int status,string code)
    {
        context.Response.StatusCode=status;
        context.Response.Headers.CacheControl="no-store";
        return context.Response.WriteAsJsonAsync(new {error=new {code,message=code,fields=new Dictionary<string,string[]>()}});
    }
}
