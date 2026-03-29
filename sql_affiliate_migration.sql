-- =============================================
-- Migration: Fitur Affiliate
-- Tanggal: 15 Maret 2026
-- =============================================

-- Tabel affiliates (data affiliate/mitra)
CREATE TABLE affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  whatsapp VARCHAR(50),
  email VARCHAR(255) UNIQUE,
  commission_rate DECIMAL(5,2) DEFAULT 10.00,
  total_earned DECIMAL(12,2) DEFAULT 0,
  balance DECIMAL(12,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Relasi: customer pertama kali direferensikan oleh affiliate mana
ALTER TABLE users ADD COLUMN referred_by UUID REFERENCES affiliates(id);

-- Riwayat komisi per transaksi
CREATE TABLE affiliate_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID REFERENCES affiliates(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  amount DECIMAL(12,2) NOT NULL,
  transaction_amount DECIMAL(12,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'credited',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Riwayat withdraw affiliate
CREATE TABLE affiliate_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID REFERENCES affiliates(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP WITH TIME ZONE
);
