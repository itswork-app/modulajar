package docgraph

import (
	"crypto/hmac"
	"crypto/sha256"
	"fmt"
	"strings"
)

const base32Chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

// toBase32 encodes bytes to custom readable base32.
func toBase32(buf []byte, length int) string {
	result := make([]byte, 0, length)
	for i := 0; i < len(buf) && len(result) < length; i++ {
		result = append(result, base32Chars[buf[i]%byte(len(base32Chars))])
	}
	return string(result)
}

// PackageShortCode derives a deterministic 6-char code from a package ID.
func PackageShortCode(packageID string) string {
	mac := hmac.New(sha256.New, []byte("package-short"))
	mac.Write([]byte(packageID))
	return toBase32(mac.Sum(nil), 6)
}

// IssueDID generates a canonical Document ID.
//
// Format: DOC-{subjectCode}-{kelas}-{semester}-{tahun}-{packageShort}-{hmac8}
// Example: DOC-BI-SD4-S1-2026-9Q1M7P-3D8K2HZA
func IssueDID(
	secret string,
	workspaceID string,
	packageID string,
	documentID string,
	subjectCode string,
	kelas string,
	semester string,
	tahunAjaran string,
) string {
	// Extract year
	year := tahunAjaran
	if idx := strings.LastIndex(tahunAjaran, "/"); idx >= 0 {
		year = tahunAjaran[idx+1:]
	}

	// Kelas normalization: "4" -> "SD4"
	kelasFormatted := strings.ToUpper(kelas)
	if !strings.HasPrefix(kelasFormatted, "SD") {
		kelasFormatted = "SD" + kelasFormatted
	}

	// Semester normalization: "1" -> "S1"
	semFormatted := strings.ToUpper(semester)
	if !strings.HasPrefix(semFormatted, "S") {
		semFormatted = "S" + semFormatted
	}

	// Package short code (6 chars)
	pkgShort := PackageShortCode(packageID)

	// HMAC suffix (8 chars)
	payload := fmt.Sprintf("%s:%s:%s:%s:%s:%s:%s",
		workspaceID, packageID, documentID, subjectCode, kelas, semester, tahunAjaran)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(payload))
	suffix := toBase32(mac.Sum(nil), 8)

	// Subject code uppercase for display
	subjUpper := strings.ToUpper(subjectCode)

	return fmt.Sprintf("DOC-%s-%s-%s-%s-%s-%s",
		subjUpper, kelasFormatted, semFormatted, year, pkgShort, suffix)
}
