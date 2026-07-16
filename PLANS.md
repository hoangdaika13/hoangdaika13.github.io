# HH English Delivery Plan

## Product Goal

Add HH English as a major HH Platform workspace for Vietnamese learners. The first release is free, local-first, original, and structured around CEFR-style can-do outcomes. It must work without paid APIs.

## Technical Assumptions

- The current production application remains a static hash-routed SPA on GitHub Pages.
- Authentication continues to use the existing HH Platform session.
- Milestone 1 persists progress, vocabulary, writing drafts, preferences, and review scheduling in localStorage.
- Browser speech synthesis is used for model audio. Speech recognition and recording are progressive enhancements because browser support varies.
- Content schemas are designed so they can later move to PostgreSQL/Supabase Free without changing the lesson renderer.
- No third-party course text, trademarked visual system, logo, or proprietary exercise is copied.

## Expected Tree

```text
english-learning.js        # data schemas, curriculum, learning engine, mount API
english-learning.css       # responsive HH English visual system
tests/
  english-learning.test.js # curriculum and scoring/review contracts
docs/
  hh-english-schema.sql    # future PostgreSQL/Supabase schema
AGENTS.md
PLANS.md
```

## Milestones

### M1: Local-first MVP

- Major sidebar entry and `/english` route.
- Learner dashboard, A0-A1 roadmap, daily goal, streak, XP, skill progress.
- Data-driven lesson renderer with vocabulary, grammar, dialogue, practice, and summary.
- Placement test with a clearly labelled preliminary result.
- Vocabulary notebook and spaced-review queue.
- Browser text-to-speech, speech recognition fallback messaging, and microphone recording.
- Writing prompt with autosave, word count, and local submission history.
- Search, responsive layout, reduced motion, empty/error states, export/import.

### M2: Complete A0 curriculum

- Five units and fifteen original lessons.
- At least five explained questions per lesson.
- More exercise renderers: ordering, matching, dictation, translation, and flashcards.
- Content QA for Vietnamese explanations, IPA, and answer rationales.

### M3: Optional free backend

- Supabase Free project, migrations, email/password auth, Storage, and RLS.
- Server-authoritative XP and idempotent lesson completion.
- Sync progress across devices and expose account data export/deletion.

### M4: Authoring and administration

- Role-protected CMS for courses, units, lessons, steps, exercises, and vocabulary.
- Draft/publish workflow, preview, duplication, sorting, and content issue reports.

## Planned Relational Schema

- `profiles(id, display_name, locale, role, created_at, updated_at)`
- `learning_goals(user_id, target, current_level, daily_minutes, study_days, focus_skills)`
- `courses(id, slug, title, status, level_min, level_max, created_at, updated_at)`
- `course_levels(id, course_id, cefr_level, position)`
- `units(id, course_level_id, slug, title, can_do, position)`
- `lessons(id, unit_id, slug, title, duration_minutes, primary_skill, xp, status, position)`
- `lesson_steps(id, lesson_id, step_type, position, content_jsonb)`
- `exercises(id, lesson_step_id, exercise_type, prompt, explanation, difficulty, points)`
- `exercise_options(id, exercise_id, label, is_correct, position)`
- `vocabulary_items(id, word, part_of_speech, ipa, meaning_vi, example_en, example_vi, cefr_level, topic)`
- `lesson_vocabulary(lesson_id, vocabulary_id, position)`
- `user_course_enrollments(user_id, course_id, started_at, completed_at)`
- `user_lesson_progress(user_id, lesson_id, status, score, xp_awarded, completed_at)`
- `exercise_attempts(id, user_id, exercise_id, answer_jsonb, correct, error_type, created_at)`
- `user_vocabulary(user_id, vocabulary_id, difficult, note, saved_at)`
- `review_queue(user_id, vocabulary_id, due_at, interval_days, ease_factor, repetitions, lapses, last_reviewed_at)`
- `daily_activity(user_id, activity_date, minutes, xp, lessons_completed)`
- `streaks(user_id, current_days, longest_days, last_activity_date)`
- `achievements(id, code, title, rule_jsonb)` and `user_achievements(user_id, achievement_id, earned_at)`
- `writing_submissions(id, user_id, prompt_id, body, word_count, status, created_at)`
- `speaking_submissions(id, user_id, lesson_id, storage_path, consented_at, status)`
- `notifications(id, user_id, type, title, body, read_at, created_at)`

Every production table will use primary keys, foreign keys, timestamps, query indexes, uniqueness constraints, and RLS based on `auth.uid()`.

## Risks And External Services

- Speech recognition is not supported consistently and may send audio to the browser vendor's recognition service. The UI must disclose this before use.
- Speech synthesis voices differ by operating system, so pronunciation audio is a study aid rather than an authoritative assessment.
- GitHub Pages cannot securely perform server-authoritative XP or multi-device sync. Supabase Free is needed for those guarantees.
- Microphone access requires HTTPS and user permission.
- CEFR placement results in M1 are preliminary and are not an accredited assessment.

