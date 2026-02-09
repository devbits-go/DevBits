package database

import (
	"database/sql"
	"net/http"

	"backend/api/internal/types"
)

// GetPostByTimeFeed retrieves a set of posts for the feed given a type
// it also paginates the results, sorted by most recent
//
// Parameters:
//   - start: the int id to start at
//   - count: the amount of posts to return
//
// Returns:
//   - []types.Post: the list of posts for the feed
//   - int: http status code
//   - error: An error if the function fails, nil otherwise
func GetPostByTimeFeed(start int, count int) ([]types.Post, int, error) {
	query := `SELECT id, user_id, project_id, content, COALESCE(media, '[]'), likes, creation_date
              FROM Posts
              ORDER BY creation_date DESC
              LIMIT ? OFFSET ?;`

	rows, err := DB.Query(query, count, start)
	if err != nil {
		return nil, http.StatusNotFound, err
	}
	defer rows.Close()
	var posts []types.Post

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

// GetPostByLikesFeed retrieves a set of posts for the feed given a type
// it also paginates the results, sorted by most liked
//
// Parameters:
//   - start: the int id to start at
//   - count: the amount of posts to return
//
// Returns:
//   - []types.Post: the list of posts for the feed
//   - int: http status code
//   - error: An error if the function fails, nil otherwise
func GetPostByLikesFeed(start int, count int) ([]types.Post, int, error) {
	query := `SELECT id, user_id, project_id, content, COALESCE(media, '[]'), likes, creation_date
              FROM Posts
              ORDER BY likes DESC
              LIMIT ? OFFSET ?;`

	rows, err := DB.Query(query, count, start)
	if err != nil {
		return nil, http.StatusNotFound, err
	}
	defer rows.Close()
	var posts []types.Post

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

// GetProjectByTimeFeed retrieves a set of projects for the feed given a type
// it also paginates the results, sorted by most recent
//
// Parameters:
//   - start: the int id to start at
//   - count: the amount of projects to return
//
// Returns:
//   - []types.Project: the list of projects for the feed
//   - int: http status code
//   - error: An error if the function fails, nil otherwise
func GetProjectByTimeFeed(start int, count int) ([]types.Project, int, error) {
	query := `SELECT id, name, description, COALESCE(about_md, ''), status, likes,
	          COALESCE(links, '[]'), COALESCE(tags, '[]'), COALESCE(media, '[]'), owner, creation_date
	          FROM Projects
	              ORDER BY creation_date DESC
              LIMIT ? OFFSET ?;`

	rows, err := DB.Query(query, count, start)
	if err != nil {
		return nil, http.StatusNotFound, err
	}
	var projects []types.Project
	defer rows.Close()

	for rows.Next() {
		var project types.Project
		var linksJSON, tagsJSON, mediaJSON string
		err := rows.Scan(
			&project.ID,
			&project.Name,
			&project.Description,
			&project.AboutMd,
			&project.Status,
			&project.Likes,
			&linksJSON,
			&tagsJSON,
			&mediaJSON,
			&project.Owner,
			&project.CreationDate,
		)
		if err != nil {
			if err == sql.ErrNoRows {
				return nil, http.StatusOK, nil
			}
			return nil, http.StatusInternalServerError, err
		}

		if err := UnmarshalFromJSON(linksJSON, &project.Links); err != nil {
			return nil, http.StatusBadRequest, err
		}
		if err := UnmarshalFromJSON(tagsJSON, &project.Tags); err != nil {
			return nil, http.StatusBadRequest, err
		}
		if err := UnmarshalFromJSON(mediaJSON, &project.Media); err != nil {
			return nil, http.StatusBadRequest, err
		}

		projects = append(projects, project)
	}

	return projects, http.StatusOK, nil
}

// GetProjectByLikesFeed retrieves a set of projects for the feed given a type
// it also paginates the results, sorted by most liked
//
// Parameters:
//   - start: the int id to start at
//   - count: the amount of projects to return
//
// Returns:
//   - []types.Project: the list of projects for the feed
//   - int: http status code
//   - error: An error if the function fails, nil otherwise
func GetProjectByLikesFeed(start int, count int) ([]types.Project, int, error) {
	query := `SELECT id, name, description, COALESCE(about_md, ''), status, likes,
	          COALESCE(links, '[]'), COALESCE(tags, '[]'), COALESCE(media, '[]'), owner, creation_date
	          FROM Projects
              ORDER BY likes DESC
              LIMIT ? OFFSET ?;`

	rows, err := DB.Query(query, count, start)
	if err != nil {
		return nil, http.StatusNotFound, err
	}
	var projects []types.Project
	defer rows.Close()

	for rows.Next() {
		var project types.Project
		var linksJSON, tagsJSON, mediaJSON string
		err := rows.Scan(
			&project.ID,
			&project.Name,
			&project.Description,
			&project.AboutMd,
			&project.Status,
			&project.Likes,
			&linksJSON,
			&tagsJSON,
			&mediaJSON,
			&project.Owner,
			&project.CreationDate,
		)
		if err != nil {
			if err == sql.ErrNoRows {
				return nil, http.StatusOK, nil
			}
			return nil, http.StatusInternalServerError, err
		}

		if err := UnmarshalFromJSON(linksJSON, &project.Links); err != nil {
			return nil, http.StatusBadRequest, err
		}
		if err := UnmarshalFromJSON(tagsJSON, &project.Tags); err != nil {
			return nil, http.StatusBadRequest, err
		}
		if err := UnmarshalFromJSON(mediaJSON, &project.Media); err != nil {
			return nil, http.StatusBadRequest, err
		}

		projects = append(projects, project)
	}

	return projects, http.StatusOK, nil
}
