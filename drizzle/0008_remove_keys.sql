-- Remove Key Management feature and the associated tables
DROP TABLE IF EXISTS "key_employee_access";
DROP TABLE IF EXISTS "keys";
DELETE FROM "features" WHERE slug = 'keys';
