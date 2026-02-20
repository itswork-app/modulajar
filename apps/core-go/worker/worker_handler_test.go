package worker

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"modulajar/apps/core-go/adapters/ai"
	"modulajar/apps/core-go/db"
)

func TestHandler_Success(t *testing.T) {
	// 1. Setup Mock JobStore with a Job
	jobID := "job-handler-test"
	mockJob := &db.GenerationJob{
		ID:           jobID,
		WorkspaceID:  "ws-test",
		PackageID:    "pkg-test",
		AttemptCount: 0,
		Metadata: map[string]interface{}{
			"job_id":       jobID,
			"package_id":   "pkg-test",
			"workspace_id": "ws-test",
			"pack_path":    basePayload().PackPath,
			"semester":     "S1",
			"kelas":        "4",
			"tahun_ajaran": "2025/2026",
			"teacher_name": "Guru Handler",
			"school_name":  "SD Handler",
			"pid":          "PKG-TEST",
		},
	}

	mockJobStore := &MockJobStore{
		AcquireJobResult: mockJob,
	}

	// 2. Setup Worker with Mocks
	mockAI := &MockAIEngine{
		GenerateResponse: &ai.GenerateResponse{
			Content: `
				{
					"meta": {
						"jenjang": "SD",
						"kelas": "4",
						"mapel": "Matematika",
						"semester": "1",
						"tahun_ajaran": "2025/2026"
					},
					"identitas": {
						"sekolah": "SDN Test",
						"guru": "Ibu Test",
						"alokasi_waktu": "2x35 menit"
					},
					"tujuan_pembelajaran": ["TP1"],
					"materi_inti": ["Bilangan"],
					"langkah_pembelajaran": {
						"pendahuluan": ["Opener"],
						"inti": ["Core"],
						"penutup": ["Closer"]
					},
					"asesmen": {
						"diagnostik": ["-"],
						"formatif": ["-"],
						"sumatif": ["-"]
					},
					"diferensiasi": {
						"konten": ["-"],
						"proses": ["-"],
						"produk": ["-"]
					},
					"profil_pancasila": ["Bernalar Kritis"],
					"lampiran": {
						"media": ["-"],
						"sumber_belajar": ["-"]
					}
				}`,
		},
	}
	mockPDF := &MockPDFEngine{GenerateBytes: []byte("%PDF...")}
	mockStorage := &MockStorage{ExistsResult: false}

	deps := WorkerDeps{
		AI:        mockAI,
		PDF:       mockPDF,
		Storage:   mockStorage,
		JobStore:  mockJobStore,
		Planner:   &RealPlanner{}, // Needs pack file
		Validator: &RealValidator{},
	}

	worker := NewWorker(deps)
	handler := NewHandler(worker)

	// 3. Request
	reqBody, _ := json.Marshal(map[string]string{"job_id": jobID})
	req := httptest.NewRequest("POST", "/tasks/generate", bytes.NewReader(reqBody))
	w := httptest.NewRecorder()

	// 4. Handle
	handler.ServeHTTP(w, req)

	// 5. Verify Response
	resp := w.Result()
	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected 200, got %d", resp.StatusCode)
	}

	// 6. Verify Mock interactions
	if !mockJobStore.MarkDoneCalled {
		t.Error("Expected MarkJobDone to be called")
	}
	if mockJobStore.MarkFailedCalled {
		t.Errorf("Did not expect MarkJobFailed, but called with: %s", mockJobStore.MarkFailedReason)
	}
}

func TestHandler_NoJob(t *testing.T) {
	// Mock JobStore returns nil (no job)
	mockJobStore := &MockJobStore{
		AcquireJobResult: nil,
	}
	deps := WorkerDeps{JobStore: mockJobStore}
	handler := NewHandler(NewWorker(deps))

	req := httptest.NewRequest("POST", "/tasks/generate", bytes.NewReader([]byte(`{}`)))
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Result().StatusCode != http.StatusOK {
		t.Errorf("Expected 200, got %d", w.Result().StatusCode)
	}
	// Verify body is {"status":"idle"}?
}

func TestHandler_InvalidMetadata(t *testing.T) {
	// Mock Job with invalid metadata (that causes unmarshal or logic error?)
	// jobToPayload unmarshals map to struct.
	// If fields are missing in map, they are empty in struct.
	// Logic fails inside ExecuteJob (e.g. Planner fails due to missing pack path).

	mockJob := &db.GenerationJob{
		ID:           "job-bad",
		PackageID:    "pkg-bad",
		AttemptCount: 0,
		Metadata: map[string]interface{}{
			"job_id":    "job-bad",
			"pack_path": "/bad/path.json", // Will cause Planner failure
		},
	}
	mockJobStore := &MockJobStore{AcquireJobResult: mockJob}

	deps := WorkerDeps{
		JobStore:  mockJobStore,
		Planner:   &RealPlanner{},
		Validator: &RealValidator{},
	}
	handler := NewHandler(NewWorker(deps))

	req := httptest.NewRequest("POST", "/tasks/generate", bytes.NewReader([]byte(`{}`)))
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Result().StatusCode != http.StatusOK {
		t.Errorf("Expected 200, got %d", w.Result().StatusCode)
	}

	// Expect MarkJobFailed to be called
	if !mockJobStore.MarkFailedCalled {
		t.Error("Expected MarkJobFailed to be called for invalid job execution")
	}
}
