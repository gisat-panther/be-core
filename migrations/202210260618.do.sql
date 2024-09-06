CREATE TABLE "fixtures" (
    "key" UUID DEFAULT public.gen_random_uuid() PRIMARY KEY,
    "file" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    UNIQUE ("file", "hash")
)