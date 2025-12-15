-- Phase 3: AMI Events Table for Pilot Hardening
-- Run this on your Azure PostgreSQL database

CREATE TABLE IF NOT EXISTS public.ami_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  feeder_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  severity NUMERIC NOT NULL DEFAULT 0.5,
  start_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ami_events_active 
  ON public.ami_events (tenant_id, feeder_id, is_active, end_at);

CREATE INDEX IF NOT EXISTS idx_ami_events_tenant_type
  ON public.ami_events (tenant_id, event_type, is_active);

-- Add unique constraint to meter_reads_electric for UPSERT
-- Adjust column names if your schema differs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'meter_reads_electric_tenant_meter_readat_key'
  ) THEN
    ALTER TABLE public.meter_reads_electric 
    ADD CONSTRAINT meter_reads_electric_tenant_meter_readat_key 
    UNIQUE (tenant_id, meter_id, read_at);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Constraint may already exist or columns differ: %', SQLERRM;
END $$;

-- Add updated_at column if not exists
DO $$
BEGIN
  ALTER TABLE public.meter_reads_electric ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Column updated_at may already exist: %', SQLERRM;
END $$;

-- Add quality_flags column if not exists
DO $$
BEGIN
  ALTER TABLE public.meter_reads_electric ADD COLUMN IF NOT EXISTS quality_flags TEXT;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Column quality_flags may already exist: %', SQLERRM;
END $$;
