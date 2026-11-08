// @ts-check
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

/**
 * The metadata of every page: canonical and hreflang links, Open Graph and
 * Twitter tags, the JSON-LD graph (schema.org) and the sitemap. Search
 * engines and link previews read these, and nobody sees them on the page,
 * so a mistake would go unnoticed without this check.
 *
 * Metadata does not depend on the browser, so these tests run in one.
 */

const ROOT = path.join(__dirname, '..', '..');
const SITE = 'https://vladimir-kiselev.me/';
const LANGS = {
  en: { hreflang: 'en', locale: 'en_US', name: 'Vladimir Kiselev', home: '' },
  ru: { hreflang: 'ru', locale: 'ru_RU', name: 'Владимир Киселёв', home: 'ru-ru/' },
  'zh-CN': { hreflang: 'zh', locale: 'zh_CN', name: '弗拉基米尔·基谢廖夫', home: 'zh-cn/' },
};
/** Pages that only redirect to a language's home page. */
const REDIRECTS = new Set(['ru-ru.html', 'zh-cn.html']);

/** Every HTML page of the site, as a path relative to its root. */
function pages() {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = path.posix.join(dir, e.name);
      if (e.isDirectory()) {
        if (!['node_modules', 'tests', 'test-results', 'playwright-report', '.git'].includes(e.name)) walk(rel);
      } else if (e.name.endsWith('.html') && !REDIRECTS.has(rel)) {
        out.push(rel);
      }
    }
  };
  walk('.');
  return out.map((p) => p.replace(/^\.\//, '')).sort();
}

/** The public URL of a page. */
const urlOf = (rel) => SITE + rel.replace(/(^|\/)index\.html$/, '$1');
/** The local path that serves a public URL. */
const localOf = (url) => '/' + url.slice(SITE.length).replace(/(^|\/)$/, '$1index.html');

const PAGES = pages();
const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');

/** Reads a page's metadata in the browser. */
async function readMeta(page) {
  return page.evaluate(() => {
    const attr = (sel, a) => document.querySelector(sel)?.getAttribute(a) ?? null;
    const metas = (k) =>
      [...document.querySelectorAll(`meta[property="${k}"], meta[name="${k}"]`)].map((m) => m.getAttribute('content'));
    const alternates = {};
    for (const l of document.querySelectorAll('link[rel="alternate"][hreflang]')) {
      alternates[l.getAttribute('hreflang')] = l.getAttribute('href');
    }
    const h1 = document.querySelector('h1');
    return {
      lang: document.documentElement.lang,
      canonical: [...document.querySelectorAll('link[rel="canonical"]')].map((l) => l.getAttribute('href')),
      alternates,
      og: {
        url: metas('og:url'),
        locale: metas('og:locale'),
        alternateLocales: metas('og:locale:alternate'),
        title: metas('og:title'),
        description: metas('og:description'),
        image: metas('og:image'),
        siteName: metas('og:site_name'),
      },
      twitter: { title: metas('twitter:title'), image: metas('twitter:image') },
      description: metas('description'),
      author: metas('author'),
      ld: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent),
      // the heading as a reader sees it, without the red full stop (. or 。)
      h1: h1 ? h1.textContent.replace(/\s+/g, ' ').trim().replace(/[.。]$/, '') : null,
      time: attr('time[datetime]', 'datetime'),
      medium: attr('.medium-note a', 'href'),
    };
  });
}

