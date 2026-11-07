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

function articleHtml(slug: string): string {
  const page = PAGES[slug]!;
  return `<!doctype html><html lang="en"><head><title>${page.title}</title>
<meta name="description" content="Fixture page ${slug}"></head><body>
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
<p><a id="paris" href="${origin}/page/weather-paris">Paris weather</a></p>
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
    if (req.method === 'GET' && url.pathname === '/login') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return void res.end(LOGIN_HTML);
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
  if (system.startsWith('You preview a linked webpage')) {
    const title = /Title: (.*)/.exec(user)?.[1] ?? 'unknown';
    return `PREVIEW of "${title}". It is a short fixture page.`;
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
  return `MOCK ANSWER about "${title}" to: ${user.slice(0, 80)}`;
}
