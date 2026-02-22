package database

import (
	"database/sql"
	"fmt"
	"net/http"
	"strings"
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

	likesExpr := fmt.Sprintf("COALESCE((SELECT COUNT(*) FROM postlikes pl_hot WHERE pl_hot.post_id = %sid), 0)", prefix)

	normalized := normalizeFeedSort(sort)
	// Use EXTRACT(EPOCH FROM (NOW() - %screation_date)) for PostgreSQL
	hotnessFormula := fmt.Sprintf(`((%s + COALESCE((SELECT COUNT(*) FROM postsaves ps_hot WHERE ps_hot.post_id = %sid), 0) * 2.0) / (EXTRACT(EPOCH FROM (NOW() - %screation_date))/3600 + 2.0))`, likesExpr, prefix, prefix)

	switch normalized {
	case "popular":
		return fmt.Sprintf("ORDER BY %s DESC, %screation_date DESC", likesExpr, prefix)
	case "hot":
		return fmt.Sprintf(`ORDER BY %s DESC, %screation_date DESC`, hotnessFormula, prefix)
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
	// Use EXTRACT(EPOCH FROM (NOW() - %screation_date)) for PostgreSQL
	hotnessFormula := fmt.Sprintf(`((%slikes + COALESCE((SELECT COUNT(*) FROM projectfollows pf_hot WHERE pf_hot.project_id = %sid), 0) * 2.0) / (EXTRACT(EPOCH FROM (NOW() - %screation_date))/3600 + 2.0))`, prefix, prefix, prefix)

	switch normalized {
	case "popular":
		return fmt.Sprintf("ORDER BY %slikes DESC, %screation_date DESC", prefix, prefix)
	case "hot":
		return fmt.Sprintf(`ORDER BY %s DESC, %screation_date DESC`, hotnessFormula, prefix)
	default:
		return fmt.Sprintf("ORDER BY %screation_date DESC", prefix)
	}
}

func getPostsFeedSorted(start int, count int, sort string) ([]Post, int, error) {
	query := fmt.Sprintf(`SELECT id, user_id, project_id, content, COALESCE(media, '[]'),
			  COALESCE((SELECT COUNT(*) FROM postlikes pl WHERE pl.post_id = posts.id), 0),
			  COALESCE((SELECT COUNT(*) FROM postsaves ps WHERE ps.post_id = posts.id), 0),
			  creation_date
			  FROM posts
			  %s
			  LIMIT $1 OFFSET $2;`, postOrderBy(sort, "posts"))

	rows, err := DB.Query(query, count, start)
	if err != nil {
		return nil, http.StatusNotFound, err
	}
	defer rows.Close()
	var posts []Post

	for rows.Next() {
		var post Post
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
				return []Post{}, http.StatusOK, nil
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

func getProjectsFeedSorted(start int, count int, sort string) ([]Project, int, error) {
	query := fmt.Sprintf(`SELECT id, name, description, COALESCE(about_md, ''), status, likes,
              COALESCE((SELECT COUNT(*) FROM projectfollows pf WHERE pf.project_id = projects.id), 0),
	          COALESCE(links, '[]'), COALESCE(tags, '[]'), COALESCE(media, '[]'), owner, creation_date
	          FROM projects
              %s
              LIMIT $1 OFFSET $2;`, projectOrderBy(sort, "projects"))

	rows, err := DB.Query(query, count, start)
	if err != nil {
		return nil, http.StatusNotFound, err
	}
	var projects []Project
	defer rows.Close()

	for rows.Next() {
		var project Project
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
//   - []Post: the list of posts for the feed
//   - int: http status code
//   - error: An error if the function fails, nil otherwise
func GetPostByTimeFeed(start int, count int) ([]Post, int, error) {
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
//   - []Post: the list of posts for the feed
//   - int: http status code
//   - error: An error if the function fails, nil otherwise
func GetPostByLikesFeed(start int, count int) ([]Post, int, error) {
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
//   - []Project: the list of projects for the feed
//   - int: http status code
//   - error: An error if the function fails, nil otherwise
func GetProjectByTimeFeed(start int, count int) ([]Project, int, error) {
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
//   - []Project: the list of projects for the feed
//   - int: http status code
//   - error: An error if the function fails, nil otherwise
func GetProjectByLikesFeed(start int, count int) ([]Project, int, error) {
	return getProjectsFeedSorted(start, count, "popular")
}

func GetPostFeedBySort(start int, count int, sort string) ([]Post, int, error) {
	return getPostsFeedSorted(start, count, sort)
}

func GetProjectFeedBySort(start int, count int, sort string) ([]Project, int, error) {
	return getProjectsFeedSorted(start, count, sort)
}

func GetPostByFollowingFeed(username string, start int, count int, sort string) ([]Post, int, error) {
	userID, err := GetUserIdByUsername(username)
	if err != nil {
		return nil, http.StatusNotFound, err
	}

	query := fmt.Sprintf(`SELECT p.id, p.user_id, p.project_id, p.content, COALESCE(p.media, '[]'),
			  COALESCE((SELECT COUNT(*) FROM postlikes pl WHERE pl.post_id = p.id), 0),
			  COALESCE((SELECT COUNT(*) FROM postsaves ps WHERE ps.post_id = p.id), 0),
			  p.creation_date
			  FROM posts p
			  JOIN userfollows uf ON uf.followed_id = p.user_id
			  WHERE uf.follower_id = $1
			  %s
			  LIMIT $2 OFFSET $3;`, postOrderBy(sort, "p"))

	rows, err := DB.Query(query, userID, count, start)
	if err != nil {
		return nil, http.StatusNotFound, err
	}
	defer rows.Close()

	posts := []Post{}
	for rows.Next() {
		var post Post
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
				return []Post{}, http.StatusOK, nil
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

func GetPostBySavedFeed(username string, start int, count int, sort string) ([]Post, int, error) {
	userID, err := GetUserIdByUsername(username)
	if err != nil {
		return nil, http.StatusNotFound, err
	}

	query := fmt.Sprintf(`SELECT p.id, p.user_id, p.project_id, p.content, COALESCE(p.media, '[]'),
			  COALESCE((SELECT COUNT(*) FROM postlikes pl WHERE pl.post_id = p.id), 0),
			  COALESCE((SELECT COUNT(*) FROM postsaves ps2 WHERE ps2.post_id = p.id), 0),
			  p.creation_date
			  FROM posts p
			  JOIN postsaves ps ON ps.post_id = p.id
			  WHERE ps.user_id = $1
			  %s
			  LIMIT $2 OFFSET $3;`, postOrderBy(sort, "p"))

	rows, err := DB.Query(query, userID, count, start)
	if err != nil {
		return nil, http.StatusNotFound, err
	}
	defer rows.Close()

	posts := []Post{}
	for rows.Next() {
		var post Post
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
				return []Post{}, http.StatusOK, nil
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

func GetProjectByFollowingFeed(username string, start int, count int, sort string) ([]Project, int, error) {
	userID, err := GetUserIdByUsername(username)
	if err != nil {
		return nil, http.StatusNotFound, err
	}

	query := fmt.Sprintf(`SELECT p.id, p.name, p.description, COALESCE(p.about_md, ''), p.status, p.likes,
			  COALESCE((SELECT COUNT(*) FROM projectfollows pf2 WHERE pf2.project_id = p.id), 0),
			  COALESCE(p.links, '[]'), COALESCE(p.tags, '[]'), COALESCE(p.media, '[]'), p.owner, p.creation_date
			  FROM projects p
			  JOIN projectfollows pf ON pf.project_id = p.id
			  WHERE pf.user_id = $1
			  %s
			  LIMIT $2 OFFSET $3;`, projectOrderBy(sort, "p"))

	rows, err := DB.Query(query, userID, count, start)
	if err != nil {
		return nil, http.StatusNotFound, err
	}
	defer rows.Close()

	projects := []Project{}
	for rows.Next() {
		var project Project
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
				return []Project{}, http.StatusOK, nil
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

func GetProjectBySavedFeed(username string, start int, count int, sort string) ([]Project, int, error) {
	userID, err := GetUserIdByUsername(username)
	if err != nil {
		return nil, http.StatusNotFound, err
	}

	query := fmt.Sprintf(`SELECT p.id, p.name, p.description, COALESCE(p.about_md, ''), p.status, p.likes,
			  COALESCE((SELECT COUNT(*) FROM projectfollows pf2 WHERE pf2.project_id = p.id), 0),
			  COALESCE(p.links, '[]'), COALESCE(p.tags, '[]'), COALESCE(p.media, '[]'), p.owner, p.creation_date
			  FROM projects p
			  JOIN projectfollows pf ON pf.project_id = p.id
			  WHERE pf.user_id = $1
			  %s
			  LIMIT $2 OFFSET $3;`, projectOrderBy(sort, "p"))

	rows, err := DB.Query(query, userID, count, start)
	if err != nil {
		return nil, http.StatusNotFound, err
	}
	defer rows.Close()

	projects := []Project{}
	for rows.Next() {
		var project Project
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
				return []Project{}, http.StatusOK, nil
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
