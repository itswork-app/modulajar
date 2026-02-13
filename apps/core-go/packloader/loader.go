package packloader

import (
	"encoding/json"
	"fmt"
	"os"
)

// Subject represents a single subject within a curriculum pack.
type Subject struct {
	Code           string          `json:"code"`
	Name           string          `json:"name"`
	TimeAllocation *TimeAllocation `json:"time_allocation,omitempty"`
	Outcomes       []Outcome       `json:"outcomes,omitempty"`
}

// TimeAllocation represents the time allocation for a subject.
type TimeAllocation struct {
	HoursPerWeek     float64 `json:"hours_per_week"`
	WeeksPerSemester float64 `json:"weeks_per_semester"`
}

// Outcome represents a learning outcome (placeholder for v0).
type Outcome struct {
	Code        string `json:"code"`
	Description string `json:"description"`
}

// CurriculumPack represents a versioned curriculum pack.
type CurriculumPack struct {
	PackID   string    `json:"pack_id"`
	Name     string    `json:"name"`
	Version  string    `json:"version"`
	Jenjang  string    `json:"jenjang"`
	Kelas    string    `json:"kelas"`
	Subjects []Subject `json:"subjects"`
}

// LoadPack loads and validates a curriculum pack from a JSON file.
func LoadPack(path string) (*CurriculumPack, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read pack file: %w", err)
	}

	var pack CurriculumPack
	if err := json.Unmarshal(data, &pack); err != nil {
		return nil, fmt.Errorf("failed to parse pack JSON: %w", err)
	}

	if err := validate(&pack); err != nil {
		return nil, fmt.Errorf("pack validation failed: %w", err)
	}

	return &pack, nil
}

// validate checks that all required fields are present.
func validate(pack *CurriculumPack) error {
	if pack.PackID == "" {
		return fmt.Errorf("missing required field: pack_id")
	}
	if pack.Name == "" {
		return fmt.Errorf("missing required field: name")
	}
	if pack.Version == "" {
		return fmt.Errorf("missing required field: version")
	}
	if pack.Jenjang == "" {
		return fmt.Errorf("missing required field: jenjang")
	}
	if pack.Kelas == "" {
		return fmt.Errorf("missing required field: kelas")
	}
	if len(pack.Subjects) == 0 {
		return fmt.Errorf("subjects array must not be empty")
	}
	for i, s := range pack.Subjects {
		if s.Code == "" {
			return fmt.Errorf("subject[%d]: missing required field: code", i)
		}
		if s.Name == "" {
			return fmt.Errorf("subject[%d]: missing required field: name", i)
		}
	}
	return nil
}
