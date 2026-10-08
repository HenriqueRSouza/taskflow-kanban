# TaskFlow — Planejamento do Projeto (Etapa 1)

> **Disciplina:** Desenvolvimento Mobile — Universidade Presbiteriana Mackenzie
> **Aluno:** Henrique Ribeiro — RA 10401770
> **Repositório:** https://github.com/HenriqueRSouza/mobile-taskflow
> **Data:** 07/10/2026

---

## 1. Visão geral

O **TaskFlow** é um quadro Kanban no estilo Trello. O usuário cria colunas (ex.: "A Fazer", "Fazendo", "Feito"), adiciona cartões e os arrasta entre colunas. A interface é *mobile-first*: funciona com toque no celular e com mouse/teclado no desktop.

### 1.1 Objetivos de aprendizagem

| # | Objetivo | Como o projeto exercita |
|---|----------|-------------------------|
| O1 | React com TypeScript | Todo o front-end em `.tsx` com `strict: true` e sem `any` |
| O2 | Componentização | Hierarquia `Board → Column → Card → TagChip`, componentes pequenos e reutilizáveis |
| O3 | `useState` | Estado local de UI: edição inline, formulários, menus e modais |
| O4 | `useEffect` | Sincronização com a API, persistência, listeners de teclado, foco automático |
| O5 | Estado global | Store com Zustand como fonte única da verdade do quadro |
| O6 | Drag-and-drop performático | `@dnd-kit` com re-render mínimo e UI sincronizada com o estado |
| O7 | Back-end e persistência | API REST simples em Node + PostgreSQL, pronta para trocar por Supabase |
| O8 | Containers | Toda a aplicação sobe com um único `docker compose up` |

### 1.2 Escopo

**Dentro do escopo (MVP):**
- CRUD de colunas e cartões;
- drag-and-drop de cartões (dentro da mesma coluna e entre colunas) e de colunas;
- edição inline de títulos (coluna e cartão);
- etiquetas (tags) com cor, atribuíveis a cartões;
- persistência no `localStorage` (cache offline) **e** no banco via API;
- tipagem estrita de todos os estados;
- execução completa via Docker Compose.

**Fora do escopo (futuro):**
- autenticação e múltiplos usuários;
- vários quadros por usuário (o modelo de dados já prevê, mas a UI terá um quadro só);
- migração para Supabase;
- integração ao HUB (apenas a identidade visual é reaproveitada agora).

---

## 2. Requisitos

### 2.1 Requisitos funcionais

| ID | Requisito | Prioridade |
|----|-----------|------------|
| RF01 | Exibir o quadro com suas colunas e cartões ordenados | Alta |
| RF02 | Criar, renomear e excluir colunas | Alta |
| RF03 | Criar, editar e excluir cartões | Alta |
| RF04 | Editar inline o título de colunas e cartões (clique → input → Enter salva / Esc cancela) | Alta |
| RF05 | Arrastar cartões dentro da mesma coluna (reordenar) | Alta |
| RF06 | Arrastar cartões entre colunas | Alta |
| RF07 | Arrastar colunas para reordená-las | Média |
| RF08 | Criar etiquetas (nome + cor) e atribuí-las/removê-las de cartões | Alta |
| RF09 | Filtrar cartões por etiqueta | Baixa |
| RF10 | Persistir o estado no `localStorage` e restaurá-lo ao recarregar | Alta |
| RF11 | Salvar colunas, cartões e etiquetas no banco via API | Alta |
| RF12 | Funcionar com a API fora do ar (modo offline) e sincronizar ao voltar | Média |
| RF13 | Descrição opcional do cartão em um painel de detalhes | Baixa |

### 2.2 Requisitos não funcionais

| ID | Requisito |
|----|-----------|
| RNF01 | TypeScript `strict`, sem `any`; validação de dados externos com Zod |
| RNF02 | Arrastar deve manter ~60 fps com 200 cartões no quadro |
| RNF03 | Mobile-first: layout utilizável a partir de 360 px, arrasto por toque |
| RNF04 | Acessibilidade: arrastar por teclado (Espaço/setas) e anúncios para leitor de tela |
| RNF05 | Identidade visual do HUB, **sem logos e sem menção a empresa** |
| RNF06 | Subir com `docker compose up` sem configuração manual |
| RNF07 | Camada de dados desacoplada para trocar a API por Supabase sem reescrever a UI |
| RNF08 | Testes automatizados nas regras de negócio (store e API) |

