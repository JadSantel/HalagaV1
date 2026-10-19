-- Drafts may be incomplete. No fictional geography or placeholder condition.
-- Publication validation and all existing history triggers remain required.
BEGIN;
ALTER TABLE listing_revision ALTER COLUMN "barangayCode" DROP NOT NULL;
ALTER TABLE listed_item_group ALTER COLUMN condition DROP NOT NULL;
COMMIT;
