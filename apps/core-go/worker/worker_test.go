package worker

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/oklog/ulid/v2"

	"modulajar/apps/core-go/adapters/ai"
	"modulajar/apps/core-go/db"
	"modulajar/apps/core-go/packloader"
	"modulajar/apps/core-go/planner"
	"modulajar/apps/core-go/render"
	"modulajar/apps/core-go/validator"
)

// Mocks

type MockAIEngine struct {
	GenerateResponse *ai.GenerateResponse
	GenerateError    error
	Responses        []*ai.GenerateResponse
	Errors           []error
	CallCount        int
}

func (m *MockAIEngine) Generate(ctx context.Context, req ai.GenerateRequest) (*ai.GenerateResponse, error) {
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
	return nil, nil
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
func (m *MockJobStore) UpdatePackageStatus(ctx context.Context, packageID string, status string) error {
	return m.UpdatePkgError
}
func (m *MockJobStore) SaveDocument(ctx context.Context, doc db.Document) error {
	return m.SaveDocError
}
func (m *MockJobStore) UpdateDocumentStatus(ctx context.Context, publicID string, status string) error {
	return m.UpdateStatusError
}
func (m *MockJobStore) UpdateDocumentMetadata(ctx context.Context, publicID string, metadata map[string]interface{}) error {
	return m.UpdateDocMetaError
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

// Helpers

func basePayload() TaskPayload {
	return TaskPayload{
		JobID:       "test-job-001",
		PackageID:   "test-pkg-001",
		WorkspaceID: "test-ws-001",
		PackPath:    filepath.Join("..", "packs", "merdeka", "sd4", "v1", "pack.json"), // Should exist or be mocked packloader
		Semester:    "S1",
		Kelas:       "4",
		TahunAjaran: "2025/2026",
		TeacherName: "Ibu Test",
		SchoolName:  "SDN Test",
		PID:         "PKG-TEST",
	}
}

func defaultPlannerResult() *planner.PlannerResult {
	return &planner.PlannerResult{
		Semester: "S1",
		Atps: []planner.Atp{
			{SubjectCode: "LEGACY", SubjectName: "Matematika", TpItems: []planner.TpItem{{Code: "TP1", Description: "Desc"}}},
		},
		SemesterPlan: planner.SemesterPlan{
			Semester:     "S1",
			SubjectPlans: []planner.SubjectPlan{{SubjectCode: "LEGACY", Units: []planner.Unit{{UnitNo: 1, OutcomeCodes: []string{"TP1"}}}}},
		},
	}
}

// Tests

func TestExecuteJob_TableDriven(t *testing.T) {
	os.Setenv("GCS_BUCKET", "test-bucket")
	defer os.Unsetenv("GCS_BUCKET")

	tests := []struct {
		Name          string
		MockAI        *MockAIEngine
		MockPDF       *MockPDFEngine
		MockStorage   *MockStorage
		MockJobStore  *MockJobStore
		MockPlanner   *MockPlanner
		MockValidator *MockValidator
		ExpectSuccess bool
		ExpectError   string
	}{
		{
			Name: "Success Path (SD4 Template)",
			MockAI: &MockAIEngine{
				GenerateResponse: &ai.GenerateResponse{Content: `
				{
					"identitas": {
						"sekolah": "SDN Test",
						"mata_pelajaran": "Matematika",
						"kelas": 4,
						"fase": "B",
						"semester": "1",
						"topik": "Penjumlahan",
						"alokasi_waktu": "2x35 menit"
					},
					"kompetensi_awal": "Siswa mengenal angka 1-100",
					"profil_pelajar_pancasila": ["Bernalar Kritis"],
					"sarana_prasarana": ["Buku Paket"],
					"target_peserta_didik": "Siswa Reguler",
					"model_pembelajaran": "Tatap Muka",
					"tujuan_pembelajaran": "Siswa dapat melakukan penjumlahan dua digit",
					"materi_pembelajaran": "Penjumlahan Bersusun",
					"kegiatan_pembelajaran": {
						"pendahuluan": "Berdoa dan apersepsi",
						"inti": "Penjelasan guru dan latihan soal",
						"penutup": "Kesimpulan dan doa"
					},
					"penilaian": {
						"sikap": "Observasi",
						"pengetahuan": "Tes Tertulis",
						"keterampilan": "Unjuk Kerja"
					},
					"refleksi_guru": "Apakah siswa senang?"
				}`},
			},
			MockPDF: &MockPDFEngine{
				GenerateBytes: []byte("%PDF-1.4..."),
			},
			MockStorage:  &MockStorage{},
			MockJobStore: &MockJobStore{},
			MockPlanner: &MockPlanner{
				PlanResult: &planner.PlannerResult{
					Semester: "S1",
					Atps: []planner.Atp{
						{SubjectCode: "MAT", SubjectName: "Matematika", TpItems: []planner.TpItem{{Code: "TP1", Description: "Desc"}}},
					},
					SemesterPlan: planner.SemesterPlan{
						SubjectPlans: []planner.SubjectPlan{{SubjectCode: "MAT"}},
					},
				},
			},
			MockValidator: &MockValidator{
				Report: &validator.ValidationReport{OK: true},
			},
			ExpectSuccess: true,
		},
		{
			Name: "Success Path (Legacy Flow)",
			MockAI: &MockAIEngine{
				GenerateResponse: &ai.GenerateResponse{Content: `
				{
					"meta": {
						"jenjang": "SD",
						"kelas": "4",
						"mapel": "Seni",
						"semester": "1",
						"tahun_ajaran": "2025/2026"
					},
					"identitas": {
						"sekolah": "SDN Test",
						"guru": "Ibu Test",
						"alokasi_waktu": "2x35 menit"
					},
					"tujuan_pembelajaran": ["TP1"],
					"materi_inti": ["Gambar"],
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
				}`},
			},
			MockPDF: &MockPDFEngine{
				GenerateBytes: []byte("%PDF-1.4..."),
			},
			MockStorage:  &MockStorage{},
			MockJobStore: &MockJobStore{},
			MockPlanner: &MockPlanner{
				PlanResult: &planner.PlannerResult{
					Semester: "S1",
					Atps: []planner.Atp{
						{SubjectCode: "SENI", SubjectName: "Seni", TpItems: []planner.TpItem{{Code: "TP1", Description: "Desc"}}},
					},
					SemesterPlan: planner.SemesterPlan{
						SubjectPlans: []planner.SubjectPlan{{SubjectCode: "SENI"}},
					},
				},
			},
			MockValidator: &MockValidator{
				Report: &validator.ValidationReport{OK: true},
			},
			ExpectSuccess: true,
		},
		{
			Name: "AI Generation Error",
			MockAI: &MockAIEngine{
				GenerateError: fmt.Errorf("AI quota exceeded"),
			},
			MockPlanner:   &MockPlanner{PlanResult: defaultPlannerResult()},
			MockValidator: &MockValidator{Report: &validator.ValidationReport{OK: true}},
			ExpectSuccess: false,
			ExpectError:   "AI generation failed",
		},
		{
			Name: "Quality Retry Success",
			MockAI: &MockAIEngine{
				// Attempt 1: Score 0 (Missing TP) -> Retry
				// Attempt 2: Score 100 -> Pass
				Responses: []*ai.GenerateResponse{
					{Content: `{"identitas":{"sekolah":"X","mata_pelajaran":"Matematika","kelas":4,"fase":"B","semester":"1","topik":"X"}, "tujuan_pembelajaran":""}`},
					{Content: `
					{
						"identitas": {
							"sekolah": "SDN Test",
							"mata_pelajaran": "Matematika",
							"kelas": 4,
							"fase": "B",
							"semester": "1",
							"topik": "Penjumlahan",
							"alokasi_waktu": "2x35 menit"
						},
						"kompetensi_awal": "Siswa mengenal angka 1-100",
						"profil_pelajar_pancasila": ["Bernalar Kritis"],
						"sarana_prasarana": ["Buku Paket"],
						"target_peserta_didik": "Siswa Reguler",
						"model_pembelajaran": "Tatap Muka",
						"tujuan_pembelajaran": "Siswa dapat melakukan penjumlahan dua digit yang sah dan benar sesuai kurikulum",
						"materi_pembelajaran": "Penjumlahan Bersusun yang sangat detail materi intinya",
						"kegiatan_pembelajaran": {
							"pendahuluan": "Berdoa dan apersepsi pembukaan pelajaran hari ini",
							"inti": "Penjelasan guru dan latihan soal secara mendalam dan terstruktur rapih sekali",
							"penutup": "Kesimpulan dan doa bersama seluruh siswa di kelas"
						},
						"penilaian": {
							"sikap": "Observasi sikap siswa",
							"pengetahuan": "Tes Tertulis pilihan ganda",
							"keterampilan": "Unjuk Kerja mandiri"
						},
						"refleksi_guru": "Apakah siswa senang dengan metode ini?"
					}`},
				},
				Errors: []error{nil, nil},
			},
			MockPDF:       &MockPDFEngine{GenerateBytes: []byte("pdf")},
			MockStorage:   &MockStorage{},
			MockJobStore:  &MockJobStore{},
			MockPlanner:   &MockPlanner{PlanResult: &planner.PlannerResult{SemesterPlan: planner.SemesterPlan{SubjectPlans: []planner.SubjectPlan{{SubjectCode: "MAT"}}}}},
			MockValidator: &MockValidator{Report: &validator.ValidationReport{OK: true}},
			ExpectSuccess: true,
		},
		{
			Name: "Quality Fail (Low Score)",
			MockAI: &MockAIEngine{
				// Constant low score: Missing TP, Missing Materi, Short Content, no Pancasila
				GenerateResponse: &ai.GenerateResponse{Content: `{"identitas":{"sekolah":"X","mata_pelajaran":"Matematika","kelas":4,"fase":"B","semester":"1","topik":"X"}, "tujuan_pembelajaran":"","materi_pembelajaran":"","kegiatan_pembelajaran":{"pendahuluan":"","inti":"short","penutup":""}, "profil_pelajar_pancasila":[]}`},
			},
			MockStorage:   &MockStorage{},
			MockJobStore:  &MockJobStore{},
			MockPlanner:   &MockPlanner{PlanResult: &planner.PlannerResult{SemesterPlan: planner.SemesterPlan{SubjectPlans: []planner.SubjectPlan{{SubjectCode: "MAT"}}}}},
			MockValidator: &MockValidator{Report: &validator.ValidationReport{OK: true}},
			ExpectSuccess: false,
			ExpectError:   "quality_evaluation_failed",
		},
		{
			Name: "AI Invalid JSON",
			MockAI: &MockAIEngine{
				GenerateResponse: &ai.GenerateResponse{Content: `INVALID JSON`},
			},
			MockPlanner:   &MockPlanner{PlanResult: defaultPlannerResult()},
			MockValidator: &MockValidator{Report: &validator.ValidationReport{OK: true}},
			ExpectSuccess: false,
			ExpectError:   "AI generated invalid JSON",
		},
		{
			Name: "PDF Generation Error",
			MockAI: &MockAIEngine{
				GenerateResponse: &ai.GenerateResponse{Content: `{"meta":{}}`},
			},
			MockPDF: &MockPDFEngine{
				GenerateError: fmt.Errorf("chrome crashed"),
			},
			MockPlanner:   &MockPlanner{PlanResult: defaultPlannerResult()},
			MockValidator: &MockValidator{Report: &validator.ValidationReport{OK: true}},
			ExpectSuccess: false,
			ExpectError:   "PDF render failed",
		},
		{
			Name: "Storage Upload Error",
			MockAI: &MockAIEngine{
				GenerateResponse: &ai.GenerateResponse{Content: `{"meta":{}}`},
			},
			MockPDF: &MockPDFEngine{
				GenerateBytes: []byte("%PDF..."),
			},
			MockStorage: &MockStorage{
				UploadError: fmt.Errorf("network error"),
			},
			MockPlanner:   &MockPlanner{PlanResult: defaultPlannerResult()},
			MockValidator: &MockValidator{Report: &validator.ValidationReport{OK: true}},
			ExpectSuccess: false,
			ExpectError:   "GCS upload failed",
		},
		{
			Name: "Metadata Persist Error",
			MockAI: &MockAIEngine{
				GenerateResponse: &ai.GenerateResponse{Content: `{"meta":{}}`},
			},
			MockJobStore: &MockJobStore{
				UpdateMetaError: fmt.Errorf("db lock timeout"),
			},
			MockPlanner:   &MockPlanner{PlanResult: defaultPlannerResult()},
			MockValidator: &MockValidator{Report: &validator.ValidationReport{OK: true}},
			// Note: The code calls UpdateJobMetadata multiple times.
			// 1. AI receipt
			// 2. PDF receipt
			// If any fails, we want job to fail.
			ExpectSuccess: false,
			ExpectError:   "failed to persist",
		},
		{
			Name: "Planner Error",
			MockAI: &MockAIEngine{
				GenerateResponse: &ai.GenerateResponse{Content: `{"meta":{}}`}, // Not reached if planner fails earlier? No, Planner called BEFORE AI.
			},
			MockPlanner: &MockPlanner{
				PlanError: fmt.Errorf("simulated planner error"),
			},
			ExpectSuccess: false,
			ExpectError:   "planner failed",
		},
		{
			Name: "Validator Error",
			MockPlanner: &MockPlanner{
				PlanResult: defaultPlannerResult(),
			},
			MockValidator: &MockValidator{
				Error: fmt.Errorf("simulated validator error"), // System error
			},
			ExpectSuccess: false,
			ExpectError:   "validator error",
		},
		{
			Name: "Validation Failure (Logic)",
			MockPlanner: &MockPlanner{
				PlanResult: defaultPlannerResult(),
			},
			MockValidator: &MockValidator{
				Report: &validator.ValidationReport{
					OK:     false,
					Errors: []validator.ValidationError{{Code: "atp_error", Message: "bad atp"}},
				},
			},
			ExpectSuccess: false,
			ExpectError:   "validation failed with 1 errors",
		},
		{
			Name: "Idempotency Success (Skip Generation)",
			MockAI: &MockAIEngine{
				GenerateError: fmt.Errorf("should not be called"),
			},
			MockStorage: &MockStorage{
				ExistsResult: true, // Artifacts exist
			},
			MockPlanner: &MockPlanner{
				PlanResult: defaultPlannerResult(),
			},
			MockValidator: &MockValidator{
				Report: &validator.ValidationReport{OK: true},
			},
			MockJobStore: &MockJobStore{}, // Required for persisting status
			// Expect success but AI not called.
			ExpectSuccess: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.Name, func(t *testing.T) {
			// Disable idempotency check for most tests, except the one designed to test it
			if !strings.Contains(tt.Name, "Idempotency") {
				os.Setenv("SKIP_IDEMPOTENCY", "true")
				defer os.Setenv("SKIP_IDEMPOTENCY", "")
			} else {
				os.Setenv("SKIP_IDEMPOTENCY", "false")
				defer os.Setenv("SKIP_IDEMPOTENCY", "")
			}

			deps := WorkerDeps{}
			if tt.MockAI != nil {
				deps.AI = tt.MockAI
			}
			if tt.MockPDF != nil {
				deps.PDF = tt.MockPDF
			}
			if tt.MockStorage != nil {
				deps.Storage = tt.MockStorage
			}
			if tt.MockJobStore != nil {
				deps.JobStore = tt.MockJobStore
			}
			if tt.MockPlanner != nil {
				deps.Planner = tt.MockPlanner
			}
			if tt.MockValidator != nil {
				deps.Validator = tt.MockValidator
			}
			worker := NewWorker(deps)
			logger := slog.New(slog.NewTextHandler(os.Stderr, nil))

			// Inject dummy planner/validator if nil since code relies on them
			if deps.Planner == nil {
				worker.Deps.Planner = &MockPlanner{PlanResult: defaultPlannerResult()}
			}
			if deps.Validator == nil {
				worker.Deps.Validator = &MockValidator{Report: &validator.ValidationReport{OK: true}}
			}

			// We need a valid pack.json or we mock packloader.
			// The refactored worker calls packloader.LoadPack.
			// packloader relies on real filesystem.
			// We can use the existing test pack in ../packs/merdeka/sd4/v1/pack.json
			// The path in basePayload is relative. We might need to adjust it or mock packloader?
			// worker.go imports "modulajar/apps/core-go/packloader" directly.
			// To test properly without relying on FS, we would need PackLoader interface.
			// For now, let's assume the file exists relative to where `go test` runs (package root).
			// If running in `apps/core-go/worker`, `../../packs`... is correct.

			// Ensure we are in `apps/core-go/worker` for test?
			// `basePayload().PackPath` is `../packs/...` which means `apps/core-go/packs/...`.
			// `apps/core-go` is parent.
			// The actual repo structure: `apps/core-go/packs`.
			// Random job ID, PID, and DID per test case to avoid idempotency skips
			payload := basePayload()
			payload.JobID = ulid.Make().String()
			payload.PID = ulid.Make().String()
			// DID is inside graphResult... wait, ExecuteJob creates docgraph results.
			// Actually, docgraph.GenerateDocGraph generates public IDs.
			// But the basePayload has PackPath which leads to a specific pack.
			// Idempotency check in worker.go:
			// checkArtifactsExist(ctx, pack, doc, payload)
			// It checks for /{workspace_id}/{pid}/{did}/v1/modul-ajar.html

			// To truly bypass, we need unique PID or WorkspaceID.
			payload.WorkspaceID = ulid.Make().String()

			result, err := worker.ExecuteJob(context.Background(), payload, logger)

			if tt.ExpectSuccess {
				if err != nil {
					t.Fatalf("Expected success, got error: %v", err)
				}
				if result.Status != "completed" {
					t.Errorf("Expected completed, got %s. Reason: %s", result.Status, result.FailureReason)
				}
			} else {
				if err == nil {
					// Check if result returned failure status
					if result != nil && result.Status == "failed" {
						// OK
					} else {
						t.Fatal("Expected error or failed status, got success")
					}
				} else {
					if !strings.Contains(err.Error(), tt.ExpectError) {
						t.Errorf("Expected error containing '%s', got '%s'", tt.ExpectError, err.Error())
					}
				}
			}
		})
	}
}

func TestHelpers(t *testing.T) {
	// Test subjectName
	t.Run("subjectName", func(t *testing.T) {
		pack := &packloader.CurriculumPack{
			Subjects: []packloader.Subject{
				{Code: "MAT", Name: "Matematika"},
				{Code: "IPA", Name: "Ilmu Pengetahuan Alam"},
			},
		}
		if got := subjectName(pack, "MAT"); got != "Matematika" {
			t.Errorf("subjectName(MAT) = %s; want Matematika", got)
		}
		if got := subjectName(pack, "UNK"); got != "UNK" {
			t.Errorf("subjectName(UNK) = %s; want UNK", got)
		}
	})

	// Test maskTeacher
	t.Run("maskTeacher", func(t *testing.T) {
		if got := maskTeacher("Guru"); got != "Gur****" {
			t.Errorf("maskTeacher('Guru') = %s; want Gur****", got)
		}
		if got := maskTeacher("Ali"); got != "Ali" {
			t.Errorf("maskTeacher('Ali') = %s; want Ali", got)
		}
	})

	// Test min
	t.Run("min", func(t *testing.T) {
		if min(1, 2) != 1 {
			t.Error("min(1, 2) != 1")
		}
		if min(5, 3) != 3 {
			t.Error("min(5, 3) != 3")
		}
	})
}
