package database

import (
	"time"
)

type Post struct {
	ID           int64     `json:"id"`
	User         int64     `json:"user" binding:"required"`
	Project      int64     `json:"project" binding:"required"`
	Likes        int64     `json:"likes"`
	Saves        int64     `json:"saves"`
	Content      string    `json:"content" binding:"required"`
	Media        []string  `json:"media"`
	CreationDate time.Time `json:"created_on"`
}

type Project struct {
	ID           int64     `json:"id"`
	Owner        int64     `json:"owner" binding:"required"`
	Name         string    `json:"name" binding:"required"`
	Description  string    `json:"description" binding:"required"`
	AboutMd      string    `json:"about_md"`
	Status       int16     `json:"status"`
	Likes        int64     `json:"likes"`
	Saves        int64     `json:"saves"`
	Tags         []string  `json:"tags"`
	Links        []string  `json:"links"`
	Media        []string  `json:"media"`
	CreationDate time.Time `json:"creation_date"`
}
