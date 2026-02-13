package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"modulajar/apps/core-go/packloader"
	"modulajar/apps/core-go/planner"
	"modulajar/apps/core-go/validator"
)

func main() {
	packPath := filepath.Join("packs", "merdeka", "sd4", "v1", "pack.json")
	if len(os.Args) > 1 {
		packPath = os.Args[1]
	}

	pack, err := packloader.LoadPack(packPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error loading pack: %v\n", err)
		os.Exit(1)
	}

	// Generate plan
	config := planner.DefaultConfig()
	result, err := planner.Plan(planner.PlannerInput{Pack: pack, Config: config})
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error planning: %v\n", err)
		os.Exit(1)
	}

	// Validate
	report, err := validator.Validate(validator.ValidatorInput{Pack: pack, Result: result})
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error validating: %v\n", err)
		os.Exit(1)
	}

	out, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error marshaling: %v\n", err)
		os.Exit(1)
	}

	fmt.Println(string(out))

	if !report.OK {
		os.Exit(1)
	}
}
