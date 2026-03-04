-- +goose Up
-- PR-058: Referral Growth Engine

-- 1. Add referral_code to workspaces
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- Create an index to quickly resolve referrals via referral_code
CREATE INDEX IF NOT EXISTS workspaces_referral_code_idx ON workspaces(referral_code);


-- 2. Create referrals table
CREATE TABLE IF NOT EXISTS referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_workspace CHAR(26) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    referred_workspace CHAR(26) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    reward_granted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraint to prevent multiple attachments between the same two nodes
    CONSTRAINT referrals_referrer_referred_unique UNIQUE (referrer_workspace, referred_workspace),
    -- Constraint to prevent self-referrals natively in DB
    CONSTRAINT referrals_no_self_referral CHECK (referrer_workspace != referred_workspace)
);

-- Index for searching referred workspaces effectively via referrer
CREATE INDEX IF NOT EXISTS referrals_referrer_workspace_idx ON referrals(referrer_workspace);

-- Index for checking unrewarded referrals
CREATE INDEX IF NOT EXISTS referrals_referred_unrewarded_idx ON referrals(referred_workspace) WHERE reward_granted = false;
