-- Migration: Create supplies table for inventory management
-- Run this SQL in your Neon database console

-- Create supplies table
CREATE TABLE IF NOT EXISTS supplies (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Item Details
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  sku VARCHAR(100),
  
  -- Quantity
  quantity INTEGER NOT NULL DEFAULT 0,
  unit VARCHAR(50),
  min_quantity INTEGER DEFAULT 5,
  
  -- Pricing
  unit_cost DECIMAL(12, 2),
  supplier VARCHAR(255),
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'in-stock',
  
  -- Notes
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS supplies_company_idx ON supplies(company_id);
CREATE INDEX IF NOT EXISTS supplies_category_idx ON supplies(category);
CREATE INDEX IF NOT EXISTS supplies_status_idx ON supplies(status);
CREATE INDEX IF NOT EXISTS supplies_sku_idx ON supplies(sku);

-- Add comment for documentation
COMMENT ON TABLE supplies IS 'Inventory/supplies tracking for cleaning companies';
