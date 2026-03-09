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

	JobStartedTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "job_started_total",
		Help: "The total number of jobs that transitioned to running",
	})

	JobCompletedTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "job_completed_total",
		Help: "The total number of jobs that transitioned to done",
	})

	JobFailedTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "job_failed_total",
		Help: "The total number of jobs that transitioned to failed",
	})

	JobDurationMs = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "job_duration_ms",
		Help:    "Duration of job execution in ms",
		Buckets: []float64{100, 500, 1000, 5000, 10000, 30000, 60000},
	}, []string{"result"}) // "done", "failed"

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

	// PR-061: AI Quality Metrics
	QualityPassTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "quality_pass_total",
		Help: "Total number of AI generations that passed quality evaluation",
	})

	QualityRetryTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "quality_retry_total",
		Help: "Total number of AI generations that triggered a quality retry",
	})

	QualityFailTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "quality_fail_total",
		Help: "Total number of AI generations that failed quality evaluation after retries",
	})

	QualityScoreHistogram = promauto.NewHistogram(prometheus.HistogramOpts{
		Name:    "quality_score_histogram",
		Help:    "Distribution of AI quality scores (0-100)",
		Buckets: []float64{0, 20, 40, 60, 70, 80, 85, 90, 95, 100},
	})

	// PR-062: Dataset Collector Metrics
	DatasetCandidateTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "dataset_candidate_total",
		Help: "Total number of successfully generated modules eligible for dataset collection",
	})

	DatasetInsertTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "dataset_insert_total",
		Help: "Total number of modules successfully inserted into the curriculum dataset",
	})

	DatasetDuplicateSkipped = promauto.NewCounter(prometheus.CounterOpts{
		Name: "dataset_duplicate_skipped",
		Help: "Total number of modules skipped due to deduplication",
	})

	DatasetRejectedQuality = promauto.NewCounter(prometheus.CounterOpts{
		Name: "dataset_rejected_quality",
		Help: "Total number of modules rejected for dataset collection due to low quality score",
	})

	// PR-063: Template Ranking Metrics
	TemplateRankRequestsTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "template_rank_requests_total",
		Help: "Total number of requests to the template ranking engine",
	})

	TemplateRankLatencyMs = promauto.NewHistogram(prometheus.HistogramOpts{
		Name:    "template_rank_latency_ms",
		Help:    "Latency of the template ranking selection in ms",
		Buckets: []float64{1, 2, 5, 10, 20, 50, 100},
	})

	TemplateSelectedTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "template_selected_total",
		Help: "Total number of templates selected for injection",
	}, []string{"count"}) // "0", "1", "2", "3"
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