---

## 3. Arquitetura

### 3.1 Stack

| Camada | Tecnologia | Justificativa |
|--------|-----------|---------------|
| Front-end | **Vite + React 19 + TypeScript** | Build rápido, sem a complexidade do SSR; foco em React puro |
| Estilo | **Tailwind CSS v4** | Mesma base do HUB, facilita a integração futura |
| Drag-and-drop | **@dnd-kit/core + @dnd-kit/sortable** | Moderno, acessível, suporta toque. O `react-beautiful-dnd` foi descontinuado pela Atlassian e não suporta React 18+ oficialmente |
| Estado global | **Zustand** (+ middleware `persist`) | API mínima, seletores evitam re-render, `persist` resolve o `localStorage` |
| Validação | **Zod** | Mesmos schemas no front e no back |
| Back-end | **Node 22 + Express + TypeScript** | Simples e didático |
| Banco | **PostgreSQL 16** | O Supabase é Postgres: o mesmo SQL migra direto |
| Acesso ao banco | **`pg`** com SQL escrito à mão | Aprender SQL de verdade; sem ORM para esconder o que acontece |
| Testes | **Vitest** (front e back) + Testing Library | Mesmo runner nos dois lados |
| Containers | **Docker + Docker Compose** | 3 serviços: `web`, `api`, `db` |

### 3.2 Diagrama

```
┌──────────────────────── docker compose ────────────────────────┐
│                                                                │
│  ┌──────────────┐   HTTP/JSON   ┌──────────────┐   SQL   ┌────┐ │
│  │  web (Vite)  │ ────────────▶ │ api (Express)│ ──────▶ │ db │ │
│  │  :5173       │ ◀──────────── │ :3000        │ ◀────── │ PG │ │
│  └──────┬───────┘               └──────────────┘         └────┘ │
│         │                                                      │
└─────────┼──────────────────────────────────────────────────────┘
          ▼
   localStorage (cache offline do quadro)
```

### 3.3 Estrutura de pastas (monorepo simples)

```
mobile-taskflow/
├── docker-compose.yml
├── docs/
│   └── PLANEJAMENTO.md       # este documento
├── packages/
│   └── shared/               # tipos e schemas Zod usados por web e api
│       └── src/{types.ts, schemas.ts}
├── web/
│   ├── Dockerfile
│   └── src/
│       ├── components/       # Board, Column, Card, TagChip, InlineEdit...
│       ├── hooks/            # useInlineEdit, useSyncBoard...
│       ├── store/            # boardStore.ts (Zustand)
│       ├── data/             # BoardRepository + implementações
│       ├── lib/              # position.ts (ordenação), utils
│       └── styles/theme.css  # tokens visuais
└── api/
    ├── Dockerfile
    ├── migrations/001_init.sql
    └── src/{server.ts, routes/, db.ts}
```

---

## 4. Modelo de dados

### 4.1 Tipos (tipagem estrita)

```ts
// IDs "marcados" impedem passar o ID de um cartão onde se espera o de uma coluna
type Brand<T, B> = T & { readonly __brand: B };
export type BoardId  = Brand<string, "BoardId">;
export type ColumnId = Brand<string, "ColumnId">;
export type CardId   = Brand<string, "CardId">;
export type TagId    = Brand<string, "TagId">;

export const TAG_COLORS = ["yellow", "black", "gray", "green", "red", "blue"] as const;
export type TagColor = (typeof TAG_COLORS)[number];

export interface Tag    { id: TagId; name: string; color: TagColor }
export interface Column { id: ColumnId; title: string; position: number }
export interface Card {
  id: CardId;
  columnId: ColumnId;
  title: string;
  description: string | null;
  tagIds: TagId[];
  position: number;
  createdAt: string; // ISO 8601
  updatedAt: string;
}

// Estado de sincronização de cada cartão — união discriminada
export type SyncState =
  | { status: "synced" }
  | { status: "pending"; since: string }
  | { status: "error"; message: string };
```

### 4.2 Estado normalizado no front-end

Guardar os dados "achatados" (por ID) é o que torna o drag-and-drop barato: mover um cartão altera só duas listas de IDs, e só as colunas afetadas re-renderizam.

