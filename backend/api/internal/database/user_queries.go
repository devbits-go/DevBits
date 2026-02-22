package database

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
)

type ApiUser struct {
	Id           int                    `json:"id"`
	Username     string                 `json:"username"`
	Picture      string                 `json:"picture"`
	Bio          string                 `json:"bio"`
	Links        map[string]interface{} `json:"links"`
	Settings     map[string]interface{} `json:"settings"`
	CreationDate string                 `json:"creation_date"`
}

type UserLoginInfo struct {
	Username     string `json:"username"`
	PasswordHash string `json:"password_hash"`
}

// CreateUser inserts a new user into the database
func CreateUser(user *ApiUser) (int, error) {
	linksJson, err := json.Marshal(user.Links)
	if err != nil {
		return 0, fmt.Errorf("failed to marshal links: %w", err)
	}
	settingsJson, err := json.Marshal(user.Settings)
	if err != nil {
		return 0, fmt.Errorf("failed to marshal settings: %w", err)
	}

	// Use $1, $2, etc. for parameter placeholders in PostgreSQL
	query := `
		INSERT INTO users (username, picture, bio, links, settings, creation_date)
		VALUES ($1, $2, $3, $4, $5, NOW())
		RETURNING id;
	`
	var newId int
	err = DB.QueryRow(
		query,
		user.Username,
		user.Picture,
		user.Bio,
		linksJson,
		settingsJson,
	).Scan(&newId)
	if err != nil {
		return 0, fmt.Errorf("failed to insert user: %w", err)
	}
	return newId, nil
}

// GetUserByUsername retrieves a user by their username
func GetUserByUsername(username string) (*ApiUser, error) {
	query := `
		SELECT id, username, picture, bio, links, settings, creation_date
		FROM users
		WHERE LOWER(username) = LOWER($1)
		ORDER BY CASE WHEN username = $1 THEN 0 ELSE 1 END, id ASC
		LIMIT 1;
	`
	user := &ApiUser{}
	var links, settings []byte
	err := DB.QueryRow(query, username).Scan(
		&user.Id,
		&user.Username,
		&user.Picture,
		&user.Bio,
		&links,
		&settings,
		&user.CreationDate,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil // User not found
		}
		return nil, fmt.Errorf("failed to get user by username: %w", err)
	}

	if err := json.Unmarshal(links, &user.Links); err != nil {
		log.Printf("WARN: could not unmarshal user links: %v", err)
	}
	if err := json.Unmarshal(settings, &user.Settings); err != nil {
		log.Printf("WARN: could not unmarshal user settings: %v", err)
	}

	return user, nil
}

// GetUserById retrieves a user by their ID
func GetUserById(id int) (*ApiUser, error) {
	query := `
		SELECT id, username, picture, bio, links, settings, creation_date
		FROM users
		WHERE id = $1;
	`
	user := &ApiUser{}
	var links, settings []byte
	err := DB.QueryRow(query, id).Scan(
		&user.Id,
		&user.Username,
		&user.Picture,
		&user.Bio,
		&links,
		&settings,
		&user.CreationDate,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil // User not found
		}
		return nil, fmt.Errorf("failed to get user by id: %w", err)
	}

	if err := json.Unmarshal(links, &user.Links); err != nil {
		log.Printf("WARN: could not unmarshal user links: %v", err)
	}
	if err := json.Unmarshal(settings, &user.Settings); err != nil {
		log.Printf("WARN: could not unmarshal user settings: %v", err)
	}

	return user, nil
}

// UpdateUser updates a user's information
func UpdateUser(user *ApiUser) error {
	linksJson, err := json.Marshal(user.Links)
	if err != nil {
		return fmt.Errorf("failed to marshal links: %w", err)
	}
	settingsJson, err := json.Marshal(user.Settings)
	if err != nil {
		return fmt.Errorf("failed to marshal settings: %w", err)
	}

	query := `
		UPDATE users
		SET picture = $1, bio = $2, links = $3, settings = $4
		WHERE username = $5;
	`
	_, err = DB.Exec(
		query,
		user.Picture,
		user.Bio,
		linksJson,
		settingsJson,
		user.Username,
	)
	if err != nil {
		return fmt.Errorf("failed to update user: %w", err)
	}
	return nil
}

