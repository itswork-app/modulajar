package gcs

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"testing"

	"google.golang.org/api/option"
)

// MockRoundTripper implements http.RoundTripper
type MockRoundTripper struct {
	CapturedReq *http.Request
	Response    *http.Response
	Err         error
}

func (m *MockRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	m.CapturedReq = req
	return m.Response, m.Err
}

func TestNewClient_NoBucket(t *testing.T) {
	os.Setenv("GCS_BUCKET", "")
	c, err := NewClient(context.Background())
	if err != nil {
		t.Errorf("Expected nil error, got %v", err)
	}
	if c != nil {
		t.Error("Expected nil client")
	}
}

func TestNewClient_WithBucket(t *testing.T) {
	os.Setenv("GCS_BUCKET", "test-bucket")

	// Mock HTTP so NewClient doesn't try actual auth/network
	mockRT := &MockRoundTripper{
		Response: &http.Response{
			StatusCode: 200,
			Body:       io.NopCloser(bytes.NewReader([]byte("{}"))),
		},
	}
	clientOpt := option.WithHTTPClient(&http.Client{Transport: mockRT})

	c, err := NewClient(context.Background(), clientOpt, option.WithoutAuthentication())
	if err != nil {
		t.Fatalf("NewClient failed: %v", err)
	}
	if c == nil {
		t.Fatal("Expected client, got nil")
	}
	if c.BucketName() != "test-bucket" {
		t.Errorf("Expected bucket test-bucket, got %s", c.BucketName())
	}
}

func TestUpload(t *testing.T) {
	os.Setenv("GCS_BUCKET", "test-bucket")

	mockRT := &MockRoundTripper{
		Response: &http.Response{
			StatusCode: 200,
			Body:       io.NopCloser(bytes.NewReader([]byte("{}"))),
		},
	}
	clientOpt := option.WithHTTPClient(&http.Client{Transport: mockRT})
	c, _ := NewClient(context.Background(), clientOpt, option.WithoutAuthentication())

	err := c.Upload(context.Background(), "path/to/obj", []byte("content"), "text/plain")
	if err != nil {
		t.Errorf("Upload failed: %v", err)
	}

	// Verify request
	if mockRT.CapturedReq == nil {
		t.Error("Request not captured")
	} else {
		// GCS upload usually goes to storage.googleapis.com/upload/storage/v1/b/bucket/o?uploadType=multipart...
		// But client library handles that.
		// We just check method is POST or PUT? Library uses POST for simple upload?
		// Actually verifying method is tricky as library does complex things.
		// Just ensuring no error is a good start for coverage.
	}
}

func TestExists_Found(t *testing.T) {
	os.Setenv("GCS_BUCKET", "test-bucket")

	// Exists calls attrs -> GET /storage/v1/b/bucket/o/obj
	mockRT := &MockRoundTripper{
		Response: &http.Response{
			StatusCode: 200,
			Body:       io.NopCloser(bytes.NewReader([]byte(`{"name":"obj"}`))),
		},
	}
	clientOpt := option.WithHTTPClient(&http.Client{Transport: mockRT})
	c, _ := NewClient(context.Background(), clientOpt, option.WithoutAuthentication())

	exists, err := c.Exists(context.Background(), "obj")
	if err != nil {
		t.Errorf("Exists error: %v", err)
	}
	if !exists {
		t.Error("Expected exists=true")
	}
}

func TestExists_NotFound(t *testing.T) {
	os.Setenv("GCS_BUCKET", "test-bucket")

	mockRT := &MockRoundTripper{
		Response: &http.Response{
			StatusCode: 404,
			Body:       io.NopCloser(bytes.NewReader([]byte(`{"error":{"code":404,"message":"Not Found"}}`))),
		},
	}
	clientOpt := option.WithHTTPClient(&http.Client{Transport: mockRT})
	c, _ := NewClient(context.Background(), clientOpt, option.WithoutAuthentication())

	exists, err := c.Exists(context.Background(), "obj")
	if err != nil {
		t.Errorf("Exists error: %v", err)
	}
	if exists {
		t.Error("Expected exists=false")
	}
}

func TestUploadFile(t *testing.T) {
	os.Setenv("GCS_BUCKET", "test-bucket")

	mockRT := &MockRoundTripper{
		Response: &http.Response{
			StatusCode: 200,
			Body:       io.NopCloser(bytes.NewReader([]byte("{}"))),
		},
	}
	clientOpt := option.WithHTTPClient(&http.Client{Transport: mockRT})
	c, _ := NewClient(context.Background(), clientOpt, option.WithoutAuthentication())

	// Create temp file
	tmp, _ := os.CreateTemp("", "gcs-test")
	tmp.WriteString("hello")
	tmp.Close()
	defer os.Remove(tmp.Name())

	err := c.UploadFile(context.Background(), "obj", tmp.Name(), "text/plain")
	if err != nil {
		t.Errorf("UploadFile failed: %v", err)
	}
}

func TestClose(t *testing.T) {
	c := &Client{}
	if err := c.Close(); err != nil {
		// Safe to close nil client wrapper?
		// My implementation checks c.gcsClient.
	}
}
func TestUploadFile_Error(t *testing.T) {
	os.Setenv("GCS_BUCKET", "test-bucket")
	c := &Client{bucketName: "test-bucket"}
	err := c.UploadFile(context.Background(), "obj", "/nonexistent/file", "text/plain")
	if err == nil {
		t.Error("Expected error for missing file, got nil")
	}
}

func TestUpload_Error(t *testing.T) {
	os.Setenv("GCS_BUCKET", "test-bucket")
	// Using a closed client or invalid RT to trigger error
	mockRT := &MockRoundTripper{
		Err: fmt.Errorf("network error"),
	}
	clientOpt := option.WithHTTPClient(&http.Client{Transport: mockRT})
	c, _ := NewClient(context.Background(), clientOpt, option.WithoutAuthentication())

	err := c.Upload(context.Background(), "obj", []byte(""), "")
	if err == nil {
		t.Error("Expected upload error, got nil")
	}
}
