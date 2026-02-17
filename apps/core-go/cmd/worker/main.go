package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"

	"modulajar/apps/core-go/db"
	"modulajar/apps/core-go/metrics"
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

	// Register worker handler
	http.HandleFunc("/", worker.Handler())

	// Observability
	// Register on-scrape collector for queue stats
	prometheus.MustRegister(metrics.NewQueueCollector())

	http.Handle("/metrics", promhttp.Handler())
	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("ok")) })
	http.HandleFunc("/readyz", func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("ok")) })

	log.Printf("Worker listening on port %s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatal(err)
	}
}
