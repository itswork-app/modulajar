-- +goose Up
-- +goose StatementBegin

-- PR-056: NPSN Verification Layer
-- Lookup table for school verification data.

CREATE TABLE schools_reference (
    npsn TEXT PRIMARY KEY,
    nama_resmi TEXT NOT NULL,
    jenjang TEXT NOT NULL,
    alamat TEXT NULL,
    kab_kota TEXT NULL,
    provinsi TEXT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed Minimal Garut Dataset for testing
INSERT INTO schools_reference (npsn, nama_resmi, jenjang, alamat, kab_kota, provinsi)
VALUES 
('20227184', 'SMPN 1 GARUT', 'SMP', 'JL. JEND. A. YANI NO. 43', 'KAB. GARUT', 'PROV. JAWA BARAT'),
('20227185', 'SMPN 2 GARUT', 'SMP', 'JL. Kiansantang No.3', 'KAB. GARUT', 'PROV. JAWA BARAT'),
('20227186', 'SMPN 3 GARUT', 'SMP', 'JL. JENDRA SUDIRMAN', 'KAB. GARUT', 'PROV. JAWA BARAT'),
('20227187', 'SMAN 1 GARUT', 'SMA', 'JL. MERDEKA NO. 91', 'KAB. GARUT', 'PROV. JAWA BARAT');

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP TABLE IF EXISTS schools_reference;

-- +goose StatementEnd
