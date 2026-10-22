BEGIN;

-- ADR-096, local synthetic foundation. No owner/bootstrap identity is inferred.
-- This module uses parameterized SQL repository projections; these tables are
-- deliberately SQL-owned, including their history and composite FK constraints.
CREATE TABLE moderation_control (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  owner_account_id uuid REFERENCES user_account(id) ON DELETE RESTRICT,
  installation_reference text,
  verified_at timestamptz(3),
  CHECK ((owner_account_id IS NULL AND installation_reference IS NULL AND verified_at IS NULL)
    OR (owner_account_id IS NOT NULL AND length(btrim(installation_reference)) > 0 AND verified_at IS NOT NULL))
);
INSERT INTO moderation_control(singleton) VALUES (true);

CREATE TABLE moderation_grant (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES user_account(id) ON DELETE RESTRICT,
  permission text NOT NULL CHECK (permission IN ('TRIAGE','CLAIM','EVIDENCE','DECIDE','APPEAL','RECOVERY','AUDIT')),
  starts_at timestamptz(3) NOT NULL,
  ends_at timestamptz(3) NOT NULL CHECK (ends_at > starts_at),
  training_reference text NOT NULL CHECK (length(btrim(training_reference)) > 0),
  authorizer_id uuid NOT NULL REFERENCES user_account(id) ON DELETE RESTRICT,
  revoked_at timestamptz(3)
);
CREATE INDEX moderation_grant_actor ON moderation_grant(account_id,permission);

CREATE TABLE moderation_shift (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES user_account(id) ON DELETE RESTRICT,
  authorizer_id uuid NOT NULL REFERENCES user_account(id) ON DELETE RESTRICT,
  role text NOT NULL CHECK (role IN ('PRIMARY','ALTERNATE')),
  starts_at timestamptz(3) NOT NULL,
  ends_at timestamptz(3) NOT NULL CHECK (ends_at > starts_at),
  training_reference text NOT NULL CHECK (length(btrim(training_reference)) > 0),
  availability text NOT NULL DEFAULT 'SCHEDULED' CHECK (availability IN ('SCHEDULED','CONFIRMED','UNAVAILABLE')),
  confirmed_at timestamptz(3)
);

