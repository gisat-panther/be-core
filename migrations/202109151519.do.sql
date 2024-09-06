--
-- Name: worldCerealProductMetadata; Type: TABLE; Schema: specific; Owner: -
--

CREATE TABLE specific."worldCerealProductMetadata" (
    key uuid DEFAULT public.gen_random_uuid() NOT NULL,
    "data" jsonb
);