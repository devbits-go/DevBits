package database

import (
	"database/sql"
	"fmt"
	"net/http"
	"time"
)

type DirectMessage struct {
	ID            int64     `json:"id"`
	SenderID      int64     `json:"sender_id"`
	RecipientID   int64     `json:"recipient_id"`
	SenderName    string    `json:"sender_name"`
	RecipientName string    `json:"recipient_name"`
	Content       string    `json:"content"`
	CreatedAt     time.Time `json:"created_at"`
}

type DirectMessageThread struct {
	PeerUsername string    `json:"peer_username"`
	LastContent  string    `json:"last_content"`
	LastAt       time.Time `json:"last_at"`
}

func QueryCreateDirectMessage(senderUsername string, recipientUsername string, content string) (*DirectMessage, int, error) {
	if senderUsername == "" || recipientUsername == "" {
		return nil, http.StatusBadRequest, fmt.Errorf("sender and recipient are required")
	}
	if content == "" {
		return nil, http.StatusBadRequest, fmt.Errorf("message content is required")
	}

	senderID, err := GetUserIdByUsername(senderUsername)
	if err != nil {
		return nil, http.StatusNotFound, fmt.Errorf("sender '%s' not found", senderUsername)
	}
	recipientID, err := GetUserIdByUsername(recipientUsername)
	if err != nil {
		return nil, http.StatusNotFound, fmt.Errorf("recipient '%s' not found", recipientUsername)
	}

	createdAt := time.Now().UTC()
	var messageID int64
	err = DB.QueryRow(
		`INSERT INTO directmessages (sender_id, recipient_id, content, creation_date) VALUES ($1, $2, $3, $4) RETURNING id;`,
		senderID,
		recipientID,
		content,
		createdAt,
	).Scan(&messageID)
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to insert direct message: %w", err)
	}

	resolvedSender, senderErr := GetUserById(senderID)
	if senderErr != nil || resolvedSender == nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to resolve sender username: %w", senderErr)
	}
	resolvedRecipient, recipientErr := GetUserById(recipientID)
	if recipientErr != nil || resolvedRecipient == nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to resolve recipient username: %w", recipientErr)
	}

	message := &DirectMessage{
		ID:            messageID,
		SenderID:      int64(senderID),
		RecipientID:   int64(recipientID),
		SenderName:    resolvedSender.Username,
		RecipientName: resolvedRecipient.Username,
		Content:       content,
		CreatedAt:     createdAt,
	}
	return message, http.StatusCreated, nil
}

func QueryDirectMessages(username string, otherUsername string, start int, count int) ([]DirectMessage, int, error) {
	if username == "" || otherUsername == "" {
		return nil, http.StatusBadRequest, fmt.Errorf("username and other username are required")
	}
	if start < 0 || count <= 0 {
		return nil, http.StatusBadRequest, fmt.Errorf("invalid pagination params")
	}

	userID, err := GetUserIdByUsername(username)
	if err != nil {
		return nil, http.StatusNotFound, fmt.Errorf("user '%s' not found", username)
	}
	otherID, err := GetUserIdByUsername(otherUsername)
	if err != nil {
		return nil, http.StatusNotFound, fmt.Errorf("user '%s' not found", otherUsername)
	}

	query := `SELECT
		dm.id,
		dm.sender_id,
		dm.recipient_id,
		sender.username,
		recipient.username,
		dm.content,
		dm.creation_date
	FROM directmessages dm
	JOIN users sender ON sender.id = dm.sender_id
	JOIN users recipient ON recipient.id = dm.recipient_id
	WHERE (dm.sender_id = $1 AND dm.recipient_id = $2)
	   OR (dm.sender_id = $3 AND dm.recipient_id = $4)
	ORDER BY dm.creation_date ASC
	LIMIT $5 OFFSET $6;`

	rows, err := DB.Query(query, userID, otherID, otherID, userID, count, start)
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to query direct messages: %w", err)
	}
	defer rows.Close()

	messages := make([]DirectMessage, 0)
	for rows.Next() {
		var message DirectMessage
		if err := rows.Scan(
			&message.ID,
			&message.SenderID,
			&message.RecipientID,
			&message.SenderName,
			&message.RecipientName,
			&message.Content,
			&message.CreatedAt,
		); err != nil {
			return nil, http.StatusInternalServerError, fmt.Errorf("failed to scan direct message: %w", err)
		}
		messages = append(messages, message)
	}
	if err := rows.Err(); err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("direct message rows error: %w", err)
	}

	return messages, http.StatusOK, nil
}

