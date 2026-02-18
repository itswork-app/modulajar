package worker_test

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"modulajar/apps/core-go/worker"
)

func TestReadinessHandler(t *testing.T) {
	tests := []struct {
		name           string
		dbCheck        worker.CheckFunc
		chromeCheck    worker.CheckFunc
		expectedStatus int
	}{
		{
			name:           "All Systems Go",
			dbCheck:        func(ctx context.Context) error { return nil },
			chromeCheck:    func(ctx context.Context) error { return nil },
			expectedStatus: http.StatusOK,
		},
		{
			name:           "DB Failure",
			dbCheck:        func(ctx context.Context) error { return errors.New("db connection lost") },
			chromeCheck:    func(ctx context.Context) error { return nil },
			expectedStatus: http.StatusServiceUnavailable,
		},
		{
			name:           "Chrome Failure",
			dbCheck:        func(ctx context.Context) error { return nil },
			chromeCheck:    func(ctx context.Context) error { return errors.New("chrome not found") },
			expectedStatus: http.StatusServiceUnavailable,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler := worker.ReadinessHandler(tt.dbCheck, tt.chromeCheck)
			req := httptest.NewRequest("GET", "/readyz", nil)
			w := httptest.NewRecorder()

			handler.ServeHTTP(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, w.Code)
			}
		})
	}
}
