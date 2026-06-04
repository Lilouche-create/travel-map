-- ==========================================================
-- TRAVEL MAP — Migration V2
-- Multi-agences + Corbeille (soft delete)
-- Copiez dans Supabase > SQL Editor > New Query > Run
-- ==========================================================

-- ── Table agences ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agences (
  id         uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  nom        text NOT NULL,
  pin_hash   text NOT NULL,
  logo_url   text,
  actif      boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE agences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON agences FOR ALL USING (true) WITH CHECK (true);

-- ── Colonnes supplémentaires sur voyages ───────────────────
ALTER TABLE voyages
  ADD COLUMN IF NOT EXISTS agence_id  uuid REFERENCES agences(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by text DEFAULT NULL;

-- ── Auto-cleanup pg_cron (facultatif — plan Pro Supabase) ──
-- Active l'extension pg_cron si disponible sur votre plan :
--
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule(
--   'cleanup-trash',
--   '0 3 * * *',    -- chaque nuit à 3h UTC
--   $$DELETE FROM voyages WHERE deleted_at IS NOT NULL
--     AND deleted_at < NOW() - INTERVAL '30 days'$$
-- );
--
-- Si pg_cron n'est pas disponible, la suppression définitive
-- se fait manuellement depuis la corbeille admin.
