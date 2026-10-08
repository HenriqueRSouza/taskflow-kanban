# TaskFlow Kanban

Quadro Kanban no estilo Trello, *mobile-first*, desenvolvido com **React + TypeScript** para a disciplina de Desenvolvimento Mobile da Universidade Presbiteriana Mackenzie.

O usuário cria colunas e cartões, arrasta tudo com mouse, toque ou teclado, edita títulos direto no quadro, organiza com etiquetas coloridas e continua trabalhando mesmo sem internet: as alterações são sincronizadas com o servidor quando a conexão volta.

![Quadro TaskFlow](docs/screenshot.png)

**Autor:** Henrique Ribeiro — RA 10401770

---

## Funcionalidades

| | Funcionalidade |
|---|---|
| 🗂️ | Criar, renomear e excluir **colunas** e **cartões** |
| ✏️ | **Edição inline** de títulos (clique → digite → Enter salva / Esc cancela) |
| ↕️ | **Drag-and-drop** de cartões (na mesma coluna e entre colunas) e de colunas |
| 📱 | Arrasto por **toque** (segurar ~0,2 s) sem atrapalhar a rolagem do celular |
| ⌨️ | Arrasto por **teclado** (Tab → Espaço → setas → Espaço) com anúncios para leitor de tela |
| 🏷️ | **Etiquetas** coloridas: criar, atribuir, remover e **filtrar** o quadro por etiqueta |
| 📝 | **Painel de detalhes** do cartão: descrição, etiquetas, datas e exclusão |
| 🕓 | **Histórico de movimentação** de cada cartão, gravado pelo banco: criação e cada troca de coluna, com data e hora |
| 💾 | Persistência no **`localStorage`** (o quadro abre instantaneamente) |
| ☁️ | Sincronização com **API REST + PostgreSQL**, com **modo offline** e reenvio automático |
| 🐳 | Tudo sobe com **um comando** via Docker Compose |

## Como executar

