-- Drop existing tables if they exist (in reverse order of dependencies)
DROP TABLE IF EXISTS CONTACT_MESSAGES CASCADE;
DROP TABLE IF EXISTS UPVOTES CASCADE;
DROP TABLE IF EXISTS PALETTE_COLORS CASCADE;
DROP TABLE IF EXISTS PALETTES CASCADE;
DROP TABLE IF EXISTS USERS CASCADE;
DROP TABLE IF EXISTS USER_ROLES CASCADE;
DROP TABLE IF EXISTS SESSIONS CASCADE;

-- Create USER_ROLES table
CREATE TABLE USER_ROLES (
    role_id SERIAL PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL UNIQUE,
    permissions TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create USERS table
CREATE TABLE USERS (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    profile_image_url VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    role_id INTEGER NOT NULL REFERENCES USER_ROLES(role_id) ON DELETE RESTRICT,
    is_disabled BOOLEAN NOT NULL DEFAULT FALSE
);

-- Create PALETTES table
CREATE TABLE PALETTES (
    palette_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES USERS(user_id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    upvote_count INTEGER NOT NULL DEFAULT 0
);

-- Create PALETTE_COLORS table
CREATE TABLE PALETTE_COLORS (
    color_id SERIAL PRIMARY KEY,
    palette_id INTEGER NOT NULL REFERENCES PALETTES(palette_id) ON DELETE CASCADE,
    hex_code CHAR(7) NOT NULL CHECK (hex_code ~ '^#[0-9A-Fa-f]{6}$'),
    position INTEGER NOT NULL,
    color_name VARCHAR(50),
    UNIQUE (palette_id, position)
);

-- Create UPVOTES table
CREATE TABLE UPVOTES (
    upvote_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES USERS(user_id) ON DELETE CASCADE,
    palette_id INTEGER NOT NULL REFERENCES PALETTES(palette_id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, palette_id)
);

-- Create CONTACT_MESSAGES table
CREATE TABLE CONTACT_MESSAGES (
    message_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES USERS(user_id) ON DELETE SET NULL,
    subject VARCHAR(200) NOT NULL,
    message_content TEXT NOT NULL,
    submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_by_user_id INTEGER REFERENCES USERS(user_id) ON DELETE SET NULL,
    resolved_at TIMESTAMP
);

-- Create SESSIONS table for Express.js session storage
CREATE TABLE SESSIONS (
    sid VARCHAR(255) NOT NULL PRIMARY KEY,
    sess JSON NOT NULL,
    expire TIMESTAMP(6) NOT NULL
);

-- Create indexes for performance optimization
CREATE INDEX idx_users_role_id ON USERS(role_id);
CREATE INDEX idx_palettes_user_id ON PALETTES(user_id);
CREATE INDEX idx_palette_colors_palette_id ON PALETTE_COLORS(palette_id);
CREATE INDEX idx_upvotes_user_id ON UPVOTES(user_id);
CREATE INDEX idx_upvotes_palette_id ON UPVOTES(palette_id);
CREATE INDEX idx_contact_messages_user_id ON CONTACT_MESSAGES(user_id);
CREATE INDEX idx_contact_messages_resolved_by ON CONTACT_MESSAGES(resolved_by_user_id);
CREATE INDEX idx_sessions_expire ON SESSIONS(expire);

-- Insert default user roles
INSERT INTO USER_ROLES (role_name, permissions) VALUES 
('Default', 'create_palettes,edit_own_palettes,upvote_palettes,submit_contact'),
('Moderator', 'create_palettes,edit_own_palettes,upvote_palettes,submit_contact,manage_contact_messages,disable_users'),
('Administrator', 'create_palettes,edit_own_palettes,upvote_palettes,submit_contact,manage_contact_messages,disable_users,delete_users,delete_palettes'),
('Disabled', 'view_palettes');

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Create a trigger to automatically update the updated_at column for palettes
CREATE TRIGGER update_palettes_updated_at
BEFORE UPDATE ON PALETTES
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create a trigger to increment upvote_count when a new upvote is added
CREATE OR REPLACE FUNCTION increment_upvote_count()
RETURNS TRIGGER AS $$
BEGIN
   UPDATE PALETTES SET upvote_count = upvote_count + 1 WHERE palette_id = NEW.palette_id;
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER after_upvote_inserted
AFTER INSERT ON UPVOTES
FOR EACH ROW
EXECUTE FUNCTION increment_upvote_count();

-- Create a trigger to decrement upvote_count when an upvote is removed
CREATE OR REPLACE FUNCTION decrement_upvote_count()
RETURNS TRIGGER AS $$
BEGIN
   UPDATE PALETTES SET upvote_count = upvote_count - 1 WHERE palette_id = OLD.palette_id;
   RETURN OLD;
END;
$$ language 'plpgsql';

CREATE TRIGGER after_upvote_deleted
AFTER DELETE ON UPVOTES
FOR EACH ROW
EXECUTE FUNCTION decrement_upvote_count();