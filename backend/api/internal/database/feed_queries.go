package database

import (
	"database/sql"
	"fmt"
	"net/http"
	"strings"

	"backend/api/internal/types"
)

func normalizeFeedSort(sort string) string {
	switch strings.ToLower(strings.TrimSpace(sort)) {
	case "likes", "popular":
		return "popular"
	case "hot":
		return "hot"
	case "new", "recent", "time", "":
		return "recent"
	default:
		return "recent"
	}
}

func postOrderBy(sort string, alias string) string {
	prefix := ""
	if alias != "" {
		prefix = alias + "."
	}

	normalized := normalizeFeedSort(sort)
	switch normalized {
	case "popular":
		return fmt.Sprintf("ORDER BY %slikes DESC, %screation_date DESC", prefix, prefix)
	case "hot":
		return fmt.Sprintf(`ORDER BY ((%slikes + COALESCE((SELECT COUNT(*) FROM PostSaves ps_hot WHERE ps_hot.post_id = %sid), 0) * 2.0) / (((julianday('now') - julianday(%screation_date)) * 24.0) + 2.0)) DESC, %screation_date DESC`, prefix, prefix, prefix, prefix)
	default:
		return fmt.Sprintf("ORDER BY %screation_date DESC", prefix)
	}
}

func projectOrderBy(sort string, alias string) string {
	prefix := ""
	if alias != "" {
		prefix = alias + "."
	}

	normalized := normalizeFeedSort(sort)
	switch normalized {
	case "popular":
		return fmt.Sprintf("ORDER BY %slikes DESC, %screation_date DESC", prefix, prefix)
	case "hot":
		return fmt.Sprintf(`ORDER BY ((%slikes + COALESCE((SELECT COUNT(*) FROM ProjectFollows pf_hot WHERE pf_hot.project_id = %sid), 0) * 2.0) / (((julianday('now') - julianday(%screation_date)) * 24.0) + 2.0)) DESC, %screation_date DESC`, prefix, prefix, prefix, prefix)
	default:
		return fmt.Sprintf("ORDER BY %screation_date DESC", prefix)
	}
}

