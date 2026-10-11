ALTER TABLE vendors ADD COLUMN IF NOT EXISTS served_coaches TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS vendors_station_idx ON vendors(station);