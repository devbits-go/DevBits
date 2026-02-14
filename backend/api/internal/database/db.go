package database

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
)

var DB *sql.DB // Global database instance

// Connect initializes a database connection
func Connect(dsn string, driverName string) {
	var err error
	DB, err = sql.Open(driverName, dsn)
	if err != nil {
		log.Fatalf("Failed to connect to the database: %v", err)
	}

	// Verify connection
	err = DB.Ping()
	if err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}

	if driverName == "sqlite" {
		if _, err := DB.Exec("PRAGMA foreign_keys=ON;"); err != nil {
			log.Printf("WARN: failed to enable foreign keys: %v", err)
		}
		if _, err := DB.Exec("PRAGMA journal_mode=WAL;"); err != nil {
			log.Printf("WARN: failed to set WAL mode: %v", err)
		}
		if _, err := DB.Exec("PRAGMA busy_timeout=5000;"); err != nil {
			log.Printf("WARN: failed to set busy timeout: %v", err)
		}
		if err := ensureSqliteSchema(); err != nil {
			log.Fatalf("Failed to initialize database schema: %v", err)
		}
	}

	log.Println("Database connected successfully")
}

func ensureSqliteSchema() error {
	requiredTables := []string{"Projects", "Users", "UserLoginInfo"}
	allPresent := true
	for _, table := range requiredTables {
		var exists string
		if err := DB.QueryRow(
			"SELECT name FROM sqlite_master WHERE type='table' AND name=?;",
			table,
		).Scan(&exists); err != nil {
			allPresent = false
			break
		}
	}
	if allPresent {
		if err := ensureLoginSchema(); err != nil {
			return err
		}
		if err := ensureUserSettingsSchema(); err != nil {
			return err
		}
		if err := ensureProjectSchema(); err != nil {
			return err
		}
		if err := ensurePostCommentSchema(); err != nil {
			return err
		}
		if err := ensureDirectMessageSchema(); err != nil {
			return err
		}
		return nil
	}

	if err := execSqlFile("create_tables.sql"); err != nil {
		return err
	}

	if err := ensureLoginSchema(); err != nil {
		return err
	}
	if err := ensureUserSettingsSchema(); err != nil {
		return err
	}
	if err := ensureProjectSchema(); err != nil {
		return err
	}
	if err := ensurePostCommentSchema(); err != nil {
		return err
	}
	if err := ensureDirectMessageSchema(); err != nil {
		return err
	}

	return nil
}

func ensureUserSettingsSchema() error {
	if exists, err := columnExists("Users", "settings"); err != nil {
		return err
	} else if exists {
		return nil
	}

	if _, err := DB.Exec("ALTER TABLE Users ADD COLUMN settings JSON;"); err != nil {
		return fmt.Errorf("failed to add settings column: %w", err)
	}
	if _, err := DB.Exec("UPDATE Users SET settings = '{}' WHERE settings IS NULL;"); err != nil {
		return fmt.Errorf("failed to backfill settings: %w", err)
	}

	return nil
}

func ensureProjectSchema() error {
	if exists, err := columnExists("Projects", "about_md"); err != nil {
		return err
	} else if !exists {
		if _, err := DB.Exec("ALTER TABLE Projects ADD COLUMN about_md TEXT;"); err != nil {
			return fmt.Errorf("failed to add about_md column: %w", err)
		}
	}

	if exists, err := columnExists("Projects", "media"); err != nil {
		return err
	} else if !exists {
		if _, err := DB.Exec("ALTER TABLE Projects ADD COLUMN media JSON;"); err != nil {
			return fmt.Errorf("failed to add media column: %w", err)
		}
		if _, err := DB.Exec("UPDATE Projects SET media = '[]' WHERE media IS NULL;"); err != nil {
			return fmt.Errorf("failed to backfill media: %w", err)
		}
	}

	if _, err := DB.Exec(`CREATE TABLE IF NOT EXISTS ProjectBuilders (
		project_id INTEGER NOT NULL,
		user_id INTEGER NOT NULL,
		PRIMARY KEY (project_id, user_id),
		FOREIGN KEY (project_id) REFERENCES Projects(id) ON DELETE CASCADE,
		FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
	);`); err != nil {
		return fmt.Errorf("failed to create ProjectBuilders table: %w", err)
	}

	if _, err := DB.Exec("CREATE INDEX IF NOT EXISTS idx_project_builders_project ON ProjectBuilders(project_id);"); err != nil {
		return fmt.Errorf("failed to create project builder index: %w", err)
	}
	if _, err := DB.Exec("CREATE INDEX IF NOT EXISTS idx_project_builders_user ON ProjectBuilders(user_id);"); err != nil {
		return fmt.Errorf("failed to create project builder index: %w", err)
	}

	return nil
}

