package worker

import (
	"context"
	"fmt"
	"log/slog"
	"path/filepath"
	"strings"
	"testing"

	"modulajar/apps/core-go/adapters/ai"
	"modulajar/apps/core-go/curriculum/ranking"
	"modulajar/apps/core-go/db"
	"modulajar/apps/core-go/render"

	"github.com/google/uuid"
)

const ValidSD4JSON = `
{
	"identitas": {
		"sekolah": "SD Test",
		"mata_pelajaran": "Matematika",
		"kelas": 4,
		"fase": "B",
		"semester": "1",
		"topik": "Pecahan",
		"alokasi_waktu": "2x35 menit"
	},
	"kompetensi_awal": "Siswa sudah mengenal bilangan bulat 1-100.",
	"profil_pelajar_pancasila": ["Bernalar Kritis"],
	"sarana_prasarana": ["Buku Paket", "Papan Tulis"],
	"target_peserta_didik": "Reguler",
	"model_pembelajaran": "Problem Based Learning",
	"tujuan_pembelajaran": "Siswa dapat membandingkan dua pecahan dengan pembilang satu.",
	"materi_pembelajaran": "Konsep pecahan dasar dan perbandingan pecahan.",
	"kegiatan_pembelajaran": {
		"pendahuluan": "Guru menyapa siswa dan melakukan apersepsi.",
		"inti": "Siswa melakukan eksplorasi dengan benda konkret untuk memahami pecahan.",
		"penutup": "Guru memberikan kesimpulan dan refleksi."
	},
	"penilaian": {
		"sikap": "Observasi selama diskusi.",
		"pengetahuan": "Tes tertulis membandingkan pecahan.",
		"keterampilan": "Unjuk kerja mewarnai bagian pecahan."
	},
	"refleksi_guru": "Apakah semua siswa memahami konsep perbandingan?"
}`

// Mocks

type MockAIEngine struct {
	GenerateResponse *ai.GenerateResponse
	GenerateError    error
	Responses        []*ai.GenerateResponse
	Errors           []error
	CallCount        int
	LastRequest      ai.GenerateRequest
}

func (m *MockAIEngine) Generate(ctx context.Context, req ai.GenerateRequest) (*ai.GenerateResponse, error) {
	m.LastRequest = req
	defer func() { m.CallCount++ }()

	if len(m.Responses) > m.CallCount {
		return m.Responses[m.CallCount], m.Errors[m.CallCount]
	}

	return m.GenerateResponse, m.GenerateError
}

type MockPDFEngine struct {
	GenerateBytes []byte
	GenerateError error
}

func (m *MockPDFEngine) Generate(ctx context.Context, htmlContent string, opts render.GeneratePDFOptions) ([]byte, error) {
	return m.GenerateBytes, m.GenerateError
}

type MockStorage struct {
	ExistsResult bool
	ExistsError  error
	UploadError  error
}

func (m *MockStorage) Exists(ctx context.Context, objectPath string) (bool, error) {
	return m.ExistsResult, m.ExistsError
}

func (m *MockStorage) UploadFile(ctx context.Context, objectPath string, filePath string, contentType string) error {
	return m.UploadError
}

func (m *MockStorage) DownloadFile(ctx context.Context, objectPath string) ([]byte, error) {
	return []byte("mock-logo-binary"), nil
}

func (m *MockStorage) Close() error {
	return nil
}

type MockJobStore struct {
	AcquireJobResult   *db.GenerationJob
	AcquireJobError    error
	UpdateMetaError    error
	MarkDoneError      error
	MarkFailedError    error
	SaveDocError       error
	UpdateStatusError  error
	UpdateDocMetaError error
	UpdatePkgError     error

	// Spies
	MarkDoneCalled    bool
	MarkFailedCalled  bool
	MarkFailedReason  string
	PersistedMetadata []map[string]interface{}
}

