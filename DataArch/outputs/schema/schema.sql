-- DataArch.AI — Auto-generated PostgreSQL schema
-- Generated: 2026-03-20T19:13:24.112904
-- Version:   1.1

CREATE TABLE IF NOT EXISTS business_unit (
    id BIGSERIAL,
    canonical_name VARCHAR(255) NOT NULL UNIQUE,
    headcount BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    parent_entity VARCHAR(255) NOT NULL,
    unit_id VARCHAR(255) NOT NULL,
    source_file VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS customer (
    id BIGSERIAL,
    canonical_name VARCHAR(255) NOT NULL UNIQUE,
    customer_id VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255) NOT NULL,
    revenue_tier VARCHAR(255) NOT NULL,
    segment VARCHAR(255) NOT NULL,
    source_file VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS financial_record (
    id BIGSERIAL,
    canonical_name VARCHAR(255) NOT NULL UNIQUE,
    currency VARCHAR(255) NOT NULL,
    period VARCHAR(255) NOT NULL,
    record_type VARCHAR(255) NOT NULL,
    total_value DECIMAL(18,2) NOT NULL,
    source_file VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS product (
    id BIGSERIAL,
    canonical_name VARCHAR(255) NOT NULL UNIQUE,
    category VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    product_id VARCHAR(255) NOT NULL,
    revenue_type VARCHAR(255) NOT NULL,
    unit_price DECIMAL(18,2) NOT NULL,
    source_file VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS vendor (
    id BIGSERIAL,
    canonical_name VARCHAR(255) NOT NULL UNIQUE,
    category VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255) NOT NULL,
    payment_terms VARCHAR(255) NOT NULL,
    vendor_id VARCHAR(255) NOT NULL,
    source_file VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS employee (
    id BIGSERIAL,
    canonical_name VARCHAR(255) NOT NULL UNIQUE,
    compensation_band VARCHAR(255) NOT NULL,
    department VARCHAR(255) NOT NULL,
    employee_id VARCHAR(255) NOT NULL,
    role VARCHAR(255) NOT NULL,
    source_file VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id),
    FOREIGN KEY (department) REFERENCES business_unit(canonical_name)
);

CREATE TABLE IF NOT EXISTS contract (
    id BIGSERIAL,
    canonical_name VARCHAR(255) NOT NULL UNIQUE,
    contract_id VARCHAR(255) NOT NULL,
    customer_id VARCHAR(255) NOT NULL,
    effective_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    parties VARCHAR(255) NOT NULL,
    "type" VARCHAR(255) NOT NULL,
    value VARCHAR(255) NOT NULL,
    vendor_id VARCHAR(255) NOT NULL,
    source_file VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id),
    FOREIGN KEY (vendor_id) REFERENCES vendor(canonical_name),
    FOREIGN KEY (customer_id) REFERENCES customer(canonical_name)
);

CREATE TABLE IF NOT EXISTS "transaction" (
    id BIGSERIAL,
    canonical_name VARCHAR(255) NOT NULL UNIQUE,
    amount DECIMAL(18,2) NOT NULL,
    counterparty VARCHAR(255) NOT NULL,
    currency VARCHAR(255) NOT NULL,
    customer_id VARCHAR(255),
    date DATE NOT NULL,
    direction VARCHAR(255) NOT NULL,
    transaction_id VARCHAR(255) NOT NULL,
    vendor_id VARCHAR(255) NOT NULL,
    source_file VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id),
    FOREIGN KEY (vendor_id) REFERENCES vendor(canonical_name),
    FOREIGN KEY (customer_id) REFERENCES customer(canonical_name)
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_business_unit_canonical_name ON business_unit (canonical_name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_canonical_name ON customer (canonical_name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_financial_record_canonical_name ON financial_record (canonical_name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_canonical_name ON product (canonical_name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_canonical_name ON vendor (canonical_name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_canonical_name ON employee (canonical_name);
CREATE INDEX IF NOT EXISTS idx_employee_department ON employee (department);
CREATE UNIQUE INDEX IF NOT EXISTS idx_contract_canonical_name ON contract (canonical_name);
CREATE INDEX IF NOT EXISTS idx_contract_vendor_id ON contract (vendor_id);
CREATE INDEX IF NOT EXISTS idx_contract_customer_id ON contract (customer_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_transaction_canonical_name ON "transaction" (canonical_name);
CREATE INDEX IF NOT EXISTS idx_transaction_vendor_id ON "transaction" (vendor_id);
CREATE INDEX IF NOT EXISTS idx_transaction_customer_id ON "transaction" (customer_id);
