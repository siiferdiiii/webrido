-- =============================================
-- Migration: Affiliate Portal — Password & Invite Token
-- Tanggal: 16 April 2026
-- =============================================

-- Tambah kolom password untuk login affiliate portal
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS password VARCHAR(255);

-- Tambah kolom invite_token untuk invite link (one-time setup)
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS invite_token VARCHAR(255) UNIQUE;
