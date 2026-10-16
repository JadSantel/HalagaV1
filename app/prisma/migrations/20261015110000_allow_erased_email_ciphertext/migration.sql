-- ADR-088 requires ciphertext erasure after acceptance/suppression and expiry,
-- while retaining minimal delivery metadata until its separate purge deadline.
ALTER TABLE "account_email_delivery"
  DROP CONSTRAINT "account_email_delivery_ciphertext_check",
  ADD CONSTRAINT "account_email_delivery_ciphertext_check"
    CHECK (octet_length("ciphertext") = 0 OR octet_length("ciphertext") >= 28);
