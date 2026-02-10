package database

import (
	"database/sql"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"backend/api/internal/types"
)

// QueryPosts retrieves a post by its ID from the database.
//
// Parameters:
//   - id: The unique identifier of the post to query.
//
// Returns:
//   - *types.Post: The post details if found.
//   - error: An error if the query fails. Returns nil for both if no post exists.
func QueryPost(id int) (*types.Post, error) {
	query := `SELECT id, user_id, project_id, content, COALESCE(media, '[]'), likes,
        COALESCE((SELECT COUNT(*) FROM PostSaves ps WHERE ps.post_id = Posts.id), 0),
        creation_date
        FROM Posts WHERE id = ?;`
	row := DB.QueryRow(query, id)
	var post types.Post
	var mediaJSON string

	err := row.Scan(
		&post.ID,
		&post.User,
		&post.Project,
		&post.Content,
		&mediaJSON,
		&post.Likes,
			&post.Saves,
		&post.CreationDate,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	if err := UnmarshalFromJSON(mediaJSON, &post.Media); err != nil {
		return nil, err
	}

	return &post, nil
}

// QueryCreatePost creates a new post in the database.
//
// Parameters:
//   - post: The post to be created, containing all necessary fields.
//
// Returns:
//   - int64: The ID of the newly created post.
//   - error: An error if the operation fails.
func QueryCreatePost(post *types.Post) (int64, error) {
	currentTime := time.Now().UTC()
	mediaJSON, err := MarshalToJSON(post.Media)
	if err != nil {
		return -1, err
	}

	query := `INSERT INTO Posts (user_id, project_id, content, media, likes, creation_date) 
	              VALUES (?, ?, ?, ?, ?, ?);`

	res, err := DB.Exec(query, post.User, post.Project, post.Content, string(mediaJSON), post.Likes, currentTime)
	if err != nil {
		return -1, fmt.Errorf("Failed to create post: %v", err)
	}

	lastId, err := res.LastInsertId()
	if err != nil {
		return -1, fmt.Errorf("Failed to ensure post was created: %v", err)
	}

	return lastId, nil
}

// QueryDeletePost deletes a post by its ID.
//
// Parameters:
//   - id: The unique identifier of the post to delete.
//
// Returns:
//   - int16: http status code indicating the result of the operation.
//   - error: An error if the operation fails or no post is found.
func QueryDeletePost(id int) (int16, error) {
	query := `DELETE from Posts WHERE id=?;`
	res, err := DB.Exec(query, id)
	if err != nil {
		return http.StatusBadRequest, fmt.Errorf("Failed to delete post `%v`: %v", id, err)
	}

	rowsAffected, err := res.RowsAffected()
	if rowsAffected == 0 {
		return http.StatusNotFound, fmt.Errorf("Deletion did not affect any records")
	} else if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("Failed to fetch affected rows: %v", err)
	}

	return http.StatusOK, nil
}

// QueryUpdateProject updates an existing post in the database.
//
// Parameters:
//   - id: The unique identifier of the post to update.
//   - updatedData: A map containing the fields to update with their new values.
//
// Returns:
//   - error: An error if the operation fails or no post is found.
func QueryUpdatePost(id int, updatedData map[string]interface{}) error {
	query := `UPDATE Posts SET `
	var args []interface{}

	queryParams, args, err := BuildUpdateQuery(updatedData)
	if err != nil {
		return fmt.Errorf("Error building query: %v", err)
	}

	query += queryParams + " WHERE id = ?"
	args = append(args, id)

	rowsAffected, err := ExecUpdate(query, args...)
	if err != nil {
		return fmt.Errorf("Error executing update query: %v", err)
	}
	if rowsAffected == 0 {
		return fmt.Errorf("No post found with id `%d` to update", id)
	}

	return nil
}

