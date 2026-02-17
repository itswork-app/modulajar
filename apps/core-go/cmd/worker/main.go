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
	// Cloud Tasks sends POST requests to root or configured path.
	// We'll handle root for simplicity, or /tasks/generate if needed.
	// But worker.go Handler checks method.
	http.HandleFunc("/", worker.Handler())

	// Observability
	http.Handle("/metrics", promhttp.Handler())
	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("ok")) })
	http.HandleFunc("/readyz", func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("ok")) })

	// Start background queue monitoring
	go monitorQueueStats(context.Background())

	log.Printf("Worker listening on port %s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatal(err)
	}
}

func monitorQueueStats(ctx context.Context) {
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			stats, err := db.GetQueueStats(ctx)
			if err != nil {
				log.Printf("Error fetching queue stats: %v", err)
				continue
			}
			metrics.JobsQueued.Set(float64(stats.Queued))
			metrics.JobsRunning.Set(float64(stats.Running))
			metrics.JobsFailed.Set(float64(stats.Failed))
		}
	}
}
