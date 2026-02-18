package main

import (
	"log"
	"net/http"
	"os"

	"modulajar/apps/core-go/db"
	"modulajar/apps/core-go/render"
	"modulajar/apps/core-go/worker"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	http.HandleFunc("/tasks/generate", worker.Handler())
	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})
	// PR-028 Readiness Probe
	http.HandleFunc("/readyz", worker.ReadinessHandler(db.Ping, render.CheckChromeReadiness))

	log.Printf("Worker service listening on port %s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatal(err)
	}
}
