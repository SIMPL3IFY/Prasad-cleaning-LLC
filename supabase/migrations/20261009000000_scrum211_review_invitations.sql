-- scrum211: Allow customer_reviews.user_id to be empty for reviews submitted through an email link.
-- Add accepted_quote_id to reviews and enforce at most one review per appointment.
-- Add invitation claim and sent timestamps to accepted_quotes
alter table public.customer_reviews
    alter column user_id drop not null,
    add column accepted_quote_id uuid references public.accepted_quotes(id) on delete set null;

create unique index customer_reviews_one_per_accepted_quote
    on public.customer_reviews (accepted_quote_id)
    where accepted_quote_id is not null;

alter table public.accepted_quotes
    add column review_invite_claimed_at timestamptz,
    add column review_invite_sent_at timestamptz;
