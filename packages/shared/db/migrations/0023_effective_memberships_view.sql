-- CP-003: effective_memberships unified access view
-- Unifies direct tenant_memberships with agency access via tenant_relationships
-- No ACCESS EXCLUSIVE lock — CREATE VIEW acquires only AccessShareLock on referenced tables

CREATE VIEW "effective_memberships" AS
  SELECT
    "user_id",
    "tenant_id",
    "role",
    'direct' AS "source",
    NULL::uuid AS "agency_tenant_id"
  FROM "tenant_memberships"
  WHERE "status" = 'active'
  UNION ALL
  SELECT
    tm."user_id",
    tr."client_tenant_id" AS "tenant_id",
    tr."access_level" AS "role",
    'agency' AS "source",
    tr."agency_tenant_id"
  FROM "tenant_relationships" tr
  JOIN "tenant_memberships" tm
    ON tm."tenant_id" = tr."agency_tenant_id"
    AND tm."status" = 'active'
  WHERE tr."status" = 'active';
