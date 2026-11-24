import {randomUUID} from 'node:crypto';

// Use the same transaction client that records the verified payment transition.
export async function enqueueCommerceEvent(client,event) {
  const data=JSON.stringify(event);
  const {rows}=await client.query(`INSERT INTO public.sr_commerce_outbox(event_id,event)
    VALUES($1,$2::jsonb) ON CONFLICT(event_id) DO NOTHING RETURNING event_id`,[event.eventId,data]);
  if (rows.length) return 'queued';
  const existing=await client.query('SELECT 1 FROM public.sr_commerce_outbox WHERE event_id=$1 AND event=$2::jsonb',[event.eventId,data]);
  if (!existing.rows.length) throw Error('commerce_event_conflict');
  return 'duplicate';
}

const maxAttempts=12;

export async function dispatchCommerceEvent(pool,sender) {
  const lease=randomUUID();
  const {rows:[job]}=await pool.query(`WITH candidate AS (
    SELECT event_id FROM public.sr_commerce_outbox
    WHERE (status='ready' AND due_at<=now()) OR (status='leased' AND lease_until<=now())
    ORDER BY due_at,event_id LIMIT 1 FOR UPDATE SKIP LOCKED
  ) UPDATE public.sr_commerce_outbox AS o SET status='leased',lease_id=$1,
    lease_until=now()+interval '60 seconds',attempts=attempts+1
    FROM candidate WHERE o.event_id=candidate.event_id RETURNING o.*`,[lease]);
  if (!job) return 'idle';
  let result;
  try { result=job.attempts>maxAttempts ? {status:'review'} : await sender.deliver(job.event); }
  catch { result={status:'retry'}; }
  const status=result.status==='delivered' ? 'delivered' :
    result.status==='retry' && job.attempts<maxAttempts ? 'ready' : 'dead';
  const delay=Math.floor(Math.min(3600,5*2**Math.min(job.attempts-1,10))*(0.75+Math.random()*0.25));
  const {rowCount}=await pool.query(`UPDATE public.sr_commerce_outbox SET status=$3,
    lease_id=NULL,lease_until=NULL,due_at=now()+$4*interval '1 second',last_http_status=$5
    WHERE event_id=$1 AND lease_id=$2`,[job.event_id,lease,status,delay,result.httpStatus??null]);
  return rowCount ? status : 'lease_lost';
}

export async function requeueDeadCommerceEvent(client,eventId) {
  const {rowCount}=await client.query(`UPDATE public.sr_commerce_outbox SET status='ready',attempts=0,
    due_at=now(),last_http_status=NULL WHERE event_id=$1 AND status='dead'`,[eventId]);
  return rowCount===1;
}
