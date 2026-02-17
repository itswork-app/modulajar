package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	JobsAcquiredTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "jobs_acquired_total",
		Help: "The total number of jobs acquired",
	}, []string{"result"}) // "success", "failed"

	JobDurationMs = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "job_duration_ms",
		Help:    "Duration of job execution in ms",
		Buckets: []float64{100, 500, 1000, 5000, 10000, 30000, 60000},
	}, []string{"result"}) // "completed", "failed"

	JobRetriesTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "job_retries_total",
		Help: "The total number of job retries triggered",
	})

	JobFailuresTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "job_failures_total",
		Help: "The total number of job failures (after max retries)",
	})

	GCSUploadTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "gcs_upload_total",
		Help: "The total number of GCS uploads",
	}, []string{"result"}) // "success", "failed"

	// Gauge for queue depth (periodic update)
	JobsQueued = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "jobs_queued_gauge",
		Help: "Current number of jobs in queued status",
	})
	JobsRunning = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "jobs_running_gauge",
		Help: "Current number of jobs in running status",
	})
	JobsFailed = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "jobs_failed_gauge",
		Help: "Current number of jobs in failed status",
	})
)
