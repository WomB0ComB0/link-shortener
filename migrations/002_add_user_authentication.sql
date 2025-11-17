-- Add password_hash column to users table for authentication
ALTER TABLE users ADD COLUMN password_hash TEXT NOT NULL DEFAULT '';

-- Create index on password_hash for faster lookups
CREATE INDEX idx_users_password_hash ON users(password_hash);
