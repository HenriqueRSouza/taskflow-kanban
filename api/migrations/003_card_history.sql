create table if not exists card_events (
  id bigint generated always as identity primary key,
  card_id uuid not null references cards(id) on delete cascade,
  type text not null check (type in ('created', 'moved')),
  from_column_id uuid,
  from_column_title text,
  to_column_id uuid not null,
  to_column_title text not null,
  occurred_at timestamptz not null default now()
);

create index if not exists card_events_card_occurred_id_idx
  on card_events(card_id, occurred_at, id);

create or replace function track_card_column() returns trigger
language plpgsql as $$
declare
  source_title text;
  destination_title text;
begin
  if TG_OP = 'INSERT' then
    select title into destination_title from columns where id = NEW.column_id;
    insert into card_events (card_id, type, to_column_id, to_column_title, occurred_at)
    values (NEW.id, 'created', NEW.column_id,
      coalesce(destination_title, '(coluna removida)'), NEW.created_at);
  elsif NEW.column_id is distinct from OLD.column_id then
    select title into source_title from columns where id = OLD.column_id;
    select title into destination_title from columns where id = NEW.column_id;
    insert into card_events (
      card_id, type, from_column_id, from_column_title,
      to_column_id, to_column_title, occurred_at
    ) values (
      NEW.id, 'moved', OLD.column_id, coalesce(source_title, '(coluna removida)'),
      NEW.column_id, coalesce(destination_title, '(coluna removida)'), NEW.updated_at
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists cards_track_column on cards;
create trigger cards_track_column
  after insert or update of column_id on cards
  for each row execute function track_card_column();

insert into card_events (card_id, type, to_column_id, to_column_title, occurred_at)
select cards.id, 'created', cards.column_id,
  coalesce(columns.title, '(coluna removida)'), cards.created_at
from cards
left join columns on columns.id = cards.column_id
where not exists (select 1 from card_events where card_id = cards.id);
