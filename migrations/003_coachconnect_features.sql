ALTER TABLE vendors ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS contact_phone TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS vendors_user_id_unique ON vendors(user_id) WHERE user_id IS NOT NULL;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS stock_quantity INTEGER NOT NULL DEFAULT 100;
CREATE TABLE IF NOT EXISTS orders (
 id BIGSERIAL PRIMARY KEY,
 order_code TEXT NOT NULL UNIQUE,
 vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
 customer_name TEXT NOT NULL,
 customer_phone TEXT NOT NULL,
 train_number TEXT NOT NULL DEFAULT '',
 coach_number TEXT NOT NULL DEFAULT '',
 pickup_station TEXT NOT NULL DEFAULT '',
 pickup_time TEXT NOT NULL DEFAULT '',
 items JSONB NOT NULL DEFAULT '[]'::jsonb,
 total NUMERIC(10,2) NOT NULL DEFAULT 0,
 status TEXT NOT NULL DEFAULT 'Received',
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_vendor_created_idx ON orders(vendor_id, created_at DESC);
CREATE TABLE IF NOT EXISTS reviews (
 id BIGSERIAL PRIMARY KEY,
 vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
 customer_name TEXT NOT NULL DEFAULT 'Passenger',
 rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
 comment TEXT NOT NULL DEFAULT '',
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reviews_vendor_idx ON reviews(vendor_id, created_at DESC);