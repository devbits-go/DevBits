package database

import (
	"database/sql"
	"fmt"
	"net/http"
	"strconv"
	"time"
)

// QueryPosts retrieves a post by its ID from the database.
//
// Parameters:
//   - id: The unique identifier of the post to query.
//
// Returns:
//   - *Post: The post details if found.
//   - error: An error if the query fails. Returns nil for both if no post exists.
func QueryPost(id int) (*Post, error) {
	query := `SELECT id, user_id, project_id, content, COALESCE(media, '[]'),
	COALESCE((SELECT COUNT(*) FROM postlikes pl WHERE pl.post_id = posts.id), 0),
	COALESCE((SELECT COUNT(*) FROM postsaves ps WHERE ps.post_id = posts.id), 0),
        creation_date
	FROM posts WHERE id = $1;`
	row := DB.QueryRow(query, id)
	var post Post
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
func QueryCreatePost(post *Post) (int64, error) {
	currentTime := time.Now().UTC()
	mediaJSON, err := MarshalToJSON(post.Media)
	if err != nil {
		return -1, err
	}

	query := `INSERT INTO posts (user_id, project_id, content, media, likes, creation_date) 
	              VALUES ($1, $2, $3, $4, $5, $6)
			  RETURNING id;`

	var lastId int64
	err = DB.QueryRow(query, post.User, post.Project, post.Content, string(mediaJSON), post.Likes, currentTime).Scan(&lastId)
	if err != nil {
		return -1, fmt.Errorf("Failed to create post: %v", err)
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
	query := `DELETE from posts WHERE id = $1;`
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
	query := `UPDATE posts SET `
	var args []interface{}

	queryParams, args, err := BuildUpdateQuery(updatedData)
	if err != nil {
		return fmt.Errorf("Error building query: %v", err)
	}
	query += queryParams

	query += fmt.Sprintf(" WHERE id = $%d", len(args)+1)
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
//   - []Post: The post details if found.
//   - error: An error if the query fails. Returns nil for both if no post exists.
func QueryPostsByUserId(userId int) ([]Post, int, error) {
	query := `SELECT id, user_id, project_id, content, COALESCE(media, '[]'),
	COALESCE((SELECT COUNT(*) FROM postlikes pl WHERE pl.post_id = posts.id), 0),
	COALESCE((SELECT COUNT(*) FROM postsaves ps WHERE ps.post_id = posts.id), 0),
	creation_date
	FROM posts WHERE user_id = $1;`

	rows, err := DB.Query(query, userId)
	if err != nil {
		return nil, http.StatusNotFound, err
	}
	defer rows.Close()

	posts := []Post{}
	for rows.Next() {
		var post Post
		var mediaJSON string
		if err := rows.Scan(&post.ID, &post.User, &post.Project, &post.Content, &mediaJSON, &post.Likes, &post.Saves, &post.CreationDate); err != nil {
			return nil, http.StatusInternalServerError, err
		}
		if err := UnmarshalFromJSON(mediaJSON, &post.Media); err != nil {
			return nil, http.StatusInternalServerError, err
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
//   - []Post: The post details if found.
//   - error: An error if the query fails. Returns nil for both if no post exists.
func QueryPostsByProjectId(projectId int) ([]Post, int, error) {
	query := `SELECT id, user_id, project_id, content, COALESCE(media, '[]'),
	COALESCE((SELECT COUNT(*) FROM postlikes pl WHERE pl.post_id = posts.id), 0),
	COALESCE((SELECT COUNT(*) FROM postsaves ps WHERE ps.post_id = posts.id), 0),
	creation_date
	FROM posts WHERE project_id = $1;`

	rows, err := DB.Query(query, projectId)
	if err != nil {
		return nil, http.StatusNotFound, err
	}
	defer rows.Close()

	posts := []Post{}
	for rows.Next() {
		var post Post
		var mediaJSON string
		if err := rows.Scan(&post.ID, &post.User, &post.Project, &post.Content, &mediaJSON, &post.Likes, &post.Saves, &post.CreationDate); err != nil {
			return nil, http.StatusInternalServerError, err
		}
		if err := UnmarshalFromJSON(mediaJSON, &post.Media); err != nil {
			return nil, http.StatusInternalServerError, err
		}
		posts = append(posts, post)
	}

	return posts, http.StatusOK, nil
}

func CreatePostLike(username string, postId string) (int, error) {
	userID, err := GetUserIdByUsername(username)
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("An error occurred getting id for username: %v", err)
	}

	parsedPostID, err := strconv.Atoi(postId)
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("An error occurred parsing post id: %v", err)
	}

	existingPost, err := QueryPost(parsedPostID)
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("Error querying for existing post: %v", err)
	}
	if existingPost == nil {
		return http.StatusNotFound, fmt.Errorf("Post with id %v does not exist", parsedPostID)
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

	insertQuery := `INSERT INTO postlikes (user_id, post_id) VALUES ($1, $2) ON CONFLICT (user_id, post_id) DO NOTHING`
	result, err := tx.Exec(insertQuery, userID, parsedPostID)
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("Failed to insert post like: %v", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("Failed to check rows affected: %v", err)
	}

	if rowsAffected == 0 {
		return http.StatusOK, nil
	}

	updateQuery := `UPDATE posts SET likes = likes + 1 WHERE id = $1`
	_, err = tx.Exec(updateQuery, parsedPostID)
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("Failed to update likes count: %v", err)
	}

	return http.StatusCreated, nil
}

func RemovePostLike(username string, postId string) (int, error) {
	userID, err := GetUserIdByUsername(username)
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("An error occurred getting id for username: %v", err)
	}

	parsedPostID, err := strconv.Atoi(postId)
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("An error occurred parsing post id: %v", err)
	}

	existingPost, err := QueryPost(parsedPostID)
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("Error querying for existing post: %v", err)
	}
	if existingPost == nil {
		return http.StatusNotFound, fmt.Errorf("Post with id %v does not exist", parsedPostID)
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

	deleteQuery := `DELETE FROM postlikes WHERE user_id = $1 AND post_id = $2`
	result, err := tx.Exec(deleteQuery, userID, parsedPostID)
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("Failed to delete post like: %v", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("Failed to check rows affected: %v", err)
	}

	if rowsAffected == 0 {
		return http.StatusNoContent, nil
	}

	updateQuery := `UPDATE posts SET likes = GREATEST(likes - 1, 0) WHERE id = $1`
	_, err = tx.Exec(updateQuery, parsedPostID)
	if err != nil {
		return http.StatusInternalServerError, fmt.Errorf("Failed to update likes count: %v", err)
	}

	return http.StatusOK, nil
}

func QueryPostLike(username string, postId string) (int, bool, error) {
	query := `SELECT EXISTS(SELECT 1 FROM postlikes WHERE user_id = (SELECT id FROM users WHERE username = $1) AND post_id = $2);`
	var exists bool
	err := DB.QueryRow(query, username, postId).Scan(&exists)
	if err != nil {
		return http.StatusInternalServerError, false, err
	}
	return http.StatusOK, exists, nil
}

