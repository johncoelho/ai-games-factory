# Agentic Stack — fase 0

Ver a visão completa em [docs/VISAO.md](docs/VISAO.md). Esta pasta tem só o sinal de tempo real: **o que cada agente faz agora, duração e custo**.
Tickets, squads e aprovações continuam sendo do GitHub e dos repositórios de cada jogo.

| Arquivo | Para quê |
|---|---|
| `hooks/factory-hook.mjs` | Hook do Claude Code. Manda um evento por ação do agente. Nunca bloqueia (sempre sai com 0). |
| `server/sink.mjs` + `server/panel.html` | Receptor local e painel ao vivo, só leitura (`http://127.0.0.1:4010`). Sem dependências. |
| `supabase/migrations/20261101000000_factory_events.sql` | Tabela `factory_events` do destino definitivo. **Aplicada** na base `jarvis-agentic-stack`. |
| `examples/factory.naval-battle.yaml` | `factory.yaml` que vai na raiz do repo de cada jogo. |

## Rodar a demo

```bash
node server/sink.mjs
```

Em cada repo de jogo, copiar o `factory.yaml` e registrar o hook em `.claude/settings.json` para os eventos
`SessionStart, SessionEnd, PreToolUse, PermissionRequest, PostToolUse, Stop, SubagentStart, SubagentStop, Notification, UserPromptSubmit`
(o mínimo do sinal ao vivo é `SessionStart, PreToolUse, PermissionRequest, Stop`; o hook nunca escreve na saída, então não aprova nem nega pedidos de permissão):

```json
{ "hooks": { "PreToolUse": [ { "hooks": [ { "type": "command", "command": "node \"D:/PROJETOS/AI Games Factory/agentic-stack/hooks/factory-hook.mjs\"" } ] } ] } }
```

O papel do agente vem de `agent_type` (subagentes) ou da variável `FACTORY_AGENT` quando o executor roda uma sessão como aquele papel.
O jogo vem do `slug` do `factory.yaml` (ou de `FACTORY_GAME`). Destino trocável com `FACTORY_EVENTS_URL` e `FACTORY_EVENTS_KEY`.

## Privacidade do evento

Sai só: jogo, agente, tipo de evento, nome da ferramenta, caminho de arquivo relativo (ou padrão de Grep/Glob), duração e custo da sessão.
**Não sai** comando de shell, prompt, conteúdo de arquivo nem resposta do agente.

## Estado e limites

- Testado com 3 agentes em paralelo (suporte, tech-lead, qa) numa cópia do Naval Battle sem remoto.
- `data/events.jsonl` é só da demo local (ignorado no git). Destino real = Supabase (`jarvis-agentic-stack`), tabela criada e testada; o hook ainda aponta para o receptor local.
- A política RLS deixa a chave `anon` só inserir e o usuário autenticado ler. Quem tiver a chave anon pode inserir lixo; aceitável para uso privado, revisar antes de qualquer vitrine pública.
- O hook **está registrado** no repo real do Naval Battle (`.claude/settings.local.json`, ignorado pelo git), já com `FACTORY_EVENTS_URL`/`FACTORY_EVENTS_KEY` apontando para o Supabase, e o `factory.yaml` foi versionado lá (commit `31f7031`, `[skip ci]`). O hook manda cada evento para o Supabase e, em paralelo, para o painel local (`FACTORY_LOCAL_URL`, padrão `http://127.0.0.1:4010/events`; `off` desliga). Destino fora do ar: falha em silêncio e nunca bloqueia o agente. Medido: ~370 ms por evento, contra o Supabase, no PC do John.
- Nome do papel: a esteira chama os agentes como subagentes, então `agent_type` já vem sozinho. Só a sessão do CTO (principal) aparece como `principal`.
- Supabase: a fábrica usa o projeto `jarvis-agentic-stack` (`project_ref` `lwaoxnjajxljxusxujku`), que pertence à organização Supabase **AI GAMES FACTORY** (transferido de "Jarvis ENV", mesmo ref), com tabelas prefixadas `factory_`. A leitura de `factory_events` foi validada em 01/11/2026: HTTP 200 com `[]`. A tabela `factory_events` **está aplicada** (RLS ligada, `factory_events_purge()` criada, sem agendamento ainda). Teste: gravar com a chave pública deu 201 e ler sem login volta vazio; a linha de teste foi apagada.
- Variáveis do hook: `FACTORY_EVENTS_URL` (`https://<project_ref>.supabase.co/rest/v1/factory_events`) e `FACTORY_EVENTS_KEY` (chave publicável do projeto). Ficam no bloco `env` de `.claude/settings.local.json` de cada repo de jogo, que o git ignora. Nunca no repositório.
- Obter a chave sem imprimir: `supabase projects api-keys --project-ref lwaoxnjajxljxusxujku -o json`, usar a chave `publishable` e gravá-la direto no arquivo.
- Validar sem gravar: `GET <FACTORY_EVENTS_URL>?limit=0` com a chave. Esperado: 200 com `[]` (validado em 01/11/2026); 404 `PGRST205` indicaria tabela inexistente.
- Custo por sessão vem do último `cost-state` do transcript; só aparece nos eventos `Stop`, `SubagentStop` e `SessionEnd`.

