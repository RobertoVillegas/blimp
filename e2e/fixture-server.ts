import http from 'node:http';
import type { AddressInfo } from 'node:net';

export const PAGES: Record<string, { title: string; body: string }> = {
  'react-hooks': { title: 'Hooks reference – React', body: 'useState lets a component remember information. useEffect synchronizes with external systems.' },
  'react-state': { title: 'Managing state – React', body: 'State is isolated and private to each component instance. Lift state up to share it.' },
  'weather-madrid': { title: 'Madrid weather forecast', body: 'Sunny with highs of 24 degrees in Madrid this week.' },
  'weather-paris': { title: 'Paris weather forecast', body: 'Light rain expected in Paris, highs of 15 degrees.' },
  'recipe-pasta': { title: 'Easy pasta recipe', body: 'Boil pasta for nine minutes, then toss with garlic and olive oil.' },
  'recipe-tacos': { title: 'Street tacos recipe', body: 'Grill the meat, warm corn tortillas and top with onion and cilantro.' },
  'news-a': { title: 'Local news A', body: 'Council approves new bike lanes along the river.' },
  'news-b': { title: 'Local news B', body: 'Library extends weekend opening hours.' },
};

/** 2×2 PNG used as the share image of the React hooks page. */
export const COVER_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR42mP4z8DAwPCfgQEIGBgYGAAJ/wH/lWg0pQAAAABJRU5ErkJggg==',
  'base64',
);

function articleHtml(slug: string): string {
  const page = PAGES[slug]!;
  const image = slug === 'react-hooks' ? '<meta property="og:image" content="/img/cover.png">' : '';
  return `<!doctype html><html lang="en"><head><title>${page.title}</title>
<meta name="description" content="Fixture page ${slug}">${image}</head><body>
<nav>NAVIGATION-CHROME Home About Login</nav>
<main><article><h1>${page.title}</h1>
<p>${page.body}</p>
<p>${'This paragraph pads the article so that extraction prefers the main element. '.repeat(10)}</p>
<h2>Details</h2><p>Section details for ${slug}.</p>
<div style="display:none">HIDDEN-SECRET-TEXT</div>
<form><input type="password" value="hunter2-PASSWORD"><input value="FORM-VALUE"></form>
</article></main>
<footer>FOOTER-CHROME copyright</footer>
</body></html>`;
}

function linksHtml(origin: string): string {
  return `<!doctype html><html lang="en"><head><title>Links</title></head><body>
<h1>Reading list</h1>
<p><a id="hooks" href="${origin}/page/react-hooks">React hooks</a></p>
<p><a id="paris" class="list-link" href="${origin}/page/weather-paris">Paris weather</a></p>
<p><a id="login" href="${origin}/login">Members area</a></p>
<p><a id="same" href="#section">Jump to section</a></p>
<p><input id="box" placeholder="type here"></p>
<p style="height:2000px">spacer</p>
</body></html>`;
}

const LOGIN_HTML = `<!doctype html><html><head><title>Sign in</title></head><body>
<h1>Sign in</h1><form><input name="u"><input type="password" name="p"><button>Go</button></form>
<p>Forgot your password?</p></body></html>`;

export interface MockRequest {
  system: string;
  user: string;
  body: Record<string, unknown>;
}

