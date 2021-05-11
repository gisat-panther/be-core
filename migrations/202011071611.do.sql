--
-- Name: topology; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA topology;

--
-- Name: postgis_topology; Type: EXTENSION; Schema: topology; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis_topology WITH SCHEMA topology;


--
-- Name: EXTENSION postgis_topology; Type: COMMENT; Schema: topology; Owner: -
--

COMMENT ON EXTENSION postgis_topology IS 'Topology functions';