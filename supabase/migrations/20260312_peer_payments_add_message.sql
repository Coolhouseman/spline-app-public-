ALTER TABLE public.peer_payments
ADD COLUMN IF NOT EXISTS message TEXT;