func ensurePostCommentSchema() error {
	if exists, err := columnExists("Posts", "media"); err != nil {
		return err
	} else if !exists {
		if _, err := DB.Exec("ALTER TABLE Posts ADD COLUMN media JSON;"); err != nil {
			return fmt.Errorf("failed to add posts media column: %w", err)
		}
		if _, err := DB.Exec("UPDATE Posts SET media = '[]' WHERE media IS NULL;"); err != nil {
			return fmt.Errorf("failed to backfill posts media: %w", err)
		}
	}

	if exists, err := columnExists("Comments", "media"); err != nil {
		return err
	} else if !exists {
		if _, err := DB.Exec("ALTER TABLE Comments ADD COLUMN media JSON;"); err != nil {
			return fmt.Errorf("failed to add comments media column: %w", err)
		}
		if _, err := DB.Exec("UPDATE Comments SET media = '[]' WHERE media IS NULL;"); err != nil {
			return fmt.Errorf("failed to backfill comments media: %w", err)
		}
	}

	return nil
}

func ensureDirectMessageSchema() error {
	if _, err := DB.Exec(`CREATE TABLE IF NOT EXISTS DirectMessages (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		sender_id INTEGER NOT NULL,
		recipient_id INTEGER NOT NULL,
		content TEXT NOT NULL,
		creation_date TIMESTAMP NOT NULL,
		FOREIGN KEY (sender_id) REFERENCES Users(id) ON DELETE CASCADE,
		FOREIGN KEY (recipient_id) REFERENCES Users(id) ON DELETE CASCADE
	);`); err != nil {
		return fmt.Errorf("failed to create DirectMessages table: %w", err)
	}

	if _, err := DB.Exec("CREATE INDEX IF NOT EXISTS idx_direct_messages_sender ON DirectMessages(sender_id);"); err != nil {
		return fmt.Errorf("failed to create direct messages sender index: %w", err)
	}
	if _, err := DB.Exec("CREATE INDEX IF NOT EXISTS idx_direct_messages_recipient ON DirectMessages(recipient_id);"); err != nil {
		return fmt.Errorf("failed to create direct messages recipient index: %w", err)
	}
	if _, err := DB.Exec("CREATE INDEX IF NOT EXISTS idx_direct_messages_created ON DirectMessages(creation_date);"); err != nil {
		return fmt.Errorf("failed to create direct messages created index: %w", err)
	}

	return nil
}

func ensureLoginSchema() error {
	if exists, err := columnExists("UserLoginInfo", "password_hash"); err != nil {
		return err
	} else if exists {
		return nil
	}

	if exists, err := columnExists("UserLoginInfo", "password"); err != nil {
		return err
	} else if exists {
		if _, err := DB.Exec("ALTER TABLE UserLoginInfo RENAME COLUMN password TO password_hash;"); err == nil {
			return nil
		}

		if _, err := DB.Exec("ALTER TABLE UserLoginInfo ADD COLUMN password_hash VARCHAR(255);"); err != nil {
			return fmt.Errorf("failed to add password_hash column: %w", err)
		}
		if _, err := DB.Exec("UPDATE UserLoginInfo SET password_hash = password;"); err != nil {
			return fmt.Errorf("failed to backfill password_hash: %w", err)
		}
		return nil
	}

	return nil
}

func columnExists(table string, column string) (bool, error) {
	rows, err := DB.Query(fmt.Sprintf("PRAGMA table_info(%s);", table))
	if err != nil {
		return false, err
	}
	defer rows.Close()

	for rows.Next() {
		var (
			cid        int
			name       string
			colType    string
			notNull    int
			defaultVal sql.NullString
			pk         int
		)
		if err := rows.Scan(&cid, &name, &colType, &notNull, &defaultVal, &pk); err != nil {
			return false, err
		}
		if name == column {
			return true, nil
		}
	}
	if err := rows.Err(); err != nil {
		return false, err
	}
	return false, nil
}

func execSqlFile(filename string) error {
	path := filepath.Join("api", "internal", "database", filename)
	content, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("failed to read %s: %w", path, err)
	}

	statements := strings.Split(string(content), ";")
	for _, statement := range statements {
		stmt := strings.TrimSpace(statement)
		if stmt == "" {
			continue
		}
		if _, err := DB.Exec(stmt); err != nil {
			return fmt.Errorf("failed to exec statement in %s: %w", filename, err)
		}
	}

	return nil
}
