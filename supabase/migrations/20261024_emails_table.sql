-- Migration: 20261024_emails_table.sql
-- Create emails table for STARK Mail reactive feed and outbound communications logging

CREATE TABLE IF NOT EXISTS public.emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender TEXT,
    sender_name TEXT,
    sender_email TEXT,
    sender_company TEXT,
    recipient TEXT,
    recipient_email TEXT,
    "to" TEXT,
    subject TEXT NOT NULL,
    body TEXT,
    snippet TEXT,
    direction TEXT DEFAULT 'outbound',
    status TEXT DEFAULT 'sent',
    unread BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access on emails"
ON public.emails FOR SELECT USING (true);

-- Allow public insert access
CREATE POLICY "Allow public insert on emails"
ON public.emails FOR INSERT WITH CHECK (true);

-- Enable Supabase Realtime for reactive feed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'emails'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.emails;
  END IF;
END $$;
