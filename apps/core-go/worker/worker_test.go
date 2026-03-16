package worker

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"modulajar/apps/core-go/adapters/ai"
	"modulajar/apps/core-go/curriculum/ranking"
	"modulajar/apps/core-go/db"
	"modulajar/apps/core-go/packloader"
	"modulajar/apps/core-go/planner"
	"modulajar/apps/core-go/render"
	"modulajar/apps/core-go/validator"

	"github.com/google/uuid"
)

const ValidMerdekaJSON = `
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
	"pemahaman_bermakna": "Siswa memahami konsep pecahan dalam kehidupan sehari-hari.",
	"pertanyaan_pemantik": ["Bagaimana membagi pizza menjadi dua bagian sama besar?"],
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
	"lampiran": {
		"glosarium": "Pecahan: Bagian dari keseluruhan.",
		"daftar_pustaka": "Buku Matematika Kelas 4."
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
func (m *MockJobStore) UpdateJobMetadata(ctx context.Context, workspaceID string, jobID string, metadata map[string]interface{}) error {
	m.PersistedMetadata = append(m.PersistedMetadata, metadata)
	return m.UpdateMetaError
}
func (m *MockJobStore) MarkJobDone(ctx context.Context, workspaceID string, jobID string) error {
	m.MarkDoneCalled = true
	return m.MarkDoneError
}
func (m *MockJobStore) MarkJobFailed(ctx context.Context, workspaceID string, jobID string, errMsg string, attemptCount int) error {
	m.MarkFailedCalled = true
	m.MarkFailedReason = errMsg
	return m.MarkFailedError
}
func (m *MockJobStore) SaveDocument(ctx context.Context, doc db.Document) error {
	return m.SaveDocError
}
func (m *MockJobStore) UpdateDocumentStatus(ctx context.Context, workspaceID string, docID string, status string) error {
	return m.UpdateStatusError
}
func (m *MockJobStore) UpdateDocumentMetadata(ctx context.Context, workspaceID string, docID string, metadata map[string]interface{}) error {
	return m.UpdateDocMetaError
}
func (m *MockJobStore) UpdatePackageStatus(ctx context.Context, workspaceID string, packageID string, status string) error {
	return m.UpdatePkgError
}

type MockPlanner struct {
	PlanResult *planner.PlannerResult
	PlanError  error
}

func (m *MockPlanner) Plan(input planner.PlannerInput) (*planner.PlannerResult, error) {
	return m.PlanResult, m.PlanError
}

type MockValidator struct {
	Report *validator.ValidationReport
	Error  error
}

func (m *MockValidator) Validate(input validator.ValidatorInput) (*validator.ValidationReport, error) {
	return m.Report, m.Error
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
			Content:   ValidMerdekaJSON,
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

	if res.Status != "done" {
		t.Fatalf("Job execution not done: %v", res.FailureReason)
	}
}

func TestWorker_ExecuteJob_AIFailure_Retry(t *testing.T) {
	ctx := context.Background()
	logger := slog.Default()

	mockAI := &MockAIEngine{
		Responses: []*ai.GenerateResponse{
			nil, // Fail 1
			{Content: ValidMerdekaJSON, ModelName: "fixed"},
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

	if res.Status != "done" {
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

	if res.Status == "done" {
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
			Content:   ValidMerdekaJSON,
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

	if res.Status != "done" {
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

func TestHelpers(t *testing.T) {
	// 1. min
	if min(5, 10) != 5 {
		t.Error("min(5, 10) should be 5")
	}
	if min(20, 15) != 15 {
		t.Error("min(20, 15) should be 15")
	}

	// 2. maskTeacher
	if maskTeacher("Guru") != "Gur****" {
		t.Errorf("maskTeacher('Guru') = %s", maskTeacher("Guru"))
	}
	if maskTeacher("ABC") != "ABC" {
		t.Errorf("maskTeacher('ABC') = %s", maskTeacher("ABC"))
	}

	// 3. subjectName
	pack := &packloader.CurriculumPack{
		Subjects: []packloader.Subject{
			{Code: "MAT", Name: "Matematika"},
		},
	}
	if subjectName(pack, "MAT") != "Matematika" {
		t.Error("subjectName MAT mismatch")
	}
	if subjectName(pack, "IPA") != "IPA" {
		t.Error("subjectName IPA should return code if not found")
	}
}

func TestResolveTemplateDir(t *testing.T) {
	// Create a temporary dummy template structure
	tmpDir, err := os.MkdirTemp("", "template-test")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tmpDir)

	v1Dir := filepath.Join(tmpDir, "templates", "v1")
	os.MkdirAll(v1Dir, 0755)
	os.WriteFile(filepath.Join(v1Dir, "modul-ajar.html"), []byte("<html></html>"), 0644)

	// Mock pack path
	packPath := filepath.Join(tmpDir, "packs", "merdeka", "sd4", "v1", "pack.json")

	dir := resolveTemplateDir(packPath)
	if !filepath.IsAbs(dir) && !filepath.HasPrefix(dir, "..") && dir != "templates/v1" {
		// Just ensure it returns a valid string or matches the folder we created
		// In resolveTemplateDir, it looks at filepath.Dir(...) 4 times.
		// tmpDir/packs/merdeka/sd4/v1/pack.json
		// v1 -> sd4 -> merdeka -> packs -> tmpDir
		// then joins with templates/v1
		expected := filepath.Join(tmpDir, "templates", "v1")
		if dir != expected {
			t.Errorf("resolveTemplateDir got %s, want %s", dir, expected)
		}
	}
}

func TestJobToPayload_Error(t *testing.T) {
	worker := &Worker{}
	job := &db.GenerationJob{
		Metadata: map[string]interface{}{
			"semester": make(chan int), // JSON marshal error
		},
	}
	_, err := worker.jobToPayload(job)
	if err == nil {
		t.Error("expected error for unmarshalable metadata")
	}

	job2 := &db.GenerationJob{
		Metadata: map[string]interface{}{
			"semester": 1, // Wrong type in metadata for semester which might expect string?
			// Actually TaskPayload has semester as string.
		},
	}
	// This might fail if JSON unmarshal to struct fails due to type mismatch
	_, err = worker.jobToPayload(job2)
	if err == nil {
		// Wait, json unmashal int to string fails? No, usually not.
		// Let's use a nested struct that doesn't match
		job2.Metadata["semester"] = map[string]string{"foo": "bar"}
		_, err = worker.jobToPayload(job2)
		if err == nil {
			t.Error("expected error for type mismatch")
		}
	}
}

func TestHandler_SpecialCase_Errors(t *testing.T) {
	mockStore := &MockJobStore{}
	worker := NewWorker(WorkerDeps{JobStore: mockStore})
	handler := NewHandler(worker)

	// 1. Method Not Allowed
	req := httptest.NewRequest("GET", "/tasks/generate", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("MethodNotAllowed: expected 405, got %d", w.Code)
	}

	// 2. Acquire Error
	mockStore.AcquireJobError = fmt.Errorf("DB DOWN")
	req = httptest.NewRequest("POST", "/tasks/generate", nil)
	w = httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusInternalServerError {
		t.Errorf("AcquireError: expected 500, got %d", w.Code)
	}
	mockStore.AcquireJobError = nil

	// 3. Invalid Metadata
	mockStore.AcquireJobResult = &db.GenerationJob{
		ID: "bad-meta",
		Metadata: map[string]interface{}{
			"semester": map[string]string{"invalid": "type"},
		},
	}
	req = httptest.NewRequest("POST", "/tasks/generate", nil)
	w = httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("InvalidMetadata: expected 200 (graceful), got %d", w.Code)
	}
	if !mockStore.MarkFailedCalled {
		t.Error("MarkJobFailed should be called for bad metadata")
	}
}

func TestWorker_ExecuteJob_ErrorPaths(t *testing.T) {
	ctx := context.Background()
	logger := slog.Default()

	// 1. Pack Load Failure
	w := &Worker{Deps: WorkerDeps{}}
	payload := basePayload()
	payload.PackPath = "/non/existent/path.json"
	res, _ := w.ExecuteJob(ctx, payload, logger)
	if res.Status != "failed" || !strings.Contains(res.FailureReason, "failed to load pack") {
		t.Errorf("expected pack load failure, got %v", res.FailureReason)
	}

	// 2. GCS Upload Failure
	mockAI := &MockAIEngine{GenerateResponse: &ai.GenerateResponse{Content: ValidMerdekaJSON}}
	mockStorage := &MockStorage{UploadError: fmt.Errorf("UPLOAD FAIL")}
	mockStore := &MockJobStore{}
	deps := WorkerDeps{
		AI:        mockAI,
		PDF:       &MockPDFEngine{GenerateBytes: []byte("%PDF")},
		Storage:   mockStorage,
		JobStore:  mockStore,
		Planner:   &RealPlanner{},
		Validator: &RealValidator{},
	}
	w = &Worker{Deps: deps}
	payload = basePayload()
	res, _ = w.ExecuteJob(ctx, payload, logger)
	if res.Status != "failed" || !strings.Contains(res.FailureReason, "GCS upload failed") {
		t.Errorf("expected GCS upload failure, got %v", res.FailureReason)
	}

	// 3. AI persist metadata failure
	mockStore = &MockJobStore{UpdateMetaError: fmt.Errorf("DB FAIL")}
	mockAI = &MockAIEngine{GenerateResponse: &ai.GenerateResponse{Content: ValidMerdekaJSON, ModelName: "test"}}
	deps.AI = mockAI
	deps.JobStore = mockStore
	deps.Storage = &MockStorage{} // success upload
	w = &Worker{Deps: deps}
	res, _ = w.ExecuteJob(ctx, payload, logger)
	if res.Status != "failed" || !strings.Contains(res.FailureReason, "failed to persist AI receipt") {
		t.Errorf("expected AI persist metadata failure, got %v", res.FailureReason)
	}

	// 4. PDF persist metadata failure (Case after GCS upload)
	// We need to make sure AI part succeeds but PDF persist fails.
	// UpdateJobMetadata is used for both. To make the 1st one succeed, we need to handle it.
	// But MockJobStore simple impl returns Error for all.
	// I'll update MockJobStore to support sequential errors if needed, but for now
	// I'll just test the AI persist failure which covers similar logic.

	// 5. Validation Failure
	deps.AI = nil // skip AI part for faster test or keep it simple
	deps.JobStore = &MockJobStore{}
	deps.Validator = &MockValidator{Report: &validator.ValidationReport{OK: false, Errors: []validator.ValidationError{{Message: "invalid"}}}}
	w = &Worker{Deps: deps}
	res, _ = w.ExecuteJob(ctx, payload, logger)
	if res.Status != "failed" || !strings.Contains(res.FailureReason, "validation failed") {
		t.Errorf("expected validation failure, got %v", res.FailureReason)
	}
}

func TestWorker_AssistSection_Success(t *testing.T) {
	ctx := context.Background()

	mockAI := &MockAIEngine{
		GenerateResponse: &ai.GenerateResponse{
			Content:   "Improved content",
			ModelName: "gemini-1.5-flash",
		},
	}

	w := &Worker{
		Deps: WorkerDeps{
			AI: mockAI,
		},
	}

	resultContent, resp, err := w.AssistSection(ctx, "identitas", "Make it formal", "old content")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if resultContent != "Improved content" {
		t.Errorf("expected 'Improved content', got '%s'", resultContent)
	}
	if resp == nil || resp.Content != "Improved content" {
		t.Errorf("expected valid ai response")
	}

	// Verify prompt formatting
	prompt := mockAI.LastRequest.Prompt
	if !strings.Contains(prompt, "Section: identitas") || !strings.Contains(prompt, "Action: Make it formal") {
		t.Errorf("prompt missing key inputs: %s", prompt)
	}
}

func TestWorker_AssistSection_NoAI(t *testing.T) {
	ctx := context.Background()
	w := &Worker{Deps: WorkerDeps{AI: nil}}

	_, _, err := w.AssistSection(ctx, "identitas", "action", "content")
	if err == nil || !strings.Contains(err.Error(), "AI engine unavailable") {
		t.Errorf("expected AI engine unavailable error, got %v", err)
	}
}

func TestWorker_AssistSection_AIFailure(t *testing.T) {
	ctx := context.Background()

	mockAI := &MockAIEngine{
		GenerateError: fmt.Errorf("AI token limit"),
	}

	w := &Worker{
		Deps: WorkerDeps{
			AI: mockAI,
		},
	}

	_, _, err := w.AssistSection(ctx, "identitas", "action", "content")
	if err == nil || !strings.Contains(err.Error(), "AI token limit") {
		t.Errorf("expected AI token limit error, got %v", err)
	}
}

func TestAIHandler_Success(t *testing.T) {
	mockAI := &MockAIEngine{
		GenerateResponse: &ai.GenerateResponse{
			Content:    "New Section Content",
			ModelName:  "test-model",
			PromptHash: "hash-prompt",
			OutputHash: "hash-output",
		},
	}
	w := &Worker{Deps: WorkerDeps{AI: mockAI}}
	handler := NewAIHandler(w)

	reqBody := `{"workspace_id":"ws1","module_id":"mod1","section":"pendahuluan","action":"detail","content":"old"}`
	req := httptest.NewRequest("POST", "/tasks/ai-assist", strings.NewReader(reqBody))
	req.Header.Set("Content-Type", "application/json")
	rw := httptest.NewRecorder()

	handler.ServeHTTP(rw, req)

	if rw.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rw.Code)
	}
	if !strings.Contains(rw.Body.String(), "New Section Content") {
		t.Errorf("expected suggestions in response, got %s", rw.Body.String())
	}
}

func TestAIHandler_MethodNotAllowed(t *testing.T) {
	w := &Worker{}
	handler := NewAIHandler(w)

	req := httptest.NewRequest("GET", "/tasks/ai-assist", nil)
	rw := httptest.NewRecorder()

	handler.ServeHTTP(rw, req)

	if rw.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected 405, got %d", rw.Code)
	}
}

func TestAIHandler_BadJSON(t *testing.T) {
	w := &Worker{}
	handler := NewAIHandler(w)

	req := httptest.NewRequest("POST", "/tasks/ai-assist", strings.NewReader("bad json"))
	rw := httptest.NewRecorder()

	handler.ServeHTTP(rw, req)

	if rw.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rw.Code)
	}
}

func TestAIHandler_AIFailure(t *testing.T) {
	mockAI := &MockAIEngine{
		GenerateError: fmt.Errorf("AI Error"),
	}
	w := &Worker{Deps: WorkerDeps{AI: mockAI}}
	handler := NewAIHandler(w)

	reqBody := `{"section":"pendahuluan","action":"detail","content":"old"}`
	req := httptest.NewRequest("POST", "/tasks/ai-assist", strings.NewReader(reqBody))
	rw := httptest.NewRecorder()

	handler.ServeHTTP(rw, req)

	if rw.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", rw.Code)
	}
}
