package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"backend/api/internal/logger"

	"github.com/gin-gonic/gin"
)

const uploadDir = "uploads"

var allowedImageExtensions = map[string]struct{}{
	".jpg":  {},
	".jpeg": {},
	".png":  {},
	".gif":  {},
	".webp": {},
	".heic": {},
	".heif": {},
	".svg":  {},
}

var allowedProfileImageExtensions = map[string]struct{}{
	".jpg":  {},
	".jpeg": {},
	".png":  {},
	".gif":  {},
	".webp": {},
	".heic": {},
	".heif": {},
}

var allowedVideoExtensions = map[string]struct{}{
	".mp4":  {},
	".mov":  {},
	".webm": {},
	".m4v":  {},
	".avi":  {},
}

const maxUploadBytes int64 = 64 << 20

func validateUploadAndResolveExtension(file *multipart.FileHeader, allowVideos bool, allowSVG bool) (string, string, error) {
	if file == nil {
		return "", "", fmt.Errorf("missing file")
	}
	if file.Size <= 0 {
		return "", "", fmt.Errorf("empty upload")
	}
	if file.Size > maxUploadBytes {
		return "", "", fmt.Errorf("file too large")
	}

	headerContentType := strings.ToLower(strings.TrimSpace(file.Header.Get("Content-Type")))
	if idx := strings.Index(headerContentType, ";"); idx >= 0 {
		headerContentType = strings.TrimSpace(headerContentType[:idx])
	}

	detectedContentType := ""
	opened, err := file.Open()
	if err == nil {
		defer opened.Close()
		probe := make([]byte, 512)
		readCount, readErr := opened.Read(probe)
		if readErr != nil && readErr != io.EOF {
			return "", "", fmt.Errorf("failed to read upload")
		}
		if readCount > 0 {
			detectedContentType = strings.ToLower(http.DetectContentType(probe[:readCount]))
			if idx := strings.Index(detectedContentType, ";"); idx >= 0 {
				detectedContentType = strings.TrimSpace(detectedContentType[:idx])
			}
		}
	}

	if headerContentType == "text/html" || detectedContentType == "text/html" ||
		headerContentType == "application/xhtml+xml" || detectedContentType == "application/xhtml+xml" {
		return "", "", fmt.Errorf("unsupported file type")
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext == "" {
		if headerContentType != "" {
			if guessed, guessErr := mime.ExtensionsByType(headerContentType); guessErr == nil && len(guessed) > 0 {
				ext = strings.ToLower(guessed[0])
			}
		}
		if ext == "" && detectedContentType != "" {
			if guessed, guessErr := mime.ExtensionsByType(detectedContentType); guessErr == nil && len(guessed) > 0 {
				ext = strings.ToLower(guessed[0])
			}
		}
	}

	isImage := strings.HasPrefix(headerContentType, "image/") || strings.HasPrefix(detectedContentType, "image/")
	isVideo := strings.HasPrefix(headerContentType, "video/") || strings.HasPrefix(detectedContentType, "video/")

	if isImage {
		if _, ok := allowedImageExtensions[ext]; !ok {
			if ext == "" {
				ext = ".jpg"
			} else {
				return "", "", fmt.Errorf("unsupported image format")
			}
		}
		if !allowSVG && ext == ".svg" {
			return "", "", fmt.Errorf("unsupported image format")
		}
		return ext, "image", nil
	}

	if isVideo {
		if !allowVideos {
			return "", "", fmt.Errorf("unsupported file type")
		}
		if _, ok := allowedVideoExtensions[ext]; !ok {
			if ext == "" {
				ext = ".mp4"
			} else {
				return "", "", fmt.Errorf("unsupported video format")
			}
		}
		return ext, "video", nil
	}

	if _, ok := allowedImageExtensions[ext]; ok {
		if !allowSVG && ext == ".svg" {
			return "", "", fmt.Errorf("unsupported image format")
		}
		return ext, "image", nil
	}
	if allowVideos {
		if _, ok := allowedVideoExtensions[ext]; ok {
			return ext, "video", nil
		}
	}

	return "", "", fmt.Errorf("unsupported file type")
}

func UploadMedia(context *gin.Context) {
	ct := context.Request.Header.Get("Content-Type")
	if ct == "" || !strings.Contains(strings.ToLower(ct), "multipart/form-data") {
		logger.Log.WithFields(map[string]interface{}{
			"content_type":   ct,
			"content_length": context.Request.ContentLength,
		}).Warn("UploadMedia rejected – expected multipart/form-data")
		context.JSON(http.StatusBadRequest, gin.H{
			"error":   "Bad Request",
			"message": "Content-Type must be multipart/form-data",
		})
		return
	}

	file, err := context.FormFile("file")
	if err != nil {
		file, err = context.FormFile("picture")
		if err != nil {
			file, err = context.FormFile("image")
			if err != nil {
				logMissingUpload(context, err)
				context.JSON(http.StatusBadRequest, gin.H{
					"error":   "Bad Request",
					"message": fmt.Sprintf("Missing file: %v", err),
				})
				return
			}
		}
	}

	if err := os.MkdirAll(uploadDir, 0o755); err != nil {
		RespondWithError(context, http.StatusInternalServerError, "Failed to prepare upload directory")
		return
	}

	ext, mediaKind, err := validateUploadAndResolveExtension(file, true, true)
	if err != nil {
		context.JSON(http.StatusBadRequest, gin.H{
			"error":   "Bad Request",
			"message": err.Error(),
		})
		return
	}

	name, err := randomHex(12)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, "Failed to generate filename")
		return
	}

	filename := buildManagedUploadFilename(context, name, ext)
	path := filepath.Join(uploadDir, filename)
	if err := context.SaveUploadedFile(file, path); err != nil {
		RespondWithError(context, http.StatusInternalServerError, "Failed to save file")
		return
	}

	scheme := "http"
	if context.Request.TLS != nil {
		scheme = "https"
	}
	relativeURL := fmt.Sprintf("/%s/%s", uploadDir, filename)
	absoluteURL := fmt.Sprintf("%s://%s%s", scheme, context.Request.Host, relativeURL)

	context.JSON(http.StatusOK, gin.H{
		"url":         relativeURL,
		"absolute_url": absoluteURL,
		"filename":    filename,
		"contentType": file.Header.Get("Content-Type"),
		"mediaType":   mediaKind,
		"size":        file.Size,
	})
}

