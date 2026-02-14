package database

import (
	"database/sql"
	"fmt"
	"net/http"
	"time"

	"backend/api/internal/types"
)

func QueryCreateDirectMessage(senderUsername string, recipientUsername string, content string) (*types.DirectMessage, int, error) {
	if senderUsername == "" || recipientUsername == "" {
		return nil, http.StatusBadRequest, fmt.Errorf("sender and recipient are required")
	}
	if content == "" {
		return nil, http.StatusBadRequest, fmt.Errorf("message content is required")
	}

	senderID, err := GetUserIdByUsernameInsensitive(senderUsername)
	if err != nil {
		return nil, http.StatusNotFound, fmt.Errorf("sender '%s' not found", senderUsername)
	}
	recipientID, err := GetUserIdByUsernameInsensitive(recipientUsername)
	if err != nil {
		return nil, http.StatusNotFound, fmt.Errorf("recipient '%s' not found", recipientUsername)
	}

	createdAt := time.Now().UTC()
	res, err := DB.Exec(
		`INSERT INTO DirectMessages (sender_id, recipient_id, content, creation_date) VALUES (?, ?, ?, ?);`,
		senderID,
		recipientID,
		content,
		createdAt,
	)
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to insert direct message: %w", err)
	}

	messageID, err := res.LastInsertId()
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to fetch direct message id: %w", err)
	}

	resolvedSenderName, senderNameErr := GetUsernameById(int64(senderID))
	if senderNameErr != nil || resolvedSenderName == "" {
		resolvedSenderName = senderUsername
	}
	resolvedRecipientName, recipientNameErr := GetUsernameById(int64(recipientID))
	if recipientNameErr != nil || resolvedRecipientName == "" {
		resolvedRecipientName = recipientUsername
	}

	message := &types.DirectMessage{
		ID:            messageID,
		SenderID:      int64(senderID),
		RecipientID:   int64(recipientID),
		SenderName:    resolvedSenderName,
		RecipientName: resolvedRecipientName,
		Content:       content,
		CreatedAt:     createdAt,
	}
	return message, http.StatusCreated, nil
}

func QueryDirectMessages(username string, otherUsername string, start int, count int) ([]types.DirectMessage, int, error) {
	if username == "" || otherUsername == "" {
		return nil, http.StatusBadRequest, fmt.Errorf("username and other username are required")
	}
	if start < 0 || count <= 0 {
		return nil, http.StatusBadRequest, fmt.Errorf("invalid pagination params")
	}

	userID, err := GetUserIdByUsernameInsensitive(username)
	if err != nil {
		return nil, http.StatusNotFound, fmt.Errorf("user '%s' not found", username)
	}
	otherID, err := GetUserIdByUsernameInsensitive(otherUsername)
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
	FROM DirectMessages dm
	JOIN Users sender ON sender.id = dm.sender_id
	JOIN Users recipient ON recipient.id = dm.recipient_id
	WHERE (dm.sender_id = ? AND dm.recipient_id = ?)
	   OR (dm.sender_id = ? AND dm.recipient_id = ?)
	ORDER BY dm.creation_date ASC
	LIMIT ? OFFSET ?;`

	rows, err := DB.Query(query, userID, otherID, otherID, userID, count, start)
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to query direct messages: %w", err)
	}
	defer rows.Close()

	messages := make([]types.DirectMessage, 0)
	for rows.Next() {
		var message types.DirectMessage
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

	userID, err := GetUserIdByUsernameInsensitive(username)
	if err != nil {
		return nil, http.StatusNotFound, fmt.Errorf("user '%s' not found", username)
	}

	query := `SELECT DISTINCT u.username
	FROM DirectMessages dm
	JOIN Users u ON u.id = CASE
		WHEN dm.sender_id = ? THEN dm.recipient_id
		ELSE dm.sender_id
	END
	WHERE dm.sender_id = ? OR dm.recipient_id = ?
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
