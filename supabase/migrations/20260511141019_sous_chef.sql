-- Phase 6.A: sous chef. The design doc has had `kitchens.sous_chef_id`
-- since v1 was specced, but Phase 1's init migration didn't actually add
-- the column — it lived only on paper. Adding it here so the host can
-- appoint a sous chef and the auto-promotion fallback can live alongside
-- in v2 (currently deferred — disconnect detection didn't ship in v1).

alter table public.kitchens
  add column sous_chef_id uuid references public.cooks(id) on delete set null;

-- The existing kitchens-channel UPDATE subscription is filtered by primary
-- key (`id=eq.<kitchenId>`), and PKs are always in the realtime payload,
-- so no replica-identity tweak is needed for sous_chef_id changes to fan
-- out to every cook.