for (const rel of PAGES) {
  test.describe(`metadata: ${rel}`, () => {
    test.skip(({ browserName }) => browserName !== 'chromium', 'metadata is the same in every browser');

    test('canonical, hreflang, Open Graph, JSON-LD and sitemap agree', async ({ page }) => {
      const res = await page.goto('/' + rel);
      expect(res?.status()).toBe(200);
      const m = await readMeta(page);
      const L = LANGS[m.lang];
      expect(L, `html lang ${m.lang}`).toBeTruthy();
      const me = urlOf(rel);

      // canonical and hreflang
      expect(m.canonical).toEqual([me]);
      expect(Object.keys(m.alternates).sort()).toEqual(['en', 'ru', 'x-default', 'zh']);
      expect(m.alternates[L.hreflang], 'its own alternate is itself').toBe(me);
      expect(m.alternates['x-default'], 'x-default is the English page').toBe(m.alternates.en);
      for (const [hreflang, url] of Object.entries(m.alternates)) {
        expect(url.startsWith(SITE), url).toBe(true);
        const other = await page.request.get(localOf(url));
        expect(other.status(), `${hreflang} ${url}`).toBe(200);
        if (hreflang === 'x-default' || hreflang === L.hreflang) continue;
        // the other version links back
        const back = (await other.text()).match(
          new RegExp(`<link rel="alternate" hreflang="${L.hreflang}" href="([^"]+)"`)
        );
        expect(back?.[1], `${url} links back to ${me}`).toBe(me);
      }

      // Open Graph and Twitter
      expect(m.og.url).toEqual([me]);
      expect(m.og.locale).toEqual([L.locale]);
      expect([...m.og.alternateLocales].sort()).toEqual(
        Object.values(LANGS).map((x) => x.locale).filter((x) => x !== L.locale).sort()
      );
      expect(m.og.siteName).toEqual([L.name]);
      expect(m.og.title.length).toBe(1);
      expect(m.og.description.length).toBe(1);
      expect(m.description.length).toBe(1);
      expect(m.twitter.title).toEqual(m.og.title);
      for (const img of [...m.og.image, ...m.twitter.image]) {
        expect((await page.request.get(localOf(img))).status(), img).toBe(200);
      }
      if (m.author.length) expect(m.author).toEqual([L.name]);

      // the JSON-LD graph
      expect(m.ld.length, 'a JSON-LD block').toBeGreaterThan(0);
      for (const block of m.ld) {
        const data = JSON.parse(block);
        expect(data['@context']).toBe('https://schema.org');
        const nodes = data['@graph'] ?? [data];
        for (const n of nodes) {
          if ('inLanguage' in n) expect(n.inLanguage, `${n['@type']} inLanguage`).toBe(m.lang);
          if (n['@type'] === 'Person') {
            expect(n['@id']).toBe(`${SITE}#person`);
            expect(n.name).toBe(L.name);
          }
          if (n['@type'] === 'WebSite') expect(n.url).toBe(SITE + L.home);
          if (n['@type'] === 'BlogPosting') {
            expect(n.url).toBe(me);
            expect(n.mainEntityOfPage).toBe(me);
            expect(n.headline).toBe(m.h1);
            expect(n.author).toEqual({ '@type': 'Person', '@id': `${SITE}#person`, name: L.name });
            const [, dd, mm, yyyy] = rel.match(/(\d\d)-(\d\d)-(\d{4})-[^/]+\.html$/) ?? [];
            expect(n.datePublished, 'the date in the slug').toBe(`${yyyy}-${mm}-${dd}`);
            expect(m.time, 'the date on the page').toBe(n.datePublished);
            if (m.medium) expect(n.isBasedOn, 'the Medium original').toBe(m.medium);
            else expect(n.isBasedOn).toBeUndefined();
          }
        }
      }

      // the sitemap
      expect(sitemap, `sitemap lists ${me}`).toContain(`<loc>${me}</loc>`);
    });
  });
}

/**
 * The JSON-LD of all pages read together, as a search engine merges it by
 * `@id`: one person, one website per language, and posts whose facts agree
 * across their three languages.
 */
