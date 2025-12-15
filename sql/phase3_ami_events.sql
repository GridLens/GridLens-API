-- Phase 3: AMI Events Table (Safe for Azure PostgreSQL)
-- Run this ONLY on your Azure PostgreSQL database
-- Does NOT touch meter_reads_electric or KPI views

CREATE TABLE IF NOT EXISTS public.ami_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  feeder_id TEXT,
  meter_id TEXT,
  event_type TEXT NOT NULL,
  severity NUMERIC,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ami_events_tenant_time
  ON public.ami_events (tenant_id, starts_at, ends_at);
