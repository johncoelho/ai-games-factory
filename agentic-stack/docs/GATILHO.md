# Gatilho da esteira (acionamento na hora, sem tarefa agendada)

O GitHub avisa o repo; o repo chama o agente. Nada depende do Claude Code aberto nem de tarefa agendada nele.

## Como funciona
1. Cada projeto tem `.github/workflows/fabrica.yml` (modelo: `gatilho/fabrica-chamada.yml`), que chama o workflow reutilizavel `johncoelho/ai-games-factory/.github/workflows/fabrica-agente.yml` (fonte: `gatilho/fabrica-agente.yml`).
2. Dispara em: issue aberta, reaberta ou rotulada; comentario novo; varredura de seguranca de hora em hora (so aciona o Claude se houver issue sem o rotulo `triado`); manual (`workflow_dispatch`).
3. Roteamento: issue com rotulo `origem:jogo`, `bug`, `feedback`, `suporte` ou `melhoria` vai para o **suporte** (se o projeto tem `.claude/agents/suporte.md`); o resto vai para o **principal** (o nome vem de `equipe.principal` do `factory.yaml`: CTO, CMO, PM...; ele lê `CLAUDE.md` (se existir), `MEMORY.md` e `factory.yaml`).
4. Regra do CEO: cada agente atua so nas suas atribuicoes; o principal delega (dev implementa, QA testa, suporte atende) e nunca faz tudo sozinho.
5. Modelo: Haiku (claude-haiku-5-5) para triagem e resposta; sobe para Sonnet se a triagem falhar ou o caso for complexo (ajuste `--model` no workflow).
6. Principal: classifica, poe no quadro na etapa certa, delega ao agente do time com comentario. Suporte: responde a quem abriu e escala ao principal (`Suporte -> principal`). Todo comentario comeca com 🤖 (a esteira ignora o proprio rastro) e a issue ganha o rotulo `triado`.
6. Esta fase faz so triagem, delegacao e resposta. Implementar, publicar e testar em emulador continuam na esteira local (precisam de ferramentas que o GitHub nao tem).

## Segredos (por repo, Settings > Secrets and variables > Actions)
- `CLAUDE_CODE_OAUTH_TOKEN`: gerado com `claude setup-token` (usa a assinatura, sem custo por chamada).
- `FABRICA_GH_TOKEN`: token classico do GitHub com `repo` e `project` (o token padrao do Actions nao edita projetos de usuario). Sem os dois, o workflow nao faz nada.

## Limites conhecidos
- Rodadas no Actions não aparecem no portal enquanto não houver hook no runner.
- Mover cartao entre etapas no quadro nao dispara o GitHub Actions em projetos de usuario; a varredura horaria cobre so issues sem triagem.
- O texto das issues e dado de terceiros: o agente roda com ferramentas restritas (Read, Glob, Grep, Task, `gh issue`, `gh project`, `gh label`).
