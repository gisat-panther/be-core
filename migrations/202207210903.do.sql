CREATE TABLE "cureUserOrders" (
    "key" UUID DEFAULT gen_random_uuid(),
    "userKey" UUID NOT NULL,
    "orderId" TEXT NOT NULL,
    "app" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "result" JSONB,
    "created" TIMESTAMP WITH TIME ZONE DEFAULT now(),
    PRIMARY KEY ( "key" ),
    UNIQUE ("userKey", "orderId")
)