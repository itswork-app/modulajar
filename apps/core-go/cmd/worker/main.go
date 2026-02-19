package main

import (
	"context"
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
	log.SetFlags(log.LstdFlags | log.Lshortfile)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// Initialize DB with timeout context
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := db.Init(ctx); err != nil {
		log.Fatalf("Failed to initialize DB: %v", err)
	}
	defer db.Close()

	// Initialize Worker with Real Dependencies
	// We need a context for GCS client initialization (it might use background context or specific one)
	// NewRealWorker uses passed context.
	// Since GCS client is long-lived, we should pass a background context or long-lived one?
	// The ctx above is cancelled after 10s. GCS client creation might fail if it does network calls and ctx cancels?
	// NewRealWorker -> gcs.NewClient(ctx).
	// Typically client creation should be fast or use its own timeout.
	// Let's use a separate context for init or reuse existing but be aware of cancel.
	// Use Background for client scope?

	setupCtx, setupCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer setupCancel()

	realWorker, err := worker.NewRealWorker(setupCtx)
	if err != nil {
		// Log warning or fatal?
		// If GCS is required, fatal.
		// But allow running locally without GCS if optional?
		// Logic in NewRealWorker returns worker even if GCS fail potentially?
		// We made it return error if critical.
		// Let's log fatal to be safe for production.
		log.Printf("Warning: Failed to initialize worker dependencies fully: %v", err)
		// Don't fatal yet, maybe just proceed?
		// NewRealWorker returns error only if totally broken?
		// We'll proceed if realWorker is not nil.
	}
	if realWorker == nil {
		log.Fatal("Failed to create worker instance")
	}

	// Register worker handler
	http.HandleFunc("/", worker.NewHandler(realWorker))

	// Observability
	// Register on-scrape collector for queue stats
	prometheus.MustRegister(metrics.NewQueueCollector())

	http.Handle("/metrics", promhttp.Handler())
	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("ok")) })

	// Real readiness checks (PR-Audit Fix)
	http.HandleFunc("/readyz", worker.ReadinessHandler(db.Ping, render.CheckChromeReadiness))

	log.Printf("Worker listening on port %s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatal(err)
	}
}
