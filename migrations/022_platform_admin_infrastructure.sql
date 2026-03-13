-- +goose Up
-- +goose StatementBegin

-- 1. Pricing Plans Table
CREATE TABLE pricing_plans (
    id CHAR(26) PRIMARY KEY, -- ULID
    name VARCHAR(50) NOT NULL, -- e.g. 'Personal', 'Institution', 'Enterprise'
    slug VARCHAR(50) UNIQUE NOT NULL, -- e.g. 'personal', 'institution'
    base_price_idr BIGINT NOT NULL,
    base_credits INT NOT NULL,
    features JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 2. Platforms Global Roles (Super Admins/Investors)
CREATE TABLE platform_roles (
    clerk_user_id VARCHAR(255) PRIMARY KEY,
    role VARCHAR(50) NOT NULL, -- 'owner', 'investor', 'support'
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 3. Update Workspaces to support Tiers
ALTER TABLE workspaces ADD COLUMN plan_id CHAR(26) REFERENCES pricing_plans(id);
ALTER TABLE workspaces ADD COLUMN subscription_status VARCHAR(20) DEFAULT 'active'; -- 'active', 'past_due', 'canceled'

-- 4. Seed basic plans
INSERT INTO pricing_plans (id, name, slug, base_price_idr, base_credits, features) VALUES
('01JKZ7W4G1RJZW1ZQW1ZQW1ZQ1', 'Personal', 'personal', 0, 50, '{"max_members": 1, "custom_branding": false, "batch_generation": false}'),
('01JKZ7W4G1RJZW1ZQW1ZQW1ZQ2', 'Institutional', 'institution', 500000, 1000, '{"max_members": 50, "custom_branding": true, "batch_generation": true, "admin_dashboard": true}');

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE workspaces DROP COLUMN IF EXISTS subscription_status;
ALTER TABLE workspaces DROP COLUMN IF EXISTS plan_id;
DROP TABLE IF EXISTS platform_roles;
DROP TABLE IF EXISTS pricing_plans;
-- +goose StatementEnd