/** Serves fixture pages and a deterministic OpenAI-compatible chat endpoint. */
export async function startFixtureServer() {
  const requests: MockRequest[] = [];
  /** Every GET path, to prove what was (and wasn't) fetched. */
  const gets: string[] = [];
  /** Posts in the test feed; tests add more with /feed/publish. */
  let feedPosts = 2;

  const server = http.createServer((req, res) => {
    const cors = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type, authorization',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
    };
    if (req.method === 'OPTIONS') return void res.writeHead(204, cors).end();

    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (req.method === 'GET') gets.push(url.pathname);
    const origin = `http://${req.headers.host}`;
    const slug = url.pathname.replace(/^\/page\//, '');
    if (req.method === 'GET' && PAGES[slug]) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return void res.end(articleHtml(slug));
    }

    if (req.method === 'GET' && url.pathname === '/links') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return void res.end(linksHtml(origin));
    }
    // Tries both ways a site can paint over an extension: a top-layer popover opened first, and
    // a max-z-index element added after the extension's UI.
    if (req.method === 'GET' && url.pathname === '/greedy') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return void res.end(`<!doctype html><html><head><title>Greedy page</title><style>
body { margin: 0; position: relative; z-index: 0; }
.cover { position: fixed; inset: 0; background: rgb(255 0 0 / .3); }
#pop { inset: 60px 0 0 0; width: 100vw; height: calc(100vh - 60px); margin: 0; border: 0; background: rgb(0 0 255 / .3); }
</style></head><body>
<p><a id="hooks" href="${origin}/page/react-hooks">React hooks</a></p>
<div id="pop" popover="manual">top-layer popover</div>
<script>
document.getElementById('pop').showPopover();
window.addLateCover = () => {
  const el = document.createElement('div');
  el.className = 'cover';
  el.id = 'late';
  el.style.zIndex = '2147483647';
  document.body.append(el);
};
</script></body></html>`);
    }
    // Behaves like Gmail: the title carries an unread count and the page rewrites it.
    if (req.method === 'GET' && url.pathname === '/inbox') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return void res.end(`<!doctype html><html><head><title>Inbox (3) - someone@example.com - Example Mail</title></head>
<body><h1>Inbox</h1><script>window.setUnread = (n) => { document.title = 'Inbox (' + n + ') - someone@example.com - Example Mail'; };</script></body></html>`);
    }
    // A playing video drawn from a canvas, so tests need no media files.
    if (req.method === 'GET' && url.pathname === '/video') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return void res.end(`<!doctype html><html><head><title>Video page</title></head><body>
<h1>Video page</h1><canvas width="320" height="180" hidden></canvas><video width="640" height="360" muted playsinline></video>
<script>
const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
let frame = 0;
setInterval(() => { ctx.fillStyle = 'hsl(' + (frame++ * 7 % 360) + ' 70% 50%)'; ctx.fillRect(0, 0, 320, 180); }, 50);
const video = document.querySelector('video');
video.srcObject = canvas.captureStream(20);
video.play();
</script></body></html>`);
    }
    // An audible page with media-session metadata, like a music site.
    if (req.method === 'GET' && url.pathname === '/song') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return void res.end(`<!doctype html><html><head><title>Music player</title></head><body><h1>Music</h1>
<audio loop></audio>
<script>
// Browsers only start audio after the user interacts, so tests click the page first.
addEventListener('click', () => {
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const dest = ctx.createMediaStreamDestination();
  osc.connect(dest); osc.connect(ctx.destination); osc.start();
  const audio = document.querySelector('audio');
  audio.srcObject = dest.stream;
  audio.play();
}, { once: true });
navigator.mediaSession.metadata = new MediaMetadata({ title: 'Test Song', artist: 'The Fixtures' });
</script></body></html>`);
    }
    // Gmail's unread feed and an iCal calendar, for peeks.
    if (req.method === 'GET' && url.pathname === '/mail/u/0/feed/atom') {
      res.writeHead(200, { 'content-type': 'application/atom+xml; charset=utf-8' });
      return void res.end(`<?xml version="1.0" encoding="UTF-8"?><feed version="0.3" xmlns="http://purl.org/atom/ns#">
<fullcount>2</fullcount>
<entry><title>Lunch on Friday?</title><summary>Are you free at 1?</summary>
<link rel="alternate" href="${origin}/mail/u/0?message_id=lunch" type="text/html"/>
<issued>${new Date(Date.now() - 20 * 60_000).toISOString()}</issued><author><name>Ana</name><email>ana@example.com</email></author></entry>
<entry><title>Your receipt</title><summary>Order 1234</summary>
<link rel="alternate" href="${origin}/mail/u/0?message_id=receipt" type="text/html"/>
<issued>${new Date(Date.now() - 3 * 3_600_000).toISOString()}</issued><author><name>Shop</name><email>shop@example.com</email></author></entry>
</feed>`);
    }
    if (req.method === 'GET' && url.pathname === '/calendar.ics') {
      const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
      const start = new Date(Date.now() + 3_600_000);
      const end = new Date(start.getTime() + 30 * 60_000);
      res.writeHead(200, { 'content-type': 'text/calendar; charset=utf-8' });
      return void res.end(
        ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', 'UID:design-review', 'SUMMARY:Design review', `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`,
          'LOCATION:Room 4', 'DESCRIPTION:Join at https://meet.google.com/xyz-abcd-efg', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n'),
      );
    }
    if (req.method === 'GET' && url.pathname === '/mail/u/0') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return void res.end('<!doctype html><title>Mail message</title><h1>Message</h1>');
    }
    // Known colors at known places, for Capture.
    if (req.method === 'GET' && url.pathname === '/capture') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return void res.end(`<!doctype html><html><head><title>Capture page</title><style>
body { margin: 0; background: #ffffff; }
#red { position: absolute; left: 100px; top: 100px; width: 200px; height: 100px; background: rgb(255, 0, 0); }
#blue { position: absolute; left: 400px; top: 100px; width: 100px; height: 100px; background: rgb(0, 0, 255); }
</style></head><body><div id="red"></div><div id="blue"></div></body></html>`);
    }
    // A GitHub search API and an RSS feed, for Live Folders.
    if (req.method === 'GET' && url.pathname === '/gh/search/issues') {
      const authorized = req.headers.authorization === 'Bearer test-token';
      res.writeHead(authorized ? 200 : 401, { 'content-type': 'application/json', ...cors, 'access-control-allow-headers': '*' });
      return void res.end(
        JSON.stringify({
          items: authorized
            ? [{ id: 1, title: 'Add dark mode', html_url: 'https://github.com/acme/web/pull/7', number: 7, repository_url: 'https://api.github.com/repos/acme/web', updated_at: '2026-11-06T10:00:00Z', user: { login: 'ana' } }]
            : [],
          query: url.searchParams.get('q'),
        }),
      );
    }
    if (req.method === 'GET' && url.pathname === '/feed/publish') {
      feedPosts++;
      return void res.writeHead(204).end();
    }
    if (req.method === 'GET' && url.pathname === '/feed.xml') {
      const items = Array.from({ length: feedPosts }, (_, i) => i + 1)
        .reverse()
        .map((n) => `<item><title>Post ${n}</title><link>${origin}/page/news-${n % 2 ? 'a' : 'b'}?post=${n}</link><guid>post-${n}</guid></item>`)
        .join('');
      res.writeHead(200, { 'content-type': 'application/rss+xml; charset=utf-8' });
      return void res.end(`<?xml version="1.0"?><rss version="2.0"><channel><title>Fixture Blog</title>${items}</channel></rss>`);
    }
    if (req.method === 'GET' && url.pathname === '/login') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return void res.end(LOGIN_HTML);
    }
    if (req.method === 'GET' && url.pathname === '/img/cover.png') {
      res.writeHead(200, { 'content-type': 'image/png' });
      return void res.end(COVER_PNG);
    }
    if (req.method === 'GET' && url.pathname === '/files/inv_8812.pdf') {
      res.writeHead(200, { 'content-type': 'application/pdf', 'content-disposition': 'attachment; filename="inv_8812.pdf"' });
      return void res.end('%PDF-1.4 fake');
    }
    // SearXNG-shaped search API.
    if (req.method === 'GET' && url.pathname === '/searx/search') {
      res.writeHead(200, { 'content-type': 'application/json', ...cors });
      return void res.end(
        JSON.stringify({
          results: [
            { title: 'React tutorial blog', url: `${origin}/page/react-state`, content: 'Someone writes about React.' },
            { title: 'Hooks reference – React', url: `${origin}/page/react-hooks`, content: 'Official React docs.' },
            { title: 'Bad scheme', url: 'javascript:alert(1)', content: 'should be dropped' },
          ],
        }),
      );
    }

    if (req.method === 'GET' && url.pathname === '/v1/models') {
      res.writeHead(200, { 'content-type': 'application/json', ...cors });
      return void res.end(JSON.stringify({ data: [{ id: 'mock' }, { id: 'mock-b' }] }));
    }

    if (req.method === 'POST' && url.pathname === '/v1/chat/completions') {
      let raw = '';
      req.on('data', (chunk) => (raw += chunk));
      req.on('end', () => {
        const body = JSON.parse(raw) as { model: string; messages: { role: string; content: string }[] };
        const system = body.messages.find((m) => m.role === 'system')?.content ?? '';
        const user = body.messages.filter((m) => m.role === 'user').at(-1)?.content ?? '';
        requests.push({ system, user, body });
        const content = respond(body.model, body.messages, user, system);
        const reply = () => {
          res.writeHead(200, { 'content-type': 'application/json', ...cors });
          res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content } }] }));
        };
        // "mock-slow" answers after Tidy Downloads' 4 s deadline.
        if (body.model === 'mock-slow') setTimeout(reply, 6_000);
        else reply();
      });
      return;
    }

    res.writeHead(404).end();
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    origin: `http://127.0.0.1:${port}`,
    requests,
    gets,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      }),
  };
}

