# Limitação de pedidos de login

Implementada em 16/10/2026, sem alteração de tela, dados, dependência ou `.env`.

## Funcionamento

`POST /login` passa por `app/middlewares/limitarLogin.js` antes dos validadores,
da consulta ao MySQL e da comparação de senha. A fábrica é criada uma única vez
ao montar a rota, não a cada requisição.

- Até **50 pedidos por IP em 15 minutos**. Variar o e-mail não libera o IP.
- Até **20 pedidos por e-mail em 15 minutos**, somando todos os IPs. Espaços nas
  pontas e maiúsculas são normalizados apenas para identificar o contador.
- Conta **todos os pedidos**, inclusive login válido, campos inválidos e conta
  inexistente; não é um contador apenas de senhas erradas. Pedidos bloqueados
  pelo limite de conta ainda consomem o limite do IP. Sucesso não zera limites.
- Janela fixa a partir do primeiro pedido daquela chave; tentativas bloqueadas
  não prorrogam sua expiração. Nenhum status de usuário é alterado no banco.
- Exceder retorna **HTTP 429**, `Retry-After` em segundos e `Cache-Control:
  no-store`, usando a página de erro que já existia. Não confirma existência de
  conta nem repete senha, e-mail ou IP na mensagem.
- `GET /login` e o fluxo separado de recuperação continuam disponíveis. A
  recuperação mantém seus próprios limites e CSRF; não são redefinidos aqui.

As chaves dos contadores usam HMAC-SHA256 com segredo aleatório apenas em memória.
Não são guardados IP ou e-mail em claro, nem senha/cookie nos contadores. Não há
log de tentativas neste módulo. Isso não implica anonimização de todo o app.

## Limitações e decisões para publicação

Esta é uma defesa local, não proteção completa contra abuso:

1. Reiniciar o processo zera os limites. Várias instâncias têm contadores
   independentes. Para publicar com escala, usar armazenamento compartilhado
   com expiração e incrementos atômicos, tanto para login quanto recuperação.
2. Um atacante que conhece o e-mail pode consumir sua janela e causar recusa
   temporária até com a senha correta. Foi preferido limite temporário a
   bloqueio permanente no banco. Ajustar limites com uso real; avaliar desafios
   adicionais/MFA e monitoramento antes de uma publicação ampla.
3. Há no máximo 10.000 chaves ativas (IP e conta juntos). Expiradas são removidas
   nos pedidos seguintes. Ao lotar, novas chaves recebem 429 por até uma janela;
   as existentes não são expulsas. Esse teto limita memória, mas pode recusar
   usuários legítimos sob ataque. Não substitui proteção na infraestrutura.
4. Usa `req.ip` do Express. O código não confia diretamente em cabeçalhos
   recebidos. A configuração atual de produção usa `trust proxy = 1`; validar
   com o provedor e impedir caminhos diretos/proxies com contagens diferentes.
   Compartilhamento de IP (escola/rede móvel) também pode atingir o limite.
5. Ainda pendem para a revisão de publicação: substituir o MemoryStore de
   sessões, exigir segredo forte em produção, revisar CSRF das demais escritas,
   limitar abuso no cadastro/geocodificação e validar HTTPS/proxy/deploy.
   Este passo não resolve esses itens nem torna o backend pronto para produção.

## Testes e teste manual

`node --test tests/limitarLogin.test.js tests/login.test.js`

Os testes usam relógio controlado, banco simulado e servidor HTTP local. Cobrem
os dois limites, troca de IP/e-mail, expiração, corpo malformado, teto de memória,
mensagem sem credenciais, cabeçalho de IP forjado (sem trust proxy no teste),
recusa antes do model e os fluxos existentes de login/permissões.
Não simulam uma implantação real atrás do proxy do provedor.

Para conferir manualmente, reiniciar o servidor, fazer poucos logins normais e
verificar que continuam funcionando. Para testar 429, preferir os testes locais;
não disparar tentativas em massa contra a conta de trabalho no banco compartilhado.

## Referências

Mantém a divisão por middleware dos materiais **PSW3_005 — Autenticação e
Autorização** e a sessão de **PSW3_004 — Variáveis de sessão**. Os limites acima
são decisões deste projeto, não valores prescritos nas apostilas.

Referência complementar: [OWASP — Authentication / Login Throttling](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#login-throttling).
