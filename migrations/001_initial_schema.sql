-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User table to store user information
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    display_name TEXT,
    email TEXT UNIQUE,
    photo_url TEXT
);

-- ShortLink table for storing shortened URLs
CREATE TABLE short_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    original_url TEXT NOT NULL,
    short_url TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    custom_alias TEXT UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMPTZ
);

-- Click table for analytics and tracking
CREATE TABLE clicks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    short_link_id UUID NOT NULL REFERENCES short_links(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_agent TEXT,
    referrer TEXT,
    ip_address TEXT,
    country TEXT,
    city TEXT
);

-- ApiKey table for API authentication
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    name TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ
);

-- Indexes for better query performance
CREATE INDEX idx_short_links_user_id ON short_links(user_id);
CREATE INDEX idx_short_links_short_url ON short_links(short_url);
CREATE INDEX idx_short_links_custom_alias ON short_links(custom_alias);
CREATE INDEX idx_short_links_is_active ON short_links(is_active);
CREATE INDEX idx_clicks_short_link_id ON clicks(short_link_id);
CREATE INDEX idx_clicks_timestamp ON clicks(timestamp);
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_key ON api_keys(key);
CREATE INDEX idx_api_keys_is_active ON api_keys(is_active);
