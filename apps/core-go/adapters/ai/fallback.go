package ai

import (
	"context"
	"fmt"
	"log/slog"
)

// Client interface defines the Generate method that both OpenAI and Gemini clients implement.
type Client interface {
	Generate(ctx context.Context, req GenerateRequest) (*GenerateResponse, error)
}

// FallbackClient wraps two AI clients and provides a failover mechanism.
type FallbackClient struct {
	Primary  Client
	Fallback Client
	Logger   *slog.Logger
}

// NewFallbackClient creates a new FallbackClient.
func NewFallbackClient(primary, fallback Client, logger *slog.Logger) *FallbackClient {
	return &FallbackClient{
		Primary:  primary,
		Fallback: fallback,
		Logger:   logger,
	}
}

// Generate attempts to generate content using the Primary client, falling back to the Fallback client on failure.
func (f *FallbackClient) Generate(ctx context.Context, req GenerateRequest) (*GenerateResponse, error) {
	resp, err := f.Primary.Generate(ctx, req)
	if err == nil {
		return resp, nil
	}

	if f.Logger != nil {
		f.Logger.Warn("Primary AI provider failed, falling back to secondary provider", "error", err)
	}

	resp, err = f.Fallback.Generate(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("both primary and fallback AI providers failed: %w", err)
	}

	return resp, nil
}
