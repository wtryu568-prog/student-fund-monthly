-- =============================================
-- Supabase Schema: ระบบกองทุนนักศึกษาแบบรายเดือน
-- =============================================

-- 1. Users (นักศึกษา)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  student_id TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  nickname TEXT DEFAULT '',
  email TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('treasurer', 'committee', 'leader', 'member')),
  position TEXT DEFAULT 'นักศึกษา',
  phone TEXT DEFAULT '',
  password TEXT DEFAULT '123456',
  is_active BOOLEAN DEFAULT TRUE,
  classroom TEXT DEFAULT 'ห้อง 1',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Settings (ตั้งค่ากองทุน) - singleton row
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY DEFAULT 'main',
  fund_name TEXT DEFAULT 'เงินเก็บTns รุ่น06',
  monthly_fee NUMERIC DEFAULT 150,
  promptpay_number TEXT DEFAULT '',
  promptpay_name TEXT DEFAULT '',
  promptpay_qr_url TEXT DEFAULT '',
  bank_name TEXT DEFAULT 'พร้อมเพย์',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Monthly Bills (บิลรายเดือน)
CREATE TABLE IF NOT EXISTS monthly_bills (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 150,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('paid', 'pending_review', 'pending')),
  due_date TEXT NOT NULL,
  paid_at TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Payments (การชำระเงิน)
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bill_id TEXT NOT NULL REFERENCES monthly_bills(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  slip_url TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('approved', 'rejected', 'pending_review')),
  reviewed_by TEXT,
  reviewed_at TEXT,
  reject_reason TEXT DEFAULT '',
  receipt_number TEXT DEFAULT '',
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Transactions (รายรับ-รายจ่าย)
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  description TEXT DEFAULT '',
  reference_id TEXT,
  reference_type TEXT,
  receipt_url TEXT DEFAULT '',
  created_by TEXT NOT NULL,
  approved_by TEXT,
  approved_at TEXT,
  month INTEGER,
  year INTEGER,
  is_closed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Market Weeks (สัปดาห์ตลาดวันพุธ)
CREATE TABLE IF NOT EXISTS market_weeks (
  id TEXT PRIMARY KEY,
  week_date TEXT NOT NULL,
  total_cost NUMERIC DEFAULT 0,
  total_revenue NUMERIC DEFAULT 0,
  total_profit NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'completed', 'approved')),
  approved_by TEXT,
  approved_at TEXT,
  note TEXT DEFAULT '',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  team_name TEXT DEFAULT '',
  leader_id TEXT,
  member_ids JSONB DEFAULT '[]',
  advance_requested NUMERIC DEFAULT 0,
  advance_reason TEXT DEFAULT '',
  advance_status TEXT DEFAULT 'none',
  advance_approved_by TEXT,
  advance_approved_at TEXT,
  advance_reject_reason TEXT DEFAULT '',
  advance_receipt_url TEXT DEFAULT '',
  additional_advance_requested NUMERIC DEFAULT 0,
  additional_advance_reason TEXT DEFAULT '',
  additional_advance_status TEXT DEFAULT 'none',
  additional_advance_approved_by TEXT,
  additional_advance_approved_at TEXT,
  additional_advance_reject_reason TEXT DEFAULT '',
  additional_advance_receipt_url TEXT DEFAULT ''
);

-- 7. Market Items (รายการสินค้า/ต้นทุน)
CREATE TABLE IF NOT EXISTS market_items (
  id TEXT PRIMARY KEY,
  market_week_id TEXT NOT NULL REFERENCES market_weeks(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('cost', 'revenue')),
  amount NUMERIC NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1,
  receipt_url TEXT DEFAULT '',
  note TEXT DEFAULT '',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Market Teams (ทีมตลาด)
CREATE TABLE IF NOT EXISTS market_teams (
  id TEXT PRIMARY KEY,
  market_week_id TEXT NOT NULL REFERENCES market_weeks(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('leader', 'seller', 'buyer')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Activities (กิจกรรม)
CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  proposed_by TEXT NOT NULL,
  status TEXT DEFAULT 'proposed',
  event_date TEXT,
  location TEXT DEFAULT '',
  budget_estimated NUMERIC DEFAULT 0,
  budget_approved NUMERIC DEFAULT 0,
  approved_by TEXT,
  approved_at TEXT,
  reject_reason TEXT DEFAULT '',
  document_urls JSONB DEFAULT '[]',
  actual_expense NUMERIC DEFAULT 0,
  refund_amount NUMERIC DEFAULT 0,
  refund_slip_url TEXT DEFAULT '',
  expense_receipts JSONB DEFAULT '[]',
  settled_by TEXT,
  settled_at TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  budget_expansion_requested NUMERIC DEFAULT 0,
  budget_expansion_reason TEXT DEFAULT '',
  budget_expansion_status TEXT DEFAULT 'none',
  budget_expansion_approved_by TEXT,
  budget_expansion_approved_at TEXT,
  budget_expansion_reject_reason TEXT DEFAULT '',
  external_incomes JSONB DEFAULT '[]'
);

-- 10. Budget Requests (คำขอเบิกงบ)
CREATE TABLE IF NOT EXISTS budget_requests (
  id TEXT PRIMARY KEY,
  activity_id TEXT,
  title TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  reason TEXT DEFAULT '',
  details TEXT DEFAULT '',
  document_urls JSONB DEFAULT '[]',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_by TEXT NOT NULL,
  approved_by TEXT,
  approved_at TEXT,
  reject_reason TEXT DEFAULT '',
  is_expansion BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Announcements (ประกาศ)
CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('urgent', 'normal')),
  is_pinned BOOLEAN DEFAULT FALSE,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Notifications (แจ้งเตือน)
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT DEFAULT '',
  type TEXT DEFAULT 'system',
  reference_id TEXT,
  reference_type TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Logs (ประวัติการกระทำ)
CREATE TABLE IF NOT EXISTS logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Petitions (คำร้อง/ข้อเสนอ)
CREATE TABLE IF NOT EXISTS petitions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  content TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  is_anonymous BOOLEAN DEFAULT FALSE,
  submitted_by TEXT NOT NULL,
  response TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TEXT,
  resolved_by TEXT
);

-- 15. Password Resets (คำขอรีเซ็ตรหัสผ่าน)
CREATE TABLE IF NOT EXISTS password_resets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  classroom TEXT DEFAULT 'ห้อง 1',
  status TEXT DEFAULT 'pending',
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TEXT,
  resolved_by TEXT
);

-- 16. Images (เก็บรูปภาพ base64)
CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  base64 TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- Indexes สำหรับ query ที่ใช้บ่อย
-- =============================================
CREATE INDEX IF NOT EXISTS idx_monthly_bills_user ON monthly_bills(user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_bills_period ON monthly_bills(month, year);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_bill ON payments(bill_id);
CREATE INDEX IF NOT EXISTS idx_transactions_period ON transactions(month, year);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_logs_user ON logs(user_id);
CREATE INDEX IF NOT EXISTS idx_market_items_week ON market_items(market_week_id);
CREATE INDEX IF NOT EXISTS idx_market_teams_week ON market_teams(market_week_id);

-- =============================================
-- Disable RLS for now (server uses service_role key)
-- =============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE petitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;
ALTER TABLE images ENABLE ROW LEVEL SECURITY;

-- Allow full access for service_role (server-side)
CREATE POLICY "Service role full access" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON monthly_bills FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON market_weeks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON market_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON market_teams FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON activities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON budget_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON announcements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON petitions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON password_resets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON images FOR ALL USING (true) WITH CHECK (true);
