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

	// Initialize DB
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := db.Init(ctx); err != nil {
		log.Fatalf("Failed to initialize DB: %v", err)
	}
	defer db.Close()

	// 1. Register Metrics Collectors
	prometheus.MustRegister(metrics.NewQueueCollector())

	// 2. Start Heartbeat / Stuck Job Loop
	metrics.StartHeartbeatLoop(context.Background())

	// Initialize Worker with Real Dependencies
	setupCtx, setupCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer setupCancel()

	realWorker, err := worker.NewRealWorker(setupCtx)
	if err != nil {
		log.Printf("Warning: Failed to initialize worker dependencies: %v", err)
	}
	if realWorker == nil {
		log.Fatal("Failed to create worker instance")
	}

	// Register Handlers
	http.Handle("/tasks/generate", worker.NewHandler(realWorker))
	http.Handle("/tasks/ai-assist", worker.NewAIHandler(realWorker))
	http.Handle("/metrics", promhttp.Handler())
	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})
	http.HandleFunc("/readyz", worker.ReadinessHandler(db.Ping, render.CheckChromeReadiness))

	log.Printf("Worker service listening on port %s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatal(err)
	}
}
