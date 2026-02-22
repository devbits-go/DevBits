package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"backend/api/internal/auth"
	"backend/api/internal/database"
	"backend/api/internal/logger"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

type directMessageStreamEvent struct {
	Type          string                `json:"type"`
	DirectMessage database.DirectMessage `json:"direct_message"`
}

type directMessageHub struct {
	mu          sync.RWMutex
	subscribers map[string]map[chan directMessageStreamEvent]struct{}
}

func newDirectMessageHub() *directMessageHub {
	return &directMessageHub{
		subscribers: make(map[string]map[chan directMessageStreamEvent]struct{}),
	}
}

func (h *directMessageHub) subscribe(username string) chan directMessageStreamEvent {
	channel := make(chan directMessageStreamEvent, 32)
	normalized := normalizeUsername(username)

	h.mu.Lock()
	defer h.mu.Unlock()

	if _, ok := h.subscribers[normalized]; !ok {
		h.subscribers[normalized] = make(map[chan directMessageStreamEvent]struct{})
	}
	h.subscribers[normalized][channel] = struct{}{}
	return channel
}

func (h *directMessageHub) unsubscribe(username string, channel chan directMessageStreamEvent) {
	normalized := normalizeUsername(username)

	h.mu.Lock()
	defer h.mu.Unlock()

	listeners, ok := h.subscribers[normalized]
	if !ok {
		return
	}

	if _, exists := listeners[channel]; exists {
		delete(listeners, channel)
		close(channel)
	}

	if len(listeners) == 0 {
		delete(h.subscribers, normalized)
	}
}

func (h *directMessageHub) publish(message database.DirectMessage) {
	event := directMessageStreamEvent{
		Type:          "direct_message",
		DirectMessage: message,
	}

	targets := []string{message.SenderName, message.RecipientName}
	for _, target := range targets {
		h.publishToUser(target, event)
	}
}

func (h *directMessageHub) publishToUser(username string, event directMessageStreamEvent) {
	normalized := normalizeUsername(username)

	h.mu.RLock()
	listeners, ok := h.subscribers[normalized]
	if !ok || len(listeners) == 0 {
		h.mu.RUnlock()
		return
	}
	channels := make([]chan directMessageStreamEvent, 0, len(listeners))
	for channel := range listeners {
		channels = append(channels, channel)
	}
	h.mu.RUnlock()

	for _, channel := range channels {
		select {
		case channel <- event:
		default:
		}
	}
}

func normalizeUsername(value string) string {
	return strings.ToLower(strings.TrimSpace(strings.TrimPrefix(value, "@")))
}

func extractToken(context *gin.Context) string {
	authorization := strings.TrimSpace(context.GetHeader("Authorization"))
	if strings.HasPrefix(strings.ToLower(authorization), "bearer ") {
		return strings.TrimSpace(authorization[7:])
	}
	return strings.TrimSpace(context.Query("token"))
}

func parseTokenClaims(context *gin.Context) (*auth.Claims, bool) {
	token := extractToken(context)
	if token == "" {
		RespondWithError(context, http.StatusUnauthorized, "Missing auth token")
		return nil, false
	}

	claims, err := auth.ParseToken(token)
	if err != nil {
		RespondWithError(context, http.StatusUnauthorized, "Invalid auth token")
		return nil, false
	}

	return claims, true
}

var wsUpgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(_ *http.Request) bool {
		return true
	},
}

var dmHub = newDirectMessageHub()

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

	dmHub.publish(*message)

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

func StreamDirectMessages(context *gin.Context) {
	username := normalizeUsername(context.Param("username"))
	if username == "" {
		RespondWithError(context, http.StatusBadRequest, "Username required")
		return
	}

	claims, ok := parseTokenClaims(context)
	if !ok {
		return
	}

	if normalizeUsername(claims.Username) != username {
		RespondWithError(context, http.StatusForbidden, "Forbidden")
		return
	}

	if !websocket.IsWebSocketUpgrade(context.Request) {
		logger.Log.WithFields(map[string]interface{}{
			"path":       context.Request.URL.Path,
			"upgrade":    context.GetHeader("Upgrade"),
			"connection": context.GetHeader("Connection"),
			"user_agent": context.GetHeader("User-Agent"),
		}).Warn("Direct message stream request missing websocket upgrade headers")
		RespondWithError(context, http.StatusBadRequest, "Failed to establish stream")
		return
	}

	connection, err := wsUpgrader.Upgrade(context.Writer, context.Request, nil)
	if err != nil {
		logger.Log.WithFields(map[string]interface{}{
			"path":                 context.Request.URL.Path,
			"upgrade":              context.GetHeader("Upgrade"),
			"connection":           context.GetHeader("Connection"),
			"sec_websocket_key":    context.GetHeader("Sec-WebSocket-Key") != "",
			"sec_websocket_version": context.GetHeader("Sec-WebSocket-Version"),
			"user_agent":           context.GetHeader("User-Agent"),
			"error":                err.Error(),
		}).Warn("Direct message stream websocket upgrade failed")
		RespondWithError(context, http.StatusBadRequest, "Failed to establish stream")
		return
	}
	defer connection.Close()

	stream := dmHub.subscribe(username)
	defer dmHub.unsubscribe(username, stream)

	_ = connection.SetReadDeadline(time.Now().Add(30 * time.Second))
	connection.SetPongHandler(func(_ string) error {
		_ = connection.SetReadDeadline(time.Now().Add(30 * time.Second))
		return nil
	})

	go func() {
		for {
			if _, _, readErr := connection.ReadMessage(); readErr != nil {
				_ = connection.Close()
				return
			}
		}
	}()

	pingTicker := time.NewTicker(20 * time.Second)
	defer pingTicker.Stop()

	for {
		select {
		case event := <-stream:
			payload, marshalErr := json.Marshal(event)
			if marshalErr != nil {
				continue
			}
			_ = connection.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := connection.WriteMessage(websocket.TextMessage, payload); err != nil {
				return
			}
		case <-pingTicker.C:
			_ = connection.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := connection.WriteMessage(websocket.PingMessage, []byte("ping")); err != nil {
				return
			}
		case <-context.Request.Context().Done():
			return
		}
	}
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

func GetDirectMessageThreads(context *gin.Context) {
	username := context.Param("username")

	start := 0
	count := 50
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

	threads, status, err := database.QueryDirectMessageThreads(username, start, count)
	if err != nil {
		RespondWithError(context, status, fmt.Sprintf("Failed to fetch direct message threads: %v", err))
		return
	}

	context.JSON(http.StatusOK, gin.H{"message": "Successfully got message threads", "threads": threads})
}