```ts
interface BoardState {
  columns: Record<ColumnId, Column>;
  cards:   Record<CardId, Card>;
  tags:    Record<TagId, Tag>;
  columnOrder: ColumnId[];
  cardOrder:   Record<ColumnId, CardId[]>;
}
```

### 4.3 Tabelas (PostgreSQL)

```sql
create table boards  (id uuid primary key default gen_random_uuid(), title text not null,
                      created_at timestamptz not null default now());
create table columns (id uuid primary key default gen_random_uuid(),
                      board_id uuid not null references boards(id) on delete cascade,
                      title text not null check (length(title) between 1 and 80),
                      position double precision not null);
create table cards   (id uuid primary key default gen_random_uuid(),
                      column_id uuid not null references columns(id) on delete cascade,
                      title text not null check (length(title) between 1 and 200),
                      description text,
                      position double precision not null,
                      created_at timestamptz not null default now(),
                      updated_at timestamptz not null default now());
create table tags    (id uuid primary key default gen_random_uuid(),
                      board_id uuid not null references boards(id) on delete cascade,
                      name text not null, color text not null);
create table card_tags (card_id uuid references cards(id) on delete cascade,
                        tag_id  uuid references tags(id)  on delete cascade,
                        primary key (card_id, tag_id));
```

**Ordenação com `position` fracionária:** ao soltar um cartão entre A (pos 1.0) e B (pos 2.0), ele recebe 1.5. Assim, mover um cartão gera **uma única** atualização no banco, em vez de renumerar a coluna toda. Se a diferença ficar pequena demais, a coluna é renumerada.

---

## 5. API REST

| Método | Rota | Descrição |
|--------|------|-------------|
| GET | `/api/health` | Verificação do container |
| GET | `/api/board` | Quadro completo (colunas, cartões, tags) |
| PUT | `/api/columns/:id` | Cria ou atualiza coluna (título, posição) |
| DELETE | `/api/columns/:id` | Exclui coluna (e seus cartões) |
| PUT | `/api/cards/:id` | Cria ou atualiza cartão (coluna, título, descrição, posição, etiquetas) |
| DELETE | `/api/cards/:id` | Exclui cartão |
| PUT | `/api/tags/:id` | Cria ou atualiza etiqueta |
| DELETE | `/api/tags/:id` | Exclui etiqueta |

**Escrita idempotente:** o front-end gera os IDs (UUID) e envia sempre o objeto completo com `PUT`. Repetir a mesma requisição produz o mesmo resultado, então o front pode reenviar com segurança depois de uma falha de rede. `DELETE` de um item inexistente também responde `204`. Chave estrangeira inexistente (ex.: cartão numa coluna que ainda não chegou ao banco) responde `409`, e o front tenta de novo.

Todo corpo de requisição é validado com os schemas Zod de `packages/shared`. Erros retornam `{ error: string }` com status 400/404/500.

---

## 6. Fluxos principais

### 6.1 Drag-and-drop com atualização otimista

1. `onDragStart` — guarda o cartão ativo e mostra uma cópia em `DragOverlay`.
2. `onDragOver` — se passou para outra coluna, move o ID entre listas no store (o usuário vê o "espaço" abrir).
3. `onDragEnd` — calcula a nova `position`, atualiza o store **na hora** e envia o `PATCH` à API.
4. Se a API falhar, o cartão fica com `SyncState = "error"` e entra na fila de reenvio; a UI não "pula" de volta.

### 6.2 Persistência em duas camadas

```
Ação do usuário → Store (Zustand) ─┬─▶ localStorage (persist, imediato)
                                   └─▶ BoardRepository ─▶ API ─▶ PostgreSQL
```

`BoardRepository` é uma interface. Hoje existe `HttpBoardRepository`; no futuro basta criar `SupabaseBoardRepository` com os mesmos métodos, sem mexer em componente nenhum.

### 6.3 Onde cada hook aparece (objetivo de aprendizagem)

| Hook | Uso concreto no TaskFlow |
|------|--------------------------|
| `useState` | `isEditing` e `draft` na edição inline; texto do formulário "Adicionar cartão"; abrir/fechar menu de etiquetas e o painel de detalhes |
| `useEffect` | Carregar o quadro da API na montagem; dar foco no input quando entra em edição; listener de `Esc` para fechar modal (com limpeza no `return`); reenviar pendências quando o navegador volta a ficar online (`window` `online`) |
| `useRef` | Referência ao input para foco e seleção do texto |
| `useMemo` / `React.memo` | Evitar re-render dos cartões que não se moveram durante o arrasto |
| Hook customizado | `useInlineEdit()` encapsula `useState` + `useEffect` e é reutilizado em coluna e cartão |

