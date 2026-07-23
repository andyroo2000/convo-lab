-- Learning OS owns passwords, verification/reset tokens, and OAuth identities.
-- ConvoLab keeps only the projected user fields required by its remaining frontend backend.
-- These artifacts predate complete migration tracking, so clean-history databases may
-- already lack some of them while production-era databases still contain them.
BEGIN;

DROP TABLE IF EXISTS "oauth_accounts";
DROP TABLE IF EXISTS "email_verification_tokens";
DROP TABLE IF EXISTS "password_reset_tokens";

ALTER TABLE "User"
  DROP COLUMN IF EXISTS "password",
  DROP COLUMN IF EXISTS "googleId";

COMMIT;
