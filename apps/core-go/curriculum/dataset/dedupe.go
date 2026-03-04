package dataset

import (
	"crypto/sha256"
	"encoding/hex"
)

// CalculateHash computes a SHA256 hash of the given JSON data for deduplication.
func CalculateHash(data []byte) string {
	hash := sha256.Sum256(data)
	return hex.EncodeToString(hash[:])
}
