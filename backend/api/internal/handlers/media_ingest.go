package handlers

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const maxIngestedMediaBytes int64 = 64 * 1024 * 1024

var mediaHTTPClient = &http.Client{Timeout: 15 * time.Second}

func coerceStringSlice(value interface{}) ([]string, bool) {
	switch typed := value.(type) {
	case []string:
		result := make([]string, len(typed))
		copy(result, typed)
		return result, true
	case []interface{}:
		result := make([]string, 0, len(typed))
		for _, item := range typed {
			text, ok := item.(string)
			if !ok {
				return nil, false
			}
			result = append(result, text)
		}
		return result, true
	default:
		return nil, false
	}
}

func materializeMediaList(values []string) ([]string, error) {
	if len(values) == 0 {
		return values, nil
	}

	normalized := make([]string, 0, len(values))
	for _, value := range values {
		stored, err := materializeMediaReference(value)
		if err != nil {
			return nil, err
		}
		normalized = append(normalized, stored)
	}

	return normalized, nil
}

func materializeMediaReference(raw string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "", nil
	}

	// Check if this is already a managed upload path (e.g. "/uploads/abc123.jpg"
	// or "uploads/abc123.jpg").
	if filename, managed := extractManagedUploadFilename(trimmed); managed {
		filePath := filepath.Join(uploadDir, filename)
		if _, statErr := os.Stat(filePath); statErr != nil {
			if os.IsNotExist(statErr) {
				return "", fmt.Errorf("managed media file not found")
			}
			return "", fmt.Errorf("failed to access managed media file")
		}
		return fmt.Sprintf("/%s/%s", uploadDir, filename), nil
	}

	if strings.HasPrefix(trimmed, "data:") {
		return materializeDataURI(trimmed)
	}

	parsed, err := url.Parse(trimmed)
	if err != nil {
		return "", fmt.Errorf("invalid media reference")
	}

	if parsed.Scheme == "http" || parsed.Scheme == "https" {
		// Before downloading, check if the URL points to our own managed
		// uploads directory (e.g. "https://devbits.ddns.net/uploads/abc.jpg").
		// If so, treat it as a local file to avoid a self-referential HTTP
		// request that can hang or loop.
		if filename, managed := extractManagedUploadFilename(parsed.Path); managed {
			filePath := filepath.Join(uploadDir, filename)
			if _, statErr := os.Stat(filePath); statErr == nil {
				return fmt.Sprintf("/%s/%s", uploadDir, filename), nil
			}
			// File doesn't exist locally — fall through to remote download
			// in case this is a legitimate external URL that happens to have
			// an /uploads/ path.
		}
		return materializeRemoteURL(parsed)
	}

	return "", fmt.Errorf("unsupported media reference scheme")
}

func materializeDataURI(raw string) (string, error) {
	commaIndex := strings.Index(raw, ",")
	if commaIndex <= 0 {
		return "", fmt.Errorf("invalid data uri")
	}

	meta := raw[:commaIndex]
	payload := raw[commaIndex+1:]
	isBase64 := strings.Contains(strings.ToLower(meta), ";base64")

	mediaType := "application/octet-stream"
	if strings.HasPrefix(strings.ToLower(meta), "data:") {
		metaWithoutPrefix := strings.TrimPrefix(meta, "data:")
		metaWithoutPrefix = strings.TrimSuffix(metaWithoutPrefix, ";base64")
		if metaWithoutPrefix != "" {
			mediaType = strings.Split(metaWithoutPrefix, ";")[0]
		}
	}

	var body []byte
	var err error
	if isBase64 {
		body, err = base64.StdEncoding.DecodeString(payload)
	} else {
		decoded, decodeErr := url.QueryUnescape(payload)
		if decodeErr != nil {
			return "", fmt.Errorf("invalid data uri encoding")
		}
		body = []byte(decoded)
	}
	if err != nil {
		return "", fmt.Errorf("invalid data uri payload")
	}

	if int64(len(body)) > maxIngestedMediaBytes {
		return "", fmt.Errorf("media file exceeds %d bytes", maxIngestedMediaBytes)
	}

	ext := extensionFromContentType(mediaType)
	return saveManagedUpload(body, ext)
}

func materializeRemoteURL(parsed *url.URL) (string, error) {
	request, err := http.NewRequest(http.MethodGet, parsed.String(), nil)
	if err != nil {
		return "", fmt.Errorf("invalid media url")
	}

	response, err := mediaHTTPClient.Do(request)
	if err != nil {
		return "", fmt.Errorf("failed to download media")
	}
	defer response.Body.Close()

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return "", fmt.Errorf("failed to download media")
	}

	reader := io.LimitReader(response.Body, maxIngestedMediaBytes+1)
	body, err := io.ReadAll(reader)
	if err != nil {
		return "", fmt.Errorf("failed to read downloaded media")
	}
	if int64(len(body)) > maxIngestedMediaBytes {
		return "", fmt.Errorf("media file exceeds %d bytes", maxIngestedMediaBytes)
	}

	contentType := response.Header.Get("Content-Type")
	ext := extensionFromPathOrType(parsed.Path, contentType)
	return saveManagedUpload(body, ext)
}

func extensionFromPathOrType(pathValue, contentType string) string {
	ext := strings.ToLower(filepath.Ext(pathValue))
	if ext != "" {
		return ext
	}
	return extensionFromContentType(contentType)
}

func extensionFromContentType(contentType string) string {
	if contentType == "" {
		return ""
	}
	mediaType, _, err := mime.ParseMediaType(contentType)
	if err != nil {
		mediaType = contentType
	}
	extensions, err := mime.ExtensionsByType(mediaType)
	if err != nil || len(extensions) == 0 {
		return ""
	}
	return strings.ToLower(extensions[0])
}

func saveManagedUpload(body []byte, ext string) (string, error) {
	if err := os.MkdirAll(uploadDir, 0o755); err != nil {
		return "", fmt.Errorf("failed to prepare upload directory")
	}

	name, err := randomHex(12)
	if err != nil {
		return "", fmt.Errorf("failed to generate filename")
	}

	filename := fmt.Sprintf("%s%s", name, ext)
	path := filepath.Join(uploadDir, filename)

	if err := os.WriteFile(path, bytes.Clone(body), 0o644); err != nil {
		return "", fmt.Errorf("failed to store media")
	}

	return fmt.Sprintf("/%s/%s", uploadDir, filename), nil
}