Pré-requisito: [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
git clone https://github.com/HenriqueRSouza/taskflow-kanban.git
cd taskflow-kanban
docker compose up --build
```

| Serviço | Endereço |
|---|---|
| Aplicação | http://localhost:5173 |
| API | http://localhost:3000/api/board |
| PostgreSQL | `localhost:5432` (usuário, senha e banco: `taskflow`) |

Na primeira execução o banco é criado com um quadro de exemplo.

> **Já tinha o banco criado antes do histórico de movimentação?** O PostgreSQL só executa as migrations na criação do banco. Aplique a nova uma vez (ela pode ser executada mais de uma vez sem problema):
> ```bash
> docker compose exec -T db psql -U taskflow -d taskflow < api/migrations/003_card_history.sql
> ```

- **Parar:** `docker compose down`
- **Apagar também os dados do banco:** `docker compose down -v`
- **Testar no celular** (mesma rede Wi-Fi): acesse `http://<IP-do-computador>:5173` — no macOS o IP aparece com `ipconfig getifaddr en0`.

### Sem Docker (opcional)

Requer Node.js 22 e um PostgreSQL com as migrations de `api/migrations/` aplicadas.

```bash
npm install
DATABASE_URL=postgres://taskflow:taskflow@localhost:5432/taskflow npm run dev:api
npm run dev:web
```

## Testes e qualidade

```bash
npm run typecheck                 # TypeScript estrito nos 3 pacotes
npm test                          # testes unitários e de componentes (Vitest)
npm run test:coverage -w web      # cobertura do front-end
DATABASE_URL=postgres://taskflow:taskflow@localhost:5432/taskflow npm test -w api   # API contra o banco real
```

- **TypeScript `strict`** em todo o projeto, sem `any`.
- Dados externos (corpo HTTP, `localStorage`, respostas da API) são **validados com Zod** usando os mesmos schemas no front e no back.
- Desempenho medido com um quadro de **200 cartões**: arrasto a **60 fps** no build de produção (abra `http://localhost:5173/?seed=200` em desenvolvimento para gerar esse quadro).

## Arquitetura

```
┌──────────────────────── docker compose ─────────────────────────┐
│                                                                 │
│  ┌──────────────┐   HTTP/JSON   ┌───────────────┐  SQL  ┌──────┐ │
│  │  web (Vite)  │ ────────────▶ │ api (Express) │ ────▶ │  db  │ │
│  │  :5173       │ ◀──────────── │ :3000         │ ◀──── │  PG  │ │
│  └──────┬───────┘               └───────────────┘       └──────┘ │
└─────────┼───────────────────────────────────────────────────────┘
          ▼
   localStorage (quadro + fila de alterações pendentes)
```

| Camada | Tecnologias |
|---|---|
| Front-end | Vite, React 19, TypeScript, Tailwind CSS v4 |
| Estado global | Zustand (com `persist` para o `localStorage`) |
| Drag-and-drop | @dnd-kit/core + @dnd-kit/sortable |
| Validação | Zod (pacote compartilhado `@taskflow/shared`) |
| Back-end | Node.js 22, Express 5, `pg` (SQL escrito à mão) |
| Banco | PostgreSQL 16 |
| Testes | Vitest, Testing Library, Supertest |
| Infraestrutura | Docker e Docker Compose |

### Estrutura de pastas

```
taskflow-kanban/
├── packages/shared/     # schemas Zod e tipos usados pelo front e pela API
├── web/src/
│   ├── components/      # Board, Column, Card, CardDetails, TagPicker, TagFilterBar…
│   ├── hooks/           # useInlineEdit, useBoardDnd, useBoardSync
│   ├── store/           # boardStore (quadro) e filterStore (filtro)
│   ├── data/            # BoardRepository, HttpBoardRepository, syncEngine
│   └── lib/             # ordenação fracionária, cores das etiquetas, utilitários
├── api/
│   ├── src/routes/      # board, columns, cards, tags
│   └── migrations/      # SQL: tabelas, dados de exemplo e trigger do histórico
├── docs/PLANEJAMENTO.md # requisitos, arquitetura e cronograma
└── docker-compose.yml
```

## Decisões técnicas

**Estado normalizado.** O quadro fica no store como objetos indexados por ID (`cards[id]`) mais listas de IDs com a ordem (`cardOrder[colunaId]`). Mover um cartão altera só duas listas, e cada componente assina apenas o seu pedaço do estado: editar um cartão re-renderiza só aquele cartão.

**Ordenação fracionária.** Cada item tem um `position` numérico. Soltar um cartão entre outros dois (1024 e 2048) dá a ele 1536: **uma única** escrita no banco por movimento, em vez de renumerar a coluna inteira.

**Atualização otimista e modo offline.** A tela muda na hora; o motor de sincronização compara o estado anterior com o novo (por referência, já que o store é imutável), coloca as entidades alteradas numa fila salva no `localStorage` e envia ao servidor. Sem conexão, a fila espera e é reenviada automaticamente (com intervalos crescentes ou assim que o navegador volta a ficar online).

**API idempotente.** As escritas usam `PUT /api/<recurso>/:id` com o objeto completo (cria ou atualiza). Reenviar a mesma requisição após uma falha de rede é seguro.

**Camada de dados desacoplada.** Os componentes não conhecem a API: tudo passa pela interface `BoardRepository`. Migrar para outro back-end (ex.: Supabase) exige apenas uma nova implementação dessa interface.

**Histórico de movimentação no banco.** Um *trigger* do PostgreSQL (`api/migrations/003_card_history.sql`) grava na tabela `card_events` a criação de cada cartão e toda troca de coluna, independentemente de quem fez a alteração. O evento guarda o nome das colunas daquele momento (o histórico continua correto se a coluna for renomeada ou excluída) e a hora em que a ação aconteceu no aparelho — um cartão movido offline às 10h e sincronizado às 15h fica registrado às 10h.

```sql
select to_char(occurred_at, 'DD/MM HH24:MI') as quando, type, from_column_title, to_column_title
from card_events where card_id = '<id do cartão>' order by occurred_at;
```

**Acessibilidade.** Arrasto por teclado com instruções e anúncios em português, contorno de foco visível, painel de detalhes com `<dialog>` nativo (foco preso e Esc), respeito à preferência de "reduzir movimento" do sistema.

## API

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/health` | Verifica a API e a conexão com o banco |
| GET | `/api/board` | Quadro completo (colunas, cartões e etiquetas) |
| PUT / DELETE | `/api/columns/:id` | Cria/atualiza ou exclui uma coluna (e seus cartões) |
| PUT / DELETE | `/api/cards/:id` | Cria/atualiza ou exclui um cartão (inclui suas etiquetas) |
| GET | `/api/cards/:id/history` | Histórico de movimentação do cartão (criação e trocas de coluna) |
| PUT / DELETE | `/api/tags/:id` | Cria/atualiza ou exclui uma etiqueta |

Erros retornam `{ "error": "mensagem" }` com status `400` (dados inválidos), `409` (coluna ou etiqueta inexistente) ou `500`.
