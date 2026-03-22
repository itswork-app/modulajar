package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"modulajar/apps/core-go/packloader"
	"modulajar/apps/core-go/planner"
)

func main() {
	if err := Run(os.Args); err != nil {
		fmt.Fprintf(os.Stderr, "%v\n", err)
		os.Exit(1)
	}
}

// Run executes the planner logic and returns an error if any.
// Exported for testing/coverage.
func Run(args []string) error {
	// Default pack path (relative to repo root)
	packPath := filepath.Join("..", "..", "packs", "merdeka", "sd4", "v1", "pack.json")

	// Allow override via CLI arg
	if len(args) > 1 {
		packPath = args[1]
	}

	pack, err := packloader.LoadPack(packPath)
	if err != nil {
		return fmt.Errorf("error loading pack: %v", err)
	}

	config := planner.DefaultConfig()
	input := planner.PlannerInput{
		Pack:   pack,
		Config: config,
	}

	result, err := planner.Plan(input)
	if err != nil {
		return fmt.Errorf("error planning: %v", err)
	}

	out, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		return fmt.Errorf("error marshaling: %v", err)
	}

	fmt.Println(string(out))
	return nil
}
