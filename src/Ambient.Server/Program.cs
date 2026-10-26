using System.Security.Claims;
using System.Threading.RateLimiting;
using Ambient.Server;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;

var builder=WebApplication.CreateBuilder(args);
builder.Services.AddSingleton<AmbientSettings>();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<Sessions>();
builder.Services.AddHostedService(p=>p.GetRequiredService<Sessions>());
builder.Services.AddSingleton<DisplayState>();
builder.Services.AddScoped<SessionCookieEvents>();
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme).AddCookie();
builder.Services.AddOptions<CookieAuthenticationOptions>(CookieAuthenticationDefaults.AuthenticationScheme).Configure<AmbientSettings>((o,s)=>
{
    o.Cookie.Name="Ambient.Session"; o.Cookie.HttpOnly=true; o.Cookie.SameSite=SameSiteMode.Strict;
    o.Cookie.Path="/"; o.Cookie.SecurePolicy=s.Secure?CookieSecurePolicy.Always:CookieSecurePolicy.None;
    o.ExpireTimeSpan=TimeSpan.FromHours(12); o.SlidingExpiration=false; o.EventsType=typeof(SessionCookieEvents);
});
builder.Services.AddAntiforgery();
builder.Services.AddOptions<AntiforgeryOptions>().Configure<AmbientSettings>((o,s)=>
{
    o.HeaderName="X-CSRF-Token"; o.Cookie.Name="Ambient.Antiforgery"; o.Cookie.HttpOnly=true;
    o.Cookie.SameSite=SameSiteMode.Strict; o.Cookie.Path="/"; o.Cookie.SecurePolicy=s.Secure?CookieSecurePolicy.Always:CookieSecurePolicy.None;
});
builder.Services.AddAuthorization();
builder.Services.AddSignalR(o=> { o.EnableDetailedErrors=false; o.MaximumReceiveMessageSize=16384; });
builder.Services.AddRateLimiter(o=>
{
    o.AddFixedWindowLimiter("login",lim=> { lim.PermitLimit=10; lim.Window=TimeSpan.FromMinutes(1); lim.QueueLimit=0; lim.AutoReplenishment=true; });
    o.OnRejected=async (context,_)=>
    {
        context.HttpContext.Response.Headers.RetryAfter="60";
        await Api.Error(context.HttpContext,429,"rate_limited");
    };
});
builder.WebHost.ConfigureKestrel(o=> { o.Limits.MaxRequestBodySize=16384; });
var app=builder.Build();
var settings=app.Services.GetRequiredService<AmbientSettings>(); // Fail closed before listening.
app.Use(async (context,next)=>
{
    context.Response.Headers.CacheControl="no-store";
    try { await next(); }
    catch(RequestFault e) { await Api.Error(context,e.Status,e.Code); }
    catch(BadHttpRequestException e) { await Api.Error(context,e.StatusCode,e.StatusCode==413?"payload_too_large":"invalid_request"); }
});
app.Use(async (context,next)=>
{
    if(settings.Secure&&!context.Request.IsHttps) { await Api.Error(context,403,"origin_rejected"); return; }
    if(!settings.Secure&&context.Connection.RemoteIpAddress is {} ip&&!System.Net.IPAddress.IsLoopback(ip)) { await Api.Error(context,403,"origin_rejected"); return; }
    await next();
});
app.UseRouting();
app.UseAuthentication();
// Endpoint authorization must run before checking Origin, CSRF or command bodies.
app.UseAuthorization();
app.Use(async (context,next)=>
{
    var request=context.Request;
    var hub=request.Path.StartsWithSegments("/hubs/display");
    var api=request.Path.StartsWithSegments("/api");
    if((hub&&(request.Headers.ContainsKey("Origin")||!HttpMethods.IsGet(request.Method))||HttpMethods.IsPost(request.Method)&&(api||hub))&&!settings.OwnOrigin(request))
    { await Api.Error(context,403,"origin_rejected"); return; }
    if(HttpMethods.IsPost(request.Method)&&(api||hub))
    {
        try { await context.RequestServices.GetRequiredService<IAntiforgery>().ValidateRequestAsync(context); }
        catch(AntiforgeryValidationException) { await Api.Error(context,403,"csrf_invalid"); return; }
    }
    await next();
});
app.UseRateLimiter();
app.UseStatusCodePages(async context=>
{
    var status=context.HttpContext.Response.StatusCode;
    if(status is 404 or 405) await Api.Error(context.HttpContext,status,status==404?"not_found":"method_not_allowed");
});
app.MapGet("/api/auth/csrf",(HttpContext c,IAntiforgery anti)=>Results.Json(new {csrfToken=anti.GetAndStoreTokens(c).RequestToken}));
app.MapGet("/api/auth/session",(HttpContext c)=>Results.Json(new {authenticated=c.User.Identity?.IsAuthenticated==true}));
app.MapPost("/api/auth/login",async (HttpContext c,Sessions sessions)=>
{
    var json=await Commands.Read(c.Request,"pairingKey");
    var key=Commands.Text(json,"pairingKey",256,true);
    if(!settings.Matches(key)) throw new RequestFault(401,"invalid_credentials");
    sessions.Revoke(c.User);
    var id=sessions.Create();
    var identity=new ClaimsIdentity(new[]{new Claim(ClaimTypes.NameIdentifier,id)},CookieAuthenticationDefaults.AuthenticationScheme);
    await c.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme,new ClaimsPrincipal(identity),new AuthenticationProperties {IsPersistent=false});
    return Results.Json(new {authenticated=true});
}).RequireRateLimiting("login");
app.MapPost("/api/auth/logout",async (HttpContext c,Sessions sessions,IOptions<AntiforgeryOptions> options)=>
{
    await Commands.Read(c.Request);
    sessions.Revoke(c.User);
    await c.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
    c.Response.Cookies.Delete("Ambient.Antiforgery",options.Value.Cookie.Build(c));
    return Results.NoContent();
}).RequireAuthorization();
app.MapGet("/api/display/status",(DisplayState state)=>state.Get()).RequireAuthorization();
app.MapPost("/api/display/animation",async (HttpRequest request,DisplayState state)=>
{
    var animation=Commands.Animation(await Commands.Read(request,"style","palette","speed","intensity","bpm"));
    return await state.Mutate(s=>s with {Animation=animation});
}).RequireAuthorization();
app.MapPost("/api/display/mode",async (HttpRequest request,DisplayState state)=>
{
    var mode=Commands.Choice(await Commands.Read(request,"mode"),"mode","art","music");
    if(mode=="music") throw new RequestFault(501,"feature_not_available");
    return await state.Mutate(s=>s with {BaseMode=mode});
}).RequireAuthorization();
foreach(var on in new[]{true,false})
    app.MapPost("/api/display/screen/"+(on?"on":"off"),async (HttpRequest request,DisplayState state)=>
    { await Commands.Read(request); return await state.Mutate(s=>s with {ScreenOn=on}); }).RequireAuthorization();
