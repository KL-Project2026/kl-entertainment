-- Migration 005: Customer Portal Audit Log
-- Spec: OPERATIONS_WORKFLOW.md §13 — customer audit trail must be isolated
-- from staff audit_log to avoid PII commingling and to support compliance
-- export per portal.
-- MIGRATION: .NET — same table, exposed via CustomerAuditService.

CREATE TABLE IF NOT EXISTS customer_audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   VARCHAR(50) NOT NULL,
  entity_id     UUID NOT NULL,
  action        VARCHAR(30) NOT NULL,
  customer_id   UUID REFERENCES customers(id),
  changed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  old_values    JSONB,
  new_values    JSONB,
  ip_address    INET,
  user_agent    TEXT
);

CREATE INDEX IF NOT EXISTS idx_customer_audit_entity     ON customer_audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_customer_audit_changed_at ON customer_audit_log (changed_at);
CREATE INDEX IF NOT EXISTS idx_customer_audit_customer   ON customer_audit_log (customer_id);
