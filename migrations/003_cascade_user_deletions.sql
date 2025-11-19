-- Migration to add CASCADE delete behavior for user deletions
-- This ensures that when a user is deleted, all their related data is also deleted

-- Update short_links foreign key constraint to CASCADE on delete
ALTER TABLE short_links 
DROP CONSTRAINT IF EXISTS short_links_user_id_fkey,
ADD CONSTRAINT short_links_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES users(id) 
    ON DELETE CASCADE;

-- Ensure api_keys has CASCADE (should already be set, but making sure)
ALTER TABLE api_keys 
DROP CONSTRAINT IF EXISTS api_keys_user_id_fkey,
ADD CONSTRAINT api_keys_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES users(id) 
    ON DELETE CASCADE;

-- clicks already cascades via short_links, no change needed
-- (clicks -> short_links -> users will cascade properly)
