package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"backend/api/internal/database"
	"backend/api/internal/types"

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

const expoPushURL = "https://exp.host/--/api/v2/push/send"

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
	if request.Token == "" || request.Platform == "" {
		RespondWithError(context, http.StatusBadRequest, "Missing token or platform")
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

func SendNotificationPush(targetID int64, notification *types.Notification, body string) {
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

	for _, token := range tokens {
		payload.To = token.Token
		bytesBody, _ := json.Marshal(payload)
		request, _ := http.NewRequest("POST", expoPushURL, bytes.NewBuffer(bytesBody))
		request.Header.Set("Content-Type", "application/json")
		client := &http.Client{Timeout: 4 * time.Second}
		_, _ = client.Do(request)
	}
}
