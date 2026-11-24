const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("controles móveis mantêm suas posições originais e não possuem arraste", () => {
  const headerCss = read("app/public/css/header.css");
  const chatbotCss = read("app/public/css/chatbot.css");
  const accessibilityPartial = read("app/views/partials/accessibility-controls.ejs");
  const chatbotPartial = read("app/views/partials/chatbot.ejs");

  assert.equal(fs.existsSync(path.join(root, "app/public/js/mobile-floating-controls.js")), false);
  assert.doesNotMatch(headerCss, /mobile-floating-control|touch-action:\s*none|pointerdown|pointermove|pointerup/);
  assert.doesNotMatch(chatbotCss, /mobile-floating-control|touch-action:\s*none|pointerdown|pointermove|pointerup/);
  assert.doesNotMatch(accessibilityPartial, /mobile-floating|reposicionar|ArrowLeft|aria-describedby/);
  assert.doesNotMatch(chatbotPartial, /mobile-floating|reposicionar|ArrowLeft|aria-describedby/);
  assert.match(headerCss, /@media \(max-width: 767\.98px\)[\s\S]*\.accessibility-controls\s*\{[\s\S]*grid-column:\s*3/);
  assert.match(chatbotCss, /@media \(max-width: 767\.98px\)[\s\S]*\.chatbot-trigger\s*\{[\s\S]*right:\s*12px[\s\S]*bottom:/);
});

test("controles de acessibilidade expõem todas as ações sem elementos independentes", () => {
  const partial = read("app/views/partials/accessibility-controls.ejs");

  assert.match(partial, /class="accessibility-trigger"/);
  assert.match(partial, /aria-label="Abrir painel de acessibilidade"/);
  assert.match(partial, /aria-expanded="false"/);
  assert.match(partial, /aria-controls="accessibility-panel"/);
  assert.match(partial, /data-accessibility-action="decrease-font"/);
  assert.match(partial, /data-accessibility-action="reset-font"/);
  assert.match(partial, /data-accessibility-action="increase-font"/);
  assert.match(partial, /data-accessibility-action="toggle-contrast"/);
  assert.match(partial, /data-accessibility-action="toggle-links"/);
  assert.match(partial, /data-accessibility-action="toggle-motion"/);
  assert.match(partial, /aria-pressed="false"/);
  assert.match(partial, /role="group"/);
});

test("preferências cobrem fonte, contraste, links e movimento com localStorage", () => {
  const script = read("app/public/js/accessibility.js");

  assert.match(script, /STORAGE_KEY\s*=\s*"climafy-accessibility"/);
  assert.match(script, /fontScale/);
  assert.match(script, /highContrast/);
  assert.match(script, /highlightLinks/);
  assert.match(script, /reduceMotion/);
  assert.match(script, /window\.localStorage\.setItem/);
  assert.match(script, /window\.localStorage\.getItem/);
  assert.match(script, /aria-expanded/);
  assert.match(script, /event\.key\s*===\s*"Escape"/);
  assert.match(script, /closePanel\(true\)/);
});

test("CSS possui estados visuais e respeita preferência reduzida do sistema", () => {
  const css = read("app/public/css/tokens.css");

  assert.match(css, /accessibility-highlight-links/);
  assert.match(css, /text-decoration-thickness/);
  assert.match(css, /accessibility-reduce-motion/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /\*:focus-visible/);
});

test("mobile público mantém logo centralizada acima do painel", () => {
  const css = read("app/public/css/header.css");
  assert.match(css, /@media \(max-width: 767\.98px\) \{[\s\S]*flex-direction:\s*row/);
  assert.match(css, /@media \(max-width: 767\.98px\) \{[\s\S]*\.brand-logo\s*\{[\s\S]*justify-content:\s*flex-start/);
  assert.match(css, /@media \(max-width: 767\.98px\) \{[\s\S]*\.accessibility-controls\s*\{[\s\S]*position:\s*relative/);
  assert.match(css, /@media \(max-width: 767\.98px\) \{[\s\S]*\.accessibility-panel\s*\{[\s\S]*position:\s*absolute[\s\S]*top:/);
  assert.match(css, /@media \(max-width: 767\.98px\) \{[\s\S]*\.accessibility-trigger\s*\{[\s\S]*border-radius:\s*50%/);
  assert.match(css, /@media \(max-width: 767\.98px\) \{[\s\S]*\.accessibility-panel\s*\{[\s\S]*grid-template-columns/);
  assert.match(css, /@media \(max-width: 767\.98px\) \{[\s\S]*backdrop-filter:\s*blur/);
});

test("mobile reutiliza linguagem visual do menu inferior", () => {
  const css = read("app/public/css/header.css");

  assert.match(css, /@media \(max-width: 767\.98px\) \{[\s\S]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.78\)/);
  assert.match(css, /@media \(max-width: 767\.98px\) \{[\s\S]*backdrop-filter:\s*blur\(16px\)\s*saturate\(170%\)/);
  assert.match(css, /@media \(max-width: 767\.98px\) \{[\s\S]*border-radius:\s*24px/);
  assert.match(css, /@media \(max-width: 767\.98px\) \{[\s\S]*box-shadow:\s*0 18px 44px/);
  assert.match(css, /@media \(max-width: 767\.98px\) \{[\s\S]*\[aria-pressed="true"\][\s\S]*background:\s*#fff/);
});

test("desktop público reaproveita transparência e blur do cabeçalho", () => {
  const css = read("app/public/css/header.css");

  assert.match(css, /@media \(min-width: 768px\) \{[\s\S]*\.accessibility-controls\s*\{[\s\S]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.58\)/);
  assert.match(css, /@media \(min-width: 768px\) \{[\s\S]*\.accessibility-controls\s*\{[\s\S]*backdrop-filter:\s*blur\(16px\)\s*saturate\(170%\)/);
  assert.match(css, /@media \(min-width: 768px\) \{[\s\S]*\.accessibility-controls\s*\{[\s\S]*border-radius:\s*999px/);
  assert.match(css, /@media \(min-width: 768px\) \{[\s\S]*\.accessibility-button\s*\{[\s\S]*border-radius:\s*999px/);
});

test("navegação desktop usa grade compartilhada sem deslocar links", () => {
  const css = read("app/public/css/header.css");

  assert.match(css, /@media \(min-width: 768px\) \{[\s\S]*\.main-header\s*\{[\s\S]*display:\s*grid/);
  assert.match(css, /@media \(min-width: 768px\) \{[\s\S]*\.main-header \.main-nav\s*\{[\s\S]*justify-self:\s*center[\s\S]*margin:\s*0/);
  assert.match(css, /@media \(min-width: 768px\) \{[\s\S]*\.main-header \.main-nav a\.is-active\s*\{[\s\S]*font-weight:\s*600/);
  assert.match(css, /@media \(min-width: 768px\) and \(max-width: 1050px\) \{[\s\S]*grid-template-columns:\s*auto minmax\(0,\s*1fr\)\s*auto/);
});
