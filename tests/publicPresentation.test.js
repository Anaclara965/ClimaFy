const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const ejs = require('ejs');

test('menu mobile mantém as outras opções e não lista páginas de bairros', async () => {
  const html = await ejs.renderFile(path.join(__dirname, '../app/views/partials/header.ejs'), { usuario: null });
  assert.match(html, /href="\/new-report"/);
  assert.match(html, /href="\/login"/);
  assert.match(html, /href="\/cadastro-dados-pessoais"/);
  assert.doesNotMatch(html, /href="\/bairro-(?:bras|pinheiros)"/);
  assert.doesNotMatch(html, /Bairro (?:Brás|Bras|Pinheiros)/);
});

test('cabeçalho sincroniza foto de perfil ou iniciais na navegação', async () => {
  const arquivo = path.join(__dirname, '../app/views/partials/header.ejs');
  const usuario = { nome: 'Ana', sobrenome: 'Clara', email: 'ana@example.com', papel: 'cidadao' };
  const comFoto = await ejs.renderFile(arquivo, { usuario: { ...usuario, temFotoPerfil: true } });
  assert.equal((comFoto.match(/class="header-profile-avatar" src="\/api\/conta\/foto"/g) || []).length, 2);

  const semFoto = await ejs.renderFile(arquivo, { usuario: { ...usuario, temFotoPerfil: false } });
  assert.equal((semFoto.match(/header-profile-initials/g) || []).length, 2);
  assert.equal((semFoto.match(/>AC<\/span>/g) || []).length, 2);
});

test('painel administrativo usa a foto ou as iniciais da mesma sessão', async () => {
  const arquivo = path.join(__dirname, '../app/views/pages/adm-investimentos.ejs');
  const usuario = { nome: 'Ana', sobrenome: 'Clara', email: 'ana@example.com' };
  const comIniciais = await ejs.renderFile(arquivo, { usuario: { ...usuario, temFotoPerfil: false } });
  assert.equal((comIniciais.match(/>\s*AC\s*<\/a>/g) || []).length, 2);

  const comFoto = await ejs.renderFile(arquivo, { usuario: { ...usuario, temFotoPerfil: true } });
  assert.equal((comFoto.match(/src="\/api\/conta\/foto"/g) || []).length, 2);
});

test('cards da equipe exibem as funções informadas sem trocar nomes ou adicionar integrantes', () => {
  const elementos = new Map();
  const document = {
    querySelector(seletor) {
      if (!elementos.has(seletor)) elementos.set(seletor, { innerHTML: '' });
      return elementos.get(seletor);
    },
  };
  vm.runInNewContext(require('node:fs').readFileSync(path.join(__dirname, '../app/public/js/sobre.js'), 'utf8'), { document });
  const html = elementos.get('#team-grid').innerHTML;

  for (const [nome, funcao] of [
    ['Ana Clara', 'Gerente e Banco de Dados'],
    ['Guilherme Brito', 'Back-end'],
    ['Laura Uchôa', 'Design e Front-end'],
    ['Sophia Ribeiro', 'Front-end'],
    ['Lucas Moraes', 'Design'],
    ['Beatriz Siqueira', 'Documentação'],
  ]) {
    assert.match(html, new RegExp(`<h3>${nome}</h3>\\s*<p>${funcao}</p>`));
  }
  assert.equal((html.match(/class="member-card"/g) || []).length, 6);
});
