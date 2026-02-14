package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"backend/api/internal/database"

	"github.com/gin-gonic/gin"
)

type DirectMessageCreateRequest struct {
	Content string `json:"content"`
}

func GetDirectMessages(context *gin.Context) {
	username := context.Param("username")
	other := context.Param("other")

	start := 0
	count := 100
	if raw := context.Query("start"); raw != "" {
		if value, err := strconv.Atoi(raw); err == nil && value >= 0 {
			start = value
		}
	}
	if raw := context.Query("count"); raw != "" {
		if value, err := strconv.Atoi(raw); err == nil && value > 0 {
			if value > 200 {
				value = 200
			}
			count = value
		}
	}

	items, status, err := database.QueryDirectMessages(username, other, start, count)
	if err != nil {
		RespondWithError(context, status, fmt.Sprintf("Failed to fetch direct messages: %v", err))
		return
	}

	context.JSON(http.StatusOK, items)
}

func CreateDirectMessage(context *gin.Context) {
	username := context.Param("username")
	other := context.Param("other")

	var request DirectMessageCreateRequest
	if err := context.BindJSON(&request); err != nil {
		RespondWithError(context, http.StatusBadRequest, "Invalid request")
		return
	}

	content := strings.TrimSpace(request.Content)
	if content == "" {
		RespondWithError(context, http.StatusBadRequest, "Message content cannot be empty")
		return
	}

	message, status, err := database.QueryCreateDirectMessage(username, other, content)
	if err != nil {
		RespondWithError(context, status, fmt.Sprintf("Failed to create direct message: %v", err))
		return
	}

	createAndPushNotification(
		message.RecipientID,
		message.SenderID,
		"direct_message",
		nil,
		nil,
		nil,
		notificationBody(message.SenderName, "sent you a message"),
	)

	context.JSON(http.StatusCreated, gin.H{"message": "Message sent", "direct_message": message})
}

func GetDirectChatPeers(context *gin.Context) {
	username := context.Param("username")

	peers, status, err := database.QueryDirectChatPeers(username)
	if err != nil {
		RespondWithError(context, status, fmt.Sprintf("Failed to fetch chat peers: %v", err))
		return
	}

	context.JSON(http.StatusOK, gin.H{"message": "Successfully got chat peers", "peers": peers})
}
