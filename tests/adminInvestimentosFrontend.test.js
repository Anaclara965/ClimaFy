const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class Element {
  constructor() {
    this.listeners = {};
    this.dataset = {};
    this.classes = new Set();
    this.classList = { toggle: (name, active) => active ? this.classes.add(name) : this.classes.delete(name) };
    this.open = false;
    this._text = '';
  }

  set innerHTML(value) { this._html = value; }
  get innerHTML() { return this._html || ''; }
  set textContent(value) { this._text = String(value); }
  get textContent() { return this._text; }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  showModal() { this.open = true; }
  close() { this.open = false; }
}

test('investimentos: detalhes mostram o registro selecionado e ações de cadastro/edição não são exibidas', () => {
  const elements = new Map();
  const document = {
    body: { dataset: { adminPage: 'investimentos' } },
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, new Element());
      return elements.get(selector);
    },
    querySelectorAll() { return []; },
  };
  const contexto = vm.createContext({ document, window: {}, setTimeout, clearTimeout });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../app/public/js/adm-areas.js'), 'utf8'), contexto);

  const body = document.querySelector('#area-table-body');
  assert.match(body.innerHTML, /data-details="#INV-091"/);
  assert.doesNotMatch(body.innerHTML, />Editar</);
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname, '../app/views/pages/adm-investimentos.ejs'), 'utf8'), /Novo investimento/);

  const detailsButton = { dataset: { details: '#INV-091' } };
  body.listeners.click({
    target: {
      closest(selector) {
        return selector === '[data-details]' ? detailsButton : null;
      },
    },
  });

  assert.equal(document.querySelector('#investment-details').open, true);
  assert.equal(document.querySelector('#investment-detail-id').textContent, '#INV-091');
  assert.equal(document.querySelector('#investment-detail-name').textContent, 'Novos pontos de hidratação');
  assert.equal(document.querySelector('#investment-detail-place').textContent, 'Pinheiros');
  assert.equal(document.querySelector('#investment-detail-amount').textContent, 'R$ 1,2 mi');
  assert.equal(document.querySelector('#investment-detail-progress').textContent, '45% executado');

  document.querySelector('#investment-details-close').listeners.click();
  assert.equal(document.querySelector('#investment-details').open, false);
});
