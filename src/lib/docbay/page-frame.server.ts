const UA =
  "Mozilla/5.0 (compatible; BESTL.INK/1.0; +https://www.bestl.ink)";
const MAX_HTML = 1_800_000;

function assertPublicHttp(raw: string): URL {
  const u = new URL(raw);
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("Nur http(s)");
  const host = u.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
  ) {
    throw new Error("Lokale Adressen sind nicht erlaubt");
  }
  return u;
}

const BRIDGE = `(function(){
  var pins=[];
  var place=false;
  var layer;
  var painting=false;
  function ensure(){
    if(layer) return layer;
    layer=document.createElement('div');
    layer.setAttribute('data-bestl-pins','1');
    layer.style.cssText='position:absolute;left:0;top:0;width:100%;pointer-events:none;z-index:2147483646;';
    document.documentElement.appendChild(layer);
    return layer;
  }
  function cssPath(el){
    if(!el||el.nodeType!==1) return '';
    var esc=window.CSS&&CSS.escape?CSS.escape:function(s){return String(s).replace(/[^a-zA-Z0-9_-]/g,'\\\\$&');};
    if(el.id) return '#'+esc(el.id);
    var parts=[];
    while(el&&el.nodeType===1&&el!==document.documentElement){
      var sel=el.tagName.toLowerCase();
      if(el.id){ parts.unshift('#'+esc(el.id)); break; }
      var p=el.parentElement;
      if(p){
        var sibs=[].filter.call(p.children,function(c){return c.tagName===el.tagName;});
        if(sibs.length>1){
          var i=[].indexOf.call(sibs,el)+1;
          sel+=':nth-of-type('+i+')';
        }
      }
      parts.unshift(sel);
      el=p;
    }
    return parts.join('>');
  }
  function render(){
    if(painting) return;
    painting=true;
    var root=ensure();
    root.innerHTML='';
    var h=Math.max(document.documentElement.scrollHeight,document.body?document.body.scrollHeight:0,1);
    root.style.height=h+'px';
    for(var i=0;i<pins.length;i++){
      var p=pins[i];
      var el=null;
      try{ el=document.querySelector(p.selector); }catch(e){}
      if(!el) continue;
      var r=el.getBoundingClientRect();
      var x=r.left+window.scrollX+Math.min(r.width-8, Math.max(8,r.width*0.92));
      var y=r.top+window.scrollY+8;
      var m=document.createElement('div');
      m.title=(p.label||'')+(p.note?(' · '+p.note):'');
      m.style.cssText='position:absolute;left:'+x+'px;top:'+y+'px;width:16px;height:16px;margin-left:-8px;margin-top:-8px;border-radius:99px;background:'+p.color+';border:2px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.4);pointer-events:auto;cursor:default;';
      root.appendChild(m);
    }
    painting=false;
  }
  window.addEventListener('message',function(e){
    var d=e.data||{};
    if(d.type==='bestl-pins'&&Array.isArray(d.pins)){ pins=d.pins; render(); }
    if(d.type==='bestl-pin-mode'){ place=!!d.on; document.documentElement.style.cursor=place?'crosshair':''; }
  });
  document.addEventListener('click',function(e){
    if(!place) return;
    e.preventDefault(); e.stopPropagation();
    var t=e.target;
    if(t&&t.closest&&t.closest('[data-bestl-pins]')) return;
    var sel=cssPath(t);
    if(!sel) return;
    window.parent.postMessage({type:'bestl-place-pin',selector:sel},'*');
  },true);
  window.addEventListener('scroll',render,{passive:true});
  window.addEventListener('resize',render);
  if(typeof MutationObserver!=='undefined'){
    new MutationObserver(function(muts){
      for(var i=0;i<muts.length;i++){
        var n=muts[i].target;
        if(n&&n.closest&&n.closest('[data-bestl-pins]')) continue;
        render();
        return;
      }
    }).observe(document.documentElement,{childList:true,subtree:true});
  }
  if(document.readyState==='complete') window.parent.postMessage({type:'bestl-frame-ready'},'*');
  else window.addEventListener('load',function(){ window.parent.postMessage({type:'bestl-frame-ready'},'*'); });
})();`;

export async function fetchPageHtml(target: string): Promise<string> {
  const page = assertPublicHttp(target);
  const res = await fetch(page.toString(), {
    redirect: "follow",
    signal: AbortSignal.timeout(10000),
    headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
  });
  if (!res.ok) throw new Error("Seite nicht ladbar");
  const mime = (res.headers.get("content-type") || "").toLowerCase();
  if (mime && !mime.includes("html") && !mime.includes("xml") && !mime.includes("text/plain")) {
    throw new Error("Keine HTML-Seite");
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_HTML) throw new Error("Seite zu groß");
  let html = buf.toString("utf8");
  const finalUrl = res.url || page.toString();
  let base = finalUrl;
  try {
    const u = new URL(finalUrl);
    if (!u.pathname.endsWith("/")) {
      u.pathname = u.pathname.replace(/[^/]+$/, "");
    }
    base = u.toString();
  } catch {
    /* keep */
  }
  const safeBase = encodeURI(base);
  html = html.replace(/<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*>/gi, "");
  if (!/<base\s/i.test(html)) {
    if (/<head[^>]*>/i.test(html)) {
      html = html.replace(/<head([^>]*)>/i, `<head$1><base href="${safeBase}">`);
    } else {
      html = `<head><base href="${safeBase}"></head>` + html;
    }
  }
  const tag = `<script>${BRIDGE}</script>`;
  if (/<\/body>/i.test(html)) html = html.replace(/<\/body>/i, `${tag}</body>`);
  else html += tag;
  return html;
}
