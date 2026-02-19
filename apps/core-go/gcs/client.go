package gcs

import (
	"context"
	"fmt"
	"io"
	"os"
	"strings"

	"cloud.google.com/go/storage"
	"google.golang.org/api/option"
)

// Client wraps the GCS storage client.
type Client struct {
	bucket     string
	gcsClient  *storage.Client
	bucketName string
}

// NewClient creates a new GCS client. Uses Application Default Credentials by default.
// If GCS_BUCKET env var is empty, returns nil (upload disabled).
func NewClient(ctx context.Context, opts ...option.ClientOption) (*Client, error) {
	bucket := os.Getenv("GCS_BUCKET")
	if bucket == "" {
		return nil, nil // GCS disabled
	}

	client, err := storage.NewClient(ctx, opts...)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCS client: %w", err)
	}

	return &Client{
		bucket:     bucket,
		gcsClient:  client,
		bucketName: bucket,
	}, nil
}

// Upload uploads data to GCS at the given object path.
// If the object already exists, it is overwritten (safe for idempotent retries).
func (c *Client) Upload(ctx context.Context, objectPath string, data []byte, contentType string) error {
	if c == nil || c.gcsClient == nil {
		return fmt.Errorf("GCS client is nil (GCS_BUCKET not set?)")
	}

	obj := c.gcsClient.Bucket(c.bucketName).Object(objectPath)
	writer := obj.NewWriter(ctx)
	writer.ContentType = contentType
	writer.CacheControl = "private, max-age=0"

	if _, err := writer.Write(data); err != nil {
		writer.Close()
		return fmt.Errorf("failed to write to GCS: %w", err)
	}
	if err := writer.Close(); err != nil {
		return fmt.Errorf("failed to close GCS writer: %w", err)
	}

	return nil
}

// UploadFile uploads a local file to GCS.
func (c *Client) UploadFile(ctx context.Context, objectPath string, filePath string, contentType string) error {
	f, err := os.Open(filePath)
	if err != nil {
		return fmt.Errorf("failed to open file %s: %w", filePath, err)
	}
	defer f.Close()

	data, err := io.ReadAll(f)
	if err != nil {
		return fmt.Errorf("failed to read file %s: %w", filePath, err)
	}

	return c.Upload(ctx, objectPath, data, contentType)
}

// Exists checks if an object exists in GCS.
func (c *Client) Exists(ctx context.Context, objectPath string) (bool, error) {
	if c == nil || c.gcsClient == nil {
		return false, nil
	}

	obj := c.gcsClient.Bucket(c.bucketName).Object(objectPath)
	_, err := obj.Attrs(ctx)
	if err != nil {
		if strings.Contains(err.Error(), "doesn't exist") || strings.Contains(err.Error(), "not found") {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

// BucketName returns the configured bucket name.
func (c *Client) BucketName() string {
	if c == nil {
		return ""
	}
	return c.bucketName
}

// Close closes the GCS client.
func (c *Client) Close() error {
	if c == nil || c.gcsClient == nil {
		return nil
	}
	return c.gcsClient.Close()
}