func (m *MockJobStore) AcquireJob(ctx context.Context) (*db.GenerationJob, error) {
	return m.AcquireJobResult, m.AcquireJobError
}
func (m *MockJobStore) UpdateJobMetadata(ctx context.Context, jobID string, metadata map[string]interface{}) error {
	m.PersistedMetadata = append(m.PersistedMetadata, metadata)
	return m.UpdateMetaError
}
func (m *MockJobStore) MarkJobDone(ctx context.Context, jobID string) error {
	m.MarkDoneCalled = true
	return m.MarkDoneError
}
func (m *MockJobStore) MarkJobFailed(ctx context.Context, jobID string, errMsg string, attemptCount int) error {
	m.MarkFailedCalled = true
	m.MarkFailedReason = errMsg
	return m.MarkFailedError
}
func (m *MockJobStore) SaveDocument(ctx context.Context, doc db.Document) error {
	return m.SaveDocError
}
func (m *MockJobStore) UpdateDocumentStatus(ctx context.Context, docID string, status string) error {
	return m.UpdateStatusError
}
func (m *MockJobStore) UpdateDocumentMetadata(ctx context.Context, docID string, metadata map[string]interface{}) error {
	return m.UpdateDocMetaError
}
func (m *MockJobStore) UpdatePackageStatus(ctx context.Context, packageID string, status string) error {
	return m.UpdatePkgError
}

func basePayload() TaskPayload {
	return TaskPayload{
		JobID:       "test-job",
		PackageID:   "test-pkg",
		WorkspaceID: "ws-test",
		PackPath:    filepath.Join("..", "packs", "merdeka", "sd4", "v1", "pack.json"),
		SchoolName:  "Test School",
		Semester:    "1",
		Kelas:       "4",
		TahunAjaran: "2025/2026",
		TeacherName: "Test Teacher",
		PID:         "PKG-TEST",
	}
}

func TestWorker_ExecuteJob_Success(t *testing.T) {
	ctx := context.Background()
	logger := slog.Default()

	mockAI := &MockAIEngine{
		GenerateResponse: &ai.GenerateResponse{
			Content:   ValidSD4JSON,
			ModelName: "gemini-1.5-flash",
		},
	}
	mockStore := &MockJobStore{
		AcquireJobResult: &db.GenerationJob{
			ID:           "job_1",
			WorkspaceID:  "ws_1",
			PackageID:    "pkg_1",
			GenerationID: "gen_1",
			Metadata:     map[string]interface{}{"teacher_name": "Bapak Guru"},
		},
	}

	deps := WorkerDeps{
		AI:        mockAI,
		PDF:       &MockPDFEngine{GenerateBytes: []byte("%PDF-1.4")},
		JobStore:  mockStore,
		Storage:   &MockStorage{},
		Planner:   &RealPlanner{},
		Validator: &RealValidator{},
	}

	worker := &Worker{Deps: deps}

	payload := basePayload()

	res, err := worker.ExecuteJob(ctx, payload, logger)
	if err != nil {
		t.Fatalf("ExecuteJob failed: %v", err)
	}

	if res.Status != "completed" {
		t.Fatalf("Job execution not done: %v", res.FailureReason)
	}
}

func TestWorker_ExecuteJob_AIFailure_Retry(t *testing.T) {
	ctx := context.Background()
	logger := slog.Default()

	mockAI := &MockAIEngine{
		Responses: []*ai.GenerateResponse{
			nil, // Fail 1
			{Content: ValidSD4JSON, ModelName: "fixed"},
		},
		Errors: []error{
			fmt.Errorf("AI down"),
			nil,
		},
	}

	mockStore := &MockJobStore{
		AcquireJobResult: &db.GenerationJob{
			ID:       "job_retry",
			Metadata: map[string]interface{}{},
		},
	}

	deps := WorkerDeps{
		AI:        mockAI,
		PDF:       &MockPDFEngine{GenerateBytes: []byte("%PDF-1.4")},
		JobStore:  mockStore,
		Storage:   &MockStorage{},
		Planner:   &RealPlanner{},
		Validator: &RealValidator{},
	}

	worker := &Worker{Deps: deps}
	payload := basePayload()
	payload.JobID = "job_retry"

	res, err := worker.ExecuteJob(ctx, payload, logger)
	if err != nil {
		t.Fatal(err)
	}

	if res.Status != "completed" {
		t.Error("Expected success after retry")
	}
	if mockAI.CallCount != 2 {
		t.Errorf("Expected 2 AI calls, got %d", mockAI.CallCount)
	}
}