ALTER TABLE listing_revision ADD CONSTRAINT moderation_revision_identity UNIQUE(id,"listingId",version);
CREATE TABLE held_laptop_review (
  id uuid PRIMARY KEY,
  listing_id uuid NOT NULL,
  revision integer NOT NULL,
  revision_id uuid NOT NULL UNIQUE REFERENCES listing_revision(id) ON DELETE RESTRICT,
  seller_id uuid NOT NULL,
  -- Future guarded submission owns provenance. No insertion command is exposed.
  source_reference uuid NOT NULL UNIQUE,
  source_policy text NOT NULL CHECK (length(btrim(source_policy)) > 0),
  trigger_class text NOT NULL CHECK (trigger_class IN ('SAFETY','POLICY','OWNERSHIP','PRIVACY','TAXONOMY','EVIDENCE')),
  submitted_at timestamptz(3) NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','CORRECTION_REQUESTED','REJECTED','APPEAL_PENDING','APPEAL_REVIEW','RESOLVED')),
  assigned_to uuid REFERENCES user_account(id) ON DELETE RESTRICT,
  closed_at timestamptz(3),
  necessity_due_at timestamptz(3) NOT NULL,
  FOREIGN KEY(listing_id,revision) REFERENCES listing_revision("listingId",version) ON DELETE RESTRICT,
  FOREIGN KEY(revision_id,listing_id,revision) REFERENCES listing_revision(id,"listingId",version) ON DELETE RESTRICT,
  FOREIGN KEY(listing_id,seller_id) REFERENCES listing(id,"sellerId") ON DELETE RESTRICT,
  FOREIGN KEY(revision_id,listing_id,seller_id) REFERENCES listing_revision(id,"listingId","authoredById") ON DELETE RESTRICT
);
CREATE TABLE moderation_conflict (
  review_id uuid NOT NULL REFERENCES held_laptop_review(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES user_account(id) ON DELETE RESTRICT,
  reason text NOT NULL CHECK (length(btrim(reason)) > 0),
  created_at timestamptz(3) NOT NULL,
  PRIMARY KEY(review_id,account_id)
);
CREATE TABLE moderation_retention_exception (
  id uuid PRIMARY KEY,
  record_kind text NOT NULL CHECK (record_kind IN ('REVIEW','AUDIT')),
  record_id uuid NOT NULL,
  authorizer_id uuid NOT NULL REFERENCES user_account(id) ON DELETE RESTRICT,
  purpose text NOT NULL CHECK (length(btrim(purpose)) > 0),
  started_at timestamptz(3) NOT NULL,
  review_at timestamptz(3) NOT NULL,
  released_at timestamptz(3),
  CHECK (review_at > started_at AND review_at <= started_at + interval '30 days')
);
CREATE TABLE moderation_decision (
  id uuid PRIMARY KEY,
  review_id uuid NOT NULL REFERENCES held_laptop_review(id) ON DELETE CASCADE,
  revision_id uuid NOT NULL REFERENCES listing_revision(id) ON DELETE RESTRICT,
  actor_id uuid NOT NULL REFERENCES user_account(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('REJECT','REQUEST_CORRECTION','APPEAL_CONFIRMED','APPEAL_CORRECTED')),
  reason_code text NOT NULL CHECK (reason_code IN ('REQUIRED_INFORMATION','SAFETY_INELIGIBLE','OWNERSHIP_DECLARATION','ACCOUNT_PUBLICATION_RESTRICTED','ORIGINAL_DECISION_CONFIRMED','DECISION_CORRECTED')),
  rationale text NOT NULL CHECK (length(btrim(rationale)) BETWEEN 1 AND 4000),
  prior_state text NOT NULL,
  resulting_state text NOT NULL,
  created_at timestamptz(3) NOT NULL,
  appeal_deadline timestamptz(3),
  corrects_id uuid REFERENCES moderation_decision(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE moderation_appeal (
  id uuid PRIMARY KEY,
  review_id uuid NOT NULL UNIQUE REFERENCES held_laptop_review(id) ON DELETE CASCADE,
  decision_id uuid NOT NULL UNIQUE REFERENCES moderation_decision(id) ON DELETE CASCADE,
  grounds jsonb NOT NULL CHECK (jsonb_typeof(grounds) = 'array' AND jsonb_array_length(grounds) BETWEEN 1 AND 4),
  explanation text NOT NULL CHECK (char_length(explanation) BETWEEN 1 AND 4000),
  created_at timestamptz(3) NOT NULL,
  acknowledgement_due_at timestamptz(3) NOT NULL,
  decision_due_at timestamptz(3) NOT NULL,
  acknowledged_at timestamptz(3),
  resolved_at timestamptz(3)
);
CREATE TABLE moderation_notice (
  id uuid PRIMARY KEY,
  review_id uuid NOT NULL REFERENCES held_laptop_review(id) ON DELETE CASCADE,
  decision_id uuid REFERENCES moderation_decision(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES user_account(id) ON DELETE RESTRICT,
  event text NOT NULL CHECK (event IN ('HELD','CORRECTION_REQUESTED','APPROVED','REJECTED','APPEAL_RECEIVED','APPEAL_UNDER_REVIEW','APPEAL_RESOLVED')),
  version integer NOT NULL DEFAULT 1 CHECK (version = 1),
  created_at timestamptz(3) NOT NULL,
  read_at timestamptz(3),
  email_outcome text NOT NULL DEFAULT 'INELIGIBLE' CHECK (email_outcome IN ('NOT_REQUIRED','INELIGIBLE','PENDING','ACCEPTED','FAILED','UNKNOWN','SUPPRESSED','EXPIRED'))
);
CREATE TABLE moderation_appeal_response (
  decision_id uuid NOT NULL REFERENCES moderation_decision(id) ON DELETE CASCADE,
  ground text NOT NULL CHECK (ground IN ('NEW_EVIDENCE','FACTUAL_ERROR','POLICY_MISAPPLICATION','PROCEDURAL_FAILURE')),
  explanation text NOT NULL CHECK (char_length(explanation) BETWEEN 1 AND 4000),
  PRIMARY KEY(decision_id,ground)
);
CREATE TABLE moderation_audit (
  id uuid PRIMARY KEY,
  actor_id uuid NOT NULL REFERENCES user_account(id) ON DELETE RESTRICT,
  grant_id uuid,
  purpose text NOT NULL CHECK (purpose IN ('ADMINISTRATION','HELD_REVIEW','MODERATION_APPEAL','DELIVERY_RECOVERY','AUDIT_INSPECTION','SELLER')),
  action text NOT NULL,
  target_id uuid NOT NULL,
  revision_id uuid,
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 4000),
  created_at timestamptz(3) NOT NULL,
  expires_at timestamptz(3) NOT NULL
);
CREATE TABLE moderation_receipt (
  actor_id uuid NOT NULL REFERENCES user_account(id) ON DELETE RESTRICT,
  command text NOT NULL,
  request_id uuid NOT NULL,
  review_id uuid REFERENCES held_laptop_review(id) ON DELETE CASCADE,
  fingerprint text NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz(3) NOT NULL,
  expires_at timestamptz(3),
  PRIMARY KEY(actor_id,command,request_id)
);

-- A monotonic address generation detects A -> B -> A, without retaining addresses.
CREATE TABLE moderation_email_binding (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  generation bigint NOT NULL DEFAULT 0
);
INSERT INTO moderation_email_binding(user_id) SELECT id FROM "user";
CREATE FUNCTION moderation_track_email_binding() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO moderation_email_binding(user_id) VALUES (NEW.id);
  ELSIF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE moderation_email_binding SET generation = generation + 1 WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER moderation_email_binding_change AFTER INSERT OR UPDATE OF email ON "user"
  FOR EACH ROW EXECUTE FUNCTION moderation_track_email_binding();

CREATE TABLE moderation_email_job (
  id uuid PRIMARY KEY,
  notice_id uuid NOT NULL UNIQUE REFERENCES moderation_notice(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES user_account(id) ON DELETE RESTRICT,
  policy text NOT NULL DEFAULT 'moderation-jobs-v1' CHECK (policy = 'moderation-jobs-v1'),
  binding_generation bigint NOT NULL,
  recipient text,
  state text NOT NULL DEFAULT 'READY' CHECK (state IN ('READY','LEASED','SENDING','ACCEPTED','FAILED','UNKNOWN','SUPPRESSED','EXPIRED')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  created_at timestamptz(3) NOT NULL,
  deadline timestamptz(3) NOT NULL,
  available_at timestamptz(3) NOT NULL,
  lease_id uuid,
  lease_until timestamptz(3),
  terminal_at timestamptz(3),
  outcome_code text,
  CHECK (deadline = created_at + interval '168 hours'),
  CHECK (state NOT IN ('ACCEPTED','FAILED','SUPPRESSED','EXPIRED') OR recipient IS NULL)
);
CREATE TABLE moderation_email_attempt (
  id uuid PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES moderation_email_job(id) ON DELETE CASCADE,
  execution integer NOT NULL CHECK (execution BETWEEN 1 AND 5),
  phase text NOT NULL CHECK (phase IN ('CLAIM','SENDING','ACCEPTED','FAILED','UNKNOWN','RATE_LIMITED','SUPPRESSED','EXPIRED')),
  created_at timestamptz(3) NOT NULL,
  UNIQUE(job_id,execution,phase)
);

CREATE FUNCTION moderation_immutable_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Moderation history is append only';
END $$;
CREATE TRIGGER moderation_decision_immutable BEFORE UPDATE ON moderation_decision
  FOR EACH ROW EXECUTE FUNCTION moderation_immutable_history();
CREATE TRIGGER moderation_audit_immutable BEFORE UPDATE ON moderation_audit
  FOR EACH ROW EXECUTE FUNCTION moderation_immutable_history();
CREATE TRIGGER moderation_attempt_immutable BEFORE UPDATE ON moderation_email_attempt
  FOR EACH ROW EXECUTE FUNCTION moderation_immutable_history();
CREATE TRIGGER moderation_conflict_immutable BEFORE UPDATE ON moderation_conflict
  FOR EACH ROW EXECUTE FUNCTION moderation_immutable_history();
CREATE TRIGGER moderation_response_immutable BEFORE UPDATE ON moderation_appeal_response
  FOR EACH ROW EXECUTE FUNCTION moderation_immutable_history();
CREATE TRIGGER moderation_receipt_immutable BEFORE UPDATE ON moderation_receipt
  FOR EACH ROW EXECUTE FUNCTION moderation_immutable_history();
CREATE FUNCTION moderation_guard_review_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW)-ARRAY['status','assigned_to','closed_at','necessity_due_at']) IS DISTINCT FROM
     (to_jsonb(OLD)-ARRAY['status','assigned_to','closed_at','necessity_due_at'])
     OR (OLD.closed_at IS NOT NULL AND NEW.closed_at IS DISTINCT FROM OLD.closed_at) THEN
    RAISE EXCEPTION 'Moderation request identity is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER moderation_review_identity BEFORE UPDATE ON held_laptop_review
  FOR EACH ROW EXECUTE FUNCTION moderation_guard_review_identity();
CREATE FUNCTION moderation_guard_notice() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW)-ARRAY['read_at','email_outcome']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['read_at','email_outcome'])
    OR (OLD.read_at IS NOT NULL AND NEW.read_at IS DISTINCT FROM OLD.read_at) OR NEW.read_at<OLD.created_at THEN
    RAISE EXCEPTION 'Moderation notice identity and first read time are immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER moderation_notice_identity BEFORE UPDATE ON moderation_notice
  FOR EACH ROW EXECUTE FUNCTION moderation_guard_notice();
CREATE FUNCTION moderation_guard_appeal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW)-ARRAY['acknowledged_at','resolved_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['acknowledged_at','resolved_at'])
    OR (OLD.acknowledged_at IS NOT NULL AND NEW.acknowledged_at IS DISTINCT FROM OLD.acknowledged_at)
    OR (OLD.resolved_at IS NOT NULL AND NEW.resolved_at IS DISTINCT FROM OLD.resolved_at)
    OR NEW.acknowledged_at<OLD.created_at OR NEW.resolved_at<OLD.created_at THEN
    RAISE EXCEPTION 'Moderation appeal clocks and content are immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER moderation_appeal_identity BEFORE UPDATE ON moderation_appeal
  FOR EACH ROW EXECUTE FUNCTION moderation_guard_appeal();
CREATE FUNCTION moderation_guard_shift() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW)-ARRAY['availability','confirmed_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['availability','confirmed_at']) THEN
    RAISE EXCEPTION 'Moderation shift identity is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER moderation_shift_identity BEFORE UPDATE ON moderation_shift
  FOR EACH ROW EXECUTE FUNCTION moderation_guard_shift();
CREATE FUNCTION moderation_guard_decision_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM held_laptop_review r WHERE r.id=NEW.review_id AND r.revision_id=NEW.revision_id) THEN
    RAISE EXCEPTION 'Decision must bind the exact review revision';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER moderation_decision_revision BEFORE INSERT ON moderation_decision
  FOR EACH ROW EXECUTE FUNCTION moderation_guard_decision_revision();
CREATE FUNCTION moderation_guard_grant() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - 'revoked_at') IS DISTINCT FROM (to_jsonb(OLD) - 'revoked_at')
    OR OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL THEN
    RAISE EXCEPTION 'Moderation grant history is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER moderation_grant_immutable BEFORE UPDATE ON moderation_grant
  FOR EACH ROW EXECUTE FUNCTION moderation_guard_grant();
CREATE INDEX moderation_email_ready ON moderation_email_job(state,available_at);
CREATE UNIQUE INDEX moderation_decision_notice ON moderation_notice(decision_id,event,account_id) WHERE decision_id IS NOT NULL;
CREATE UNIQUE INDEX moderation_single_review_notice ON moderation_notice(review_id,event,account_id)
  WHERE event IN ('HELD','APPEAL_RECEIVED','APPEAL_UNDER_REVIEW','APPEAL_RESOLVED');
CREATE INDEX moderation_audit_expiry ON moderation_audit(expires_at);
CREATE INDEX moderation_review_queue ON held_laptop_review(status,submitted_at);
COMMIT;
