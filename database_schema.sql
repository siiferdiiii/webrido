-- Riwayat Skema Database Project Rido
-- Versi 1.0 (Initial Draft)
-- Tanggal: 14 Maret 2026

-- 1. Tabel Users (Data Pelanggan)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    whatsapp VARCHAR(50),                     -- Sangat penting untuk follow-up pelanggan lama
    customer_type VARCHAR(50) DEFAULT 'new',  -- Penanda status ('new', 'returning', 'loyal')
    subscription_status VARCHAR(50) DEFAULT 'inactive', -- 'active', 'inactive'
    follow_up_status VARCHAR(50) DEFAULT 'none',        -- 'none', 'follow_up_1', 'follow_up_2', 'follow_up_3', 'cold', 'project_only'
    notes TEXT,                               -- Catatan khusus untuk pelanggan (opsional)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabel Stock Accounts (Stok Akun CapCut Pro)
CREATE TABLE stock_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_email VARCHAR(255) NOT NULL,
    account_password VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'available',   -- Status akun: 'available', 'in_use', 'banned', 'expired', 'replaced'
    duration_days INT DEFAULT 30,             -- Durasi langganan akun (misal: 30 hari)
    notes TEXT,                               -- Catatan error atau alasan kena ban
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabel Transactions (Pembelian & Penugasan Akun)
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lynk_id_ref VARCHAR(255) UNIQUE,          -- ID invoice/transaksi dari webhook Lynk.id (Null kalau manual)
    user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    stock_account_id UUID REFERENCES stock_accounts(id) ON DELETE SET NULL, -- Akun mana yg diberikan ke user?
    amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    status VARCHAR(50) DEFAULT 'success',     -- 'success', 'pending', 'failed', 'refund'
    is_manual BOOLEAN DEFAULT false,          -- Menandakan apakah ini ditambahkan manual dari dashboard
    purchase_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    warranty_expired_at TIMESTAMP WITH TIME ZONE, -- Tanggal masa aktif garansi habis
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabel Warranty Claims (Riwayat Klaim Garansi)
CREATE TABLE warranty_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
    old_account_id UUID REFERENCES stock_accounts(id) ON DELETE SET NULL, -- Akun yg bermasalah
    new_account_id UUID REFERENCES stock_accounts(id) ON DELETE SET NULL, -- Akun pengganti baru
    claim_reason TEXT,                        -- Alasan error: "Batas Limit Perangkat", dll.
    status VARCHAR(50) DEFAULT 'resolved',    -- 'pending', 'resolved', 'rejected'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Tabel Message Logs (Riwayat Pengiriman WhatsApp & Follow-Up)
CREATE TABLE message_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL, -- Null jika ini pesan promosi/follow-up retensi
    whatsapp_number VARCHAR(50) NOT NULL,     -- Nomor tujuan pesan dikirim
    message_type VARCHAR(50) NOT NULL,        -- 'account_delivery', 'follow_up_1', 'follow_up_2', 'follow_up_3', 'cold_promo', 'project_promo', 'warranty_replacement'
    message_content TEXT,                     -- Isi pesan yang dikirim
    status VARCHAR(50) DEFAULT 'sent',        -- 'sent', 'failed', 'delivered'
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
