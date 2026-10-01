-- Actor references that used to be NOT NULL made permanently deleting an
-- account impossible once that account had created a task, written a
-- comment, generated a narrative, or dismissed a signal for someone else.
-- Deleting a person must never delete other people's records, so these
-- become nullable and deleteUserPermanently nulls them out instead.
ALTER TABLE tasks ALTER COLUMN created_by_user_id DROP NOT NULL;
ALTER TABLE performance_narratives ALTER COLUMN generated_by_user_id DROP NOT NULL;
ALTER TABLE signal_dismissals ALTER COLUMN dismissed_by_user_id DROP NOT NULL;
ALTER TABLE comments ALTER COLUMN manager_id DROP NOT NULL;
ALTER TABLE log_comments ALTER COLUMN manager_id DROP NOT NULL;
ALTER TABLE task_comments ALTER COLUMN author_user_id DROP NOT NULL;
