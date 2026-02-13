# ID Specification (Dual-ID System)

ModulAjar uses a dual-ID system to balance usability and security.

## 1. Public ID (PID)
- **Format**: `ma_<entity>_<timestamp>_<random>`
- **Usage**: URLs, public references.
- **Example**: `ma_ws_12345678_xyz`

## 2. Deterministic ID (DID)
- **Format**: UUIDv7 (Time-sortable)
- **Usage**: Database Primary Keys, Foreign Keys.
- **Mapping**: PID -> DID mapping is cached and immutable.

## 3. HMAC Suffix
- All public verification URLs include an 8-character HMAC suffix to prevent enumeration.
- Format: `.../verify/:pid?s=HMAC_8_CHAR`

## 4. Routing
- **App**: `app.modulajar.app/w/:workspace_pid/...`
- **API**: `api.modulajar.app/w/:workspace_pid/...`
- **Verification**: `modulajar.app/verify/:scan_id` (Public)