// QueryPostsByUserId retrieves a set of posts by its owning user id from the database.
//
// Parameters:
//   - id: The unique identifier of the user to query.
//
// Returns:
//   - []types.Post: The post details if found.
//   - error: An error if the query fails. Returns nil for both if no post exists.
func QueryPostsByUserId(userId int) ([]types.Post, int, error) {
	query := `SELECT id, user_id, project_id, content, COALESCE(media, '[]'), likes,
	COALESCE((SELECT COUNT(*) FROM PostSaves ps WHERE ps.post_id = Posts.id), 0),
	creation_date
	FROM Posts WHERE user_id = ?;`

	rows, err := DB.Query(query, userId)
	if err != nil {
		return nil, http.StatusNotFound, err
	}
	defer rows.Close()

	posts := []types.Post{}

	for rows.Next() {
		var post types.Post
		var mediaJSON string
		err := rows.Scan(
			&post.ID,
			&post.User,
			&post.Project,
			&post.Content,
			&mediaJSON,
			&post.Likes,
			&post.Saves,
			&post.CreationDate,
		)

		if err != nil {
			if err == sql.ErrNoRows {
				return []types.Post{}, http.StatusOK, nil
			}
			return nil, http.StatusInternalServerError, err
		}
		if err := UnmarshalFromJSON(mediaJSON, &post.Media); err != nil {
			return nil, http.StatusBadRequest, err
		}
		posts = append(posts, post)
	}

	return posts, http.StatusOK, nil
}

// QueryPostsByProjectId retrieves a set of posts by its owning project id from the database.
//
// Parameters:
//   - id: The unique identifier of the project to query.
//
// Returns:
//   - *types.Post: The post details if found.
//   - error: An error if the query fails. Returns nil for both if no post exists.
func QueryPostsByProjectId(projId int) ([]types.Post, int, error) {
	query := `SELECT id, user_id, project_id, content, COALESCE(media, '[]'), likes,
	COALESCE((SELECT COUNT(*) FROM PostSaves ps WHERE ps.post_id = Posts.id), 0),
	creation_date
	FROM Posts WHERE project_id = ?;`

	rows, err := DB.Query(query, projId)
	if err != nil {
		return nil, http.StatusNotFound, err
	}
	defer rows.Close()

	posts := []types.Post{}

	for rows.Next() {
		var post types.Post
		var mediaJSON string
		err := rows.Scan(
			&post.ID,
			&post.User,
			&post.Project,
			&post.Content,
			&mediaJSON,
			&post.Likes,
			&post.Saves,
			&post.CreationDate,
		)

		if err != nil {
			if err == sql.ErrNoRows {
				return []types.Post{}, http.StatusOK, nil
			}
			return nil, http.StatusInternalServerError, err
		}
		if err := UnmarshalFromJSON(mediaJSON, &post.Media); err != nil {
			return nil, http.StatusBadRequest, err
		}
		posts = append(posts, post)
	}
	return posts, http.StatusOK, nil
}

// CreatePostLike creates a like relationship between a user and a post.
//
// Parameters:
//   - username: The username of the user creating the like.
//   - strPostID: The ID of the project to like (as a string, converted internally).
//
// Returns:
//   - int: HTTP-like status code indicating the result of the operation.
//   - error: An error if the operation fails or the user is not liking the post.
func CreatePostLike(username string, strPostId string) (int, error) {
	// get user ID from username, implicitly checks if user exists
	user_id, err := GetUserIdByUsername(username)
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("An error occurred getting id for username: %v", err)
	}

	// parse post ID
	postId, err := strconv.Atoi(strPostId)
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("An error occurred parsing post_id id: %v", err)
	}

	// verify post exists
	post, err := QueryPost(postId)
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("An error occurred verifying the post exists: %v", err)
	} else if post == nil {
		return http.StatusNotFound, fmt.Errorf("Post ID %d does not exist", postId)
	}

	// check if the like already exists
	var exists bool
	query := `SELECT EXISTS (
                 SELECT 1 FROM PostLikes WHERE user_id = ? AND post_id = ?
              )`
	err = DB.QueryRow(query, user_id, postId).Scan(&exists)
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("An error occurred checking like existence: %v", err)
	}
	if exists {
		// like already exists, but we return success to keep it idempotent
		return http.StatusOK, nil
	}
	tx, err := DB.Begin()
	if err != nil {
		return -1, fmt.Errorf("failed to begin transaction: %v", err)
	}

	defer func() {
		if err != nil {
			tx.Rollback()
		} else {
			tx.Commit()
		}
	}()
	// insert the like
	insertQuery := `INSERT INTO PostLikes (user_id, post_id) VALUES (?, ?)`
	_, err = tx.Exec(insertQuery, user_id, postId)
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("Failed to insert post like: %v", err)
	}

	// update the likes column
	updateQuery := `UPDATE Posts SET likes = likes + 1 WHERE id = ?`
	_, err = tx.Exec(updateQuery, postId)
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("Failed to update likes count: %v", err)
	}

	return http.StatusCreated, nil
}

