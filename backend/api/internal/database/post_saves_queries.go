package database

import (
	"fmt"
	"net/http"
	"strconv"
)

func QuerySavePost(username string, postID string) (int, error) {
	userID, err := GetUserIdByUsername(username)
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("An error occurred getting id for username: %v", err)
	}

	intPostID, err := strconv.Atoi(postID)
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("An error occurred parsing post id: %v", postID)
	}

	post, err := QueryPost(intPostID)
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("Error querying for existing post: %v", err)
	}
	if post == nil {
		return http.StatusNotFound, fmt.Errorf("Post with id %v does not exist", intPostID)
	}

	query := `INSERT INTO postsaves (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`
	rowsAffected, err := ExecUpdate(query, userID, intPostID)
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("An error occurred saving post: %v", err)
	}
	if rowsAffected == 0 {
		return http.StatusConflict, fmt.Errorf("Post already saved")
	}

	return http.StatusOK, nil
}

func QueryUnsavePost(username string, postID string) (int, error) {
	userID, err := GetUserIdByUsername(username)
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("An error occurred getting id for username: %v", err)
	}

	intPostID, err := strconv.Atoi(postID)
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("An error occurred parsing post id: %v", postID)
	}

	query := `DELETE FROM postsaves WHERE post_id = $1 AND user_id = $2;`
	rowsAffected, err := ExecUpdate(query, intPostID, userID)
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("An error occurred unsaving post: %v", err)
	}
	if rowsAffected == 0 {
		return http.StatusConflict, fmt.Errorf("Post is not saved")
	}

	return http.StatusOK, nil
}

func QuerySavedPostsByUser(username string) ([]int, int, error) {
	userID, err := GetUserIdByUsername(username)
	if err != nil {
		return nil, http.StatusNotFound, fmt.Errorf("Cannot find user with username '%v'", username)
	}

	query := `SELECT post_id FROM postsaves WHERE user_id = $1 ORDER BY post_id DESC;`
	rows, err := DB.Query(query, userID)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	defer rows.Close()

	list := []int{}
	for rows.Next() {
		var postID int
		if err := rows.Scan(&postID); err != nil {
			return nil, http.StatusInternalServerError, err
		}
		list = append(list, postID)
	}

	return list, http.StatusOK, nil
}
