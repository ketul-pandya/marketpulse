export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'No URL' });

  try {
    const r = await fetch(decodeURIComponent(url), {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/rss+xml,text/xml,*/*' },
      signal: AbortSignal.timeout(9000),
    });
    if (!r.ok) return res.status(r.status).json({ error: `Feed error ${r.status}` });
    const xml = await r.text();
    const items = [];

    // RSS 2.0
    for (const m of xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi)) {
      const b = m[1];
      const title   = clean(cdata(tag(b,'title')));
      const link    = tag(b,'link') || attr(b,'link','href');
      const desc    = clean(cdata(tag(b,'description') || tag(b,'summary')));
      const pubDate = tag(b,'pubDate') || tag(b,'published') || tag(b,'updated');
      const src     = tag(b,'source') || '';
      if (title && link) items.push({
        title, link: link.trim(),
        description: desc.slice(0,350),
        pubDate: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        source: clean(src),
      });
    }

    // Atom fallback
    if (!items.length) {
      for (const m of xml.matchAll(/<entry[^>]*>([\s\S]*?)<\/entry>/gi)) {
        const b = m[1];
        const title   = clean(cdata(tag(b,'title')));
        const link    = attr(b,'link','href') || tag(b,'link');
        const desc    = clean(cdata(tag(b,'summary') || tag(b,'content')));
        const pubDate = tag(b,'published') || tag(b,'updated');
        if (title && link) items.push({
          title, link: link.trim(),
          description: desc.slice(0,350),
          pubDate: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
          source: '',
        });
      }
    }

    res.status(200).json({ items: items.slice(0,12) });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}

function tag(x,t){const m=x.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)<\\/${t}>`, 'i'));return m?m[1].trim():'';}
function attr(x,t,a){const m=x.match(new RegExp(`<${t}[^>]*${a}=["']([^"']+)["']`,'i'));return m?m[1].trim():'';}
function cdata(s){return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').trim();}
function clean(s){return s.replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();}
