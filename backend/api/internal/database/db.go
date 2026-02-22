package database

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "github.com/lib/pq" // PostgreSQL driver
)

var DB *sql.DB // Global database instance

// driverName stores the active database driver ("postgres" or "sqlite").
var driverName string

// Connect initializes a database connection
func Connect() {
	var err error
	var dsn string

	// Prefer PostgreSQL connection if DATABASE_URL is set
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL != "" {
		driverName = "postgres"
		dsn = dbURL
	} else {
		// Fallback to SQLite for local development
		driverName = "sqlite"
		dbPath := filepath.Join(".", "api", "internal", "database", "dev.sqlite3")
		dsn = dbPath
	}

	DB, err = sql.Open(driverName, dsn)
	if err != nil {
		log.Fatalf("Failed to open database connection: %v", err)
	}

	// Verify connection (retry for postgres to handle cold starts / deploy races)
	if driverName == "postgres" {
		const maxAttempts = 30
		const retryDelay = 2 * time.Second
		for attempt := 1; attempt <= maxAttempts; attempt++ {
			err = DB.Ping()
			if err == nil {
				break
			}
			log.Printf("Postgres ping attempt %d/%d failed: %v", attempt, maxAttempts, err)
			if attempt < maxAttempts {
				time.Sleep(retryDelay)
			}
		}
		if err != nil {
			log.Fatalf("Failed to ping database after retries: %v", err)
		}
	} else {
		err = DB.Ping()
		if err != nil {
			log.Fatalf("Failed to ping database: %v", err)
		}
	}

	// Apply driver-specific configurations
	if driverName == "postgres" {
		if err := ensurePostgresSchema(); err != nil {
			log.Fatalf("Failed to initialize postgres database schema: %v", err)
		}
	} else if driverName == "sqlite" {
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
			log.Fatalf("Failed to initialize sqlite database schema: %v", err)
		}
	}

	log.Printf("Database connected successfully using %s driver", driverName)
}

func ensurePostgresSchema() error {
	if err := execSqlFile("create_tables.sql"); err != nil {
		return err
	}
	if err := ensureDirectMessageIntegrityForPostgres(); err != nil {
		return err
	}
	log.Println("PostgreSQL schema ensured successfully.")
	return nil
}

func ensureSqliteSchema() error {
	// For SQLite, we'll just run the schema file every time.
	// This is simple and effective for a dev database.
	if err := execSqlFile("create_tables.sql"); err != nil {
		return err
	}
	return nil
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

func ensureDirectMessageIntegrityForPostgres() error {
	if _, err := DB.Exec(`DELETE FROM directmessages dm
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = dm.sender_id)
   OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = dm.recipient_id);`); err != nil {
		return fmt.Errorf("failed to clean orphaned direct messages: %w", err)
	}

	if _, err := DB.Exec(`DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'directmessages_sender_id_fkey'
	) THEN
		ALTER TABLE directmessages
		ADD CONSTRAINT directmessages_sender_id_fkey
		FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE;
	END IF;
END $$;`); err != nil {
		return fmt.Errorf("failed to ensure sender foreign key on directmessages: %w", err)
	}

	if _, err := DB.Exec(`DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'directmessages_recipient_id_fkey'
	) THEN
		ALTER TABLE directmessages
		ADD CONSTRAINT directmessages_recipient_id_fkey
		FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE;
	END IF;
END $$;`); err != nil {
		return fmt.Errorf("failed to ensure recipient foreign key on directmessages: %w", err)
	}

	if _, err := DB.Exec(`CREATE INDEX IF NOT EXISTS idx_directmessages_created_at
ON directmessages (creation_date DESC, id DESC);`); err != nil {
		return fmt.Errorf("failed to ensure directmessages recency index: %w", err)
	}

	return nil
}