// DeleteUser deletes a user by their username
func DeleteUser(username string) error {
	tx, err := DB.Begin()
	if err != nil {
		return fmt.Errorf("failed to start user delete transaction: %w", err)
	}

	rollback := func(original error) error {
		if rollbackErr := tx.Rollback(); rollbackErr != nil {
			return fmt.Errorf("%v (rollback failed: %v)", original, rollbackErr)
		}
		return original
	}

	var userID int
	if err := tx.QueryRow("SELECT id FROM users WHERE username = $1", username).Scan(&userID); err != nil {
		if err == sql.ErrNoRows {
			return rollback(fmt.Errorf("user not found"))
		}
		return rollback(fmt.Errorf("failed to resolve user id: %w", err))
	}

	_, err = tx.Exec(
		`DELETE FROM comments WHERE id IN (
			SELECT DISTINCT comment_id FROM (
				SELECT pc.comment_id
				FROM postcomments pc
				JOIN posts p ON p.id = pc.post_id
				WHERE p.user_id = $1 OR p.project_id IN (SELECT id FROM projects WHERE owner = $1)
				UNION
				SELECT prc.comment_id
				FROM projectcomments prc
				JOIN projects pr ON pr.id = prc.project_id
				WHERE pr.owner = $1
			) owned_comment_ids
		);`,
		userID,
	)
	if err != nil {
		return rollback(fmt.Errorf("failed to delete comments linked to user-owned content: %w", err))
	}

	if _, err := tx.Exec("DELETE FROM userlogininfo WHERE username = $1", username); err != nil {
		return rollback(fmt.Errorf("failed to delete user login info: %w", err))
	}

	if _, err := tx.Exec("DELETE FROM directmessages WHERE sender_id = $1 OR recipient_id = $1", userID); err != nil {
		return rollback(fmt.Errorf("failed to delete user direct messages: %w", err))
	}

	res, err := tx.Exec("DELETE FROM users WHERE id = $1", userID)
	if err != nil {
		return rollback(fmt.Errorf("failed to delete user: %w", err))
	}

	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return rollback(fmt.Errorf("failed to fetch affected rows while deleting user: %w", err))
	}
	if rowsAffected == 0 {
		return rollback(fmt.Errorf("user not found"))
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit user delete transaction: %w", err)
	}

	return nil
}

// GetUsers retrieves a list of all users
func GetUsers() ([]*ApiUser, error) {
	query := `
		SELECT id, username, picture, bio, links, settings, creation_date
		FROM users;
	`
	rows, err := DB.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to get users: %w", err)
	}
	defer rows.Close()

	var users []*ApiUser
	for rows.Next() {
		user := &ApiUser{}
		var links, settings []byte
		if err := rows.Scan(
			&user.Id,
			&user.Username,
			&user.Picture,
			&user.Bio,
			&links,
			&settings,
			&user.CreationDate,
		); err != nil {
			return nil, fmt.Errorf("failed to scan user row: %w", err)
		}

		if err := json.Unmarshal(links, &user.Links); err != nil {
			log.Printf("WARN: could not unmarshal user links: %v", err)
		}
		if err := json.Unmarshal(settings, &user.Settings); err != nil {
			log.Printf("WARN: could not unmarshal user settings: %v", err)
		}
		users = append(users, user)
	}

	return users, nil
}

// FollowUser creates a follow relationship between two users
func FollowUser(followerUsername, followedUsername string) error {
	follower, err := GetUserByUsername(followerUsername)
	if err != nil {
		return fmt.Errorf("failed to get follower: %w", err)
	}
	if follower == nil {
		return fmt.Errorf("follower not found")
	}

	followed, err := GetUserByUsername(followedUsername)
	if err != nil {
		return fmt.Errorf("failed to get followed user: %w", err)
	}
	if followed == nil {
		return fmt.Errorf("followed user not found")
	}

	query := "INSERT INTO userfollows (follower_id, followed_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;"
	_, err = DB.Exec(query, follower.Id, followed.Id)
	if err != nil {
		return fmt.Errorf("failed to follow user: %w", err)
	}
	return nil
}

// UnfollowUser removes a follow relationship between two users
func UnfollowUser(followerUsername, followedUsername string) error {
	follower, err := GetUserByUsername(followerUsername)
	if err != nil {
		return fmt.Errorf("failed to get follower: %w", err)
	}
	if follower == nil {
		return fmt.Errorf("follower not found")
	}

	followed, err := GetUserByUsername(followedUsername)
	if err != nil {
		return fmt.Errorf("failed to get followed user: %w", err)
	}
	if followed == nil {
		return fmt.Errorf("followed user not found")
	}

	query := "DELETE FROM userfollows WHERE follower_id = $1 AND followed_id = $2;"
	_, err = DB.Exec(query, follower.Id, followed.Id)
	if err != nil {
		return fmt.Errorf("failed to unfollow user: %w", err)
	}
	return nil
}

// GetUserFollowers retrieves a list of users who follow the given user
func GetUserFollowers(username string) ([]*ApiUser, error) {
	user, err := GetUserByUsername(username)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}
	if user == nil {
		return nil, fmt.Errorf("user not found")
	}

	query := `
		SELECT u.id, u.username, u.picture, u.bio, u.links, u.settings, u.creation_date
		FROM users u
		JOIN userfollows f ON u.id = f.follower_id
		WHERE f.followed_id = $1;
	`
	rows, err := DB.Query(query, user.Id)
	if err != nil {
		return nil, fmt.Errorf("failed to get followers: %w", err)
	}
	defer rows.Close()

	var followers []*ApiUser
	for rows.Next() {
		follower := &ApiUser{}
		var links, settings []byte
		if err := rows.Scan(
			&follower.Id,
			&follower.Username,
			&follower.Picture,
			&follower.Bio,
			&links,
			&settings,
			&follower.CreationDate,
		); err != nil {
			return nil, fmt.Errorf("failed to scan follower row: %w", err)
		}

		if err := json.Unmarshal(links, &follower.Links); err != nil {
			log.Printf("WARN: could not unmarshal follower links: %v", err)
		}
		if err := json.Unmarshal(settings, &follower.Settings); err != nil {
			log.Printf("WARN: could not unmarshal follower settings: %v", err)
		}
		followers = append(followers, follower)
	}

	return followers, nil
}