test.describe('the JSON-LD graph across the site', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'the files are the same in every browser');

  /** Every node of every page, with the page and its language. */
  const nodes = [];
  const collect = (n, rel, lang) => {
    if (Array.isArray(n)) return n.forEach((x) => collect(x, rel, lang));
    if (!n || typeof n !== 'object') return;
    if (n['@type']) nodes.push({ node: n, rel, lang });
    for (const [k, v] of Object.entries(n)) if (k !== '@context') collect(v, rel, lang);
  };
  for (const rel of PAGES) {
    const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const lang = text.match(/<html lang="([^"]+)"/)[1];
    for (const [, block] of text.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      const data = JSON.parse(block);
      collect(data['@graph'] ?? data, rel, lang);
    }
  }
  const persons = nodes.filter((x) => x.node['@type'] === 'Person');

  test('every page names the same person, with the same facts', () => {
    expect(persons.length).toBeGreaterThan(0);
    // facts that do not depend on the language
    const SAME = ['@id', 'url', 'image', 'sameAs', 'email'];
    const first = {};
    for (const { node, rel } of persons) {
      expect(node['@id'], rel).toBe(`${SITE}#person`);
      for (const k of SAME) {
        if (!(k in node)) continue;
        first[k] ??= { value: node[k], rel };
        expect(node[k], `${k} on ${rel} (first seen on ${first[k].rel})`).toEqual(first[k].value);
      }
      if (node.address) expect(node.address.addressCountry, rel).toBe('RU');
    }
  });

  test('within a language, the person reads the same on every page', () => {
    // facts written in the page's language
    const LOCAL = ['name', 'alternateName', 'givenName', 'familyName', 'jobTitle', 'address', 'knowsAbout', 'alumniOf'];
    const first = {};
    for (const { node, rel, lang } of persons) {
      for (const k of LOCAL) {
        if (!(k in node)) continue;
        const key = `${lang} ${k}`;
        first[key] ??= { value: node[k], rel };
        expect(node[k], `${key} on ${rel} (first seen on ${first[key].rel})`).toEqual(first[key].value);
      }
    }
  });

  test('each language has one website, published by the person', () => {
    const sites = nodes.filter((x) => x.node['@type'] === 'WebSite');
    expect(sites.map((x) => x.lang).sort()).toEqual(Object.keys(LANGS).sort());
    for (const { node, lang } of sites) {
      expect(node['@id']).toBe(`${SITE}${LANGS[lang].home}#website`);
      expect(node.url).toBe(`${SITE}${LANGS[lang].home}`);
      expect(node.publisher).toEqual({ '@id': `${SITE}#person` });
    }
  });

  test("a post's date and original agree in all three languages", () => {
    const posts = {};
    for (const { node, rel } of nodes.filter((x) => x.node['@type'] === 'BlogPosting')) {
      const slug = rel.split('/').pop();
      (posts[slug] ??= []).push({ node, rel });
    }
    for (const [slug, copies] of Object.entries(posts)) {
      expect(copies.length, `${slug} in three languages`).toBe(3);
      for (const k of ['datePublished', 'isBasedOn', 'publisher']) {
        const values = copies.map((c) => JSON.stringify(c.node[k]));
        expect(new Set(values).size, `${k} of ${slug}: ${values.join(' / ')}`).toBe(1);
      }
    }
  });
});

/** The owner's name is spelt with ё in Russian, in every form (Киселёв, Киселёва). */
test('Russian text spells the name Киселёв, with ё', ({ browserName }) => {
  test.skip(browserName !== 'chromium', 'the files are the same in every browser');
  const wrong = [];
  for (const rel of [...PAGES, 'ru-ru.html', 'sitemap.xml']) {
    const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const count = (text.match(/[Кк]иселев/g) ?? []).length;
    if (count) wrong.push(`${rel}: ${count}`);
  }
  expect(wrong, `Киселев without ё:\n${wrong.join('\n')}`).toEqual([]);
});

/**
 * Every page carries the same Content Security Policy and referrer policy
 * (GitHub Pages sends no headers, so they live in the page). The page swap
 * keeps the first page's policy, which is why every page has the same one.
 */
test('every page carries the same security policy', ({ browserName }) => {
  test.skip(browserName !== 'chromium', 'the files are the same in every browser');
  const policies = new Map();
  for (const rel of [...PAGES, 'ru-ru.html', 'zh-cn.html']) {
    const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const csp = text.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)?.[1];
    expect(csp, `${rel} has a Content Security Policy`).toBeTruthy();
    expect(text, `${rel} has a referrer policy`).toContain('<meta name="referrer" content="strict-origin-when-cross-origin">');
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(/script-src[^;]*'unsafe-inline'/.test(csp), `${rel} lets inline scripts run`).toBe(false);
    policies.set(csp, rel);
  }
  expect([...policies.keys()].length, 'one policy for the whole site').toBe(1);
});
