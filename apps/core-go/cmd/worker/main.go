package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"modulajar/apps/core-go/db"
	"modulajar/apps/core-go/metrics"
	"modulajar/apps/core-go/render"
	"modulajar/apps/core-go/worker"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

func main() {
	if err := Bootstrap(os.Args); err != nil {
		log.Fatal(err)
	}
}

// Bootstrap inits the worker and starts the server.
// Exported for testing/coverage of the init sequence.
func Bootstrap(args []string) error {
	log.SetFlags(log.LstdFlags | log.Lshortfile)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// Initialize DB
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := db.Init(ctx); err != nil {
		return fmt.Errorf("failed to initialize DB: %v", err)
	}
	defer db.Close()

	// Initialize Worker with Real Dependencies
	setupCtx, setupCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer setupCancel()

	realWorker, err := worker.NewRealWorker(setupCtx)
	if err != nil {
		log.Printf("Warning: Failed to initialize worker dependencies fully: %v", err)
	}
	if realWorker == nil {
		return fmt.Errorf("failed to create worker instance")
	}

	// Register handlers
	mux := http.NewServeMux()
	mux.HandleFunc("/", worker.NewHandler(realWorker))
	mux.Handle("/metrics", promhttp.Handler())
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("ok")) })
	mux.HandleFunc("/readyz", worker.ReadinessHandler(db.Ping, render.CheckChromeReadiness))

	// Register on-scrape collector
	// Note: Register might fail if already registered in tests, ignoring for simplicity
	_ = prometheus.Register(metrics.NewQueueCollector())

	// PR-059: Start heartbeat loop for production safety metrics
	heartbeatCtx, heartbeatCancel := context.WithCancel(context.Background())
	defer heartbeatCancel()
	metrics.StartHeartbeatLoop(heartbeatCtx)

	log.Printf("Worker listening on port %s", port)

	// Skip ListenAndServe in short/test mode if needed,
	// but for coverage we'll just test the initialization part.
	if os.Getenv("SKIP_SERVER") == "true" {
		return nil
	}

	return http.ListenAndServe(":"+port, mux)
}