func logMissingUpload(context *gin.Context, err error) {
	contentType := context.Request.Header.Get("Content-Type")
	contentLength := context.Request.ContentLength
	formErr := context.Request.ParseMultipartForm(64 << 20)
	formFieldKeys := []string{}
	formFileKeys := []string{}
	if context.Request.MultipartForm != nil {
		for key := range context.Request.MultipartForm.Value {
			formFieldKeys = append(formFieldKeys, key)
		}
		for key := range context.Request.MultipartForm.File {
			formFileKeys = append(formFileKeys, key)
		}
	}

	logger.Log.WithFields(map[string]interface{}{
		"content_type":   contentType,
		"content_length": contentLength,
		"parse_error":    fmt.Sprintf("%v", formErr),
		"form_fields":    formFieldKeys,
		"form_files":     formFileKeys,
		"file_error":     fmt.Sprintf("%v", err),
	}).Warn("UploadMedia missing file payload")
}

func randomHex(length int) (string, error) {
	buf := make([]byte, length)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

func buildManagedUploadFilename(context *gin.Context, randomName, ext string) string {
	if userID, ok := getAuthUserIDFromContext(context); ok {
		return fmt.Sprintf("u%d_%s%s", userID, randomName, ext)
	}
	return fmt.Sprintf("%s%s", randomName, ext)
}

func getAuthUserIDFromContext(context *gin.Context) (int, bool) {
	raw, ok := context.Get(authUserIDKey)
	if !ok || raw == nil {
		return 0, false
	}

	switch value := raw.(type) {
	case int:
		if value > 0 {
			return value, true
		}
	case int64:
		if value > 0 {
			return int(value), true
		}
	case float64:
		if value > 0 {
			return int(value), true
		}
	case string:
		parsed, err := strconv.Atoi(strings.TrimSpace(value))
		if err == nil && parsed > 0 {
			return parsed, true
		}
	}

	return 0, false
}
