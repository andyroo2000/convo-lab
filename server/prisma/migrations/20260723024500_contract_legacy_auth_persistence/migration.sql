-- The first legacy-auth contract migration was recorded without execution in
-- production so rollback remained compatible during the credential-free client deploy.
-- Repeat the idempotent contract now that both active and rollback code tolerate it.
BEGIN;

DROP TABLE IF EXISTS "oauth_accounts";
DROP TABLE IF EXISTS "email_verification_tokens";
DROP TABLE IF EXISTS "password_reset_tokens";

ALTER TABLE "User"
  DROP COLUMN IF EXISTS "password",
  DROP COLUMN IF EXISTS "googleId";

COMMIT;
