const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class Element {
  constructor(classNames = '') {
    this.className = classNames;
    this.classNames = new Set(classNames.split(/\s+/).filter(Boolean));
    this.classList = { contains: name => this.classNames.has(name) };
    this.childNodes = [];
    this.listeners = {};
    this.files = [];
    this.disabled = false;
    this.textContent = '';
  }

  addEventListener(name, callback) { this.listeners[name] = callback; }
  cloneNode() { return new Element(this.className); }
  replaceChildren(...children) { this.childNodes = children; }
  setCustomValidity(message) { this.validationMessage = message; }
  reportValidity() { this.reported = true; }
}

function preparar() {
  const input = new Element();
  const button = new Element();
  const form = new Element();
  const feedback = new Element();
  const frames = [new Element(), new Element('profile-avatar-frame--large')];
  const document = {
    querySelector(selector) {
      return {
        '#profile-photo': input,
        '.photo-upload-form': form,
        '#photo-feedback': feedback,
      }[selector] ?? null;
    },
    querySelectorAll: () => frames,
    createElement: tag => new Element(tag),
  };
  form.querySelector = () => button;
  const objectUrls = [];
  const window = { addEventListener() {} };
  const URL = {
    createObjectURL() { objectUrls.push('blob:preview'); return 'blob:preview'; },
    revokeObjectURL(url) { objectUrls.push(`revoked:${url}`); },
  };
  form.requestSubmit = submitter => {
    const evento = { submitter, prevented: false, preventDefault() { this.prevented = true; } };
    form.listeners.submit(evento);
    form.resubmitEvent = evento;
  };
  const contexto = vm.createContext({ document, window, URL, Uint8Array });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../app/public/js/alterar-perfil.js'), 'utf8'), contexto);
  return { input, button, form, feedback, frames, objectUrls };
}

function arquivo(tipo, bytes, size = bytes.length) {
  return { type: tipo, size, async arrayBuffer() { return Uint8Array.from(bytes).buffer; } };
}

const png = [
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
];

test('pré-visualiza PNG somente após validar assinatura real e tamanho', async () => {
  const ui = preparar();
  ui.input.files = [arquivo('image/png', png)];
  await ui.input.listeners.change();

  assert.equal(ui.input.validationMessage, '');
  assert.match(ui.feedback.textContent, /Pré-visualização atualizada/);
  assert.equal(ui.frames[0].childNodes[0].src, 'blob:preview');
  assert.equal(ui.frames[1].childNodes[0].alt, 'Pré-visualização da foto de perfil');

  ui.input.files = [arquivo('image/png', Buffer.from('<svg/>'))];
  await ui.input.listeners.change();
  assert.match(ui.input.validationMessage, /conteúdo do arquivo/);
  assert.equal(ui.frames[0].childNodes.length, 0);

  const jpeg = [0xff, 0xd8, 0xff, 0x00, 0xff, 0xd9];
  ui.input.files = [arquivo('image/jpeg', jpeg, 5 * 1024 * 1024)];
  await ui.input.listeners.change();
  assert.equal(ui.input.validationMessage, '');
  assert.equal(ui.frames[0].childNodes[0].src, 'blob:preview');

  ui.input.files = [arquivo('image/jpeg', jpeg, 5 * 1024 * 1024 + 1)];
  await ui.input.listeners.change();
  assert.match(ui.input.validationMessage, /até 5 MB/);
});

test('revalida o arquivo antes do envio e deixa o formulário enviar após aprovação', async () => {
  const ui = preparar();
  ui.input.files = [arquivo('image/png', png)];
  const evento = { prevented: false, preventDefault() { this.prevented = true; } };
  await ui.form.listeners.submit(evento);

  assert.equal(evento.prevented, true);
  assert.equal(ui.form.resubmitEvent.prevented, false);
  assert.equal(ui.button.disabled, true);
  assert.equal(ui.input.validationMessage, '');
});
