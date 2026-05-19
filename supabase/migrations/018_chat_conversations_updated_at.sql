-- Add `updated_at` to chat_conversations so the coach sidebar can sort
-- conversations by recency without joining chat_messages on every list.
-- A trigger on chat_messages bumps the parent conversation's updated_at
-- whenever a new message lands.

alter table public.chat_conversations
  add column if not exists updated_at timestamptz not null default now();

-- Initialize updated_at from the latest message timestamp where possible,
-- falling back to created_at for empty conversations.
update public.chat_conversations c
set updated_at = coalesce(
  (
    select max(m.created_at)
    from public.chat_messages m
    where m.conversation_id = c.id
  ),
  c.created_at
);

create or replace function public.touch_chat_conversation_on_message()
returns trigger
language plpgsql
as $$
begin
  update public.chat_conversations
  set updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists chat_messages_touch_parent on public.chat_messages;
create trigger chat_messages_touch_parent
after insert on public.chat_messages
for each row
execute function public.touch_chat_conversation_on_message();

create index if not exists chat_conversations_user_updated_idx
  on public.chat_conversations (user_id, updated_at desc);
