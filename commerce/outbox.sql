CREATE TABLE public.sr_commerce_outbox (
 event_id uuid PRIMARY KEY,
 event jsonb NOT NULL CHECK (event->>'eventId' IS NOT DISTINCT FROM event_id::text),
 status text NOT NULL DEFAULT 'ready' CHECK (status IN ('ready','leased','delivered','dead')),
 attempts integer NOT NULL DEFAULT 0,
 due_at timestamptz NOT NULL DEFAULT now(),
 lease_id uuid,
 lease_until timestamptz,
 last_http_status integer,
 CHECK ((status = 'leased') = (lease_id IS NOT NULL AND lease_until IS NOT NULL))
);
CREATE INDEX sr_commerce_outbox_due ON public.sr_commerce_outbox(due_at)
 WHERE status IN ('ready','leased');
REVOKE ALL ON public.sr_commerce_outbox FROM PUBLIC;
ALTER TABLE public.sr_commerce_outbox ENABLE ROW LEVEL SECURITY;
