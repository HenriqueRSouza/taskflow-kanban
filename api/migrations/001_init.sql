create table boards (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  created_at timestamptz not null default now()
);

create table columns (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references boards(id) on delete cascade,
  title text not null check (length(title) between 1 and 80),
  position double precision not null
);

create table cards (
  id uuid primary key default gen_random_uuid(),
  column_id uuid not null references columns(id) on delete cascade,
  title text not null check (length(title) between 1 and 200),
  description text,
  position double precision not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table tags (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references boards(id) on delete cascade,
  name text not null,
  color text not null check (color in ('yellow', 'black', 'gray', 'green', 'red', 'blue'))
);

create table card_tags (
  card_id uuid references cards(id) on delete cascade,
  tag_id uuid references tags(id) on delete cascade,
  primary key (card_id, tag_id)
);

create index columns_board_position_idx on columns(board_id, position);
create index cards_column_position_idx on cards(column_id, position);
