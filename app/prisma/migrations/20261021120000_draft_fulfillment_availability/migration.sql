-- Availability belongs to the immutable content snapshot, never an exact location.
-- Existing revisions remain unselected. Publication validation stays a separate gate.
BEGIN;
ALTER TABLE listing_revision ADD COLUMN fulfillment TEXT;
ALTER TABLE listing_revision ADD CONSTRAINT listing_revision_fulfillment_choices
  CHECK (fulfillment IN ('pickup', 'meetup', 'both'));
COMMIT;
