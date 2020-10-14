ALTER TABLE "user"."users"
  ADD COLUMN "googleId" TEXT UNIQUE,
  ADD COLUMN "facebookId" TEXT UNIQUE;