func TestWorker_ExecuteJob_MaxAttemptsReached(t *testing.T) {
	ctx := context.Background()
	logger := slog.Default()

	mockAI := &MockAIEngine{
		GenerateError: fmt.Errorf("Permafail"),
	}

	mockStore := &MockJobStore{
		AcquireJobResult: &db.GenerationJob{
			ID:       "job_fail",
			Metadata: map[string]interface{}{},
		},
	}

	deps := WorkerDeps{
		AI:        mockAI,
		PDF:       &MockPDFEngine{GenerateBytes: []byte("%PDF-1.4")},
		JobStore:  mockStore,
		Storage:   &MockStorage{},
		Planner:   &RealPlanner{},
		Validator: &RealValidator{},
	}

	worker := &Worker{Deps: deps}
	payload := basePayload()
	payload.JobID = "job_fail"

	res, err := worker.ExecuteJob(ctx, payload, logger)
	if err != nil {
		t.Fatal(err)
	}

	if res.Status == "completed" {
		t.Error("Expected failure")
	}
	if mockAI.CallCount != 2 { // maxAttempts is 2 in code
		t.Errorf("Expected 2 attempts, got %d", mockAI.CallCount)
	}
}

func TestWorker_TemplateRankingInjection(t *testing.T) {
	ctx := context.Background()
	logger := slog.Default()

	// 1. Setup Mock Data
	mockAI := &MockAIEngine{
		GenerateResponse: &ai.GenerateResponse{
			Content:   ValidSD4JSON,
			ModelName: "gemini-1.5-flash",
		},
	}

	mockStore := &MockJobStore{
		AcquireJobResult: &db.GenerationJob{
			ID:           "job_123",
			WorkspaceID:  "ws_456",
			PackageID:    "pkg_789",
			GenerationID: "gen_001",
			Metadata: map[string]interface{}{
				"teacher_name": "Test Guru",
				"school_name":  "SD Test",
			},
		},
	}

	deps := WorkerDeps{
		AI:        mockAI,
		PDF:       &MockPDFEngine{GenerateBytes: []byte("%PDF-1.4")},
		JobStore:  mockStore,
		Storage:   &MockStorage{},
		Planner:   &RealPlanner{},
		Validator: &RealValidator{},
	}

	worker := &Worker{Deps: deps}

	payload := basePayload()
	payload.JobID = "job_123"

	// 2. Mock Ranking Engine
	originalQuery := ranking.DBQuery
	defer func() { ranking.DBQuery = originalQuery }()

	ranking.DBQuery = func(ctx context.Context, subject string, grade int) ([]db.DatasetEntry, error) {
		return []db.DatasetEntry{
			{
				ID:           uuid.New().String(),
				Subject:      "Bahasa Indonesia",
				Grade:        4,
				Topic:        "Pecahan Mat",
				ModuleJSON:   []byte(`{"example":"template"}`),
				QualityScore: 95,
			},
		}, nil
	}

	// 3. Execute Job
	res, err := worker.ExecuteJob(ctx, payload, logger)
	if err != nil {
		t.Fatalf("ExecuteJob failed: %v", err)
	}

	if res.Status != "completed" {
		t.Fatalf("Job execution not done: %v", res.FailureReason)
	}

	// 4. Verify AI Prompt contains Few-Shot Examples
	prompt := mockAI.LastRequest.Prompt
	if !strings.Contains(prompt, "EXAMPLES OF HIGH QUALITY OUTPUT") {
		t.Error("AI prompt missing few-shot header")
	}
	if !strings.Contains(prompt, `{"example":"template"}`) {
		t.Error("AI prompt missing injected template content")
	}

	t.Log("Verified template ranking injection in prompt")
}
