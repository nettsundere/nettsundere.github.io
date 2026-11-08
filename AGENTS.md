# AGENTS.md

Guidance for AI agents and contributors working on this website.

## What the site is

- The owner's personal website: a home page, a résumé, a contact page and a blog.
- Plain HTML, CSS and a little JavaScript, hosted on GitHub Pages (`CNAME`: vladimir-kiselev.me).
- For now the owner uses it locally, to see how the fonts look on real pages; it is not being published. Agents never push it. The owner publishes.

## Design constraints

### Cool URLs don't change

Tim Berners-Lee's rule (W3C, 1998): a URL that someone may have linked to keeps working forever.

- Never rename, move or remove a page, a post, an image, a font file or an anchor (`id`) that a link may point to. The slugs and the folders stay as they are, in every language.
- Stylesheets and scripts keep their file names too. To make browsers fetch a changed file, add a version as a query string (`?v=N`) instead of renaming the file.
- If a page truly has to move, the old URL stays as a redirect page (as `ru-ru.html` does) that points to the new one.
- External links are changed only to keep them working, for example from `http://` to `https://` for the same address.

### The structure and the information architecture do not change

The site has four sections in every language: the home page, the résumé, the contact page and the blog, in that order in the navigation.

- The same pages exist, with the same sections in the same order, the same navigation items, the same headings and the same content on each page.
- A redesign changes how the site looks and feels, never what is where.
- A new page or a new section is the owner's decision, never an agent's.

### Sea of Love everywhere

- Every piece of text on every page uses Sea of Love, the owner's font: body text, headings, navigation, labels, dates, captions, and code too.
- Sea of Love covers Latin, Cyrillic and Chinese, so one face serves all three languages.
- A font stack may end with generic fallbacks (`sans-serif`), but no other named face comes before Sea of Love.
- This holds on custom pages too. The fonts post has a design of its own (`css/fonts-post.css`), and its text is still set in Sea of Love. Only its specimens use the fonts that they show (Lords, Lords Connected, Neftyanochka). A custom page uses another face only where the owner asks for it.
- The site's fonts are local files in `fonts/`. The site loads nothing from a font service.

### One theme: light

- The site has one theme, the light one. It has no dark theme and does not follow the system's dark mode.
- `:root` sets `color-scheme: light`, so that scrollbars and form controls stay light too.
- Contrast is checked for this one theme (WCAG AA at least).

### Three languages: English, Russian and Chinese

Every page and every post exists in all three languages, as three trees of the same shape.

| Language | Folder | `<html lang>` | `body data-lang` | Switcher |
|---|---|---|---|---|
| English | `/` | `en` | `en` | EN |
| Russian | `/ru-ru/` | `ru` | `ru` | RU |
| Chinese (Simplified) | `/zh-cn/` | `zh-CN` | `zh` | 中文 |

- Russian pages keep Russian file names: `ru-ru/rezyume.html` and `ru-ru/kontakty.html`. The English and Chinese trees use `resume.html` and `contact.html`. Blog posts use the same slug in all three trees.
- `ru-ru.html` and `zh-cn.html` at the root redirect to each language's home page.
- **The language switcher** shows EN / RU / 中文 in that order on every page, with the current language marked active. Each entry links to the same page in the other language, never to that language's home page.
- **The head of every page** names all three versions:
  - `hreflang` alternates for `en`, `ru`, `zh` and `x-default` (the English page);
  - `og:locale` for its own language and `og:locale:alternate` for the other two.
- **`sitemap.xml`** lists every page in every language, with the same alternates.
- **A page or post that is added or changed** is added or changed in all three languages in the same change. A page in one language only is a bug.
- **Chinese is written as Chinese.** Use full-width punctuation, with a space between Chinese characters and Latin words or numbers. Dates are written like 2026年10月10日.
- **Chinese must work on every page**, including pages with a design of their own, such as the fonts post and its `css/fonts-post.css`:
  - Han characters render in Sea of Love, as all text does. Even where a specimen font comes first in a stack, Sea of Love follows it, so Chinese never falls back to a system font.
  - `hanging-punctuation` is `none` under `:lang(zh)`, because full-width punctuation already carries its own space.
  - Letter-spacing and upper case on labels do not suit Chinese. They are reset under `:lang(zh)` where they hurt.
  - Chinese has no italic, so italic text is upright under `:lang(zh)`.
  - Vertical text is written as Chinese is written vertically: top to bottom, with the characters upright (`writing-mode: vertical-rl; text-orientation: mixed`), never Chinese turned on its side. Latin words inside it lie on their side, and short numbers such as 01 stand upright as one unit (`text-combine-upright`). English and Russian labels keep their turned style.
