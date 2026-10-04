-- Make BusinessSettings.customFields the single home for custom field definitions.
--
-- WHY
-- `BusinessSettings` has a dedicated `customFields` column AND an `enabledFeatures` JSON bag.
-- The bag is a feature-flag store and is used as one across the app: `enabledFeatures['contact']`
-- gates a page, `.notifications` holds notification preferences, the trust page keeps its own
-- keys. A field SCHEMA is not a feature flag -- different shape, different lifecycle.
--
-- CustomFieldsPage wrote `enabledFeatures.customFields` while GET /crm/settings read the
-- `customFields` column, so the two disagreed and the CRM's custom fields silently rendered
-- empty. SettingsService.updateSettings now normalises writes to the column; this moves
-- whatever is already sitting in the bag so no definition is stranded there.
--
-- Per-entity COALESCE, not a wholesale overwrite: the column is canonical, so where both
-- places hold definitions for the same entity the column wins. Overwriting would discard
-- edits made through the correct path.
--
-- The customFields key is then removed from the bag so it cannot become a second home again.
--
-- Idempotent: safe on every deploy and every boot. Mirrors the change in
-- services/settings.service.ts -- keep the two in step, and add this filename to SQL_FILES in
-- ensure-agent-tables.cjs.

UPDATE "BusinessSettings"
SET "customFields" = COALESCE("customFields", '{}'::jsonb) || COALESCE("enabledFeatures"->'customFields', '{}'::jsonb)
WHERE "enabledFeatures"->'customFields' IS NOT NULL
  AND jsonb_typeof("enabledFeatures"->'customFields') = 'object';

UPDATE "BusinessSettings"
SET "enabledFeatures" = "enabledFeatures" - 'customFields'
WHERE "enabledFeatures" ? 'customFields';
