-- Migration 004: Hostess Session Assignment Order System
-- Adapted for actual DB schema (hostess_profiles, agents, orders, staff)
-- MIGRATION: .NET — HostessAvailabilityHub (SignalR)

CREATE TABLE IF NOT EXISTS hostess_session_assignments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id        UUID NOT NULL REFERENCES reservations(id),
  hostess_id            UUID NOT NULL REFERENCES hostess_profiles(id),
  agency_id             UUID REFERENCES agents(id),
  pos_order_id          UUID REFERENCES orders(id),

  assigned_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  session_start         TIMESTAMPTZ NOT NULL,
  session_end           TIMESTAMPTZ,
  billed_hours          DECIMAL(5,2),

  order_type            VARCHAR(20) NOT NULL
                        CHECK (order_type IN ('INITIAL','ADD_ON','EXTENSION','REPLACEMENT')),
  parent_assignment_id  UUID REFERENCES hostess_session_assignments(id),

  hourly_rate_guest     DECIMAL(10,2) NOT NULL,
  commission_rate_pct   DECIMAL(5,2)  NOT NULL,
  agency_rate_pct       DECIMAL(5,2),

  status                VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                        CHECK (status IN ('ACTIVE','COMPLETED','CANCELLED','DISPUTED')),
  commission_status     VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                        CHECK (commission_status IN ('PENDING','CALCULATED','APPROVED','PAID','DISPUTED')),

  gross_commission      DECIMAL(10,2),
  agency_commission     DECIMAL(10,2),
  net_commission        DECIMAL(10,2),

  assigned_by           UUID REFERENCES staff(id),
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hsa_reservation ON hostess_session_assignments(reservation_id, status);
CREATE INDEX IF NOT EXISTS idx_hsa_hostess_date ON hostess_session_assignments(hostess_id, session_start);
CREATE INDEX IF NOT EXISTS idx_hsa_pos_order ON hostess_session_assignments(pos_order_id) WHERE pos_order_id IS NOT NULL;
