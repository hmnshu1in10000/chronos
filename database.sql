-- SQL Database Schema Setup for Supabase
-- Paste this script into the Supabase SQL Editor to create the slots table.

-- Create the slots table
CREATE TABLE IF NOT EXISTS public.slots (
    id UUID PRIMARY KEY,
    "userId" UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL,
    "dayOfWeek" TEXT NOT NULL,
    "durationMinutes" INT NOT NULL
);

-- Enable Row Level Security (RLS) on the table
ALTER TABLE public.slots ENABLE ROW LEVEL SECURITY;

-- Create Policies for RLS
-- Allows users to query only their own slots
CREATE POLICY "Allow users to read their own study slots" 
ON public.slots FOR SELECT 
USING (auth.uid() = "userId");

-- Allows users to insert their own slots
CREATE POLICY "Allow users to insert their own study slots" 
ON public.slots FOR INSERT 
WITH CHECK (auth.uid() = "userId");

-- Allows users to update their own slots
CREATE POLICY "Allow users to update their own study slots" 
ON public.slots FOR UPDATE 
USING (auth.uid() = "userId")
WITH CHECK (auth.uid() = "userId");

-- Allows users to delete their own slots
CREATE POLICY "Allow users to delete their own study slots" 
ON public.slots FOR DELETE 
USING (auth.uid() = "userId");

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_slots_user_id ON public.slots ("userId");
CREATE INDEX IF NOT EXISTS idx_slots_timestamp ON public.slots (timestamp);
