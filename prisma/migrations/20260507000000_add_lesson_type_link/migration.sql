-- Add LINK to LessonType so admins can create lessons that are a single
-- external URL (blog post, vendor whitepaper, news article) rendered as
-- an "Open article ↗" card with click-then-complete semantics. The URL
-- (and optional blurb) live in Lesson.content as JSON, same convention
-- as VIDEO / DOCUMENT / HTML lessons.
ALTER TYPE "LessonType" ADD VALUE IF NOT EXISTS 'LINK';