---

## 7. Desempenho do drag-and-drop

- Estado normalizado (seção 4.2) e **seletores** do Zustand: cada `Column` assina só a sua lista de IDs.
- `React.memo` em `Card`; props estáveis (IDs, não objetos recriados).
- `DragOverlay` renderiza a "cópia" arrastada fora da lista, sem reflow das colunas.
- Sensores com restrição de ativação: `PointerSensor` (distância 5 px) e `TouchSensor` (atraso 200 ms) para não confundir arrasto com rolagem no celular; `KeyboardSensor` para acessibilidade.
- Escrita no `localStorage` com *debounce* e chamadas à API só no `onDragEnd`, nunca no `onDragOver`.
- Medição: React DevTools Profiler com um quadro de teste de 200 cartões (meta RNF02).

---

## 8. Identidade visual

Tokens reaproveitados do HUB, **sem logotipo, sem nome de empresa, sem slogan**:

| Token | Valor | Uso |
|-------|-------|-----|
| `--color-brand-500` | `#ffcd00` | Destaque, botão primário, foco, etiqueta "amarela" |
| `--color-brand-100` | `#fff6cc` | Fundo de chips e realces leves |
| `--color-brand-600/700` | `#e0b400` / `#b38f00` | Hover / pressionado |
| `--color-ink` | `#141414` | Texto, faixa superior, botão secundário |
| `--color-band` | `#ebebeb` | Fundo das colunas |
| `--color-tile` | `#f3f3f3` | Fundo do quadro / estados vazios |
| Fontes | **Inter** (texto) e **Archivo 800/900** (títulos) | Google Fonts |

Padrões visuais: cantos `rounded-2xl` nos cartões, botões `rounded-full` com borda preta, título do quadro em Archivo maiúsculo com o grifo amarelo (`display-highlight`), cartão que sobe levemente com sombra no hover.

---

## 9. Cronograma por etapas

| Etapa | Entrega | Conteúdo |
|-------|---------|----------|
| **1** | **Planejamento** (este documento) | Requisitos, arquitetura, modelo de dados, cronograma |
| 2 | Fundação | Repositório, monorepo, Docker Compose (web + api + db), tema visual |
| 3 | Quadro estático | Componentes `Board`/`Column`/`Card`, store Zustand, CRUD local, edição inline, `localStorage` |
| 4 | Drag-and-drop | `@dnd-kit`, reordenação de cartões e colunas, `DragOverlay`, toque e teclado |
| 5 | Back-end | API Express, migrations SQL, `HttpBoardRepository`, sincronização otimista e offline |
| 6 | Etiquetas e polimento | Tags, filtro, painel de detalhes, responsividade, acessibilidade |
| 7 | Qualidade e entrega | Testes, perfil de desempenho, README, vídeo/demonstração |

---

## 10. Riscos e mitigação

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Arrasto no celular conflita com a rolagem | Alto | `TouchSensor` com atraso e `touch-action` configurado; testar em aparelho real |
| UI e banco divergem após falha de rede | Médio | Atualização otimista + `SyncState` por item + fila de reenvio |
| Re-render excessivo ao arrastar | Médio | Estado normalizado, seletores, `memo`, perfil com 200 cartões |
| Migração futura para Supabase | Baixo | PostgreSQL desde já + interface `BoardRepository` |

---

## 11. Critérios de aceite do projeto

- [ ] `docker compose up` sobe web, api e banco em uma máquina limpa
- [ ] Criar, renomear (inline) e excluir colunas e cartões
- [ ] Arrastar cartões entre colunas e reordenar, por mouse, toque e teclado
- [ ] Etiquetas coloridas atribuíveis a cartões
- [ ] Recarregar a página mantém o quadro (localStorage) e o banco reflete as mudanças
- [ ] Funciona com a API desligada e sincroniza quando ela volta
- [ ] `tsc --noEmit` sem erros e sem `any`
- [ ] Testes do store, de `position.ts` e da API passando
- [ ] Layout utilizável em 360 px de largura
- [ ] Nenhum logo nem menção a empresa na interface ou no código
