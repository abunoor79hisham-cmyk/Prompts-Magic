// Vercel serverless function: turns a Pinterest "Copy link" URL (pin.it or pinterest.com/pin/...)
// into the pin's image. Same-origin, so the page can analyze it without CORS problems.
const PIN_HOST = /(^|\.)(pin\.it|pinterest\.[a-z.]+)$/i;
const IMG_HOST = /(^|\.)pinimg\.com$/i;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

module.exports = async (req, res) => {
  try {
    const u = new URL(String(req.query.url || ''));
    if (!PIN_HOST.test(u.hostname)) return res.status(400).json({ error: 'Only Pinterest links are supported.' });

    const page = await fetch(u, { redirect: 'follow', headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9' } });
    if (!PIN_HOST.test(new URL(page.url).hostname)) return res.status(400).json({ error: 'Unexpected redirect.' });
    const html = await page.text();

    const m = html.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)(?::src)?["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image|twitter:image)["']/i)
      || html.match(/https:\/\/i\.pinimg\.com\/[^"'\s\\]+\.(?:jpg|jpeg|png|webp)/i);
    if (!m) return res.status(404).json({ error: 'No image found on that pin.' });

    const image = new URL((m[1] || m[0]).replace(/&amp;/g, '&'));
    if (!IMG_HOST.test(image.hostname)) return res.status(404).json({ error: 'No Pinterest image found.' });
    if (!req.query.img) return res.status(200).json({ image: image.href });

    const r = await fetch(image, { headers: { 'user-agent': UA, referer: 'https://www.pinterest.com/' } });
    if (!r.ok) return res.status(502).json({ error: 'Could not download the image.' });
    res.setHeader('content-type', r.headers.get('content-type') || 'image/jpeg');
    res.setHeader('cache-control', 'public, max-age=86400');
    return res.status(200).send(Buffer.from(await r.arrayBuffer()));
  } catch (e) {
    return res.status(500).json({ error: 'Could not read that pin.' });
  }
};
