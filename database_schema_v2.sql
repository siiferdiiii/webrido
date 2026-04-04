-- ============================================================
--  PROJECT RIDO — Complete Database Schema
--  Generated from Prisma schema (capcut-pro-dashboard)
--  Version: 2.0 (Full — safe to run on a fresh database)
--
--  Cara pakai:
--  1. Buka SQL Editor di Neon / Supabase / PgAdmin
--  2. Paste seluruh isi file ini
--  3. Eksekusi sekali — semua tabel akan dibuat
--
--  PERINGATAN: Script ini akan DROP semua tabel yang ada
--  dan membuatnya ulang dari nol. Semua data akan hilang.
-- ============================================================


-- ============================================================
-- STEP 1: Drop semua tabel (urutan terbalik agar FK tidak error)
-- ============================================================

DROP TABLE IF EXISTS customer_tags                   CASCADE;
DROP TABLE IF EXISTS affiliate_withdrawals           CASCADE;
DROP TABLE IF EXISTS affiliate_commissions           CASCADE;
DROP TABLE IF EXISTS scheduled_followup_recipients   CASCADE;
DROP TABLE IF EXISTS scheduled_followups             CASCADE;
DROP TABLE IF EXISTS message_logs                    CASCADE;
DROP TABLE IF EXISTS warranty_claims                 CASCADE;
DROP TABLE IF EXISTS transactions                    CASCADE;
DROP TABLE IF EXISTS tags                            CASCADE;
DROP TABLE IF EXISTS stock_accounts                  CASCADE;
DROP TABLE IF EXISTS users                           CASCADE;
DROP TABLE IF EXISTS affiliates                      CASCADE;


-- ============================================================
-- STEP 2: Buat semua tabel (urutan sesuai dependency FK)
-- ============================================================


-- ── 1. affiliates ─────────────────────────────────────────
--    Dibuat duluan karena users.referred_by mereferensikan tabel ini
CREATE TABLE affiliates (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255)    NOT NULL,
    whatsapp        VARCHAR(50),
    email           VARCHAR(255)    UNIQUE,
    commission_rate DECIMAL(5, 2)   NOT NULL DEFAULT 10.00,  -- Persentase komisi (%)
    total_earned    DECIMAL(12, 2)  NOT NULL DEFAULT 0,      -- Total komisi yang pernah didapat
    balance         DECIMAL(12, 2)  NOT NULL DEFAULT 0,      -- Saldo yang belum dicairkan
    status          VARCHAR(50)     DEFAULT 'active',        -- 'active', 'inactive'
    created_at      TIMESTAMPTZ     DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     DEFAULT NOW()
);


-- ── 2. users ──────────────────────────────────────────────
CREATE TABLE users (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email               VARCHAR(255) UNIQUE NOT NULL,
    name                VARCHAR(255) NOT NULL,
    whatsapp            VARCHAR(50),
    customer_type       VARCHAR(50)  DEFAULT 'new',       -- 'new', 'returning', 'loyal'
    subscription_status VARCHAR(50)  DEFAULT 'inactive',  -- 'active', 'inactive'
    follow_up_status    VARCHAR(50)  DEFAULT 'none',      -- 'none', 'follow_up_1', 'follow_up_2', 'follow_up_3', 'cold', 'project_only'
    notes               TEXT,                             -- Catatan khusus untuk pelanggan
    referred_by         UUID         REFERENCES affiliates(id) ON UPDATE NO ACTION ON DELETE SET NULL,
    created_at          TIMESTAMPTZ  DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  DEFAULT NOW()
);


-- ── 3. stock_accounts ─────────────────────────────────────
CREATE TABLE stock_accounts (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    account_email    VARCHAR(255) NOT NULL,
    account_password VARCHAR(255) NOT NULL,
    status           VARCHAR(50)  DEFAULT 'available',  -- 'available', 'in_use', 'banned', 'expired', 'replaced'
    duration_days    INT          DEFAULT 30,           -- Durasi langganan akun (hari)
    product_type     VARCHAR(50)  DEFAULT 'mobile',     -- 'mobile', 'pc', 'team'
    max_slots        INT          DEFAULT 3,            -- Maksimum slot perangkat
    used_slots       INT          DEFAULT 0,            -- Slot yang sudah terpakai
    notes            TEXT,                              -- Catatan error / alasan banned
    created_at       TIMESTAMPTZ  DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  DEFAULT NOW()
);


