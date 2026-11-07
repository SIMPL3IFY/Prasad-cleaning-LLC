-- SCRUM-224: Admin-editable descriptions for the service flip cards

-- 1. Description shown on the back of each service card
alter table public.services
  add column if not exists description text;

-- 2. Start the existing services off with the descriptions from ServicesData.jsx
--    (only fills blanks, so it never overwrites an admin's edits)
update public.services as s
set description = d.description
from (values
  ('Residential Cleaning', 'Routine cleaning for living spaces, bedrooms, kitchens, and bathrooms with dependable attention to detail.'),
  ('Commercial Cleaning', 'Professional upkeep for offices and shared spaces to maintain a clean, welcoming atmosphere.'),
  ('Move-in / Move-Out', 'A top-to-bottom clean of empty homes and units, so you can move in fresh or hand over the keys with confidence.'),
  ('Deep Cleaning', 'A thorough clean that reaches the buildup routine cleaning misses, from baseboards and fixtures to hard-to-reach corners.'),
  ('Recurring Maintenance', 'Scheduled visits that keep your space consistently clean, on a routine that works for you.'),
  ('Custom Requests', 'Have something specific in mind? Tell us what you need and we''ll tailor a cleaning plan around it.'),
  ('Special Offers', 'Flexible cleaning bundles and seasonal promos designed to fit your schedule and budget.')
) as d(name, description)
where s.name = d.name
  and s.description is null;
