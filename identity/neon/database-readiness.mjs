// Probe with the actual runtime role. Catalog presence alone does not prove
// the role can perform the operations or that RLS applies to it.
export async function identityDatabaseReady(pool, store, kid, expectedLogin) {
  try {
    const { rows } = await pool.query(`
      SELECT ($1::text IS NULL OR (session_user::text = $1 AND current_user::text = $1))
      AND bool_and(
        row_security_active(rel)
        AND has_table_privilege(rel, 'SELECT')
        AND NOT has_table_privilege(rel, 'DELETE')
        AND NOT has_table_privilege(rel, 'TRUNCATE')
      )
      AND has_column_privilege(
        'public.sr_platform_identities', 'neon_subject', 'INSERT'
      )
      AND has_column_privilege(
        'public.sr_platform_identities', 'platform_player_id', 'INSERT'
      )
      AND (
        SELECT ($1::text IS NULL OR (session_user::text = $1 AND current_user::text = $1))
      AND bool_and(has_column_privilege(
          'public.sr_identity_authorization_codes', column_name, 'INSERT'
        ))
        FROM unnest(ARRAY[
          'code_hash', 'client_id', 'redirect_uri', 'code_challenge',
          'player_id', 'state_hash', 'nonce_hash', 'expires_at'
        ]) AS columns(column_name)
      )
      AND has_column_privilege(
        'public.sr_identity_authorization_codes', 'consumed_at', 'UPDATE'
      ) AS ready
      FROM unnest(ARRAY[
        'public.sr_platform_identities'::regclass,
        'public.sr_identity_authorization_codes'::regclass,
        'public.sr_identity_account_status'::regclass,
        'public.sr_identity_revoked_jti'::regclass,
        'public.sr_identity_revoked_kids'::regclass
      ]) AS tables(rel)
    `, [expectedLogin ?? null]);
    return rows[0]?.ready === true && await store.canIssue(kid) === true;
  } catch {
    return false;
  }
}
