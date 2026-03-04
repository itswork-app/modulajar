package metrics

import (
	"context"
	"time"

	"modulajar/apps/core-go/db"

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

	// PR-059: Production Safety Metrics
	WorkerHeartbeatTimestamp = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "worker_heartbeat_timestamp",
		Help: "Unix timestamp of last worker heartbeat update",
	})

	JobsStuckGauge = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "jobs_stuck_gauge",
		Help: "Number of jobs stuck in running state beyond threshold",
	})
)

// DefaultStuckThresholdSeconds is the default threshold for stuck job detection (5 minutes).
const DefaultStuckThresholdSeconds = 300

// QueueCollector implements prometheus.Collector to scrape DB stats on demand.
type QueueCollector struct {
	queuedDesc  *prometheus.Desc
	runningDesc *prometheus.Desc
	failedDesc  *prometheus.Desc
	stuckDesc   *prometheus.Desc
}

func NewQueueCollector() *QueueCollector {
	return &QueueCollector{
		queuedDesc:  prometheus.NewDesc("jobs_queued_gauge", "Current number of jobs in queued status", nil, nil),
		runningDesc: prometheus.NewDesc("jobs_running_gauge", "Current number of jobs in running status", nil, nil),
		failedDesc:  prometheus.NewDesc("jobs_failed_gauge", "Current number of jobs in failed status", nil, nil),
		stuckDesc:   prometheus.NewDesc("jobs_stuck_collector_gauge", "Current number of stuck jobs (via collector)", nil, nil),
	}
}

func (c *QueueCollector) Describe(ch chan<- *prometheus.Desc) {
	ch <- c.queuedDesc
	ch <- c.runningDesc
	ch <- c.failedDesc
	ch <- c.stuckDesc
}

func (c *QueueCollector) Collect(ch chan<- prometheus.Metric) {
	// We need a context. Background is acceptable for scraping.
	stats, err := db.GetQueueStats(context.Background())
	if err != nil {
		return
	}

	ch <- prometheus.MustNewConstMetric(c.queuedDesc, prometheus.GaugeValue, float64(stats.Queued))
	ch <- prometheus.MustNewConstMetric(c.runningDesc, prometheus.GaugeValue, float64(stats.Running))
	ch <- prometheus.MustNewConstMetric(c.failedDesc, prometheus.GaugeValue, float64(stats.Failed))

	// Stuck jobs
	stuck, err := db.CountStuckJobs(context.Background(), DefaultStuckThresholdSeconds)
	if err == nil {
		ch <- prometheus.MustNewConstMetric(c.stuckDesc, prometheus.GaugeValue, float64(stuck))
	}
}

// StartHeartbeatLoop launches a goroutine that updates heartbeat and stuck gauge every 10 seconds.
func StartHeartbeatLoop(ctx context.Context) {
	go func() {
		ticker := time.NewTicker(10 * time.Second)
		defer ticker.Stop()

		// Initial heartbeat
		WorkerHeartbeatTimestamp.Set(float64(time.Now().Unix()))

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				WorkerHeartbeatTimestamp.Set(float64(time.Now().Unix()))

				stuck, err := db.CountStuckJobs(context.Background(), DefaultStuckThresholdSeconds)
				if err == nil {
					JobsStuckGauge.Set(float64(stuck))
				}
			}
		}
	}()
}
