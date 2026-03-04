package database

import (
	"database/sql"
	"fmt"
	"time"
)

type ActiveBan struct {
	UserID      int       `json:"user_id"`
	Reason      string    `json:"reason"`
	BannedUntil time.Time `json:"banned_until"`
	CreatedAt   time.Time `json:"created_at"`
}

func IsUserAdmin(userID int64) (bool, error) {
	var exists bool
	query := `SELECT EXISTS(SELECT 1 FROM adminusers WHERE user_id = $1)`
	if err := DB.QueryRow(query, userID).Scan(&exists); err != nil {
		return false, err
	}
	return exists, nil
}

func SetUserAdmin(userID int64, grantedBy *int64, isAdmin bool) error {
	if isAdmin {
		query := `INSERT INTO adminusers (user_id, granted_at, granted_by)
			VALUES ($1, $2, $3)
			ON CONFLICT (user_id) DO UPDATE SET granted_at = EXCLUDED.granted_at, granted_by = EXCLUDED.granted_by`
		_, err := DB.Exec(query, userID, time.Now().UTC(), grantedBy)
		return err
	}

	_, err := DB.Exec(`DELETE FROM adminusers WHERE user_id = $1`, userID)
	return err
}

func GetActiveBanByUserID(userID int64) (*ActiveBan, error) {
	query := `SELECT user_id, reason, banned_until, created_at
		FROM userbans
		WHERE user_id = $1 AND lifted_at IS NULL AND banned_until > CURRENT_TIMESTAMP
		ORDER BY banned_until DESC
		LIMIT 1`

	ban := &ActiveBan{}
	err := DB.QueryRow(query, userID).Scan(&ban.UserID, &ban.Reason, &ban.BannedUntil, &ban.CreatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return ban, nil
}

func GetActiveBanByUsername(username string) (*ActiveBan, error) {
	query := `SELECT ub.user_id, ub.reason, ub.banned_until, ub.created_at
		FROM userbans ub
		JOIN users u ON u.id = ub.user_id
		WHERE LOWER(u.username) = LOWER($1)
			AND ub.lifted_at IS NULL
			AND ub.banned_until > CURRENT_TIMESTAMP
		ORDER BY ub.banned_until DESC
		LIMIT 1`

	ban := &ActiveBan{}
	err := DB.QueryRow(query, username).Scan(&ban.UserID, &ban.Reason, &ban.BannedUntil, &ban.CreatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return ban, nil
}

func CreateUserBan(userID int64, reason string, bannedUntil time.Time, bannedBy *int64) error {
	if reason == "" {
		reason = "Violation of community guidelines"
	}

	_, err := DB.Exec(`UPDATE userbans SET lifted_at = $2 WHERE user_id = $1 AND lifted_at IS NULL`, userID, time.Now().UTC())
	if err != nil {
		return fmt.Errorf("failed to close existing bans: %w", err)
	}

	_, err = DB.Exec(`INSERT INTO userbans (user_id, reason, banned_until, created_at, banned_by) VALUES ($1, $2, $3, $4, $5)`,
		userID,
		reason,
		bannedUntil.UTC(),
		time.Now().UTC(),
		bannedBy,
	)
	if err != nil {
		return fmt.Errorf("failed to create ban: %w", err)
	}

	return nil
}

func LiftUserBan(userID int64) error {
	_, err := DB.Exec(`UPDATE userbans SET lifted_at = $2 WHERE user_id = $1 AND lifted_at IS NULL`, userID, time.Now().UTC())
	return err
}