// GetUserFollowing retrieves a list of users the given user follows
func GetUserFollowing(username string) ([]*ApiUser, error) {
	user, err := GetUserByUsername(username)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}
	if user == nil {
		return nil, fmt.Errorf("user not found")
	}

	query := `
		SELECT u.id, u.username, u.picture, u.bio, u.links, u.settings, u.creation_date
		FROM users u
		JOIN userfollows f ON u.id = f.followed_id
		WHERE f.follower_id = $1;
	`
	rows, err := DB.Query(query, user.Id)
	if err != nil {
		return nil, fmt.Errorf("failed to get following: %w", err)
	}
	defer rows.Close()

	var following []*ApiUser
	for rows.Next() {
		followed := &ApiUser{}
		var links, settings []byte
		if err := rows.Scan(
			&followed.Id,
			&followed.Username,
			&followed.Picture,
			&followed.Bio,
			&links,
			&settings,
			&followed.CreationDate,
		); err != nil {
			return nil, fmt.Errorf("failed to scan followed row: %w", err)
		}

		if err := json.Unmarshal(links, &followed.Links); err != nil {
			log.Printf("WARN: could not unmarshal followed links: %v", err)
		}
		if err := json.Unmarshal(settings, &followed.Settings); err != nil {
			log.Printf("WARN: could not unmarshal followed settings: %v", err)
		}
		following = append(following, followed)
	}

	return following, nil
}

// GetUserFollowersUsernames retrieves a list of usernames who follow the given user
func GetUserFollowersUsernames(username string) ([]string, error) {
	user, err := GetUserByUsername(username)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}
	if user == nil {
		return nil, fmt.Errorf("user not found")
	}

	query := `
		SELECT u.username
		FROM users u
		JOIN userfollows f ON u.id = f.follower_id
		WHERE f.followed_id = $1;
	`
	rows, err := DB.Query(query, user.Id)
	if err != nil {
		return nil, fmt.Errorf("failed to get follower usernames: %w", err)
	}
	defer rows.Close()

	var usernames []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, fmt.Errorf("failed to scan follower username: %w", err)
		}
		usernames = append(usernames, name)
	}

	return usernames, nil
}

// GetUserFollowingUsernames retrieves a list of usernames the given user follows
func GetUserFollowingUsernames(username string) ([]string, error) {
	user, err := GetUserByUsername(username)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}
	if user == nil {
		return nil, fmt.Errorf("user not found")
	}

	query := `
		SELECT u.username
		FROM users u
		JOIN userfollows f ON u.id = f.followed_id
		WHERE f.follower_id = $1;
	`
	rows, err := DB.Query(query, user.Id)
	if err != nil {
		return nil, fmt.Errorf("failed to get following usernames: %w", err)
	}
	defer rows.Close()

	var usernames []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, fmt.Errorf("failed to scan following username: %w", err)
		}
		usernames = append(usernames, name)
	}

	return usernames, nil
}

// GetUserIdByUsername retrieves a user's ID by their username
func GetUserIdByUsername(username string) (int, error) {
	var id int
	query := `
		SELECT id
		FROM users
		WHERE LOWER(username) = LOWER($1)
		ORDER BY CASE WHEN username = $1 THEN 0 ELSE 1 END, id ASC
		LIMIT 1;
	`
	err := DB.QueryRow(query, username).Scan(&id)
	if err != nil {
		if err == sql.ErrNoRows {
			return 0, fmt.Errorf("user not found")
		}
		return 0, fmt.Errorf("failed to get user id by username: %w", err)
	}
	return id, nil
}

// GetUserLoginInfo retrieves the login information for a user
func GetUserLoginInfo(username string) (*UserLoginInfo, error) {
	query := `
		SELECT username, password_hash
		FROM userlogininfo
		WHERE LOWER(username) = LOWER($1)
		ORDER BY CASE WHEN username = $1 THEN 0 ELSE 1 END
		LIMIT 1;
	`
	info := &UserLoginInfo{}
	err := DB.QueryRow(query, username).Scan(&info.Username, &info.PasswordHash)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil // User not found
		}
		return nil, fmt.Errorf("failed to get user login info: %w", err)
	}
	return info, nil
}

// CreateUserLoginInfo creates a new login info record for a user
func CreateUserLoginInfo(info *UserLoginInfo) error {
	query := "INSERT INTO UserLoginInfo (username, password_hash) VALUES ($1, $2);"
	_, err := DB.Exec(query, info.Username, info.PasswordHash)
	if err != nil {
		return fmt.Errorf("failed to create user login info: %w", err)
	}
	return nil
}