// RemovePostLike deletes a like relationship between a user and a post.
//
// Parameters:
//   - username: The username of the user removing the like.
//   - strPostID: The ID of the post to unlike (as a string, converted internally).
//
// Returns:
//   - int: HTTP-like status code indicating the result of the operation.
//   - error: An error if the operation fails or the user is not liking the post.
func RemovePostLike(username string, strPostId string) (int, error) {
	// get user ID
	user_id, err := GetUserIdByUsername(username)
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("An error occurred getting id for username: %v", err)
	}

	// parse post ID
	postId, err := strconv.Atoi(strPostId)
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("An error occurred parsing username id: %v", err)
	}

	// verify post exists
	_, err = QueryPost(postId)
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("An error occurred verifying the post exists: %v", err)
	}
	tx, err := DB.Begin()
	if err != nil {
		return -1, fmt.Errorf("failed to begin transaction: %v", err)
	}

	defer func() {
		if err != nil {
			tx.Rollback()
		} else {
			tx.Commit()
		}
	}()
	// perform the delete operation
	deleteQuery := `DELETE FROM PostLikes WHERE user_id = ? AND post_id = ?`
	result, err := tx.Exec(deleteQuery, user_id, postId)
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("Failed to delete post like: %v", err)
	}

	// check if any rows were actually deleted
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("Failed to check rows affected: %v", err)
	}

	if rowsAffected == 0 {
		// if no rows were deleted, return success to keep idempotency
		return http.StatusNoContent, nil
	}

	// update the likes column
	updateQuery := `UPDATE Posts SET likes = likes - 1 WHERE id = ?`
	_, err = tx.Exec(updateQuery, postId)
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("Failed to update likes count: %v", err)
	}

	return http.StatusOK, nil
}

// QueryPostLike queries for a like relationship between a user and a post.
//
// Parameters:
//   - username: The username of the user removing the like.
//   - postID: The ID of the post to unlike (as a string, converted internally).
//
// Returns:
//   - int: HTTP-like status code indicating the result of the operation.
//   - error: An error if the operation fails or.
func QueryPostLike(username string, strPostId string) (int, bool, error) {
	// get user ID from username, implicitly checks if user exists
	user_id, err := GetUserIdByUsername(username)
	if err != nil {
		return http.StatusInternalServerError, false, fmt.Errorf("An error occurred getting id for username: %v", err)
	}

	// parse post ID
	postId, err := strconv.Atoi(strPostId)
	if err != nil {
		return http.StatusInternalServerError, false, fmt.Errorf("An error occurred parsing post_id: %v", err)
	}

	// verify post exists
	_, err = QueryPost(postId)
	if err != nil {
		return http.StatusInternalServerError, false, fmt.Errorf("An error occurred verifying the post exists: %v", err)
	}

	// check if the like already exists
	var exists bool
	query := `SELECT EXISTS (
                 SELECT 1 FROM PostLikes WHERE user_id = ? AND post_id = ?
              )`
	err = DB.QueryRow(query, user_id, postId).Scan(&exists)
	if err != nil {
		return http.StatusInternalServerError, false, fmt.Errorf("An error occurred checking like existence: %v", err)
	}
	if exists {
		return http.StatusOK, true, nil
	} else {
		return http.StatusOK, false, nil
	}

}