func QueryDirectChatPeers(username string) ([]string, int, error) {
	if username == "" {
		return nil, http.StatusBadRequest, fmt.Errorf("username is required")
	}

	userID, err := GetUserIdByUsername(username)
	if err != nil {
		return nil, http.StatusNotFound, fmt.Errorf("user '%s' not found", username)
	}

	query := `SELECT DISTINCT u.username
	FROM directmessages dm
	JOIN users u ON u.id = CASE
		WHEN dm.sender_id = $1 THEN dm.recipient_id
		ELSE dm.sender_id
	END
	WHERE dm.sender_id = $2 OR dm.recipient_id = $3
	ORDER BY u.username ASC;`

	rows, err := DB.Query(query, userID, userID, userID)
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to query chat peers: %w", err)
	}
	defer rows.Close()

	peers := make([]string, 0)
	for rows.Next() {
		var peer sql.NullString
		if err := rows.Scan(&peer); err != nil {
			return nil, http.StatusInternalServerError, fmt.Errorf("failed to scan chat peer: %w", err)
		}
		if peer.Valid && peer.String != "" {
			peers = append(peers, peer.String)
		}
	}
	if err := rows.Err(); err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("chat peer rows error: %w", err)
	}

	return peers, http.StatusOK, nil
}

func QueryDirectMessageThreads(username string, start int, count int) ([]DirectMessageThread, int, error) {
	if username == "" {
		return nil, http.StatusBadRequest, fmt.Errorf("username is required")
	}
	if start < 0 || count <= 0 {
		return nil, http.StatusBadRequest, fmt.Errorf("invalid pagination params")
	}

	userID, err := GetUserIdByUsername(username)
	if err != nil {
		return nil, http.StatusNotFound, fmt.Errorf("user '%s' not found", username)
	}

	query := `WITH ranked_threads AS (
		SELECT
			CASE
				WHEN dm.sender_id = $1 THEN dm.recipient_id
				ELSE dm.sender_id
			END AS peer_id,
			dm.content,
			dm.creation_date,
			ROW_NUMBER() OVER (
				PARTITION BY CASE
					WHEN dm.sender_id = $1 THEN dm.recipient_id
					ELSE dm.sender_id
				END
				ORDER BY dm.creation_date DESC, dm.id DESC
			) AS rank_in_thread
		FROM directmessages dm
		WHERE dm.sender_id = $1 OR dm.recipient_id = $1
	)
	SELECT u.username, rt.content, rt.creation_date
	FROM ranked_threads rt
	JOIN users u ON u.id = rt.peer_id
	WHERE rt.rank_in_thread = 1
	ORDER BY rt.creation_date DESC
	LIMIT $2 OFFSET $3;`

	rows, err := DB.Query(query, userID, count, start)
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to query direct message threads: %w", err)
	}
	defer rows.Close()

	threads := make([]DirectMessageThread, 0)
	for rows.Next() {
		var thread DirectMessageThread
		if err := rows.Scan(&thread.PeerUsername, &thread.LastContent, &thread.LastAt); err != nil {
			return nil, http.StatusInternalServerError, fmt.Errorf("failed to scan direct message thread: %w", err)
		}
		threads = append(threads, thread)
	}
	if err := rows.Err(); err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("direct message thread rows error: %w", err)
	}

	return threads, http.StatusOK, nil
}
