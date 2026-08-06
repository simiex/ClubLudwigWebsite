-- ============================================================================
-- Newsletter – EXECUTE auch PUBLIC entziehen
-- ============================================================================
-- Die vorige Migration entzog das Recht nur `anon` und `authenticated`. Beide
-- erben EXECUTE aber über die Default-Rechte von PUBLIC, sodass die Funktionen
-- weiter unter /rest/v1/rpc/ erreichbar blieben: `newsletter_trigger_weekly`
-- hätte jeder aufrufen und damit den Versand anstoßen können,
-- `newsletter_purge_stale` löscht Zeilen. Beides gehört allein der Service Role.
-- ============================================================================

revoke all on function public.newsletter_purge_stale()    from public, anon, authenticated;
revoke all on function public.newsletter_trigger_weekly() from public, anon, authenticated;