func getPostsFeedSorted(start int, count int, sort string) ([]types.Post, int, error) {
	query := fmt.Sprintf(`SELECT id, user_id, project_id, content, COALESCE(media, '[]'), likes,
			  COALESCE((SELECT COUNT(*) FROM PostSaves ps WHERE ps.post_id = Posts.id), 0),
			  creation_date
			  FROM Posts
			  %s
			  LIMIT ? OFFSET ?;`, postOrderBy(sort, "Posts"))

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

func getProjectsFeedSorted(start int, count int, sort string) ([]types.Project, int, error) {
	query := fmt.Sprintf(`SELECT id, name, description, COALESCE(about_md, ''), status, likes,
              COALESCE((SELECT COUNT(*) FROM ProjectFollows pf WHERE pf.project_id = Projects.id), 0),
	          COALESCE(links, '[]'), COALESCE(tags, '[]'), COALESCE(media, '[]'), owner, creation_date
	          FROM Projects
              %s
              LIMIT ? OFFSET ?;`, projectOrderBy(sort, "Projects"))

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
			&project.Saves,
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
	return getPostsFeedSorted(start, count, "recent")
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
	return getPostsFeedSorted(start, count, "popular")
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
	return getProjectsFeedSorted(start, count, "recent")
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
	return getProjectsFeedSorted(start, count, "popular")
}

func GetPostFeedBySort(start int, count int, sort string) ([]types.Post, int, error) {
	return getPostsFeedSorted(start, count, sort)
}

func GetProjectFeedBySort(start int, count int, sort string) ([]types.Project, int, error) {
	return getProjectsFeedSorted(start, count, sort)
}

func GetPostByFollowingFeed(username string, start int, count int, sort string) ([]types.Post, int, error) {
	userID, err := GetUserIdByUsername(username)
	if err != nil {
		return nil, http.StatusNotFound, err
	}

	query := fmt.Sprintf(`SELECT p.id, p.user_id, p.project_id, p.content, COALESCE(p.media, '[]'), p.likes,
			  COALESCE((SELECT COUNT(*) FROM PostSaves ps WHERE ps.post_id = p.id), 0),
			  p.creation_date
			  FROM Posts p
			  JOIN UserFollows uf ON uf.follows_id = p.user_id
			  WHERE uf.follower_id = ?
			  %s
			  LIMIT ? OFFSET ?;`, postOrderBy(sort, "p"))

	rows, err := DB.Query(query, userID, count, start)
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

func GetPostBySavedFeed(username string, start int, count int, sort string) ([]types.Post, int, error) {
	userID, err := GetUserIdByUsername(username)
	if err != nil {
		return nil, http.StatusNotFound, err
	}

	query := fmt.Sprintf(`SELECT p.id, p.user_id, p.project_id, p.content, COALESCE(p.media, '[]'), p.likes,
			  COALESCE((SELECT COUNT(*) FROM PostSaves ps2 WHERE ps2.post_id = p.id), 0),
			  p.creation_date
			  FROM Posts p
			  JOIN PostSaves ps ON ps.post_id = p.id
			  WHERE ps.user_id = ?
			  %s
			  LIMIT ? OFFSET ?;`, postOrderBy(sort, "p"))

	rows, err := DB.Query(query, userID, count, start)
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

func GetProjectByFollowingFeed(username string, start int, count int, sort string) ([]types.Project, int, error) {
	userID, err := GetUserIdByUsername(username)
	if err != nil {
		return nil, http.StatusNotFound, err
	}

	query := fmt.Sprintf(`SELECT p.id, p.name, p.description, COALESCE(p.about_md, ''), p.status, p.likes,
			  COALESCE((SELECT COUNT(*) FROM ProjectFollows pf2 WHERE pf2.project_id = p.id), 0),
			  COALESCE(p.links, '[]'), COALESCE(p.tags, '[]'), COALESCE(p.media, '[]'), p.owner, p.creation_date
			  FROM Projects p
			  JOIN ProjectFollows pf ON pf.project_id = p.id
			  WHERE pf.user_id = ?
			  %s
			  LIMIT ? OFFSET ?;`, projectOrderBy(sort, "p"))

	rows, err := DB.Query(query, userID, count, start)
	if err != nil {
		return nil, http.StatusNotFound, err
	}
	defer rows.Close()

	projects := []types.Project{}
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
			&project.Saves,
			&linksJSON,
			&tagsJSON,
			&mediaJSON,
			&project.Owner,
			&project.CreationDate,
		)
		if err != nil {
			if err == sql.ErrNoRows {
				return []types.Project{}, http.StatusOK, nil
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

func GetProjectBySavedFeed(username string, start int, count int, sort string) ([]types.Project, int, error) {
	userID, err := GetUserIdByUsername(username)
	if err != nil {
		return nil, http.StatusNotFound, err
	}

	query := fmt.Sprintf(`SELECT p.id, p.name, p.description, COALESCE(p.about_md, ''), p.status, p.likes,
			  COALESCE((SELECT COUNT(*) FROM ProjectFollows pf2 WHERE pf2.project_id = p.id), 0),
			  COALESCE(p.links, '[]'), COALESCE(p.tags, '[]'), COALESCE(p.media, '[]'), p.owner, p.creation_date
			  FROM Projects p
			  JOIN ProjectFollows pf ON pf.project_id = p.id
			  WHERE pf.user_id = ?
			  %s
			  LIMIT ? OFFSET ?;`, projectOrderBy(sort, "p"))

	rows, err := DB.Query(query, userID, count, start)
	if err != nil {
		return nil, http.StatusNotFound, err
	}
	defer rows.Close()

	projects := []types.Project{}
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
			&project.Saves,
			&linksJSON,
			&tagsJSON,
			&mediaJSON,
			&project.Owner,
			&project.CreationDate,
		)
		if err != nil {
			if err == sql.ErrNoRows {
				return []types.Project{}, http.StatusOK, nil
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