## Portal visual (Pixel Agents)

`portal/` monta o escritório em pixel: `bash portal/build.sh <pasta>` clona o Pixel Agents (MIT, v1.5.0 fixada), aplica a camada da fábrica (`portal/overlay/`) e gera a página estática. Publicado em `johncoelho.github.io/ai-games-factory/portal/` (repo `ai-games-factory`, GitHub Pages).
- A camada da fábrica lê `factory_events` do Supabase (histórico + Realtime) e traduz cada evento em ação do personagem. Só leitura; entrada por link no e-mail, e o banco só deixa o dono ler.
- Cada par jogo+agente vira um personagem. Clique nele para ver o papel, o jogo e a ação atual. Quem fica 2 minutos sem evento senta e descansa.
- Teste local sem login e sem banco: `VITE_DEMO=1 bash portal/build.sh <pasta>` (eventos sintéticos; nunca publicar essa versão).
- O que não foi testado com dados reais: o portal só foi visto com eventos de demonstração, porque o hook ainda manda para o receptor local.
- **Squad e nomes:** o portal lê o `factory.yaml` do repo do jogo (`nome_squad`, `equipe`, `etapas`, `quadro`), convenção de repo `johncoelho/<slug>`. Todo o squad nasce sentado na sala de estar; ao trabalhar o agente vai a uma mesa com computador e, ao terminar, volta ao sofá. O escritório ganhou 4 bancos extras (patch em `portal/patches.mjs`) para caber o squad de 8.
- **Issues ao clicar no agente:** função `factory-board` (Supabase Edge Function) lê o quadro do GitHub na hora, exige o login do dono e o segredo `GITHUB_TOKEN` (PAT clássico, só `read:project`, configurado pelo John no Supabase). As issues de cada papel são os cartões nas etapas definidas em `etapas:` do `factory.yaml`. Sem o segredo, o painel avisa que falta o token.
- **Registrar um jogo novo no portal:** (1) `factory.yaml` na raiz do repo do jogo; (2) repo privado? cópia igual em `squads/<slug>.yaml` no repo do site `ai-games-factory`; (3) linha em `SQUADS` (`portal/overlay/webview-ui/src/factory/config.ts`) e em `SQUADS_MAPA` (`portal/layout.mjs`, uma sala por squad: o mapa tem 5 salas de time, o 5º squad (Domínio) tomou o lugar do LAZER 3); (4) hook e `FACTORY_EVENTS_*` no `.claude/settings.local.json` do jogo; (5) gerar e publicar o portal. Primeira vez feito com o `dominiogame` em 01/11/2026.
