-- SCRUM-211: Reviews reached from an appointment email have no Auth session.
-- Keep customer_reviews as the single review store and associate guest reviews
-- with the accepted appointment rather than inventing an Auth user.
alter table public.customer_reviews
    alter column user_id drop not null,
    add column accepted_quote_id uuid references public.accepted_quotes(id) on delete set null;

create unique index customer_reviews_one_per_accepted_quote
    on public.customer_reviews (accepted_quote_id)
    where accepted_quote_id is not null;

alter table public.accepted_quotes
    add column review_invite_claimed_at timestamptz,
    add column review_invite_sent_at timestamptz;