- **Chinese pages follow Chinese typographic tradition** (the W3C's *Requirements for Chinese Text Layout*, clreq). A Chinese reader should find nothing odd on them. The design adapts to the language; it is not the English page with Chinese letters poured in.
  - **Punctuation.** Chinese sentences use full-width punctuation: ，。、；：？！ and the quotation marks “” and ‘’ of Simplified Chinese (not 「」, which belong to Traditional Chinese and Japanese). Book and article titles take 《》. The ellipsis is …… and the dash is —— (two characters wide each).
  - **The red full stop after headings** is the Chinese full stop 。 on Chinese pages, never a Latin period after Chinese characters.
  - **Line breaking.** A line never starts with closing punctuation (，。、）》” and the like) or ends with opening punctuation (`line-break: strict`). There is no hyphenation, and words are not broken inside a two-character word where a narrow column can avoid it.
  - **Spacing.** A space separates Chinese characters from Latin words and numbers. There is no letter-spacing (tracking) on Chinese text, and no upper case, small caps or italics, because Chinese has none of them.
  - **Emphasis** is bold, or emphasis dots under the characters (`text-emphasis: filled dot; text-emphasis-position: under`), never italics.
  - **Size and line height.** Chinese body text needs more room than Latin: a line height of about 1.7 to 1.8, body text no smaller than the English body text, and labels no smaller than 12 px, so that the strokes stay apart.
  - **Paragraphs** are separated by space, as in most Chinese writing on the web. They are not also indented.
  - **Dates and names.** Dates read 2026年10月10日. A foreign name joins its parts with a middle dot: 弗拉基米尔·基谢廖夫.
  - **Vertical text** is read top to bottom with the characters upright (see the rule above).
- **Text that is not Chinese** on a Chinese page carries its own `lang` attribute. Examples are a font specimen in Latin or Cyrillic, or a quote in the original.

### Static only, no server

- The site is static files served as they are. It has no backend, no server code, no build step, no database and no forms that post anywhere. Any static file server can serve it (`npm run serve`).
- Links are relative, so the site works from any folder of any static server as well as from its domain.
- `js/transitions.js` swaps page bodies in place when a person clicks a link, and it does not run the new page's scripts. So no page depends on a script of its own: motion is CSS (scroll-driven animation), and the content reads without JavaScript.
- Fonts, stylesheets and scripts carry a version in a query string (`?v=N`). Raise it in every page that links the file whenever the file changes, so that browsers do not show the old one. The `@v=N` in some existing file names is part of the name and stays (see Cool URLs don't change).

### Metadata and the structured-data graph

Every page carries metadata that search engines and link previews read. Nobody sees it on the page, so `tests/e2e/meta.spec.js` checks it.

- **Canonical and hreflang.** Each page names itself as canonical, and links its three language versions plus `x-default` (the English page). Each version links back.
- **Open Graph and Twitter.** `og:url` is the canonical URL, and `og:locale` is the page's language (`en_US`, `ru_RU` or `zh_CN`), with the other two as `og:locale:alternate`. `og:site_name` and `author` are the owner's name in the page's language. `twitter:title` equals `og:title`.
- **The JSON-LD graph (schema.org).** Every page has a `<script type="application/ld+json">` block. A search engine joins the blocks of all pages into one graph by their `@id`, so the nodes must agree:
  - **One person:** `https://vladimir-kiselev.me/#person`. Every page that names the owner uses this `@id`. The facts that do not depend on the language are the same everywhere: `url` (the site root), `image`, `sameAs` and `email`. The facts that are written in a language (`name`, `jobTitle`, `address`, `knowsAbout`, `alumniOf`) are the same on every page of that language. The full person is described on the home page; other pages may repeat it or refer to it by `@id`.
  - **One website per language:** `WebSite` with `@id` `<language home>#website` (`https://vladimir-kiselev.me/#website`, `…/ru-ru/#website`, `…/zh-cn/#website`), published by the person.
  - **Pages:** the résumé is a `ProfilePage` about the person, the contact page a `ContactPage`, and each blog index a `Blog`.
  - **Posts:** each post is a `BlogPosting`. Its `headline` is the post's heading without the decorative full stop. `url` and `mainEntityOfPage` are its canonical URL. `datePublished` is the date in its slug and on the page, and `inLanguage` is its language. `author` and `publisher` are the person. A post moved from Medium has `isBasedOn`, its Medium URL, which is the same link as the note at its end. The date, the original and the publisher are the same in all three languages.
- **The sitemap** lists every page in every language with the same alternates.
- **A change to any of these facts** (a new job title, a new profile link) is made on every page in every language at once. Then `meta.spec.js` must pass.

### Security

The site is static and takes no input, so the attack surface is small. These rules keep it small:

- Nothing is loaded from another host: no scripts, styles, fonts, frames, trackers or analytics.
- No forms, no inline event handlers (`onclick=`), no `javascript:` URLs, and no HTML built from strings in scripts (`innerHTML`, `document.write`, `eval`).
- Every page carries a Content Security Policy in a `<meta http-equiv="Content-Security-Policy">` tag, because GitHub Pages cannot send headers. It allows only the site's own files. The one inline script, which swaps the `no-js` class, is allowed by its hash. Style attributes are allowed (`style-src-attr 'unsafe-inline'`), because the fonts post uses a few and the page swap keeps the first page's policy for every page after it; stylesheets and scripts still come only from the site. Every page carries the same policy, and `meta.spec.js` checks it. A new inline script needs its hash added to every page, so move scripts into `js/` instead.
- Every page sets `<meta name="referrer" content="strict-origin-when-cross-origin">`.
- External links use `https://`. A link that opens a new tab carries `rel="noopener"`.
- `js/transitions.js` fetches pages of the same origin only, and never runs scripts from a fetched page.
- The development tools (Playwright, http-server) are checked with `npm audit`, which must report no vulnerabilities.

### Usability: Jakob Nielsen's ten heuristics

Judge every change against all ten. For this site they mean:

1. **Visibility of system status.** The current page is marked in the navigation, and the current language in the switcher. Links look like links.
2. **Match with the real world.** Each language uses its readers' own words, dates and punctuation, not a word-for-word translation.
3. **User control and freedom.** Back and forward work, including after an in-place page swap. A person can always reach the home page, the blog index and the other languages.
4. **Consistency and standards.** The same header, navigation, switcher and footer on every page, in the same places, in every language.
5. **Error prevention.** No broken links, missing images or pages missing in one language. The tests check this.
6. **Recognition rather than recall.** Posts link to the older and newer post and back to the index. The switcher keeps the reader on the same page.
7. **Flexibility and efficiency of use.** Pages work with the keyboard alone, and the focus is visible.
8. **Aesthetic and minimalist design.** Every element earns its place. Nothing is added that the reader does not need for the current page.
9. **Help users recognise and recover from errors.** A missing page should not happen. Where a reader can go wrong, the page says what to do next.
10. **Help and documentation.** The site needs none. If a page needs explaining, the page is redesigned.

### In-place page changes, without blinking

The site keeps its own Turbolinks-like navigation in `js/transitions.js`. The owner wants it kept: it stops the white flash between pages.

- A click on a link to another page of the site fetches that page and swaps in its `<body>` in place. The document is not loaded again, so the header, the fonts and the stylesheets stay on screen and nothing blinks.
- The address bar, the title, Back and Forward and the scroll position behave as with an ordinary navigation (`history.pushState`, `popstate`).
- Where the browser supports it, the swap runs inside a View Transition, as an enhancement on top of the swap, never instead of it.
- Pages that are fetched are kept in memory, and links are fetched in advance when the pointer rests on them or the keyboard reaches them.
- After a swap, the keyboard focus moves to the new page's heading, so a screen reader announces the new page and the next Tab starts there.
- Each history entry remembers where the reader left it, so Back and Forward return to that place, not to the top.
- The new page's scripts do not run. Shared behaviour lives in `js/app.js` and is wired again after each swap.
- The swap also copies the new page's `<html lang>` and body attributes (`data-page`, `data-lang`), so a page in another language is read in its own language.
- A link with a modifier key or a `target`, a link to a file or to another site, and any failure fall back to an ordinary navigation. So the site works the same with the script off.
- Do not replace this script with full page loads or with cross-document View Transitions alone. `tests/e2e/transitions.spec.js` checks that a click swaps the page without a reload, and that Back and Forward work.

### One separator at a time

- A separator (a line, a border or a rule) divides two pieces of content. Two separators never follow each other with only space between them.
- The red rule under a page's heading is the only line there. The list below it does not open with a line of its own.
- The last item of a list has no line under it, because the footer's line follows.

### The design system

Two stylesheets carry the design: `css/app.css@v=1.css` for every page, and `css/blog.css` for the blog index and the posts. The fonts post has its own stylesheet and takes none of this.

**Layers.** `app.css` names the cascade layers in order: reset, tokens, base, grid, type, components, utilities, motion, print. `blog.css` adds its rules to the same layers. A later layer wins over an earlier one, whatever the selectors.

**Tokens.** Every colour, size, space and duration is a custom property on `:root`. Components use the tokens, never raw values.

- Colours are OKLCH, in one light theme:
  - `--paper` is the warm ground of the page, `--surface` a lighter ground for code and notes, and `--plate` the ground behind pictures.
  - `--ink` is the text (16.7:1 on the paper), and `--muted` the secondary text (6.3:1).
  - `--red` is the brand red, #e3000f. It fills shapes: the square, the wave, the block behind the portrait.
  - `--red-text` is a darker red for red text (5.4:1), because small text needs more contrast than a shape.
  - `--rule` (the ink) draws strong lines, and `--hairline` draws the thin lines between rows. `--focus` colours the focus ring.
- Text sizes are fluid. Each `--text-*` token grows with the window between a phone and 1440 px (`clamp()`). `--text-read` is the size of long text and posts.
- Line heights are `--leading-body`, `--leading-read`, `--leading-snug` and `--leading-tight`. Chinese pages set their own values.
- Spaces run from `--space-3xs` to `--space-2xl`, and grow with the window. `--gutter` is the space between columns and at the page edge.
- Durations are `--dur-quick` (160 ms), `--dur-base` (280 ms) and `--dur-slow` (480 ms), with the curves `--ease-out` and `--ease-in-out`.

**The grid.** The page has twelve columns on a desktop, six between 560 and 900 px, and one below 560 px.

- Columns 1 to 3 hold labels. The text column starts at column 4: the navigation, the section text, the résumé, the contact list and the blog list all start there.
- The lists use subgrid, so their rows share the page's columns.

**Type.** All text is set in Sea of Love, code too.

- The display heading (`h1.display`) is upper case. Its size follows the width of the hero (container query units), so that the longest word, РЕЗЮМЕ. at 4.12 em, fits on one line at 320 px.
- Labels use Sea of Love's own small capitals (`font-variant-caps: all-small-caps`).
- Dates and numbers use figures of equal width (`tabular-nums`). Code turns ligatures off and uses the slashed zero.
- Headings balance their lines (`text-wrap: balance`), and paragraphs avoid a short last line (`text-wrap: pretty`).

**The signs of the site.**

- **The red square.** The full stop of every big heading shows as a red square on the baseline. CSS draws it; the character stays in the text, for copying and for screen readers. On Chinese pages the character is 。, and the square sits low at the left of a full-width cell, where 。 sits. The same square marks the current page in the navigation.
- **The red wave.** The line under each page's heading (`hr.rule-red`) is a sine wave. `images/sine-wave.svg` draws y = sin(x) over 64 periods with a 2-px stroke, and the CSS uses it as a mask over `--red`. The CSS sets the wavelength (about 32 px on a phone, 42 px at 1440 px) so that whole periods fill the line. So both ends fall on the midline, where a round cap closes each one. The wave does not move. Print shows a plain black line.
- The VK mark stands over the role at the top left. A vertical label runs down the hero's first column. The portrait is grey on a red block, and turns to colour on hover.

**Links and focus.**

- Links in text are underlined. On hover the underline thickens and the link turns red.
- The current page in the navigation is red, has no underline, and carries the red square, so colour is not the only sign. The current language in the switcher is red, bold and not a link.
- Everything that takes the focus shows a 2-px red ring with room around it.

**Motion.** Motion is an enhancement: the pages read the same without it, and a person who asks the system for reduced motion gets none of it, except the reading bar.

- A page change runs as a View Transition: the page fades, the header stays still, and the red square of the heading travels to the next page's heading.
- The portrait drifts down a little as the page scrolls (a scroll-driven animation in CSS).
- A 3-px red bar at the top of a post shows how far the reader has read. The reader's own scrolling drives it, so it stays with reduced motion too.
- Nothing moves on its own for more than a moment: no cursor effects, no links that follow the pointer, no looping animation. Content never fades in as the page scrolls.

**Per-language typography.**

- English and Russian hang punctuation in the margin where the browser can.
- On a phone, Russian text breaks words at syllables, with at least three letters on each side. English posts do the same. Chinese never does.
- Chinese follows the rules in "Chinese pages follow Chinese typographic tradition". In the CSS this means:
  - line heights of 1.75 for body text and 1.8 for posts;
  - no tracking, small capitals or italics;
  - emphasis in bold, because emphasis dots need more room than this line height leaves and would push their lines apart;
  - `line-break: strict`, and labels of 14 px and more;
  - the hero's label set vertically, with upright characters. Its number is wrapped in `<span class="number">` and stands upright as one unit (`text-combine-upright: all`). Its separator is ⋯, which turns into vertical dots.
- Sea of Love's `locl` feature gives Chinese pages the Chinese forms of “ ”, —— and …….

**Posts.**

- On a wide screen the text runs on columns 4 to 10, about 70 characters a line. Pictures and code may take one column more.
- Pictures keep their own size and are never enlarged. They sit on `--plate` with a hairline edge.
- Code blocks sit on `--surface` with an ink line on the left. A code block that scrolls sideways can take the keyboard focus (`js/app.js`).
- Lists mark their items with red squares, and quotations have a red line on the left.
- The note at the end ("Originally posted on Medium") opens with a short line, as a footnote does.

### Other rules

- **Phone width.** Every page fits a 320-px wide screen without horizontal scrolling.
- **Accessibility.** Images have `alt` text, the document language is right, headings are in order, and nothing is shown by colour alone.
- **The fonts post** (`blog/10-10-2026-a-couple-of-fonts.html` in each language) has its own stylesheet and ignores the blog design. Its specimens show the fonts' own letters and stay in their original language in every version.
- **The owner's name.** Vladimir Kiselev in English, Владимир Киселёв in Russian (always with ё, in every form: Киселёва, Киселёву), and 弗拉基米尔·基谢廖夫 in Chinese. A test checks the ё.
- **Writing about the owner.** Do not refer to the owner with gendered pronouns.

## Adding a blog post

Do all of this in the same change:

1. Write the post in all three folders (`blog/`, `ru-ru/blog/`, `zh-cn/blog/`) with the same slug.
2. Add it to the three blog indexes (`blog.html`, `ru-ru/blog.html`, `zh-cn/blog.html`), newest first.
3. Link the previous post's "Newer" link to it, in each language.
4. Add it to `sitemap.xml` with its alternates.
5. Add its slug to `SLUGS` in `tests/e2e/blog.spec.js`. A post written for this site, not moved from Medium, also goes in `ORIGINAL`.

## Tests

The tests are Playwright end-to-end tests in `tests/e2e/`. They run against a static server, which Playwright starts on port 8080 or reuses if one is running.

```sh
npm install
npx playwright test --project=chromium --project=webkit
```

- Firefox crashes in the agents' sandbox, so agents run Chromium and WebKit. The owner can run all three with `npx playwright test`.
- The tests check, for every page and post in every language:
  - that it loads without errors, with the right language and metadata;
  - the navigation and the language switcher;
  - the older and newer links;
  - that it fits 320 px;
  - that the metadata and the JSON-LD graph agree on every page and across the site (`meta.spec.js`);
  - that every Chinese character is drawn in Sea of Love (`chinese.spec.js`, Chromium only).
- `npm audit` reports no vulnerabilities.
- A change is done when these tests pass.
