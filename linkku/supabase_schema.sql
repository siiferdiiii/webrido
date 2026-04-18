-- ═══════════════════════════════════════════════════════════
-- Dorizz Store Dashboard — Full Schema
-- Run this in Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ═════ Users (Customers) ═════
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  whatsapp VARCHAR(50),
  customer_type VARCHAR(50) DEFAULT 'new',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  subscription_status VARCHAR(50) DEFAULT 'inactive',
  follow_up_status VARCHAR(50) DEFAULT 'none',
  referred_by UUID
);

-- ═════ Stock Accounts ═════
CREATE TABLE IF NOT EXISTS stock_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_email VARCHAR(255) NOT NULL,
  account_password VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'available',
  duration_days INT DEFAULT 30,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  product_type VARCHAR(50) DEFAULT 'mobile',
  max_slots INT DEFAULT 3,
  used_slots INT DEFAULT 0
);

-- ═════ Transactions ═════
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lynk_id_ref VARCHAR(255) UNIQUE,
  user_id UUID REFERENCES users(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
  stock_account_id UUID REFERENCES stock_accounts(id) ON UPDATE NO ACTION,
  amount DECIMAL(12,2) DEFAULT 0,
  product_name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'success',
  is_manual BOOLEAN DEFAULT false,
  purchase_date TIMESTAMPTZ DEFAULT now(),
  warranty_expired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ═════ Warranty Claims ═════
CREATE TABLE IF NOT EXISTS warranty_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  old_account_id UUID REFERENCES stock_accounts(id) ON UPDATE NO ACTION,
  new_account_id UUID REFERENCES stock_accounts(id) ON UPDATE NO ACTION,
  claim_reason TEXT,
  status VARCHAR(50) DEFAULT 'resolved',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═════ Message Logs ═════
CREATE TABLE IF NOT EXISTS message_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  transaction_id UUID REFERENCES transactions(id) ON UPDATE NO ACTION,
  whatsapp_number VARCHAR(50) NOT NULL,
  message_type VARCHAR(50) NOT NULL,
  message_content TEXT,
  status VARCHAR(50) DEFAULT 'sent',
  sent_at TIMESTAMPTZ DEFAULT now()
);

-- ═════ Scheduled Follow-Ups ═════
CREATE TABLE IF NOT EXISTS scheduled_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  message_template TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  total_recipients INT DEFAULT 0,
  sent_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scheduled_followup_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  followup_id UUID REFERENCES scheduled_followups(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  whatsapp_number VARCHAR(50) NOT NULL,
  customer_name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  sent_at TIMESTAMPTZ
);

-- ═════ Affiliates ═════
CREATE TABLE IF NOT EXISTS affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  whatsapp VARCHAR(50),
  email VARCHAR(255) UNIQUE,
  password VARCHAR(255),
  invite_token VARCHAR(255) UNIQUE,
  commission_rate DECIMAL(5,2) DEFAULT 10.00,
  total_earned DECIMAL(12,2) DEFAULT 0,
  balance DECIMAL(12,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add FK from users to affiliates
ALTER TABLE users ADD CONSTRAINT users_referred_by_fkey 
  FOREIGN KEY (referred_by) REFERENCES affiliates(id) ON UPDATE NO ACTION;

CREATE TABLE IF NOT EXISTS affiliate_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID REFERENCES affiliates(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  user_id UUID REFERENCES users(id) ON UPDATE NO ACTION,
  amount DECIMAL(12,2) NOT NULL,
  transaction_amount DECIMAL(12,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'credited',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS affiliate_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID REFERENCES affiliates(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  amount DECIMAL(12,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);

-- ═════ Tags ═════
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  color VARCHAR(20) DEFAULT '#818cf8',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer_tags (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  assigned_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (user_id, tag_id)
);

-- ═════ App Settings ═════
CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ═════ Admin Users ═════
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'admin',
  status VARCHAR(50) DEFAULT 'inactive',
  permissions JSONB,
  whatsapp VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ═════ Admin Schedules ═════
CREATE TABLE IF NOT EXISTS admin_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "adminId" UUID UNIQUE NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  "shiftStart" VARCHAR(5) NOT NULL,
  "shiftEnd" VARCHAR(5) NOT NULL,
  "isActive" BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ═════ Tasks ═════
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  "recurrenceType" VARCHAR(20) DEFAULT 'daily' NOT NULL,
  "scheduledDate" VARCHAR(10),
  period_start VARCHAR(10),
  period_end VARCHAR(10),
  "isActive" BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ═════ Task Assignments ═════
CREATE TABLE IF NOT EXISTS task_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "taskId" UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  "adminId" UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  date VARCHAR(10) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' NOT NULL,
  completed_at TIMESTAMPTZ,
  assigned_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE ("taskId", "adminId", date)
);

-- ═════ Attendance Records ═════
CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "adminId" UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  date VARCHAR(10) NOT NULL,
  check_in_at TIMESTAMPTZ,
  check_out_at TIMESTAMPTZ,
  webhook_sent_in BOOLEAN DEFAULT false,
  webhook_sent_out BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE ("adminId", date)
);

-- ═══════════════════════════════════════════════════════════
-- Enable Realtime for key tables
-- ═══════════════════════════════════════════════════════════
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE users;
ALTER PUBLICATION supabase_realtime ADD TABLE stock_accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE scheduled_followups;
ALTER PUBLICATION supabase_realtime ADD TABLE message_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE affiliate_commissions;
ALTER PUBLICATION supabase_realtime ADD TABLE warranty_claims;

-- ═══════════════════════════════════════════════════════════
-- Done! Tables created & Realtime enabled.
-- ═══════════════════════════════════════════════════════════