-- ── 4. tags ───────────────────────────────────────────────
CREATE TABLE tags (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(100) UNIQUE NOT NULL,
    color      VARCHAR(20)  NOT NULL DEFAULT '#818cf8',  -- Warna hex untuk label UI
    created_at TIMESTAMPTZ  DEFAULT NOW()
);


-- ── 5. transactions ───────────────────────────────────────
CREATE TABLE transactions (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    lynk_id_ref         VARCHAR(255)    UNIQUE,           -- ID order dari Lynk.id (null jika manual)
    user_id             UUID            REFERENCES users(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
    stock_account_id    UUID            REFERENCES stock_accounts(id) ON DELETE SET NULL ON UPDATE NO ACTION,
    amount              DECIMAL(12, 2)  NOT NULL DEFAULT 0,
    product_name        VARCHAR(255),                     -- Nama produk (misal: 'CapCut Pro PC 1 Bulan')
    status              VARCHAR(50)     DEFAULT 'success', -- 'success', 'pending', 'failed', 'refund'
    is_manual           BOOLEAN         DEFAULT false,    -- true = ditambahkan manual dari dashboard
    purchase_date       TIMESTAMPTZ     DEFAULT NOW(),    -- Tanggal pembelian
    warranty_expired_at TIMESTAMPTZ,                     -- Tanggal masa garansi habis
    created_at          TIMESTAMPTZ     DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     DEFAULT NOW()
);


-- ── 6. warranty_claims ────────────────────────────────────
CREATE TABLE warranty_claims (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID        REFERENCES transactions(id) ON DELETE CASCADE ON UPDATE NO ACTION,
    old_account_id UUID        REFERENCES stock_accounts(id) ON DELETE SET NULL ON UPDATE NO ACTION,  -- Akun yang bermasalah
    new_account_id UUID        REFERENCES stock_accounts(id) ON DELETE SET NULL ON UPDATE NO ACTION,  -- Akun pengganti
    claim_reason   TEXT,                                 -- Alasan klaim: 'Batas Limit Perangkat', dll.
    status         VARCHAR(50) DEFAULT 'resolved',       -- 'pending', 'resolved', 'rejected'
    created_at     TIMESTAMPTZ DEFAULT NOW()
);


-- ── 7. message_logs ───────────────────────────────────────
CREATE TABLE message_logs (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        REFERENCES users(id) ON DELETE CASCADE ON UPDATE NO ACTION,
    transaction_id  UUID        REFERENCES transactions(id) ON DELETE SET NULL ON UPDATE NO ACTION,
    whatsapp_number VARCHAR(50)  NOT NULL,               -- Nomor WA tujuan
    message_type    VARCHAR(50)  NOT NULL,               -- 'account_delivery', 'follow_up_1', 'follow_up_2', 'follow_up_3', 'cold_promo', 'warranty_replacement'
    message_content TEXT,                                -- Isi pesan yang dikirim
    status          VARCHAR(50)  DEFAULT 'sent',         -- 'sent', 'failed', 'delivered'
    sent_at         TIMESTAMPTZ  DEFAULT NOW()
);


-- ── 8. scheduled_followups ────────────────────────────────
CREATE TABLE scheduled_followups (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    title            VARCHAR(255) NOT NULL,
    message_template TEXT         NOT NULL,              -- Template pesan dengan variabel {name}, dll.
    scheduled_at     TIMESTAMPTZ  NOT NULL,              -- Waktu jadwal eksekusi
    status           VARCHAR(50)  DEFAULT 'pending',     -- 'pending', 'running', 'done', 'failed'
    total_recipients INT          DEFAULT 0,
    sent_count       INT          DEFAULT 0,
    created_at       TIMESTAMPTZ  DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  DEFAULT NOW()
);


-- ── 9. scheduled_followup_recipients ─────────────────────
CREATE TABLE scheduled_followup_recipients (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    followup_id     UUID        REFERENCES scheduled_followups(id) ON DELETE CASCADE ON UPDATE NO ACTION,
    whatsapp_number VARCHAR(50)  NOT NULL,
    customer_name   VARCHAR(255),
    status          VARCHAR(50)  DEFAULT 'pending',      -- 'pending', 'sent', 'failed'
    sent_at         TIMESTAMPTZ                          -- Waktu aktual pesan berhasil dikirim
);


-- ── 10. affiliate_commissions ─────────────────────────────
CREATE TABLE affiliate_commissions (
    id                 UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id       UUID            REFERENCES affiliates(id) ON DELETE CASCADE ON UPDATE NO ACTION,
    transaction_id     UUID            REFERENCES transactions(id) ON DELETE CASCADE ON UPDATE NO ACTION,
    user_id            UUID            REFERENCES users(id) ON DELETE SET NULL ON UPDATE NO ACTION,
    amount             DECIMAL(12, 2)  NOT NULL,          -- Nominal komisi yang dikreditkan
    transaction_amount DECIMAL(12, 2)  NOT NULL,          -- Nilai transaksi acuan
    status             VARCHAR(50)     DEFAULT 'credited', -- 'credited', 'withdrawn'
    created_at         TIMESTAMPTZ     DEFAULT NOW()
);


-- ── 11. affiliate_withdrawals ─────────────────────────────
CREATE TABLE affiliate_withdrawals (
    id           UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id UUID            REFERENCES affiliates(id) ON DELETE CASCADE ON UPDATE NO ACTION,
    amount       DECIMAL(12, 2)  NOT NULL,
    status       VARCHAR(50)     DEFAULT 'pending',       -- 'pending', 'approved', 'rejected'
    notes        TEXT,
    created_at   TIMESTAMPTZ     DEFAULT NOW(),
    processed_at TIMESTAMPTZ                              -- Waktu diproses/disetujui
);


-- ── 12. customer_tags ─────────────────────────────────────
CREATE TABLE customer_tags (
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE NO ACTION,
    tag_id      UUID        NOT NULL REFERENCES tags(id) ON DELETE CASCADE ON UPDATE NO ACTION,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, tag_id)
);


