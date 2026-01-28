-- Query to check recently added customers
-- Run this in your database client (e.g., Neon SQL Editor, pgAdmin, etc.)

-- Get all customers ordered by creation date (most recent first)
SELECT 
    id,
    first_name,
    last_name,
    email,
    phone,
    alternate_phone,
    created_at
FROM customers
ORDER BY created_at DESC
LIMIT 10;

-- Get customers created in the last hour
SELECT 
    id,
    first_name,
    last_name,
    email,
    phone,
    alternate_phone,
    created_at
FROM customers
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- Count total customers
SELECT COUNT(*) as total_customers FROM customers;

