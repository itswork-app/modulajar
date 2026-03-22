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
	if err := Run(os.Args); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

// Run executes the validation logic and returns an error if any.
// Exported for testing/coverage.
func Run(args []string) error {
	packPath := filepath.Join("..", "..", "packs", "merdeka", "sd4", "v1", "pack.json")
	if len(args) > 1 {
		packPath = args[1]
	}

	pack, err := packloader.LoadPack(packPath)
	if err != nil {
		return fmt.Errorf("error loading pack: %v", err)
	}

	// Generate plan
	config := planner.DefaultConfig()
	result, err := planner.Plan(planner.PlannerInput{Pack: pack, Config: config})
	if err != nil {
		return fmt.Errorf("error planning: %v", err)
	}

	// Validate
	report, err := validator.Validate(validator.ValidatorInput{Pack: pack, Result: result})
	if err != nil {
		return fmt.Errorf("error validating: %v", err)
	}

	out, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return fmt.Errorf("error marshaling: %v", err)
	}

	fmt.Println(string(out))

	if !report.OK {
		return fmt.Errorf("validation failed")
	}
	return nil
}
