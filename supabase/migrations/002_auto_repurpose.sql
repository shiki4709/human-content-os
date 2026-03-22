-- Create user_settings table for RSS URL and voice
CREATE TABLE IF NOT EXISTS user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL UNIQUE,
  substack_rss_url text,
  base_voice text,
  onboarding_complete boolean DEFAULT false,
  rss_fail_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own settings" ON user_settings
  FOR ALL USING (auth.uid() = user_id);

-- Add source_id FK to generated_content
ALTER TABLE generated_content ADD COLUMN IF NOT EXISTS source_id uuid REFERENCES sources(id);

-- Add rss_guid to sources for dedup
ALTER TABLE sources ADD COLUMN IF NOT EXISTS rss_guid text;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS rss_published_at timestamptz;

-- Create index for RSS dedup lookups
CREATE INDEX IF NOT EXISTS idx_sources_rss_guid ON sources(user_id, rss_guid);

-- Add error/update tracking to generated_content
ALTER TABLE generated_content ADD COLUMN IF NOT EXISTS error_message text;
ALTER TABLE generated_content ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Add error tracking to publish_log
ALTER TABLE publish_log ADD COLUMN IF NOT EXISTS error_message text;