function respond(model: string, messages: { role: string; content: string }[], user: string, system: string): string {
  if (system.startsWith('You make a glanceable preview card')) {
    const title = /Title: (.*)/.exec(user)?.[1] ?? 'unknown';
    return JSON.stringify({ blocked: false, headline: `PREVIEW of "${title}"`, facts: [{ label: 'Topic', info: 'A short fixture page for tests' }] });
  }
  if (system.startsWith('You take notes')) {
    const numbers = [...user.matchAll(/<source n="(\d+)">/g)].map((m) => m[1]);
    return numbers.map((n) => `- note from source [${n}]`).join('\n');
  }
  if (system.startsWith('You answer from several browser tabs')) {
    const count = Math.max(...[...user.matchAll(/(?:<source n="|\[)(\d+)/g)].map((m) => Number(m[1])));
    const question = /Question: (.*)/.exec(user)?.[1];
    return `${question ? `ANSWER to "${question}".` : 'CROSS SUMMARY.'}\n- First point [1].\n- Second point [2][${count}].\n- Ignored citation [99].`;
  }
  if (system.startsWith('You give pinned browser tabs short, clear names')) {
    const lines = user.split('\n').filter((line) => /^\[\d+\]/.test(line));
    return JSON.stringify({
      titles: lines.map((line) => {
        const n = Number(/^\[(\d+)\]/.exec(line)![1]);
        return { tab: n, title: /Inbox/.test(line) ? 'Mail' : /Hooks/.test(line) ? '"React Hooks"' : `Tab ${n}` };
      }),
    });
  }
  if (system.startsWith('You are a quick assistant')) {
    const turns = messages.filter((m) => m.role === 'user').length;
    return `QUICK ANSWER ${turns} to "${user}"`;
  }
  if (system.startsWith('You turn what someone typed')) {
    if (/directions/i.test(user)) return JSON.stringify({ navigate: false, actions: [{ type: 'directions', query: '', origin: 'Zócalo', destination: 'Coyoacán' }] });
    if (/youtube/i.test(user)) return JSON.stringify({ navigate: false, actions: [{ type: 'site', site: 'youtube', query: 'lofi beats' }] });
    if (/reviews/i.test(user)) return JSON.stringify({ navigate: false, actions: [{ type: 'web', query: 'react reviews', count: 2 }] });
    return JSON.stringify({ navigate: true, actions: [{ type: 'web', query: `${user} official` }] });
  }
  if (system.startsWith("You answer someone's web search")) {
    const snippetOnly = /\(Only the search snippet is available\)/.test(user);
    return `BROWSE ANSWER for "${/Search: (.*)/.exec(user)?.[1]}". Hooks let components remember state [2].\n- State lives per component [1].${snippetOnly ? '\n- (some snippets)' : ''}`;
  }
  if (system.startsWith('You pick which search result')) return JSON.stringify({ best: 2, why: 'Official React documentation' });
  if (system.startsWith('You rename a file')) return JSON.stringify({ name: 'Acme invoice 8812.pdf' });

  if (user.includes('<tabs>')) {
    if (model === 'mock-bad') return JSON.stringify({ groups: [{ name: 'Broken', color: 'blue', tabs: [1, 99] }] });
    const lines = user.split('\n').filter((line) => /^\[\d+\]/.test(line));
    const byTopic = new Map<string, number[]>();
    for (const line of lines) {
      const ref = Number(/^\[(\d+)\]/.exec(line)![1]);
      const topic = /React/.test(line) ? 'React docs' : /weather/i.test(line) ? 'Weather' : /recipe/i.test(line) ? 'Recipes' : null;
      if (topic) byTopic.set(topic, [...(byTopic.get(topic) ?? []), ref]);
    }
    const colors = ['blue', 'cyan', 'orange'];
    // When the user's own groups are offered, React tabs join an existing "React docs" group.
    const existing = new Map([...user.matchAll(/\[(G\d+)\] "([^"]*)"/g)].map((m) => [m[2]!, m[1]!]));
    return '```json\n' + JSON.stringify({
      groups: [...byTopic].map(([name, tabs], i) =>
        existing.has(name) ? { existing: existing.get(name), tabs } : { name, color: colors[i], tabs },
      ),
    }) + '\n```';
  }
  const page = messages.find((m) => m.role === 'user')?.content ?? '';
  const title = /Title: (.*)/.exec(page)?.[1] ?? 'unknown';
  if (user.includes('Summarize this page')) return `MOCK SUMMARY of "${title}".\n- point one\n- point two`;
  // Ask Page answers quote the page; "bogus" asks for a quote the page doesn't have.
  if (/boil/i.test(user)) return `> Boil pasta for nine minutes, then toss with garlic and olive oil.\nBoil it for **nine minutes**.`;
  if (/bogus/i.test(user)) return `> Boil pasta for twenty minutes in salty water.\nAbout **twenty minutes**.`;
  return `MOCK ANSWER about "${title}" to: ${user.slice(0, 80)}`;
}