-- ============================================================
-- STEP 3: Indexes untuk performa query
-- ============================================================

-- users
CREATE INDEX idx_users_email              ON users(email);
CREATE INDEX idx_users_subscription       ON users(subscription_status);
CREATE INDEX idx_users_customer_type      ON users(customer_type);
CREATE INDEX idx_users_referred_by        ON users(referred_by);

-- transactions
CREATE INDEX idx_transactions_user_id     ON transactions(user_id);
CREATE INDEX idx_transactions_stock_acc   ON transactions(stock_account_id);
CREATE INDEX idx_transactions_purchase    ON transactions(purchase_date);
CREATE INDEX idx_transactions_lynk_ref    ON transactions(lynk_id_ref);
CREATE INDEX idx_transactions_status      ON transactions(status);

-- warranty_claims
CREATE INDEX idx_warranty_transaction     ON warranty_claims(transaction_id);

-- message_logs
CREATE INDEX idx_message_logs_user        ON message_logs(user_id);
CREATE INDEX idx_message_logs_sent_at     ON message_logs(sent_at);

-- scheduled_followup_recipients
CREATE INDEX idx_sfr_followup_id          ON scheduled_followup_recipients(followup_id);
CREATE INDEX idx_sfr_status               ON scheduled_followup_recipients(status);

-- affiliate_commissions
CREATE INDEX idx_aff_comm_affiliate       ON affiliate_commissions(affiliate_id);
CREATE INDEX idx_aff_comm_transaction     ON affiliate_commissions(transaction_id);

-- customer_tags
CREATE INDEX idx_ctags_tag_id             ON customer_tags(tag_id);


-- ============================================================
-- SELESAI ✓
-- Semua 12 tabel berhasil dibuat dengan struktur terbaru.
-- ============================================================
