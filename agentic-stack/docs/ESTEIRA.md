# Esteira do Agentic Stack Team

Como o trabalho da plataforma (hook, Supabase, portal e o fluxo dos squads) anda, do pedido do John ao ar.
Os agentes ficam em `.claude/agents/`; a rodada recorrente é a skill `esteira`. O desenho é o mesmo da esteira do Naval Battle.

## Papéis

| Papel | Nome no portal | Arquivo | Faz | Decide |
|---|---|---|---|---|
| CEO | **John** | — | prioriza, aprova melhorias, é o único que edita o mapa | melhoria, prioridade, dinheiro, stack |
| CTO (principal) | CTO | console + skill `esteira` | triagem, delega por Task, cobra status; nunca implementa, testa ou desenha | — |
| PO | Gates | `po` | issues com critérios de aceite, ordem da Fila | — |
| Tech Lead | Torvalds | `tech-lead` | desenho antes, revisão antes de todo push | — |
| Dev | Musk | `dev` | implementa o lote da Fila num worktree | — |
| QA | Hopper | `qa` | confere no navegador (Chrome do John), com captura | — |
| Designer | Ive | `designer` | mapa, salas, arte e identidade visual | — |

Os nomes no portal são sobrenomes de figuras da tecnologia (só o sobrenome, de propósito).

Modelos: o padrão é Sonnet para todos, inclusive o Tech Lead na revisão de diff. Opus só para desenho técnico e segurança. O CTO sobrescreve `model`/`effort` por demanda conforme a seção "Modelo e esforço por demanda".

## Quadro

GitHub Projects "Agentic Stack · Esteira", campo **Status** (visão em quadro). Cada issue aberta é um cartão. O portal lê este quadro: ao clicar num agente aparecem as issues das etapas dele (`etapas:` no `factory.yaml`).

| Etapa | Significa | Quem move |
|---|---|---|
| **Novo** | chegou, sem triagem | CTO |
| **Aguardando aprovação** | melhoria com proposta do PO | **John** |
| **Fila** | pronto para fazer, na ordem | PO ordena; a rodada pega a Fila inteira como um lote |
| **Em andamento** | Dev + Tech Lead trabalhando | Dev |
| **Publicado** | no ar (site) e aguardando a conferência visual | Dev (após APROVADO do Tech Lead e do QA local) |
| **Concluído** | QA aprovou no Chrome do John, issue fechada | QA |

Nota: `etapas:` no `factory.yaml` diz onde cada papel atua/acompanha (o portal usa isso para listar as issues do agente), não quem move o cartão; quem move é a coluna "Quem move" acima.

## Regras

- **Um dono por dado, sem espelhar, custo mínimo.** Serviço pago novo só com o OK do John.
- **Bug** (quebrou algo que funcionava) vai direto para a Fila. **Melhoria** só entra na Fila com aprovação do John.
- **Um lote por vez.** Tech Lead aprova o diff antes de publicar; o QA confere no navegador depois. Toda entrega passa pelo QA antes e depois de publicar; o CTO chama o QA por `Task`, nunca confere sozinho.
- **Visual bom sem o John precisar avisar:** nada sobreposto, texto legível, conferido em captura de tela antes e depois de publicar.
- **Só o John edita o mapa.** Visitantes só veem e se movimentam.
- **Segredo nunca no repositório.** Token do GitHub e chaves privadas ficam como segredo do Supabase.
- Commits só de documentação ou configuração dispensam novo build do portal.

## Modelo e esforço por demanda

O CTO escolhe o modelo e o esforço de cada delegação pela complexidade da demanda, usando os parâmetros `model` e `effort` da ferramenta Agent/Task; o modelo fixo no cabeçalho do agente é só o padrão.

- Trivial com conferência objetiva (trocar um texto, conferir publicação por curl/grep/SQL, abrir issue por modelo, triagem simples): haiku, esforço baixo.
- Rotina (funcionalidade em código conhecido, revisão de diff pequeno, QA visual, especificação visual): sonnet, esforço médio. É o padrão.
- Complexa ou arriscada (desenho técnico novo, segurança, bug de causa desconhecida, mudança em vários arquivos que se influenciam): opus, esforço alto, só para Tech Lead e Dev quando necessário.

Haiku só onde o resultado se confere por teste; se falhar, sobe um degrau em vez de repetir. Revisão de diff do Tech Lead é Sonnet por padrão; Opus só para desenho e segurança. Sessões novas por assunto e compactar cedo economizam mais que trocar o modelo do console.

## Rodada da esteira

1. Estado: issues abertas e cartões do quadro.
2. **CTO** faz a triagem (o PO dá critério de aceite): pedidos novos viram issue; melhoria vai para Aguardando aprovação; o PO ordena a Fila.
3. Se nada está **Em andamento**: pega a Fila inteira como lote → **Tech Lead** desenha (se preciso) → **Dev** implementa → **Tech Lead** revisa → **QA** confere a versão local → **Dev** publica.
4. **QA** confere o publicado no Chrome e move para Concluído (ou devolve à Fila).

## Comandos do quadro

```bash
gh project list --owner johncoelho
gh project item-list <N> --owner johncoelho --format json
gh project item-edit --project-id <id> --id <item> --field-id <status-field> --single-select-option-id <opcao>
gh issue create --repo johncoelho/agentic-stack --title "..." --body "..."
gh project item-add <N> --owner johncoelho --url <issue-url>
```
