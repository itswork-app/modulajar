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
	// Default pack path (relative to repo root)
	packPath := filepath.Join("packs", "merdeka", "sd4", "v1", "pack.json")

	// Allow override via CLI arg
	if len(os.Args) > 1 {
		packPath = os.Args[1]
	}

	pack, err := packloader.LoadPack(packPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error loading pack: %v\n", err)
		os.Exit(1)
	}

	config := planner.DefaultConfig()
	input := planner.PlannerInput{
		Pack:   pack,
		Config: config,
	}

	result, err := planner.Plan(input)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error planning: %v\n", err)
		os.Exit(1)
	}

	out, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error marshaling: %v\n", err)
		os.Exit(1)
	}

	fmt.Println(string(out))
}