app.MapPost("/api/display/music",async (HttpRequest request)=>
{
    Commands.Music(await Commands.Read(request,"trackId","title","artist","artworkId","isPlaying"));
    throw new RequestFault(501,"feature_not_available");
    #pragma warning disable CS0162
    return Results.Empty;
    #pragma warning restore CS0162
}).RequireAuthorization();
app.MapPost("/api/display/message",async (HttpRequest request,DisplayState state)=>
{
    var command=Commands.Message(await Commands.Read(request,"text","priority","durationSeconds"));
    return await state.PostMessage(command);
}).RequireAuthorization();
app.MapHub<DisplayHub>("/hubs/display",o=> {o.CloseOnAuthenticationExpiration=true; o.AllowStatefulReconnects=false;});
// Serve a built frontend when present, including publish output; never fall back for API/hub paths.
var clientDist=Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath,"../ambient-client/dist"));
var webRoot=app.Environment.WebRootPath;
var staticRoot=webRoot!=null&&File.Exists(Path.Combine(webRoot,"index.html"))?webRoot:clientDist;
if(Directory.Exists(staticRoot))
{
    var provider=new Microsoft.Extensions.FileProviders.PhysicalFileProvider(staticRoot);
    app.Lifetime.ApplicationStopped.Register(provider.Dispose);
    app.UseStaticFiles(new StaticFileOptions {FileProvider=provider});
    foreach(var route in new[]{"/","/control","/display"})
        app.MapGet(route,async (HttpContext context)=>
        {
            context.Response.ContentType="text/html; charset=utf-8";
            await context.Response.SendFileAsync(Path.Combine(staticRoot,"index.html"));
        });
}
app.Run();
public partial class Program { }


