package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"backend/api/internal/database"
	"backend/api/internal/logger"

	"github.com/gin-gonic/gin"
)

type RegisterPushTokenRequest struct {
	Token    string `json:"token"`
	Platform string `json:"platform"`
}

type ExpoPushMessage struct {
	To    string                 `json:"to"`
	Title string                 `json:"title"`
	Body  string                 `json:"body"`
	Data  map[string]interface{} `json:"data,omitempty"`
}

type ExpoPushTicketResponse struct {
	Data struct {
		Status  string `json:"status"`
		Message string `json:"message"`
		Details struct {
			Error string `json:"error"`
		} `json:"details"`
	} `json:"data"`
}

const expoPushURL = "https://exp.host/--/api/v2/push/send"

var expoPushHTTPClient = &http.Client{Timeout: 4 * time.Second}

func RegisterPushToken(context *gin.Context) {
	userID, ok := GetAuthUserID(context)
	if !ok {
		RespondWithError(context, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var request RegisterPushTokenRequest
	if err := context.BindJSON(&request); err != nil {
		RespondWithError(context, http.StatusBadRequest, "Invalid request")
		return
	}

	request.Token = strings.TrimSpace(request.Token)
	request.Platform = strings.ToLower(strings.TrimSpace(request.Platform))
	if request.Token == "" || request.Platform == "" {
		RespondWithError(context, http.StatusBadRequest, "Missing token or platform")
		return
	}
	if !isValidExpoPushToken(request.Token) {
		RespondWithError(context, http.StatusBadRequest, "Invalid Expo push token")
		return
	}

	status, err := database.UpsertPushToken(userID, request.Token, request.Platform)
	if err != nil {
		RespondWithError(context, status, fmt.Sprintf("Failed to store token: %v", err))
		return
	}

	context.JSON(http.StatusOK, gin.H{"message": "Token registered"})
}

func GetNotifications(context *gin.Context) {
	userID, ok := GetAuthUserID(context)
	if !ok {
		RespondWithError(context, http.StatusUnauthorized, "Unauthorized")
		return
	}

	start, count := 0, 50
	if raw := context.Query("start"); raw != "" {
		if value, err := strconv.Atoi(raw); err == nil && value >= 0 {
			start = value
		}
	}
	if raw := context.Query("count"); raw != "" {
		if value, err := strconv.Atoi(raw); err == nil && value > 0 {
			count = value
		}
	}

	items, status, err := database.QueryNotificationsByUser(userID, start, count)
	if err != nil {
		RespondWithError(context, status, fmt.Sprintf("Failed to fetch notifications: %v", err))
		return
	}

	context.JSON(http.StatusOK, items)
}

func GetNotificationCount(context *gin.Context) {
	userID, ok := GetAuthUserID(context)
	if !ok {
		RespondWithError(context, http.StatusUnauthorized, "Unauthorized")
		return
	}

	count, status, err := database.GetUnreadNotificationCount(userID)
	if err != nil {
		RespondWithError(context, status, fmt.Sprintf("Failed to fetch count: %v", err))
		return
	}

	context.JSON(http.StatusOK, gin.H{"count": count})
}

func MarkNotificationRead(context *gin.Context) {
	userID, ok := GetAuthUserID(context)
	if !ok {
		RespondWithError(context, http.StatusUnauthorized, "Unauthorized")
		return
	}

	id, err := strconv.Atoi(context.Param("notification_id"))
	if err != nil {
		RespondWithError(context, http.StatusBadRequest, "Invalid notification id")
		return
	}

	status, err := database.MarkNotificationRead(userID, int64(id))
	if err != nil {
		RespondWithError(context, status, fmt.Sprintf("Failed to mark read: %v", err))
		return
	}

	context.JSON(http.StatusOK, gin.H{"message": "Notification marked read"})
}

func DeleteNotification(context *gin.Context) {
	userID, ok := GetAuthUserID(context)
	if !ok {
		RespondWithError(context, http.StatusUnauthorized, "Unauthorized")
		return
	}

	id, err := strconv.Atoi(context.Param("notification_id"))
	if err != nil {
		RespondWithError(context, http.StatusBadRequest, "Invalid notification id")
		return
	}

	status, err := database.DeleteNotification(userID, int64(id))
	if err != nil {
		RespondWithError(context, status, fmt.Sprintf("Failed to delete: %v", err))
		return
	}

	context.JSON(http.StatusOK, gin.H{"message": "Notification deleted"})
}

func ClearNotifications(context *gin.Context) {
	userID, ok := GetAuthUserID(context)
	if !ok {
		RespondWithError(context, http.StatusUnauthorized, "Unauthorized")
		return
	}

	status, err := database.ClearNotifications(userID)
	if err != nil {
		RespondWithError(context, status, fmt.Sprintf("Failed to clear: %v", err))
		return
	}

	context.JSON(http.StatusOK, gin.H{"message": "Notifications cleared"})
}

func SendNotificationPush(targetID int64, notification *database.Notification, body string) {
	if notification == nil {
		return
	}

	tokens, status, err := database.QueryPushTokens(targetID)
	if err != nil || status != http.StatusOK {
		return
	}

	payload := ExpoPushMessage{
		Title: "DevBits",
		Body:  body,
		Data: map[string]interface{}{
			"actor_id":   notification.ActorID,
			"actor_name": notification.ActorName,
			"type":       notification.Type,
			"post_id":    notification.PostID,
			"project_id": notification.ProjectID,
			"comment_id": notification.CommentID,
		},
	}

	const maxWorkers = 6
	workerCount := len(tokens)
	if workerCount > maxWorkers {
		workerCount = maxWorkers
	}
	if workerCount < 1 {
		return
	}

	tokensCh := make(chan database.PushToken)
	for i := 0; i < workerCount; i++ {
		go func() {
			for token := range tokensCh {
				sendPushToToken(token.Token, payload)
			}
		}()
	}

	for _, token := range tokens {
		tokensCh <- token
	}
	close(tokensCh)
}

func isValidExpoPushToken(token string) bool {
	return strings.HasPrefix(token, "ExponentPushToken[") || strings.HasPrefix(token, "ExpoPushToken[")
}

func sendPushToToken(token string, basePayload ExpoPushMessage) {
	if token == "" {
		return
	}

	payload := basePayload
	payload.To = token

	bytesBody, err := json.Marshal(payload)
	if err != nil {
		return
	}

	request, err := http.NewRequest("POST", expoPushURL, bytes.NewBuffer(bytesBody))
	if err != nil {
		return
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Accept", "application/json")

	response, err := expoPushHTTPClient.Do(request)
	if err != nil {
		logger.Log.Warnf("push delivery failed for token: %v", err)
		return
	}
	defer response.Body.Close()

	responseBytes, err := io.ReadAll(response.Body)
	if err != nil {
		return
	}

	if response.StatusCode >= http.StatusBadRequest {
		logger.Log.Warnf("expo push rejected token with status %d", response.StatusCode)
	}

	if shouldDeleteToken(responseBytes) {
		_, _ = database.DeletePushToken(token)
	}
}

func shouldDeleteToken(responseBytes []byte) bool {
	if len(responseBytes) == 0 {
		return false
	}

	var ticket ExpoPushTicketResponse
	if err := json.Unmarshal(responseBytes, &ticket); err != nil {
		return false
	}

	if ticket.Data.Status != "error" {
		return false
	}

	errorCode := strings.ToLower(strings.TrimSpace(ticket.Data.Details.Error))
	message := strings.ToLower(strings.TrimSpace(ticket.Data.Message))
	return errorCode == "devicenotregistered" || strings.Contains(message, "not a registered push notification recipient")
}
