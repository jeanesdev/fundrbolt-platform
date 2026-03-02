--
-- PostgreSQL database dump
--

\restrict CqZB1aIdcIR4mf4KnkS7fja03rAC2TLZPFoieWaN8ynGHe4bkyCXnP6amXLqtj6

-- Dumped from database version 15.14
-- Dumped by pg_dump version 15.14

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: application_status; Type: TYPE; Schema: public; Owner: fundrbolt_user
--

CREATE TYPE public.application_status AS ENUM (
    'submitted',
    'under_review',
    'approved',
    'rejected'
);


ALTER TYPE public.application_status OWNER TO fundrbolt_user;

--
-- Name: consent_action; Type: TYPE; Schema: public; Owner: fundrbolt_user
--

CREATE TYPE public.consent_action AS ENUM (
    'consent_given',
    'consent_withdrawn',
    'consent_updated',
    'data_export_requested',
    'data_deletion_requested',
    'cookie_consent_updated'
);


ALTER TYPE public.consent_action OWNER TO fundrbolt_user;

--
-- Name: consent_status; Type: TYPE; Schema: public; Owner: fundrbolt_user
--

CREATE TYPE public.consent_status AS ENUM (
    'active',
    'withdrawn',
    'superseded'
);


ALTER TYPE public.consent_status OWNER TO fundrbolt_user;

--
-- Name: discount_type_enum; Type: TYPE; Schema: public; Owner: fundrbolt_user
--

CREATE TYPE public.discount_type_enum AS ENUM (
    'percentage',
    'fixed_amount'
);


ALTER TYPE public.discount_type_enum OWNER TO fundrbolt_user;

--
-- Name: event_link_type; Type: TYPE; Schema: public; Owner: fundrbolt_user
--

CREATE TYPE public.event_link_type AS ENUM (
    'video',
    'website',
    'social_media'
);


ALTER TYPE public.event_link_type OWNER TO fundrbolt_user;

--
-- Name: event_media_status; Type: TYPE; Schema: public; Owner: fundrbolt_user
--

CREATE TYPE public.event_media_status AS ENUM (
    'uploaded',
    'scanned',
    'quarantined'
);


ALTER TYPE public.event_media_status OWNER TO fundrbolt_user;

--
-- Name: event_media_type; Type: TYPE; Schema: public; Owner: fundrbolt_user
--

CREATE TYPE public.event_media_type AS ENUM (
    'image',
    'video',
    'flyer'
);


ALTER TYPE public.event_media_type OWNER TO fundrbolt_user;

--
-- Name: event_status; Type: TYPE; Schema: public; Owner: fundrbolt_user
--

CREATE TYPE public.event_status AS ENUM (
    'draft',
    'active',
    'closed'
);


ALTER TYPE public.event_status OWNER TO fundrbolt_user;

--
-- Name: invitation_status; Type: TYPE; Schema: public; Owner: fundrbolt_user
--

CREATE TYPE public.invitation_status AS ENUM (
    'pending',
    'accepted',
    'expired',
    'revoked'
);


ALTER TYPE public.invitation_status OWNER TO fundrbolt_user;

--
-- Name: legal_document_status; Type: TYPE; Schema: public; Owner: fundrbolt_user
--

CREATE TYPE public.legal_document_status AS ENUM (
    'draft',
    'published',
    'archived'
);


ALTER TYPE public.legal_document_status OWNER TO fundrbolt_user;

--
-- Name: legal_document_type; Type: TYPE; Schema: public; Owner: fundrbolt_user
--

CREATE TYPE public.legal_document_type AS ENUM (
    'terms_of_service',
    'privacy_policy'
);


ALTER TYPE public.legal_document_type OWNER TO fundrbolt_user;

--
-- Name: member_role; Type: TYPE; Schema: public; Owner: fundrbolt_user
--

CREATE TYPE public.member_role AS ENUM (
    'admin',
    'co_admin',
    'staff'
);


ALTER TYPE public.member_role OWNER TO fundrbolt_user;

--
-- Name: member_status; Type: TYPE; Schema: public; Owner: fundrbolt_user
--

CREATE TYPE public.member_status AS ENUM (
    'active',
    'invited',
    'suspended',
    'removed'
);


ALTER TYPE public.member_status OWNER TO fundrbolt_user;

--
-- Name: npo_status; Type: TYPE; Schema: public; Owner: fundrbolt_user
--

CREATE TYPE public.npo_status AS ENUM (
    'draft',
    'pending_approval',
    'approved',
    'suspended',
    'rejected'
);


ALTER TYPE public.npo_status OWNER TO fundrbolt_user;

--
-- Name: option_type_enum; Type: TYPE; Schema: public; Owner: fundrbolt_user
--

CREATE TYPE public.option_type_enum AS ENUM (
    'boolean',
    'multi_select',
    'text_input'
);


ALTER TYPE public.option_type_enum OWNER TO fundrbolt_user;

--
-- Name: payment_status_enum; Type: TYPE; Schema: public; Owner: fundrbolt_user
--

CREATE TYPE public.payment_status_enum AS ENUM (
    'pending',
    'completed',
    'failed',
    'refunded'
);


ALTER TYPE public.payment_status_enum OWNER TO fundrbolt_user;

--
-- Name: registration_status; Type: TYPE; Schema: public; Owner: fundrbolt_user
--

CREATE TYPE public.registration_status AS ENUM (
    'pending',
    'confirmed',
    'cancelled',
    'waitlisted'
);


ALTER TYPE public.registration_status OWNER TO fundrbolt_user;

--
-- Name: submissionstatus; Type: TYPE; Schema: public; Owner: fundrbolt_user
--

CREATE TYPE public.submissionstatus AS ENUM (
    'pending',
    'processed',
    'failed'
);


ALTER TYPE public.submissionstatus OWNER TO fundrbolt_user;

--
-- Name: check_bidder_number_uniqueness(); Type: FUNCTION; Schema: public; Owner: fundrbolt_user
--

CREATE FUNCTION public.check_bidder_number_uniqueness() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
        DECLARE
            event_id_var UUID;
            existing_count INTEGER;
        BEGIN
            -- Skip check if bidder_number is NULL
            IF NEW.bidder_number IS NULL THEN
                RETURN NEW;
            END IF;

            -- Get event_id for this guest
            SELECT event_id INTO event_id_var
            FROM event_registrations
            WHERE id = NEW.registration_id;

            -- Check if this bidder number is already used in this event
            SELECT COUNT(*) INTO existing_count
            FROM registration_guests rg
            JOIN event_registrations er ON rg.registration_id = er.id
            WHERE er.event_id = event_id_var
              AND rg.bidder_number = NEW.bidder_number
              AND rg.id != NEW.id; -- Exclude current row (for updates)

            IF existing_count > 0 THEN
                RAISE EXCEPTION
                    'Bidder number % is already assigned to another guest in this event',
                    NEW.bidder_number
                USING ERRCODE = '23505'; -- Unique violation error code
            END IF;

            RETURN NEW;
        END;
        $$;


ALTER FUNCTION public.check_bidder_number_uniqueness() OWNER TO fundrbolt_user;

--
-- Name: prevent_audit_modification(); Type: FUNCTION; Schema: public; Owner: fundrbolt_user
--

CREATE FUNCTION public.prevent_audit_modification() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
        BEGIN
            RAISE EXCEPTION 'Audit logs are immutable. Modifications are not allowed.';
        END;
        $$;


ALTER FUNCTION public.prevent_audit_modification() OWNER TO fundrbolt_user;

--
-- Name: prevent_ticket_audit_log_modification(); Type: FUNCTION; Schema: public; Owner: fundrbolt_user
--

CREATE FUNCTION public.prevent_ticket_audit_log_modification() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
        BEGIN
            RAISE EXCEPTION 'Ticket audit log records are immutable and cannot be modified or deleted';
        END;
        $$;


ALTER FUNCTION public.prevent_ticket_audit_log_modification() OWNER TO fundrbolt_user;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: fundrbolt_user
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


ALTER TABLE public.alembic_version OWNER TO fundrbolt_user;

--
-- Name: assigned_tickets; Type: TABLE; Schema: public; Owner: fundrbolt_user
--

CREATE TABLE public.assigned_tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_purchase_id uuid NOT NULL,
    ticket_number integer NOT NULL,
    qr_code character varying(255) NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.assigned_tickets OWNER TO fundrbolt_user;

--
-- Name: auction_item_media; Type: TABLE; Schema: public; Owner: fundrbolt_user
--

CREATE TABLE public.auction_item_media (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auction_item_id uuid NOT NULL,
    media_type character varying(20) NOT NULL,
    file_path text NOT NULL,
    file_name character varying(255) NOT NULL,
    file_size integer NOT NULL,
    mime_type character varying(100) NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    thumbnail_path text,
    video_url text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT ck_auction_item_media_file_size_positive CHECK ((file_size > 0)),
    CONSTRAINT ck_auction_item_media_type CHECK (((media_type)::text = ANY (ARRAY[('image'::character varying)::text, ('video'::character varying)::text])))
);


ALTER TABLE public.auction_item_media OWNER TO fundrbolt_user;

--
-- Name: auction_items; Type: TABLE; Schema: public; Owner: fundrbolt_user
--

CREATE TABLE public.auction_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    bid_number integer NOT NULL,
    title character varying(200) NOT NULL,
    description text NOT NULL,
    auction_type character varying(20) NOT NULL,
    starting_bid numeric(10,2) NOT NULL,
    donor_value numeric(10,2),
    cost numeric(10,2),
    buy_now_price numeric(10,2),
    buy_now_enabled boolean DEFAULT false NOT NULL,
    quantity_available integer DEFAULT 1 NOT NULL,
    donated_by character varying(200),
    sponsor_id uuid,
    item_webpage text,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    display_priority integer,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp with time zone,
    bid_increment numeric(10,2) DEFAULT 50.00 NOT NULL,
    CONSTRAINT ck_auction_items_auction_type CHECK (((auction_type)::text = ANY (ARRAY[('live'::character varying)::text, ('silent'::character varying)::text]))),
    CONSTRAINT ck_auction_items_bid_increment_positive CHECK ((bid_increment > (0)::numeric)),
    CONSTRAINT ck_auction_items_buy_now_consistency CHECK (((buy_now_enabled = false) OR ((buy_now_enabled = true) AND (buy_now_price IS NOT NULL)))),
    CONSTRAINT ck_auction_items_buy_now_price_min CHECK (((buy_now_price IS NULL) OR (buy_now_price >= starting_bid))),
    CONSTRAINT ck_auction_items_cost_nonnegative CHECK (((cost IS NULL) OR (cost >= (0)::numeric))),
    CONSTRAINT ck_auction_items_donor_value_nonnegative CHECK (((donor_value IS NULL) OR (donor_value >= (0)::numeric))),
    CONSTRAINT ck_auction_items_quantity_min CHECK ((quantity_available >= 1)),
    CONSTRAINT ck_auction_items_starting_bid_nonnegative CHECK ((starting_bid >= (0)::numeric)),
    CONSTRAINT ck_auction_items_status CHECK (((status)::text = ANY (ARRAY[('draft'::character varying)::text, ('published'::character varying)::text, ('sold'::character varying)::text, ('withdrawn'::character varying)::text])))
);


ALTER TABLE public.auction_items OWNER TO fundrbolt_user;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: fundrbolt_user
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    action character varying(50) NOT NULL,
    resource_type character varying(50),
    resource_id uuid,
    ip_address character varying(45) NOT NULL,
    user_agent character varying,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.audit_logs OWNER TO fundrbolt_user;

--
-- Name: consent_audit_logs; Type: TABLE; Schema: public; Owner: fundrbolt_user
--

CREATE TABLE public.consent_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    action public.consent_action NOT NULL,
    details jsonb,
    ip_address character varying(45) NOT NULL,
    user_agent character varying,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.consent_audit_logs OWNER TO fundrbolt_user;

--
-- Name: cookie_consents; Type: TABLE; Schema: public; Owner: fundrbolt_user
--

CREATE TABLE public.cookie_consents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    session_id character varying(255),
    essential boolean DEFAULT true NOT NULL,
    analytics boolean DEFAULT false NOT NULL,
    marketing boolean DEFAULT false NOT NULL,
    ip_address character varying(45) NOT NULL,
    user_agent character varying,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.cookie_consents OWNER TO fundrbolt_user;

--
-- Name: custom_ticket_options; Type: TABLE; Schema: public; Owner: fundrbolt_user
--

CREATE TABLE public.custom_ticket_options (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_package_id uuid NOT NULL,
    option_label character varying(200) NOT NULL,
    option_type public.option_type_enum NOT NULL,
    choices jsonb,
    is_required boolean DEFAULT false NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT check_multi_select_has_choices CHECK (((option_type = ANY (ARRAY['boolean'::public.option_type_enum, 'text_input'::public.option_type_enum])) OR ((option_type = 'multi_select'::public.option_type_enum) AND (choices IS NOT NULL))))
);


ALTER TABLE public.custom_ticket_options OWNER TO fundrbolt_user;

--
-- Name: event_10adb96b_75b8_4a43_8a44_c593cb853e3c_bid_number_seq; Type: SEQUENCE; Schema: public; Owner: fundrbolt_user
--

CREATE SEQUENCE public.event_10adb96b_75b8_4a43_8a44_c593cb853e3c_bid_number_seq
    START WITH 100
    INCREMENT BY 1
    MINVALUE 100
    MAXVALUE 999
    CACHE 1;


ALTER TABLE public.event_10adb96b_75b8_4a43_8a44_c593cb853e3c_bid_number_seq OWNER TO fundrbolt_user;

--
-- Name: event_1145ecbb_9493_4e07_b6fe_d725915d55ea_bid_number_seq; Type: SEQUENCE; Schema: public; Owner: fundrbolt_user
--

CREATE SEQUENCE public.event_1145ecbb_9493_4e07_b6fe_d725915d55ea_bid_number_seq
    START WITH 100
    INCREMENT BY 1
    MINVALUE 100
    MAXVALUE 999
    CACHE 1;


ALTER TABLE public.event_1145ecbb_9493_4e07_b6fe_d725915d55ea_bid_number_seq OWNER TO fundrbolt_user;

--
-- Name: event_a2342a83_0141_4512_88b5_6e460bb11dfd_bid_number_seq; Type: SEQUENCE; Schema: public; Owner: fundrbolt_user
--

CREATE SEQUENCE public.event_a2342a83_0141_4512_88b5_6e460bb11dfd_bid_number_seq
    START WITH 100
    INCREMENT BY 1
    MINVALUE 100
    MAXVALUE 999
    CACHE 1;


ALTER TABLE public.event_a2342a83_0141_4512_88b5_6e460bb11dfd_bid_number_seq OWNER TO fundrbolt_user;

--
-- Name: event_links; Type: TABLE; Schema: public; Owner: fundrbolt_user
--

CREATE TABLE public.event_links (
    id uuid NOT NULL,
    event_id uuid NOT NULL,
    link_type public.event_link_type NOT NULL,
    url character varying(500) NOT NULL,
    label character varying(255),
    platform character varying(50),
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid NOT NULL,
    CONSTRAINT check_link_type CHECK ((link_type = ANY (ARRAY['video'::public.event_link_type, 'website'::public.event_link_type, 'social_media'::public.event_link_type])))
);


ALTER TABLE public.event_links OWNER TO fundrbolt_user;

--
-- Name: COLUMN event_links.label; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.event_links.label IS 'Display label (e.g., ''Event Promo Video'')';


--
-- Name: COLUMN event_links.platform; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.event_links.platform IS 'Platform name (YouTube, Vimeo, Facebook, etc.)';


--
-- Name: event_media; Type: TABLE; Schema: public; Owner: fundrbolt_user
--

CREATE TABLE public.event_media (
    id uuid NOT NULL,
    event_id uuid NOT NULL,
    file_url character varying(500) NOT NULL,
    file_name character varying(255) NOT NULL,
    file_type character varying(100) NOT NULL,
    file_size integer NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    status public.event_media_status DEFAULT 'uploaded'::public.event_media_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    uploaded_by uuid NOT NULL,
    media_type public.event_media_type NOT NULL,
    mime_type character varying(100) NOT NULL,
    blob_name character varying(500) NOT NULL,
    CONSTRAINT check_file_size_max_10mb CHECK ((file_size <= 10485760)),
    CONSTRAINT check_media_status CHECK ((status = ANY (ARRAY['uploaded'::public.event_media_status, 'scanned'::public.event_media_status, 'quarantined'::public.event_media_status])))
);


ALTER TABLE public.event_media OWNER TO fundrbolt_user;

--
-- Name: COLUMN event_media.file_url; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.event_media.file_url IS 'Azure Blob Storage URL';


--
-- Name: COLUMN event_media.file_name; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.event_media.file_name IS 'Original filename';


--
-- Name: COLUMN event_media.file_type; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.event_media.file_type IS 'MIME type (e.g., image/png)';


--
-- Name: COLUMN event_media.file_size; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.event_media.file_size IS 'File size in bytes';


--
-- Name: COLUMN event_media.display_order; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.event_media.display_order IS 'Order for gallery display';


--
-- Name: COLUMN event_media.media_type; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.event_media.media_type IS 'Type of media: image, video, or flyer';


--
-- Name: COLUMN event_media.mime_type; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.event_media.mime_type IS 'MIME type for validation (e.g., image/jpeg)';


--
-- Name: COLUMN event_media.blob_name; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.event_media.blob_name IS 'Azure Blob Storage blob name/path';


--
-- Name: event_registrations; Type: TABLE; Schema: public; Owner: fundrbolt_user
--

CREATE TABLE public.event_registrations (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    event_id uuid NOT NULL,
    status character varying(20) DEFAULT 'confirmed'::character varying NOT NULL,
    ticket_type character varying(100),
    number_of_guests integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    check_in_time timestamp with time zone
);


ALTER TABLE public.event_registrations OWNER TO fundrbolt_user;

--
-- Name: TABLE event_registrations; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON TABLE public.event_registrations IS 'Event registrations linking donors to events';


--
-- Name: COLUMN event_registrations.status; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.event_registrations.status IS 'Registration status';


--
-- Name: COLUMN event_registrations.ticket_type; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.event_registrations.ticket_type IS 'Type of ticket (future use: VIP, General, etc.)';


--
-- Name: COLUMN event_registrations.number_of_guests; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.event_registrations.number_of_guests IS 'Number of guests (including registrant)';


--
-- Name: COLUMN event_registrations.check_in_time; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.event_registrations.check_in_time IS 'When the primary registrant checked in at the event';


--
-- Name: event_tables; Type: TABLE; Schema: public; Owner: fundrbolt_user
--

CREATE TABLE public.event_tables (
    id uuid NOT NULL,
    event_id uuid NOT NULL,
    table_number integer NOT NULL,
    custom_capacity integer,
    table_name character varying(50),
    table_captain_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_event_tables_capacity_range CHECK (((custom_capacity IS NULL) OR ((custom_capacity >= 1) AND (custom_capacity <= 20)))),
    CONSTRAINT ck_event_tables_name_not_empty CHECK (((table_name IS NULL) OR (length(TRIM(BOTH FROM table_name)) > 0)))
);


ALTER TABLE public.event_tables OWNER TO fundrbolt_user;

--
-- Name: events; Type: TABLE; Schema: public; Owner: fundrbolt_user
--

CREATE TABLE public.events (
    id uuid NOT NULL,
    npo_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(255) NOT NULL,
    custom_slug character varying(255),
    status public.event_status DEFAULT 'draft'::public.event_status NOT NULL,
    event_datetime timestamp with time zone NOT NULL,
    timezone character varying(50) NOT NULL,
    venue_name character varying(255),
    venue_address text,
    description text,
    logo_url character varying(500),
    primary_color character varying(7),
    secondary_color character varying(7),
    version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid NOT NULL,
    updated_by uuid NOT NULL,
    tagline character varying(200),
    venue_city character varying(100),
    venue_state character varying(50),
    venue_zip character varying(20),
    background_color character varying(7),
    accent_color character varying(7),
    attire character varying(100),
    primary_contact_name character varying(255),
    primary_contact_email character varying(255),
    primary_contact_phone character varying(20),
    search_vector tsvector GENERATED ALWAYS AS ((setweight(to_tsvector('english'::regconfig, (COALESCE(name, ''::character varying))::text), 'A'::"char") || setweight(to_tsvector('english'::regconfig, COALESCE(description, ''::text)), 'B'::"char"))) STORED,
    table_count integer,
    max_guests_per_table integer,
    seating_layout_image_url character varying(500),
    CONSTRAINT check_event_status CHECK ((status = ANY (ARRAY['draft'::public.event_status, 'active'::public.event_status, 'closed'::public.event_status]))),
    CONSTRAINT check_primary_color_format CHECK (((primary_color IS NULL) OR ((primary_color)::text ~ '^#[0-9A-Fa-f]{6}$'::text))),
    CONSTRAINT check_secondary_color_format CHECK (((secondary_color IS NULL) OR ((secondary_color)::text ~ '^#[0-9A-Fa-f]{6}$'::text))),
    CONSTRAINT ck_events_max_guests_per_table_positive CHECK (((max_guests_per_table IS NULL) OR (max_guests_per_table > 0))),
    CONSTRAINT ck_events_table_count_positive CHECK (((table_count IS NULL) OR (table_count > 0)))
);


ALTER TABLE public.events OWNER TO fundrbolt_user;

--
-- Name: COLUMN events.timezone; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.events.timezone IS 'IANA timezone name (e.g., America/Chicago)';


--
-- Name: COLUMN events.description; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.events.description IS 'Rich text description (Markdown format)';


--
-- Name: COLUMN events.logo_url; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.events.logo_url IS 'Event-specific logo (Azure Blob URL)';


--
-- Name: COLUMN events.primary_color; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.events.primary_color IS 'Hex color code (e.g., #FF5733)';


--
-- Name: COLUMN events.secondary_color; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.events.secondary_color IS 'Hex color code (e.g., #33C4FF)';


--
-- Name: COLUMN events.version; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.events.version IS 'Version counter for optimistic locking';


--
-- Name: COLUMN events.tagline; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.events.tagline IS 'Short tagline for event (max 200 characters)';


--
-- Name: COLUMN events.venue_city; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.events.venue_city IS 'City where event is held';


--
-- Name: COLUMN events.venue_state; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.events.venue_state IS 'State/Province where event is held';


--
-- Name: COLUMN events.venue_zip; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.events.venue_zip IS 'ZIP/Postal code where event is held';


--
-- Name: COLUMN events.background_color; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.events.background_color IS 'Hex color code for background (e.g., #FFFFFF)';


--
-- Name: COLUMN events.accent_color; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.events.accent_color IS 'Hex color code for accents (e.g., #FF5733)';


--
-- Name: COLUMN events.attire; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.events.attire IS 'Dress code or attire (e.g., ''Black Tie'', ''Cocktail Attire'', ''Business Casual'')';


--
-- Name: COLUMN events.primary_contact_name; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.events.primary_contact_name IS 'Primary contact person for event inquiries';


--
-- Name: COLUMN events.primary_contact_email; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.events.primary_contact_email IS 'Email address for event inquiries';


--
-- Name: COLUMN events.primary_contact_phone; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.events.primary_contact_phone IS 'Phone number for event inquiries';


--
-- Name: COLUMN events.seating_layout_image_url; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.events.seating_layout_image_url IS 'Azure Blob URL for event space layout image';


--
-- Name: food_options; Type: TABLE; Schema: public; Owner: fundrbolt_user
--

CREATE TABLE public.food_options (
    id uuid NOT NULL,
    event_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT check_food_option_name_not_empty CHECK (((name IS NOT NULL) AND (TRIM(BOTH FROM name) <> ''::text)))
);


ALTER TABLE public.food_options OWNER TO fundrbolt_user;

--
-- Name: COLUMN food_options.name; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.food_options.name IS 'Option name (e.g., ''Chicken'', ''Vegetarian'')';


--
-- Name: COLUMN food_options.description; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.food_options.description IS 'Optional detailed description';


--
-- Name: invitations; Type: TABLE; Schema: public; Owner: fundrbolt_user
--

CREATE TABLE public.invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    npo_id uuid NOT NULL,
    invited_by_user_id uuid NOT NULL,
    invited_user_id uuid,
    email character varying(255) NOT NULL,
    role character varying(50) NOT NULL,
    status character varying(8) DEFAULT 'pending'::public.invitation_status NOT NULL,
    token_hash character varying(255) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    accepted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    first_name character varying(100),
    last_name character varying(100)
);


ALTER TABLE public.invitations OWNER TO fundrbolt_user;

--
-- Name: COLUMN invitations.invited_user_id; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.invitations.invited_user_id IS 'Set when existing user is invited';


--
-- Name: COLUMN invitations.email; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.invitations.email IS 'Invitation target email address';


--
-- Name: COLUMN invitations.role; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.invitations.role IS 'Role to assign: admin, co_admin, or staff';


--
-- Name: COLUMN invitations.token_hash; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.invitations.token_hash IS 'Hashed JWT invitation token';


--
-- Name: COLUMN invitations.expires_at; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.invitations.expires_at IS 'Invitation expiry (7 days from creation)';


--
-- Name: COLUMN invitations.accepted_at; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.invitations.accepted_at IS 'When invitation was accepted';


--
-- Name: COLUMN invitations.first_name; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.invitations.first_name IS 'Optional first name to pre-fill registration';


--
-- Name: COLUMN invitations.last_name; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.invitations.last_name IS 'Optional last name to pre-fill registration';


--
-- Name: legal_documents; Type: TABLE; Schema: public; Owner: fundrbolt_user
--

CREATE TABLE public.legal_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_type public.legal_document_type NOT NULL,
    version character varying(20) NOT NULL,
    content text NOT NULL,
    status public.legal_document_status DEFAULT 'draft'::public.legal_document_status NOT NULL,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.legal_documents OWNER TO fundrbolt_user;

--
-- Name: meal_selections; Type: TABLE; Schema: public; Owner: fundrbolt_user
--

CREATE TABLE public.meal_selections (
    id uuid NOT NULL,
    registration_id uuid NOT NULL,
    guest_id uuid,
    food_option_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.meal_selections OWNER TO fundrbolt_user;

--
-- Name: TABLE meal_selections; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON TABLE public.meal_selections IS 'Meal selections for event attendees';


--
-- Name: COLUMN meal_selections.guest_id; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.meal_selections.guest_id IS 'Guest who made selection (NULL = registrant)';


--
-- Name: npo_applications; Type: TABLE; Schema: public; Owner: fundrbolt_user
--

CREATE TABLE public.npo_applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    npo_id uuid NOT NULL,
    status public.application_status DEFAULT 'submitted'::public.application_status NOT NULL,
    review_notes json,
    reviewed_by_user_id uuid,
    submitted_at timestamp with time zone,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.npo_applications OWNER TO fundrbolt_user;

--
-- Name: COLUMN npo_applications.review_notes; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.npo_applications.review_notes IS 'Array of review notes with timestamp, reviewer, action, notes';


--
-- Name: npo_branding; Type: TABLE; Schema: public; Owner: fundrbolt_user
--

CREATE TABLE public.npo_branding (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    npo_id uuid NOT NULL,
    primary_color character varying(7),
    secondary_color character varying(7),
    logo_url character varying(500),
    social_media_links json,
    custom_css_properties json,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    background_color character varying(7),
    accent_color character varying(7)
);


ALTER TABLE public.npo_branding OWNER TO fundrbolt_user;

--
-- Name: COLUMN npo_branding.primary_color; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.npo_branding.primary_color IS 'Primary brand color in hex format';


--
-- Name: COLUMN npo_branding.secondary_color; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.npo_branding.secondary_color IS 'Secondary brand color in hex format';


--
-- Name: COLUMN npo_branding.logo_url; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.npo_branding.logo_url IS 'Azure Blob Storage URL for NPO logo';


--
-- Name: COLUMN npo_branding.social_media_links; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.npo_branding.social_media_links IS 'Social media platform URLs and handles';


--
-- Name: COLUMN npo_branding.custom_css_properties; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.npo_branding.custom_css_properties IS 'Additional CSS custom properties for theming';


--
-- Name: COLUMN npo_branding.background_color; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.npo_branding.background_color IS 'Background color in hex format (default white)';


--
-- Name: COLUMN npo_branding.accent_color; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.npo_branding.accent_color IS 'Accent/highlight color in hex format';


--
-- Name: npo_members; Type: TABLE; Schema: public; Owner: fundrbolt_user
--

CREATE TABLE public.npo_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    npo_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role public.member_role NOT NULL,
    status public.member_status DEFAULT 'invited'::public.member_status NOT NULL,
    joined_at timestamp with time zone,
    invited_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.npo_members OWNER TO fundrbolt_user;

--
-- Name: COLUMN npo_members.joined_at; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.npo_members.joined_at IS 'When user accepted invitation and became active member';


--
-- Name: npos; Type: TABLE; Schema: public; Owner: fundrbolt_user
--

CREATE TABLE public.npos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    mission_statement text,
    tax_id character varying(50),
    website_url character varying(500),
    phone character varying(20),
    email character varying(255) NOT NULL,
    address json,
    registration_number character varying(100),
    status public.npo_status DEFAULT 'draft'::public.npo_status NOT NULL,
    created_by_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    tagline character varying(255),
    search_vector tsvector GENERATED ALWAYS AS (((setweight(to_tsvector('english'::regconfig, (COALESCE(name, ''::character varying))::text), 'A'::"char") || setweight(to_tsvector('english'::regconfig, COALESCE(mission_statement, ''::text)), 'B'::"char")) || setweight(to_tsvector('english'::regconfig, COALESCE(description, ''::text)), 'C'::"char"))) STORED
);


ALTER TABLE public.npos OWNER TO fundrbolt_user;

--
-- Name: option_responses; Type: TABLE; Schema: public; Owner: fundrbolt_user
--

CREATE TABLE public.option_responses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_purchase_id uuid NOT NULL,
    custom_option_id uuid NOT NULL,
    response_value text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.option_responses OWNER TO fundrbolt_user;

--
-- Name: promo_code_applications; Type: TABLE; Schema: public; Owner: fundrbolt_user
--

CREATE TABLE public.promo_code_applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    promo_code_id uuid NOT NULL,
    ticket_purchase_id uuid NOT NULL,
    discount_amount numeric(10,2) NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT check_discount_amount_positive CHECK ((discount_amount >= (0)::numeric))
);


ALTER TABLE public.promo_code_applications OWNER TO fundrbolt_user;

--
-- Name: promo_codes; Type: TABLE; Schema: public; Owner: fundrbolt_user
--

CREATE TABLE public.promo_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    code character varying(50) NOT NULL,
    discount_type public.discount_type_enum NOT NULL,
    discount_value numeric(10,2) NOT NULL,
    max_uses integer,
    used_count integer DEFAULT 0 NOT NULL,
    valid_from timestamp with time zone,
    valid_until timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT check_max_uses_vs_used CHECK (((max_uses IS NULL) OR (max_uses >= used_count))),
    CONSTRAINT check_percentage_max_100 CHECK ((((discount_type = 'percentage'::public.discount_type_enum) AND (discount_value <= (100)::numeric)) OR (discount_type = 'fixed_amount'::public.discount_type_enum))),
    CONSTRAINT check_promo_discount_value_positive CHECK ((discount_value > (0)::numeric)),
    CONSTRAINT check_used_count_positive CHECK ((used_count >= 0))
);


ALTER TABLE public.promo_codes OWNER TO fundrbolt_user;

--
-- Name: registration_guests; Type: TABLE; Schema: public; Owner: fundrbolt_user
--

CREATE TABLE public.registration_guests (
    id uuid NOT NULL,
    registration_id uuid NOT NULL,
    user_id uuid,
    name character varying(255),
    email character varying(255),
    phone character varying(20),
    invited_by_admin boolean DEFAULT false NOT NULL,
    invitation_sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    checked_in boolean DEFAULT false NOT NULL,
    bidder_number integer,
    table_number integer,
    bidder_number_assigned_at timestamp with time zone,
    is_table_captain boolean DEFAULT false NOT NULL,
    CONSTRAINT ck_registration_guests_bidder_number_range CHECK (((bidder_number IS NULL) OR ((bidder_number >= 100) AND (bidder_number <= 999)))),
    CONSTRAINT ck_registration_guests_table_number_positive CHECK (((table_number IS NULL) OR (table_number > 0)))
);


ALTER TABLE public.registration_guests OWNER TO fundrbolt_user;

--
-- Name: TABLE registration_guests; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON TABLE public.registration_guests IS 'Guest information for event registrations';


--
-- Name: COLUMN registration_guests.user_id; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.registration_guests.user_id IS 'Guest''s user account (if created)';


--
-- Name: COLUMN registration_guests.name; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.registration_guests.name IS 'Guest''s full name';


--
-- Name: COLUMN registration_guests.email; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.registration_guests.email IS 'Guest''s email address';


--
-- Name: COLUMN registration_guests.phone; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.registration_guests.phone IS 'Guest''s phone number';


--
-- Name: COLUMN registration_guests.invited_by_admin; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.registration_guests.invited_by_admin IS 'Whether admin sent registration link to this guest';


--
-- Name: COLUMN registration_guests.invitation_sent_at; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.registration_guests.invitation_sent_at IS 'When admin sent registration link';


--
-- Name: COLUMN registration_guests.checked_in; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.registration_guests.checked_in IS 'Whether the guest has checked in at the event';


--
-- Name: roles; Type: TABLE; Schema: public; Owner: fundrbolt_user
--

CREATE TABLE public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(50) NOT NULL,
    description character varying(255),
    scope character varying(20) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT role_name_valid CHECK (((name)::text = ANY (ARRAY[('super_admin'::character varying)::text, ('npo_admin'::character varying)::text, ('event_coordinator'::character varying)::text, ('staff'::character varying)::text, ('donor'::character varying)::text]))),
    CONSTRAINT role_scope_valid CHECK (((scope)::text = ANY (ARRAY[('platform'::character varying)::text, ('npo'::character varying)::text, ('event'::character varying)::text, ('own'::character varying)::text])))
);


ALTER TABLE public.roles OWNER TO fundrbolt_user;

--
-- Name: COLUMN roles.scope; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.roles.scope IS 'Access scope: platform, npo, event, own';


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: fundrbolt_user
--

CREATE TABLE public.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    refresh_token_jti character varying(255) NOT NULL,
    device_info character varying(500),
    ip_address character varying(45) NOT NULL,
    user_agent character varying,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT expires_after_creation CHECK ((expires_at > created_at))
);


ALTER TABLE public.sessions OWNER TO fundrbolt_user;

--
-- Name: sponsors; Type: TABLE; Schema: public; Owner: fundrbolt_user
--

CREATE TABLE public.sponsors (
    id uuid NOT NULL,
    event_id uuid NOT NULL,
    name character varying(200) NOT NULL,
    logo_url character varying(500) NOT NULL,
    logo_blob_name character varying(500) NOT NULL,
    thumbnail_url character varying(500) NOT NULL,
    thumbnail_blob_name character varying(500) NOT NULL,
    website_url character varying(500),
    logo_size character varying(20) DEFAULT 'large'::character varying NOT NULL,
    sponsor_level character varying(100),
    contact_name character varying(200),
    contact_email character varying(200),
    contact_phone character varying(20),
    address_line1 character varying(200),
    address_line2 character varying(200),
    city character varying(100),
    state character varying(100),
    postal_code character varying(20),
    country character varying(100),
    donation_amount numeric(12,2),
    notes text,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid NOT NULL,
    CONSTRAINT ck_display_order_nonnegative CHECK ((display_order >= 0)),
    CONSTRAINT ck_donation_nonnegative CHECK ((donation_amount >= (0)::numeric)),
    CONSTRAINT ck_logo_size_enum CHECK (((logo_size)::text = ANY (ARRAY[('xsmall'::character varying)::text, ('small'::character varying)::text, ('medium'::character varying)::text, ('large'::character varying)::text, ('xlarge'::character varying)::text])))
);


ALTER TABLE public.sponsors OWNER TO fundrbolt_user;

--
-- Name: ticket_audit_logs; Type: TABLE; Schema: public; Owner: fundrbolt_user
--

CREATE TABLE public.ticket_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id uuid NOT NULL,
    coordinator_id uuid NOT NULL,
    field_name character varying(100) NOT NULL,
    old_value text,
    new_value text,
    changed_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.ticket_audit_logs OWNER TO fundrbolt_user;

--
-- Name: ticket_packages; Type: TABLE; Schema: public; Owner: fundrbolt_user
--

CREATE TABLE public.ticket_packages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    price numeric(10,2) NOT NULL,
    seats_per_package integer NOT NULL,
    quantity_limit integer,
    sold_count integer DEFAULT 0 NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    image_url character varying(500),
    is_enabled boolean DEFAULT true NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    is_sponsorship boolean DEFAULT false NOT NULL,
    CONSTRAINT check_quantity_limit_vs_sold CHECK (((quantity_limit IS NULL) OR (quantity_limit >= sold_count))),
    CONSTRAINT check_seats_per_package_range CHECK (((seats_per_package >= 1) AND (seats_per_package <= 100))),
    CONSTRAINT check_sold_count_positive CHECK ((sold_count >= 0)),
    CONSTRAINT check_ticket_package_price_positive CHECK ((price >= (0)::numeric))
);


ALTER TABLE public.ticket_packages OWNER TO fundrbolt_user;

--
-- Name: ticket_purchases; Type: TABLE; Schema: public; Owner: fundrbolt_user
--

CREATE TABLE public.ticket_purchases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    ticket_package_id uuid NOT NULL,
    user_id uuid NOT NULL,
    quantity integer NOT NULL,
    total_price numeric(10,2) NOT NULL,
    payment_status public.payment_status_enum NOT NULL,
    purchased_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT check_purchase_quantity_positive CHECK ((quantity > 0)),
    CONSTRAINT check_total_price_positive CHECK ((total_price >= (0)::numeric))
);


ALTER TABLE public.ticket_purchases OWNER TO fundrbolt_user;

--
-- Name: user_consents; Type: TABLE; Schema: public; Owner: fundrbolt_user
--

CREATE TABLE public.user_consents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    tos_document_id uuid NOT NULL,
    privacy_document_id uuid NOT NULL,
    ip_address character varying(45) NOT NULL,
    user_agent character varying,
    status public.consent_status DEFAULT 'active'::public.consent_status NOT NULL,
    withdrawn_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_consents OWNER TO fundrbolt_user;

--
-- Name: users; Type: TABLE; Schema: public; Owner: fundrbolt_user
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    phone character varying(20),
    email_verified boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    role_id uuid NOT NULL,
    npo_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_login_at timestamp with time zone,
    organization_name character varying(255),
    address_line1 character varying(255),
    address_line2 character varying(255),
    city character varying(100),
    state character varying(100),
    postal_code character varying(20),
    country character varying(100),
    search_vector tsvector GENERATED ALWAYS AS (((setweight(to_tsvector('english'::regconfig, (COALESCE(first_name, ''::character varying))::text), 'A'::"char") || setweight(to_tsvector('english'::regconfig, (COALESCE(last_name, ''::character varying))::text), 'A'::"char")) || setweight(to_tsvector('english'::regconfig, (COALESCE(email, ''::character varying))::text), 'B'::"char"))) STORED,
    profile_picture_url character varying(500),
    social_media_links json,
    CONSTRAINT email_lowercase CHECK (((email)::text = lower((email)::text))),
    CONSTRAINT password_not_empty CHECK ((length((password_hash)::text) > 0))
);


ALTER TABLE public.users OWNER TO fundrbolt_user;

--
-- Name: COLUMN users.social_media_links; Type: COMMENT; Schema: public; Owner: fundrbolt_user
--

COMMENT ON COLUMN public.users.social_media_links IS 'Social media platform URLs (facebook, twitter, instagram, linkedin, youtube, website)';


--
-- Data for Name: alembic_version; Type: TABLE DATA; Schema: public; Owner: fundrbolt_user
--

COPY public.alembic_version (version_num) FROM stdin;
sponsorship_001
\.


--
-- Data for Name: assigned_tickets; Type: TABLE DATA; Schema: public; Owner: fundrbolt_user
--

COPY public.assigned_tickets (id, ticket_purchase_id, ticket_number, qr_code, assigned_at) FROM stdin;
\.


--
-- Data for Name: auction_item_media; Type: TABLE DATA; Schema: public; Owner: fundrbolt_user
--

COPY public.auction_item_media (id, auction_item_id, media_type, file_path, file_name, file_size, mime_type, display_order, thumbnail_path, video_url, created_at, updated_at) FROM stdin;
7acac6c5-b404-4fd9-8ce2-6aeebb6f038a	e5624ee6-25e0-49ca-96f4-2113cf1a0c06	image	https://augeodevst.blob.core.windows.net/npo-assets/auction-items/e5624ee6-25e0-49ca-96f4-2113cf1a0c06/image/20251123_205553_5096f7c5_spa-accessory-composition-set-in-day-spa-hotel-beauty-wellness-centre-spa-product-are-placed-in-luxury-spa-resort-room-ready-for-massage-therapy-from-professional-service-photo.webp	spa-accessory-composition-set-in-day-spa-hotel-beauty-wellness-centre-spa-product-are-placed-in-luxury-spa-resort-room-ready-for-massage-therapy-from-professional-service-photo.webp	10772	image/webp	0	https://augeodevst.blob.core.windows.net/npo-assets/auction-items/e5624ee6-25e0-49ca-96f4-2113cf1a0c06/image/20251123_205553_5096f7c5_spa-accessory-composition-set-in-day-spa-hotel-beauty-wellness-centre-spa-product-are-placed-in-luxury-spa-resort-room-ready-for-massage-therapy-from-professional-service-photo_thumb_200x200.webp	\N	2025-11-23 20:55:53.843327+00	2025-11-23 20:55:53.843327+00
5bd88d03-07e9-495b-98c4-d8377432dfec	9c0ca120-a03c-42b7-ae46-092d8704d457	image	https://augeodevst.blob.core.windows.net/npo-assets/auction-items/9c0ca120-a03c-42b7-ae46-092d8704d457/image/20251123_205835_a6147a16_brown-leather-handbag.webp	brown-leather-handbag.webp	11832	image/webp	0	https://augeodevst.blob.core.windows.net/npo-assets/auction-items/9c0ca120-a03c-42b7-ae46-092d8704d457/image/20251123_205835_a6147a16_brown-leather-handbag_thumb_200x200.webp	\N	2025-11-23 20:58:35.937312+00	2025-11-23 20:58:35.937312+00
98a93895-be43-4e8a-9fe2-ac69be833680	03dc61cf-db2c-4c75-9a3f-5b7b5bb6b0dd	image	https://augeodevst.blob.core.windows.net/npo-assets/auction-items/03dc61cf-db2c-4c75-9a3f-5b7b5bb6b0dd/image/20251123_210049_a6fc335b_wall_web_bd81b7dc-9306-4881-a4c0-9c931ba4de9e_296x296_crop_center.webp	wall_web_bd81b7dc-9306-4881-a4c0-9c931ba4de9e_296x296_crop_center.webp	4524	image/webp	0	https://augeodevst.blob.core.windows.net/npo-assets/auction-items/03dc61cf-db2c-4c75-9a3f-5b7b5bb6b0dd/image/20251123_210049_a6fc335b_wall_web_bd81b7dc-9306-4881-a4c0-9c931ba4de9e_296x296_crop_center_thumb_200x200.webp	\N	2025-11-23 21:00:50.228176+00	2025-11-23 21:00:50.228176+00
1981e9a1-3af5-40fb-9607-3813220bb99e	806d776e-255d-4e45-9d9e-4b6941b839f3	image	https://augeodevst.blob.core.windows.net/npo-assets/auction-items/806d776e-255d-4e45-9d9e-4b6941b839f3/image/20251115_184751_d7c65f01_BigBearLake.jpg	Big Bear Lake.jpg	410659	image/jpeg	0	https://augeodevst.blob.core.windows.net/npo-assets/auction-items/806d776e-255d-4e45-9d9e-4b6941b839f3/image/20251115_184751_d7c65f01_BigBearLake_thumb_200x200.jpg	\N	2025-11-15 18:47:51.918709+00	2025-12-10 01:19:21.709256+00
f8f62799-50b0-4cf0-97ff-fb820d4c8294	806d776e-255d-4e45-9d9e-4b6941b839f3	image	https://augeodevst.blob.core.windows.net/npo-assets/auction-items/806d776e-255d-4e45-9d9e-4b6941b839f3/image/20251115_185134_73a78c3f_Starbucks-logo-500x281.png	Starbucks-logo-500x281.png	56990	image/png	1	https://augeodevst.blob.core.windows.net/npo-assets/auction-items/806d776e-255d-4e45-9d9e-4b6941b839f3/image/20251115_185134_73a78c3f_Starbucks-logo-500x281_thumb_200x200.png	\N	2025-11-15 18:51:35.054705+00	2025-12-10 01:19:21.709256+00
\.


--
-- Data for Name: auction_items; Type: TABLE DATA; Schema: public; Owner: fundrbolt_user
--

COPY public.auction_items (id, event_id, bid_number, title, description, auction_type, starting_bid, donor_value, cost, buy_now_price, buy_now_enabled, quantity_available, donated_by, sponsor_id, item_webpage, status, display_priority, created_by, created_at, updated_at, deleted_at, bid_increment) FROM stdin;
332a1d64-ff18-4ea3-8951-c9b04103c11c	1145ecbb-9493-4e07-b6fe-d725915d55ea	101	Gourmet Coffee Gift Basket	Premium coffee lovers bundle with artisan roasted beans, French press, and gourmet treats. Perfect gift for coffee enthusiasts.	silent	25.00	100.00	\N	75.00	t	5	Roastery Coffee Co.	\N	\N	published	60	b25889fa-76a3-4008-950c-6d7ee0cb5f01	2025-11-17 02:32:48.275037+00	2025-12-09 19:45:43.149909+00	\N	50.00
e5624ee6-25e0-49ca-96f4-2113cf1a0c06	10adb96b-75b8-4a43-8a44-c593cb853e3c	102	Spa Day Package	Full day spa package including massage, facial, manicure, and access to spa facilities. Valid for 6 months.	silent	100.00	250.00	\N	\N	f	2	Serenity Spa & Wellness	\N	\N	published	55	b25889fa-76a3-4008-950c-6d7ee0cb5f01	2025-11-17 02:32:48.361069+00	2025-12-09 19:45:43.149909+00	\N	50.00
85df72c5-4b2c-4cfe-9ae6-2bdbd9c79dd2	a2342a83-0141-4512-88b5-6e460bb11dfd	102	Professional Photography Session	2-hour family or portrait photography session with professional photographer. Includes 20 edited digital images.	silent	75.00	300.00	\N	\N	f	3	Capture Moments Photography	\N	\N	published	50	b25889fa-76a3-4008-950c-6d7ee0cb5f01	2025-11-17 02:32:48.445651+00	2025-12-09 19:45:43.149909+00	\N	50.00
b18bbbf5-efb6-44f4-8afd-7baf4afc996a	1145ecbb-9493-4e07-b6fe-d725915d55ea	102	Cooking Class with Celebrity Chef	Hands-on cooking class featuring Italian cuisine. Learn to make fresh pasta, sauces, and authentic dishes. Includes dinner and wine.	silent	80.00	200.00	\N	\N	f	10	Chef Marco's Culinary School	\N	\N	published	45	b25889fa-76a3-4008-950c-6d7ee0cb5f01	2025-11-17 02:32:48.528008+00	2025-12-09 19:45:43.149909+00	\N	50.00
6b8d8a9d-7e62-4e7a-beb8-67cab644d08a	a2342a83-0141-4512-88b5-6e460bb11dfd	103	Art Supplies Bundle	Complete art supplies set including professional-grade paints, brushes, canvas, and easel. Perfect for beginners or experienced artists.	silent	30.00	150.00	\N	\N	f	4	Creative Arts Supply Store	\N	\N	published	35	b25889fa-76a3-4008-950c-6d7ee0cb5f01	2025-11-17 02:32:48.696686+00	2025-12-09 19:45:43.149909+00	\N	50.00
9c0ca120-a03c-42b7-ae46-092d8704d457	10adb96b-75b8-4a43-8a44-c593cb853e3c	103	Designer Handbag	Authentic designer leather handbag from premium collection. Brand new with tags and authentication certificate.	silent	60.00	400.00	\N	\N	f	1	Luxe Fashion Boutique	\N	\N	published	40	b25889fa-76a3-4008-950c-6d7ee0cb5f01	2025-11-17 02:32:48.613586+00	2025-12-09 19:45:43.149909+00	\N	50.00
03dc61cf-db2c-4c75-9a3f-5b7b5bb6b0dd	10adb96b-75b8-4a43-8a44-c593cb853e3c	101	Original Artwork by Local Artist	Beautiful 24x36 canvas painting featuring mountain landscape. Professionally framed and ready to hang. One-of-a-kind piece.	live	400.00	1200.00	\N	\N	f	1	Sarah Mitchell Art Studio	\N	\N	published	80	b25889fa-76a3-4008-950c-6d7ee0cb5f01	2025-11-17 02:32:48.102854+00	2025-12-09 19:45:43.149909+00	\N	50.00
82cb5c43-5b1c-49e1-85f0-2b9231d1cb5c	1145ecbb-9493-4e07-b6fe-d725915d55ea	100	Wine Tasting Experience for Four	Private wine tasting at Vineyard Estate with sommelier-guided tour. Includes tasting of 8 premium wines and gourmet cheese pairing.	live	300.00	800.00	\N	600.00	t	2	Vineyard Estate Wines	\N	\N	published	90	b25889fa-76a3-4008-950c-6d7ee0cb5f01	2025-11-17 02:32:48.017004+00	2025-12-09 19:45:43.149909+00	\N	50.00
a0fa079e-4186-4eda-9a14-2c7fa529045b	a2342a83-0141-4512-88b5-6e460bb11dfd	101	Golf Package at Championship Course	Foursome golf package at Pebble Creek Championship Golf Course. Includes cart, range balls, and lunch at the clubhouse.	live	200.00	600.00	\N	\N	f	3	Pebble Creek Golf Club	\N	\N	published	70	b25889fa-76a3-4008-950c-6d7ee0cb5f01	2025-11-17 02:32:48.189991+00	2025-12-09 19:45:43.149909+00	\N	50.00
806d776e-255d-4e45-9d9e-4b6941b839f3	10adb96b-75b8-4a43-8a44-c593cb853e3c	100	Big Bear Lake House	Embrace the rustic serenity of Southern California’s soaring alpine wilderness with a cozy lakeside retreat to the forested shores and four-season wonderland of Big Bear. This winsome A-frame cabin welcomes up to six guests into a world of woodsy elegance and natural beauty, where rugged charm meets peaceful luxury year-round. Surrounded by towering pines and crisp mountain air, the home blends classic cabin warmth with refined modern touches for a truly restorative retreat. Rich timber beams, warm wood finishes, and expansive windows frame sweeping views of the lake, bathing the open-plan living space in dappled sunlight and ruminative reflections. Cozy up by the stone fireplace after a day of hiking or gather in the well-equipped kitchen for fireside meals and laughter-filled evenings. Each bedroom is a peaceful woodland sanctuary, adorned with soft, nature-inspired hues perfect for restful mountain mornings. Step outside to your own private dock, where calm waters beckon for summer swims or sunset skywatching. Unwind in the bubbling hot tub beneath the evergreens or gather around the firepit on crisp mountain nights with a wraparound deck offering breathtaking lake views and nearby trails offering adventure in every direction.	silent	3475.00	0.00	2894.98	6000.00	f	3	Big Bear Lake	\N	http://gooe	published	0	b25889fa-76a3-4008-950c-6d7ee0cb5f01	2025-11-15 02:34:55.405156+00	2025-12-09 19:45:43.149909+00	\N	50.00
bee6e02b-391c-49bd-b432-80c9ee7b507c	a2342a83-0141-4512-88b5-6e460bb11dfd	100	Weekend Getaway at Luxury Resort	Enjoy a relaxing 3-night stay at the Grand Mountain Resort. Includes spa treatment for two, gourmet breakfast, and resort credits. Valid for 1 year.	live	500.00	1500.00	0.00	1200.00	t	1	Grand Mountain Resort & Spa	\N	https://grandmountainresort.example.com	published	100	b25889fa-76a3-4008-950c-6d7ee0cb5f01	2025-11-17 02:32:47.910885+00	2025-12-09 19:45:43.149909+00	\N	50.00
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: fundrbolt_user
--

COPY public.audit_logs (id, user_id, action, resource_type, resource_id, ip_address, user_agent, metadata, created_at) FROM stdin;
9a0ec114-4437-4d66-827e-b7a436541ec4	a748e498-1771-4ce2-ac4e-f9d3a8c2866b	account_deactivated	\N	\N	unknown	\N	{"email": "tokentest@example.com", "reason": "Manual deactivation", "admin_user_id": "b25889fa-76a3-4008-950c-6d7ee0cb5f01"}	2025-10-26 10:31:54.710367+00
1019505b-9ef3-4f3b-be86-3d6b1b10ad11	25d5958f-9480-4da8-914a-f1f220d67b9b	email_verified	\N	\N	127.0.0.1	\N	{"email": "josh@augeo.app"}	2025-10-31 18:04:30.178954+00
470c4f47-c7ef-41e4-a493-883fd34ca31c	d352f991-08b4-4906-add7-b166ec288681	email_verified	\N	\N	127.0.0.1	\N	{"email": "bluejeanes521+test3@gmail.com"}	2025-10-31 18:57:37.824088+00
30789a65-a3f0-4686-aaed-c6cea5197384	b25889fa-76a3-4008-950c-6d7ee0cb5f01	npo_created	\N	\N	unknown	\N	{"npo_id": "67a55d4f-6401-4957-908e-60fd384daed4", "npo_name": "The BrightPath Foundation", "created_by_email": "super_admin@test.com"}	2025-11-02 17:51:02.132631+00
9aeb363c-457a-4ef9-b27f-9eb0baf9fc75	b25889fa-76a3-4008-950c-6d7ee0cb5f01	npo_updated	\N	\N	unknown	\N	{"npo_id": "67a55d4f-6401-4957-908e-60fd384daed4", "changes": {"name": "The BrightPath Foundation", "email": "test.brightpath@augeo.app", "phone": "1234567890", "address": {"city": "San Fransico", "state": "CA", "street": "123 Main St", "country": "United States", "street2": "", "postal_code": "12345"}, "tagline": "Guiding communities toward a brighter tomorrow", "description": "The BrightPath Foundation is a nonprofit organization dedicated to empowering families and individuals through education, mentorship, and resource development. Our mission is to create pathways for lasting change by connecting people with tools, knowledge, and community support. Through scholarship programs, youth leadership initiatives, and workforce readiness projects, we strive to build stronger, more resilient communities for generations to come.", "website_url": "https://brightpath.fake/"}, "npo_name": "The BrightPath Foundation", "updated_by_email": "super_admin@test.com"}	2025-11-03 19:21:15.76036+00
62288d6f-6214-4d94-9679-67f1c0ce37b0	b25889fa-76a3-4008-950c-6d7ee0cb5f01	npo_updated	\N	\N	unknown	\N	{"npo_id": "67a55d4f-6401-4957-908e-60fd384daed4", "changes": {"name": "The BrightPath Foundation", "email": "test.brightpath@augeo.app", "phone": "1234567890", "address": {"city": "San Fransico", "state": "CA", "street": "123 Main St", "country": "United States", "street2": "", "postal_code": "12345"}, "tagline": "Guiding communities toward a brighter tomorrow", "description": "The BrightPath Foundation is a nonprofit organization dedicated to empowering families and individuals through education, mentorship, and resource development. Our mission is to create pathways for lasting change by connecting people with tools, knowledge, and community support. Through scholarship programs, youth leadership initiatives, and workforce readiness projects, we strive to build stronger, more resilient communities for generations to come.", "website_url": "https://brightpath.fake/"}, "npo_name": "The BrightPath Foundation", "updated_by_email": "super_admin@test.com"}	2025-11-03 19:22:41.455487+00
e2439a8b-c69b-4890-9c89-a97fd88e1c11	b25889fa-76a3-4008-950c-6d7ee0cb5f01	npo_updated	\N	\N	unknown	\N	{"npo_id": "67a55d4f-6401-4957-908e-60fd384daed4", "changes": {"name": "The BrightPath Foundation", "email": "test.brightpath@augeo.app", "phone": "1234567890", "address": {"city": "San Fransico", "state": "CA", "street": "123 Main St", "country": "United States", "street2": "", "postal_code": "12345"}, "tagline": "Guiding communities toward a brighter tomorrow", "description": "The BrightPath Foundation is a nonprofit organization dedicated to empowering families and individuals through education, mentorship, and resource development. Our mission is to create pathways for lasting change by connecting people with tools, knowledge, and community support. Through scholarship programs, youth leadership initiatives, and workforce readiness projects, we strive to build stronger, more resilient communities for generations to come.", "website_url": "https://brightpath.fake/"}, "npo_name": "The BrightPath Foundation", "updated_by_email": "super_admin@test.com"}	2025-11-03 19:31:01.9852+00
30d03267-afdf-447a-939c-e5647c10ca32	b25889fa-76a3-4008-950c-6d7ee0cb5f01	npo_member_removed	\N	\N	unknown	\N	{"npo_id": "67a55d4f-6401-4957-908e-60fd384daed4", "reason": "Invitation revoked", "npo_name": "The BrightPath Foundation", "member_email": "test789@example.com", "member_user_id": "00000000-0000-0000-0000-000000000000"}	2025-11-05 12:50:24.009831+00
776e5612-f7cd-41e4-af18-6e7fe67392ae	b25889fa-76a3-4008-950c-6d7ee0cb5f01	npo_member_removed	\N	\N	unknown	\N	{"npo_id": "67a55d4f-6401-4957-908e-60fd384daed4", "reason": "Invitation revoked", "npo_name": "The BrightPath Foundation", "member_email": "newstaff123@example.com", "member_user_id": "00000000-0000-0000-0000-000000000000"}	2025-11-05 12:50:27.651461+00
8e0de686-1090-4617-ae20-7fff2cf28002	b25889fa-76a3-4008-950c-6d7ee0cb5f01	npo_member_removed	\N	\N	unknown	\N	{"npo_id": "67a55d4f-6401-4957-908e-60fd384daed4", "reason": "Invitation revoked", "npo_name": "The BrightPath Foundation", "member_email": "bluejeanes521@gmail.com", "member_user_id": "00000000-0000-0000-0000-000000000000"}	2025-11-05 12:50:34.579418+00
ae8b139c-b136-4dd4-aba1-99a2c3e109ab	b25889fa-76a3-4008-950c-6d7ee0cb5f01	npo_member_added	\N	\N	unknown	\N	{"role": "staff", "npo_id": "67a55d4f-6401-4957-908e-60fd384daed4", "npo_name": "The BrightPath Foundation", "member_email": "staff.brightpath@augeo.app", "member_user_id": "061cd97f-9ad6-48a8-9dc4-80a8353ea255"}	2025-11-05 14:19:23.590815+00
5e60f564-29b2-417e-b69c-545bda8ae873	b25889fa-76a3-4008-950c-6d7ee0cb5f01	npo_member_removed	\N	\N	unknown	\N	{"npo_id": "67a55d4f-6401-4957-908e-60fd384daed4", "reason": "Invitation revoked", "npo_name": "The BrightPath Foundation", "member_email": "co-admin.brightpath@augeo.app", "member_user_id": "00000000-0000-0000-0000-000000000000"}	2025-11-05 14:32:30.125167+00
3d179909-ac65-497b-b9c0-f7a4b23cc218	b25889fa-76a3-4008-950c-6d7ee0cb5f01	npo_member_removed	\N	\N	unknown	\N	{"npo_id": "67a55d4f-6401-4957-908e-60fd384daed4", "reason": "Invitation revoked", "npo_name": "The BrightPath Foundation", "member_email": "newstaff@example.com", "member_user_id": "00000000-0000-0000-0000-000000000000"}	2025-11-05 14:32:34.048787+00
bca7967a-bfbe-496e-a760-300d6ab88df4	8035482b-c4bf-4b80-991b-7a03580771e4	email_verified	\N	\N	127.0.0.1	\N	{"email": "co-admin.brightpath@augeo.app"}	2025-11-05 18:33:12.022492+00
1d877f69-9835-4365-90b0-918cfe86e0c2	b25889fa-76a3-4008-950c-6d7ee0cb5f01	npo_updated	\N	\N	unknown	\N	{"npo_id": "67a55d4f-6401-4957-908e-60fd384daed4", "changes": {"name": "The BrightPath Foundation", "email": "test.brightpath@augeo.app", "phone": "1234567890", "tax_id": "12-1234567", "address": {"city": "San Fransico", "state": "CA", "street": "123 Main St", "country": "United States", "street2": "", "postal_code": "12345"}, "tagline": "Guiding communities toward a brighter tomorrow", "description": "The BrightPath Foundation is a nonprofit organization dedicated to empowering families and individuals through education, mentorship, and resource development. Our mission is to create pathways for lasting change by connecting people with tools, knowledge, and community support. Through scholarship programs, youth leadership initiatives, and workforce readiness projects, we strive to build stronger, more resilient communities for generations to come.", "website_url": "https://brightpath.fake/", "registration_number": "REG-12345"}, "npo_name": "The BrightPath Foundation", "updated_by_email": "super_admin@test.com"}	2025-11-06 01:57:00.79681+00
0f793eab-69ae-4935-a0ec-ecd97d6f6044	b25889fa-76a3-4008-950c-6d7ee0cb5f01	npo_status_changed	\N	\N	unknown	\N	{"notes": "Application submitted for review", "npo_id": "67a55d4f-6401-4957-908e-60fd384daed4", "npo_name": "The BrightPath Foundation", "new_status": "pending_approval", "old_status": "draft", "changed_by_email": "super_admin@test.com"}	2025-11-06 02:14:57.680645+00
31ff07f3-7db8-419d-bb46-8c8088175c2c	b25889fa-76a3-4008-950c-6d7ee0cb5f01	npo_application_approved	\N	\N	unknown	\N	{"npo_id": "67a55d4f-6401-4957-908e-60fd384daed4", "status": "approved", "npo_name": "The BrightPath Foundation", "reviewed_by_email": "super_admin@test.com"}	2025-11-06 03:13:48.899766+00
f767616a-585e-40ff-a8b9-7f5a0f4b0de8	b25889fa-76a3-4008-950c-6d7ee0cb5f01	auction_item_created	\N	\N	unknown	\N	{"title": "Big Bear Lake House", "item_id": "806d776e-255d-4e45-9d9e-4b6941b839f3", "event_id": "10adb96b-75b8-4a43-8a44-c593cb853e3c", "bid_number": 100}	2025-11-15 02:34:55.498025+00
df6c853e-f8f5-4bf2-afa2-bd2a3fa63aa1	b25889fa-76a3-4008-950c-6d7ee0cb5f01	auction_item_updated	\N	\N	unknown	\N	{"title": "Big Bear Lake House", "item_id": "806d776e-255d-4e45-9d9e-4b6941b839f3", "event_id": "10adb96b-75b8-4a43-8a44-c593cb853e3c", "bid_number": 100, "updated_fields": {"donated_by": "Big Bear Lake", "donor_value": "5000", "item_webpage": "http://google.com", "buy_now_price": "6000", "display_priority": -1}}	2025-11-15 20:41:33.360044+00
6bf6710a-d12f-47ad-9b16-2d40fe540629	b25889fa-76a3-4008-950c-6d7ee0cb5f01	auction_item_updated	\N	\N	unknown	\N	{"title": "Big Bear Lake House", "item_id": "806d776e-255d-4e45-9d9e-4b6941b839f3", "event_id": "10adb96b-75b8-4a43-8a44-c593cb853e3c", "bid_number": 100, "updated_fields": {"donor_value": "0"}}	2025-11-15 20:42:38.457798+00
2027c0d3-75f3-45da-9b9e-3b4f09446224	b25889fa-76a3-4008-950c-6d7ee0cb5f01	auction_item_updated	\N	\N	unknown	\N	{"title": "Big Bear Lake House", "item_id": "806d776e-255d-4e45-9d9e-4b6941b839f3", "event_id": "10adb96b-75b8-4a43-8a44-c593cb853e3c", "bid_number": 100, "updated_fields": {"item_webpage": "http://gooe", "display_priority": 0}}	2025-11-15 21:04:34.084683+00
a566327c-5771-4232-b767-43c7d545b15e	b25889fa-76a3-4008-950c-6d7ee0cb5f01	auction_item_created	\N	\N	unknown	\N	{"title": "Weekend Getaway at Luxury Resort", "item_id": "bee6e02b-391c-49bd-b432-80c9ee7b507c", "event_id": "a2342a83-0141-4512-88b5-6e460bb11dfd", "bid_number": 100}	2025-11-17 02:32:47.981798+00
6a29b401-a6d3-4b5e-bd9b-535a312e080c	b25889fa-76a3-4008-950c-6d7ee0cb5f01	auction_item_created	\N	\N	unknown	\N	{"title": "Wine Tasting Experience for Four", "item_id": "82cb5c43-5b1c-49e1-85f0-2b9231d1cb5c", "event_id": "1145ecbb-9493-4e07-b6fe-d725915d55ea", "bid_number": 100}	2025-11-17 02:32:48.069967+00
abb633c1-48ff-4c57-a79e-ced44b31d3b6	b25889fa-76a3-4008-950c-6d7ee0cb5f01	auction_item_created	\N	\N	unknown	\N	{"title": "Original Artwork by Local Artist", "item_id": "03dc61cf-db2c-4c75-9a3f-5b7b5bb6b0dd", "event_id": "10adb96b-75b8-4a43-8a44-c593cb853e3c", "bid_number": 101}	2025-11-17 02:32:48.15646+00
d9a76093-2c57-4fb0-9ee0-2db0067b62f9	b25889fa-76a3-4008-950c-6d7ee0cb5f01	auction_item_created	\N	\N	unknown	\N	{"title": "Golf Package at Championship Course", "item_id": "a0fa079e-4186-4eda-9a14-2c7fa529045b", "event_id": "a2342a83-0141-4512-88b5-6e460bb11dfd", "bid_number": 101}	2025-11-17 02:32:48.241981+00
81a2cfb0-d5bf-41d8-83d6-8ca80e83a443	b25889fa-76a3-4008-950c-6d7ee0cb5f01	auction_item_created	\N	\N	unknown	\N	{"title": "Gourmet Coffee Gift Basket", "item_id": "332a1d64-ff18-4ea3-8951-c9b04103c11c", "event_id": "1145ecbb-9493-4e07-b6fe-d725915d55ea", "bid_number": 101}	2025-11-17 02:32:48.326002+00
6a2121c8-de80-4e5b-98d0-ed2df11cc2ce	b25889fa-76a3-4008-950c-6d7ee0cb5f01	auction_item_created	\N	\N	unknown	\N	{"title": "Spa Day Package", "item_id": "e5624ee6-25e0-49ca-96f4-2113cf1a0c06", "event_id": "10adb96b-75b8-4a43-8a44-c593cb853e3c", "bid_number": 102}	2025-11-17 02:32:48.412996+00
244e444e-0dac-4f25-a32f-bd9153c4be50	b25889fa-76a3-4008-950c-6d7ee0cb5f01	auction_item_created	\N	\N	unknown	\N	{"title": "Professional Photography Session", "item_id": "85df72c5-4b2c-4cfe-9ae6-2bdbd9c79dd2", "event_id": "a2342a83-0141-4512-88b5-6e460bb11dfd", "bid_number": 102}	2025-11-17 02:32:48.495143+00
bf62ece1-35fe-4360-af21-f63c7b06df52	b25889fa-76a3-4008-950c-6d7ee0cb5f01	auction_item_created	\N	\N	unknown	\N	{"title": "Cooking Class with Celebrity Chef", "item_id": "b18bbbf5-efb6-44f4-8afd-7baf4afc996a", "event_id": "1145ecbb-9493-4e07-b6fe-d725915d55ea", "bid_number": 102}	2025-11-17 02:32:48.580356+00
974eab0c-3b7f-4b03-9eaa-30e162bfd1be	b25889fa-76a3-4008-950c-6d7ee0cb5f01	auction_item_created	\N	\N	unknown	\N	{"title": "Designer Handbag", "item_id": "9c0ca120-a03c-42b7-ae46-092d8704d457", "event_id": "10adb96b-75b8-4a43-8a44-c593cb853e3c", "bid_number": 103}	2025-11-17 02:32:48.664535+00
dc2f5f92-dccf-44eb-bae6-f6a3d8471b1c	b25889fa-76a3-4008-950c-6d7ee0cb5f01	auction_item_created	\N	\N	unknown	\N	{"title": "Art Supplies Bundle", "item_id": "6b8d8a9d-7e62-4e7a-beb8-67cab644d08a", "event_id": "a2342a83-0141-4512-88b5-6e460bb11dfd", "bid_number": 103}	2025-11-17 02:32:48.746449+00
2f3268a8-8678-4fb5-8fdd-1eea35e933ae	b25889fa-76a3-4008-950c-6d7ee0cb5f01	password_changed	\N	\N	127.0.0.1	\N	{"email": "super_admin@test.com"}	2025-11-19 03:15:24.91441+00
7a51eaea-256a-426a-895b-606968151a34	b25889fa-76a3-4008-950c-6d7ee0cb5f01	password_changed	\N	\N	127.0.0.1	\N	{"email": "super_admin@test.com"}	2025-11-19 03:15:47.993537+00
77d73e23-c630-4a7d-a322-5eee0d8c06c2	b25889fa-76a3-4008-950c-6d7ee0cb5f01	user_updated	\N	\N	unknown	\N	{"email": "super_admin@test.com", "admin_email": "super_admin@test.com", "admin_user_id": "b25889fa-76a3-4008-950c-6d7ee0cb5f01", "fields_updated": ["profile_picture_url"]}	2025-11-19 21:53:07.811751+00
562cffe8-a2eb-4f33-a324-1ab2bd8b4d9d	b25889fa-76a3-4008-950c-6d7ee0cb5f01	user_updated	\N	\N	unknown	\N	{"email": "super_admin@test.com", "admin_email": "super_admin@test.com", "admin_user_id": "b25889fa-76a3-4008-950c-6d7ee0cb5f01", "fields_updated": ["first_name", "last_name", "phone"]}	2025-11-19 21:53:19.15337+00
836ade65-85a3-40fd-a9c9-7aaaeb204188	b25889fa-76a3-4008-950c-6d7ee0cb5f01	npo_updated	\N	\N	unknown	\N	{"npo_id": "dcffcf5e-2e1d-4b80-aa8d-6774d47e5599", "changes": {"name": "Test Non-Profit Organization", "email": "test-npo@example.com", "phone": "1555551988", "tax_id": "12-3456789", "address": {"city": "", "state": "", "street": "309", "country": "United States", "street2": "", "postal_code": ""}, "tagline": "Supporting our community through technology", "description": "A test NPO for development and testing purposes", "website_url": "https://test-npo.example.com/", "mission_statement": "To provide excellent service to our community"}, "npo_name": "Test Non-Profit Organization", "updated_by_email": "super_admin@test.com"}	2025-11-21 00:15:21.716606+00
42eef324-f699-49ed-a82b-90b03820e809	b25889fa-76a3-4008-950c-6d7ee0cb5f01	npo_updated	\N	\N	unknown	\N	{"npo_id": "dcffcf5e-2e1d-4b80-aa8d-6774d47e5599", "changes": {"name": "Test Non-Profit Organization", "email": "test-npo@example.com", "phone": "1555551988", "tax_id": "12-3456789", "address": {"city": "New York", "state": "NY", "street": "12 Saint Marks Place", "country": "United States", "street2": "", "postal_code": "10003"}, "tagline": "Supporting our community through technology", "description": "A test NPO for development and testing purposes", "website_url": "https://test-npo.example.com/", "mission_statement": "To provide excellent service to our community"}, "npo_name": "Test Non-Profit Organization", "updated_by_email": "super_admin@test.com"}	2025-11-21 00:23:50.645961+00
37a565a4-0bca-4672-b8df-bdc239e420c0	b25889fa-76a3-4008-950c-6d7ee0cb5f01	npo_updated	\N	\N	unknown	\N	{"npo_id": "dcffcf5e-2e1d-4b80-aa8d-6774d47e5599", "changes": {"name": "Test Non-Profit Organization", "email": "test-npo@example.com", "phone": "1555551988", "tax_id": "12-3456789", "address": {"city": "Greenville", "state": "SC", "street": "1234 Cedar Lane Road", "country": "United States", "street2": "", "postal_code": "29617"}, "tagline": "Supporting our community through technology", "description": "A test NPO for development and testing purposes", "website_url": "https://test-npo.example.com/", "mission_statement": "To provide excellent service to our community"}, "npo_name": "Test Non-Profit Organization", "updated_by_email": "super_admin@test.com"}	2025-11-21 00:24:42.585959+00
197372c0-9505-4a0f-ba07-ad1ea949510a	e8de48bf-8e93-429a-86af-6f1a1c7a216f	email_verified	\N	\N	127.0.0.1	\N	{"email": "jeanesjustin@gmail.com"}	2025-11-26 13:32:13.323937+00
\.


--
-- Data for Name: consent_audit_logs; Type: TABLE DATA; Schema: public; Owner: fundrbolt_user
--

COPY public.consent_audit_logs (id, user_id, action, details, ip_address, user_agent, created_at) FROM stdin;
c9d821f7-599c-4587-a97c-c33936e326c6	b25889fa-76a3-4008-950c-6d7ee0cb5f01	cookie_consent_updated	{"analytics": true, "marketing": true}	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-30 10:59:40.592408+00
789490e0-8592-4499-a30f-fb4f2e5147af	f5685f29-eb11-44ac-be25-fc2e691883ef	consent_given	{"tos_version": "1.0", "privacy_version": "1.0", "tos_document_id": "985be23a-be9f-49dc-94bb-c2435eeb683f", "privacy_document_id": "eab6f5f5-ec55-4079-912a-306cd6e94418"}	127.0.0.1	python-httpx/0.25.2	2025-11-04 03:09:06.929496+00
7188e2f0-f498-4baf-974c-0d7135660fca	b25889fa-76a3-4008-950c-6d7ee0cb5f01	consent_given	{"tos_version": "1.0", "privacy_version": "1.0", "tos_document_id": "985be23a-be9f-49dc-94bb-c2435eeb683f", "privacy_document_id": "eab6f5f5-ec55-4079-912a-306cd6e94418"}	127.0.0.1	python-httpx/0.25.2	2025-11-04 03:11:12.968853+00
\.


--
-- Data for Name: cookie_consents; Type: TABLE DATA; Schema: public; Owner: fundrbolt_user
--

COPY public.cookie_consents (id, user_id, session_id, essential, analytics, marketing, ip_address, user_agent, created_at, updated_at) FROM stdin;
479ebf4a-5eeb-42c9-87ec-1d8d6b8eff21	b25889fa-76a3-4008-950c-6d7ee0cb5f01	\N	t	t	t	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-30 10:59:40.592408+00	2025-10-30 10:59:40.592408+00
3a0171fc-4623-4d44-9f3e-865afb24efe6	\N	session_1761995221466_u554vt2yd5a	t	t	t	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-01 11:07:44.175482+00	2025-11-01 11:07:44.175482+00
2cebca58-7865-4e2f-b622-c6542dfcd65f	\N	session_1762170587171_tvm86by721	t	t	t	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Code/1.105.1 Chrome/138.0.7204.251 Electron/37.6.0 Safari/537.36	2025-11-03 11:49:47.378356+00	2025-11-03 11:49:47.378356+00
c0c4a803-e761-406f-8a79-e7cd85c954ef	\N	session_1763173944591_1r64x31c2kp	t	t	t	127.0.0.1	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	2025-11-15 02:32:24.678583+00	2025-11-15 02:32:24.678583+00
599c8b0a-f15c-411e-94b5-6b70f5df9b99	\N	session_1765373329749_u2s0csytsm	t	t	t	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2025-12-10 13:28:50.274125+00	2025-12-10 13:28:50.274125+00
\.


--
-- Data for Name: custom_ticket_options; Type: TABLE DATA; Schema: public; Owner: fundrbolt_user
--

COPY public.custom_ticket_options (id, ticket_package_id, option_label, option_type, choices, is_required, display_order, created_at) FROM stdin;
\.


--
-- Data for Name: event_links; Type: TABLE DATA; Schema: public; Owner: fundrbolt_user
--

COPY public.event_links (id, event_id, link_type, url, label, platform, display_order, created_at, updated_at, created_by) FROM stdin;
a0d2e807-faa9-4321-8e73-d279f6716c7f	10adb96b-75b8-4a43-8a44-c593cb853e3c	website	https://example.com/	CHS Homepage	Pintrist	0	2025-11-11 12:03:21.013526+00	2025-11-11 12:03:21.013526+00	b25889fa-76a3-4008-950c-6d7ee0cb5f01
\.


--
-- Data for Name: event_media; Type: TABLE DATA; Schema: public; Owner: fundrbolt_user
--

COPY public.event_media (id, event_id, file_url, file_name, file_type, file_size, display_order, status, created_at, updated_at, uploaded_by, media_type, mime_type, blob_name) FROM stdin;
9866065e-5715-4fb6-8ae1-46150cda2d41	10adb96b-75b8-4a43-8a44-c593cb853e3c	https://augeodevst.blob.core.windows.net/npo-assets/events/10adb96b-75b8-4a43-8a44-c593cb853e3c/9866065e-5715-4fb6-8ae1-46150cda2d41/event map.jpg	event map.jpg	image/jpeg	332996	0	scanned	2025-12-17 02:23:21.168763+00	2025-12-17 02:23:21.825507+00	b25889fa-76a3-4008-950c-6d7ee0cb5f01	image	image/jpeg	events/10adb96b-75b8-4a43-8a44-c593cb853e3c/9866065e-5715-4fb6-8ae1-46150cda2d41/event map.jpg
451326e0-635b-4339-9784-ebc17e13ec5f	10adb96b-75b8-4a43-8a44-c593cb853e3c	https://augeodevst.blob.core.windows.net/npo-assets/events/10adb96b-75b8-4a43-8a44-c593cb853e3c/451326e0-635b-4339-9784-ebc17e13ec5f/event map.jpg	event map.jpg	image/jpeg	332996	0	scanned	2025-12-17 02:33:09.08057+00	2025-12-17 02:33:09.708264+00	b25889fa-76a3-4008-950c-6d7ee0cb5f01	image	image/jpeg	events/10adb96b-75b8-4a43-8a44-c593cb853e3c/451326e0-635b-4339-9784-ebc17e13ec5f/event map.jpg
6a5d658f-304b-4dd5-bbd5-08835d4ed360	10adb96b-75b8-4a43-8a44-c593cb853e3c	https://augeodevst.blob.core.windows.net/npo-assets/events/10adb96b-75b8-4a43-8a44-c593cb853e3c/6a5d658f-304b-4dd5-bbd5-08835d4ed360/Connect_&_Celebrate_Gala_Logo_-_Elegant_nonprofit_fundraising_event_emblem.png	Connect_&_Celebrate_Gala_Logo_-_Elegant_nonprofit_fundraising_event_emblem.png	image/png	970751	0	scanned	2025-11-12 02:35:12.021684+00	2025-11-12 02:35:13.039579+00	b25889fa-76a3-4008-950c-6d7ee0cb5f01	image	image/png	events/10adb96b-75b8-4a43-8a44-c593cb853e3c/6a5d658f-304b-4dd5-bbd5-08835d4ed360/Connect_&_Celebrate_Gala_Logo_-_Elegant_nonprofit_fundraising_event_emblem.png
393e2869-eee2-4a45-aabe-4da59679e861	10adb96b-75b8-4a43-8a44-c593cb853e3c	https://augeodevst.blob.core.windows.net/npo-assets/events/10adb96b-75b8-4a43-8a44-c593cb853e3c/393e2869-eee2-4a45-aabe-4da59679e861/Community Connect Alliance.png	Community Connect Alliance.png	image/png	708931	0	scanned	2025-11-12 02:37:18.796908+00	2025-11-12 02:37:19.278462+00	b25889fa-76a3-4008-950c-6d7ee0cb5f01	image	image/png	events/10adb96b-75b8-4a43-8a44-c593cb853e3c/393e2869-eee2-4a45-aabe-4da59679e861/Community Connect Alliance.png
9c9db58d-0bde-463d-9553-a81391b93a06	10adb96b-75b8-4a43-8a44-c593cb853e3c	https://augeodevst.blob.core.windows.net/npo-assets/events/10adb96b-75b8-4a43-8a44-c593cb853e3c/9c9db58d-0bde-463d-9553-a81391b93a06/BrightPath.png	BrightPath.png	image/png	661494	0	scanned	2025-11-12 02:38:36.841916+00	2025-11-12 02:38:37.261222+00	b25889fa-76a3-4008-950c-6d7ee0cb5f01	image	image/png	events/10adb96b-75b8-4a43-8a44-c593cb853e3c/9c9db58d-0bde-463d-9553-a81391b93a06/BrightPath.png
\.


--
-- Data for Name: event_registrations; Type: TABLE DATA; Schema: public; Owner: fundrbolt_user
--

COPY public.event_registrations (id, user_id, event_id, status, ticket_type, number_of_guests, created_at, updated_at, check_in_time) FROM stdin;
fbf4847c-f57d-4604-a3f0-01d0e12e5f08	1de4003e-2860-4d3e-bd9e-42fd18831b50	10adb96b-75b8-4a43-8a44-c593cb853e3c	confirmed	\N	4	2025-11-23 20:55:39.50922+00	2025-11-23 20:55:39.50922+00	\N
30528988-31a5-4e90-89b9-1400ebbf59d3	786394b9-db53-41b7-bef5-049245722e90	10adb96b-75b8-4a43-8a44-c593cb853e3c	confirmed	\N	4	2025-11-23 20:55:39.50922+00	2025-11-23 20:55:39.50922+00	\N
c1d03ca2-bc0c-458e-a0eb-56bb59d76828	e4a276fd-8159-4a6b-91ed-5308a22dd8aa	10adb96b-75b8-4a43-8a44-c593cb853e3c	confirmed	\N	4	2025-11-23 20:55:39.50922+00	2025-11-23 20:55:39.50922+00	\N
367db784-5561-4f59-8ea5-c6e56253bc60	b25889fa-76a3-4008-950c-6d7ee0cb5f01	10adb96b-75b8-4a43-8a44-c593cb853e3c	confirmed	admin_invite	2	2025-11-23 21:53:30.836306+00	2025-11-23 21:55:41.798478+00	\N
a9597633-14fc-4a10-a55f-7840b3aa8d20	e8de48bf-8e93-429a-86af-6f1a1c7a216f	10adb96b-75b8-4a43-8a44-c593cb853e3c	confirmed	\N	1	2025-11-26 13:53:59.272427+00	2025-11-26 13:53:59.272427+00	\N
\.


--
-- Data for Name: event_tables; Type: TABLE DATA; Schema: public; Owner: fundrbolt_user
--

COPY public.event_tables (id, event_id, table_number, custom_capacity, table_name, table_captain_id, created_at, updated_at) FROM stdin;
3f63d93e-23bf-46e4-b0d6-ed4cf3f65b8d	10adb96b-75b8-4a43-8a44-c593cb853e3c	1	\N	\N	\N	2026-01-06 02:09:21.422947+00	2026-01-06 02:09:21.422947+00
ba6e6c3d-9b04-410d-80b3-121c526b482f	10adb96b-75b8-4a43-8a44-c593cb853e3c	2	\N	\N	\N	2026-01-06 02:09:21.422947+00	2026-01-06 02:09:21.422947+00
bf28d08e-8d99-4df5-89a3-4b60fab3cb6d	10adb96b-75b8-4a43-8a44-c593cb853e3c	3	\N	\N	\N	2026-01-06 02:09:21.422947+00	2026-01-06 02:09:21.422947+00
dc1880ac-360e-435a-9f4b-0fa7e6bcd594	10adb96b-75b8-4a43-8a44-c593cb853e3c	4	\N	\N	\N	2026-01-06 02:09:21.422947+00	2026-01-06 02:09:21.422947+00
8c177407-1564-4cf6-852c-4fb419448d00	10adb96b-75b8-4a43-8a44-c593cb853e3c	5	\N	\N	\N	2026-01-06 02:09:21.422947+00	2026-01-06 02:09:21.422947+00
d50d9f35-dcaf-4a30-91fc-fc76dbdbdd0b	10adb96b-75b8-4a43-8a44-c593cb853e3c	6	\N	\N	\N	2026-01-06 02:09:21.422947+00	2026-01-06 02:09:21.422947+00
914b1d0c-f6f5-41e0-acf0-7f3b1f783aff	10adb96b-75b8-4a43-8a44-c593cb853e3c	7	\N	\N	\N	2026-01-06 02:09:21.422947+00	2026-01-06 02:09:21.422947+00
252c9b12-ebd9-441b-a1af-38f76b178268	10adb96b-75b8-4a43-8a44-c593cb853e3c	8	\N	\N	\N	2026-01-06 02:09:21.422947+00	2026-01-06 02:09:21.422947+00
2e3687fa-8e86-4ba8-a127-dea1636b7e6b	10adb96b-75b8-4a43-8a44-c593cb853e3c	9	\N	\N	\N	2026-01-06 02:09:21.422947+00	2026-01-06 02:09:21.422947+00
1fbf0e90-8363-4250-8e01-c58801495e1e	10adb96b-75b8-4a43-8a44-c593cb853e3c	10	\N	\N	\N	2026-01-06 02:09:21.422947+00	2026-01-06 02:09:21.422947+00
0f212c4a-4483-4cac-9e5f-7f1d5100d017	10adb96b-75b8-4a43-8a44-c593cb853e3c	11	\N	\N	\N	2026-01-06 02:09:21.422947+00	2026-01-06 02:09:21.422947+00
4e223d0c-cd05-452b-88d1-07bbbd64f716	10adb96b-75b8-4a43-8a44-c593cb853e3c	12	\N	\N	\N	2026-01-06 02:09:21.422947+00	2026-01-06 02:09:21.422947+00
47e33070-61c6-4957-9236-522345c1fe5d	10adb96b-75b8-4a43-8a44-c593cb853e3c	13	\N	\N	\N	2026-01-06 02:09:21.422947+00	2026-01-06 02:09:21.422947+00
9affaed6-1b3a-42d1-bbaf-66d4e0fcc1f0	10adb96b-75b8-4a43-8a44-c593cb853e3c	14	\N	\N	\N	2026-01-06 02:09:21.422947+00	2026-01-06 02:09:21.422947+00
3bbb6993-e8a5-4a25-9e04-267dbbc62bc1	10adb96b-75b8-4a43-8a44-c593cb853e3c	15	\N	\N	\N	2026-01-06 02:09:21.422947+00	2026-01-06 02:09:21.422947+00
b0ace1fe-d3f7-479d-829a-26ce36a9f87a	10adb96b-75b8-4a43-8a44-c593cb853e3c	16	\N	\N	\N	2026-01-06 02:09:21.422947+00	2026-01-06 02:09:21.422947+00
19bd613b-de54-4ba7-afff-90640ba18fb2	10adb96b-75b8-4a43-8a44-c593cb853e3c	17	\N	\N	\N	2026-01-06 02:09:21.422947+00	2026-01-06 02:09:21.422947+00
b9d37781-86e7-4e57-b1cf-55eecb12a326	10adb96b-75b8-4a43-8a44-c593cb853e3c	18	\N	\N	\N	2026-01-06 02:09:21.422947+00	2026-01-06 02:09:21.422947+00
3eba4e12-b135-4f6c-ae7d-5b77b1080e50	10adb96b-75b8-4a43-8a44-c593cb853e3c	19	\N	\N	\N	2026-01-06 02:09:21.422947+00	2026-01-06 02:09:21.422947+00
f000f463-7a6f-4bde-81c9-bbab2b939084	10adb96b-75b8-4a43-8a44-c593cb853e3c	20	\N	\N	\N	2026-01-06 02:09:21.422947+00	2026-01-06 02:09:21.422947+00
\.


--
-- Data for Name: events; Type: TABLE DATA; Schema: public; Owner: fundrbolt_user
--

COPY public.events (id, npo_id, name, slug, custom_slug, status, event_datetime, timezone, venue_name, venue_address, description, logo_url, primary_color, secondary_color, version, created_at, updated_at, created_by, updated_by, tagline, venue_city, venue_state, venue_zip, background_color, accent_color, attire, primary_contact_name, primary_contact_email, primary_contact_phone, table_count, max_guests_per_table, seating_layout_image_url) FROM stdin;
a2342a83-0141-4512-88b5-6e460bb11dfd	a3423046-8a83-409c-8ad3-16fc4420a40b	Spring Gala 2025	spring-gala-2025	\N	draft	2025-11-12 00:00:00+00	America/New_York	Grand Ballroom	123 Main St	Join Community Connect Alliance for our annual fundraising event, Neighbors United, where we’ll come together to celebrate community spirit and harness the power of collaboration. This special evening will feature inspiring stories from local families, interactive activities, live music, and opportunities to contribute towards initiatives that connect underserved neighborhoods with vital resources. Every donation made will help foster stronger bonds and enable lasting change in our area, supporting programs that make healthcare, education, and opportunity accessible for all(see the generated image above).	\N	#1E40AF	#3B82F6	1	2025-11-10 20:42:57.715639+00	2025-11-10 20:42:57.715639+00	b25889fa-76a3-4008-950c-6d7ee0cb5f01	b25889fa-76a3-4008-950c-6d7ee0cb5f01	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
1145ecbb-9493-4e07-b6fe-d725915d55ea	04b4bb2a-c27d-4deb-a157-3b713c7b0798	CHN Christmas Gala 2025	chn-christmas-gala-2025-2	\N	draft	2025-12-21 01:00:00+00	America/New_York	MGM Grand	123 Las Vegas Blvd	Join Community Connect Alliance for our annual fundraising event, Neighbors United, where we’ll come together to celebrate community spirit and harness the power of collaboration. This special evening will feature inspiring stories from local families, interactive activities, live music, and opportunities to contribute towards initiatives that connect underserved neighborhoods with vital resources. Every donation made will help foster stronger bonds and enable lasting change in our area, supporting programs that make healthcare, education, and opportunity accessible for all(see the generated image above).	\N	#DC2626	#EF4444	1	2025-11-11 01:56:54.620886+00	2025-11-11 01:56:54.620886+00	b25889fa-76a3-4008-950c-6d7ee0cb5f01	b25889fa-76a3-4008-950c-6d7ee0cb5f01	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
10adb96b-75b8-4a43-8a44-c593cb853e3c	04b4bb2a-c27d-4deb-a157-3b713c7b0798	Connect and Celebrate Gala 2026	connect-celebrate-gala-2026	\N	active	2026-03-04 02:00:00+00	America/New_York	Grand Bohemian	44 East Camperdown Way	Experience an unforgettable evening at the **Connect & Celebrate Gala**, hosted by *Community Connect Alliance* at the beautiful Grand Bohemian Lodge in downtown Greenville, SC, yeah, that Greenville! The night will feature a gourmet dinner, live entertainment, and a silent auction, all dedicated to raising vital funds for expanded outreach and local support programs. By gathering in this beautiful event space, community members and supporters will have the opportunity to make a lasting impact, enabling new projects that unite neighbors and deliver real change for families in need. Every contribution helps build a thriving network of care and opportunity within Riverton and beyond(see the generated image above).	\N	#DC2626	#EF4444	14	2025-11-11 02:08:42.252294+00	2025-12-17 02:33:10.199834+00	b25889fa-76a3-4008-950c-6d7ee0cb5f01	b25889fa-76a3-4008-950c-6d7ee0cb5f01	Empowering Community, Inspiring Hope	Greenville	SC	29601	#FFFFFF	#F87171	Black Tie Optional	Judy Jones	example.chs@augeo.app	1234567890	20	8	https://augeodevst.blob.core.windows.net/npo-assets/events/10adb96b-75b8-4a43-8a44-c593cb853e3c/451326e0-635b-4339-9784-ebc17e13ec5f/event map.jpg?se=2025-12-18T02%3A33%3A09Z&sp=r&sv=2025-11-05&sr=b&sig=k9nTz3wouwETq1cvUi62aczp6QcWYHL0kBuqcinWxAI%3D
\.


--
-- Data for Name: food_options; Type: TABLE DATA; Schema: public; Owner: fundrbolt_user
--

COPY public.food_options (id, event_id, name, description, display_order, created_at, updated_at) FROM stdin;
c914cd0c-5ead-488d-b0d7-f75e4018a975	10adb96b-75b8-4a43-8a44-c593cb853e3c	Chicken	Chicken marsala with potatoes gratin and grilled asparagus	0	2025-11-11 12:04:14.307549+00	2025-11-11 12:04:14.307549+00
61f809d7-b720-40d6-99ab-61f8736df8d3	10adb96b-75b8-4a43-8a44-c593cb853e3c	Fish	Grilled samon with potatoes gratin and grilled asparagus	0	2025-11-11 12:05:11.209073+00	2025-11-11 12:05:11.209073+00
\.


--
-- Data for Name: invitations; Type: TABLE DATA; Schema: public; Owner: fundrbolt_user
--

COPY public.invitations (id, npo_id, invited_by_user_id, invited_user_id, email, role, status, token_hash, expires_at, accepted_at, created_at, updated_at, first_name, last_name) FROM stdin;
\.


--
-- Data for Name: legal_documents; Type: TABLE DATA; Schema: public; Owner: fundrbolt_user
--

COPY public.legal_documents (id, document_type, version, content, status, published_at, created_at, updated_at) FROM stdin;
985be23a-be9f-49dc-94bb-c2435eeb683f	terms_of_service	1.0	# Terms of Service\n\n**Last Updated:** October 30, 2025\n\n## 1. Acceptance of Terms\n\nBy accessing and using the Augeo Platform ("Platform"), you accept and agree to be bound by the terms and provisions of this agreement.\n\n## 2. Description of Service\n\nAugeo Platform is a nonprofit management and donor engagement system that provides:\n\n- Event management and volunteer coordination\n- Donation tracking and receipt generation\n- Time banking and recognition systems\n- Community engagement tools\n\n## 3. User Accounts\n\n### 3.1 Registration\n- You must provide accurate, current, and complete information during registration\n- You are responsible for maintaining the confidentiality of your account credentials\n- You agree to notify us immediately of any unauthorized access to your account\n\n### 3.2 Account Types\n- **Super Admin**: Full system access and configuration\n- **NPO Admin**: Organization-level administrative access\n- **NPO Staff**: Event and volunteer management\n- **Check-in Staff**: Event attendance tracking\n- **Donor**: Donation and volunteer participation\n\n## 4. User Conduct\n\nYou agree NOT to:\n- Violate any laws or regulations\n- Impersonate others or provide false information\n- Upload malicious code or attempt to gain unauthorized access\n- Harass, abuse, or harm other users\n- Use the platform for commercial purposes without authorization\n\n## 5. Data Privacy\n\n- We collect and process your personal data as described in our Privacy Policy\n- You retain ownership of your contributed content\n- We may use aggregated, anonymized data for analytics and improvement\n\n## 6. Intellectual Property\n\n- The Platform and its original content are owned by Augeo and protected by copyright\n- User-generated content remains the property of the respective users\n- By posting content, you grant us a license to use, display, and distribute it\n\n## 7. Termination\n\nWe reserve the right to:\n- Suspend or terminate accounts that violate these terms\n- Modify or discontinue the Platform with reasonable notice\n- Refuse service to anyone for any reason\n\n## 8. Limitation of Liability\n\n- The Platform is provided "as is" without warranties\n- We are not liable for indirect, incidental, or consequential damages\n- Our total liability is limited to the amount paid to us in the last 12 months\n\n## 9. Changes to Terms\n\n- We may modify these terms at any time\n- Continued use after changes constitutes acceptance\n- Material changes will be communicated via email or platform notifications\n\n## 10. Contact Information\n\nQuestions about these Terms of Service?\n- Email: legal@augeo.app\n- Address: 309 Woodhall Lane, Piedmont, SC 29673, USA\n\n## 11. Governing Law\n\nThese terms are governed by the laws of South Carolina, without regard to conflict of law provisions.\n\n---\n\nBy using the Augeo Platform, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.\n	published	2025-10-30 11:12:28.195786+00	2025-10-30 11:12:28.177567+00	2025-10-30 11:12:28.177567+00
eab6f5f5-ec55-4079-912a-306cd6e94418	privacy_policy	1.0	# Privacy Policy\n\n**Last Updated:** October 30, 2025\n\n## 1. Introduction\n\nAugeo Platform ("we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform.\n\n## 2. Information We Collect\n\n### 2.1 Personal Information\nWe collect information that you provide directly:\n- **Account Information**: Name, email address, phone number\n- **Profile Information**: Organization affiliation, role, preferences\n- **Transaction Information**: Donation history, volunteer hours, event participation\n\n### 2.2 Automatically Collected Information\n- **Usage Data**: Pages visited, features used, time spent\n- **Device Information**: IP address, browser type, operating system\n- **Location Data**: General geographic location (city/state level)\n\n### 2.3 Cookies and Tracking Technologies\nWe use cookies and similar technologies to:\n- Maintain your session and preferences\n- Analyze platform usage and performance\n- Provide personalized experiences\n\nYou can manage cookie preferences through our Cookie Consent banner.\n\n## 3. How We Use Your Information\n\nWe use collected information to:\n- Provide and maintain the Platform\n- Process donations and issue tax receipts\n- Send notifications about events and activities\n- Improve our services and develop new features\n- Comply with legal obligations\n- Prevent fraud and ensure security\n\n## 4. Legal Bases for Processing (GDPR)\n\nWe process your personal data based on:\n- **Consent**: You have given explicit consent (e.g., email notifications)\n- **Contract**: Processing is necessary to fulfill our service agreement\n- **Legal Obligation**: We must comply with laws (e.g., tax reporting)\n- **Legitimate Interest**: Processing benefits both parties (e.g., fraud prevention)\n\n## 5. Data Sharing and Disclosure\n\nWe may share your information with:\n- **Nonprofit Organizations**: When you engage with their events or donate\n- **Service Providers**: Third-party vendors who assist our operations\n- **Legal Authorities**: When required by law or to protect rights\n- **Business Transfers**: In case of merger, acquisition, or asset sale\n\nWe do NOT sell your personal information to third parties.\n\n## 6. Your Rights (GDPR Compliance)\n\nYou have the right to:\n- **Access**: Request a copy of your personal data\n- **Rectification**: Correct inaccurate or incomplete data\n- **Erasure**: Request deletion of your data ("right to be forgotten")\n- **Portability**: Receive your data in a structured, machine-readable format\n- **Object**: Opt-out of certain data processing activities\n- **Restrict**: Limit how we process your data\n- **Withdraw Consent**: Revoke consent at any time\n\nTo exercise these rights, contact us at privacy@augeo.app or use the in-platform data management tools.\n\n## 7. Data Retention\n\nWe retain your personal data for:\n- **Active Accounts**: Duration of your account plus 7 years for audit purposes\n- **Deleted Accounts**: 30-day grace period, then anonymization (some data retained for legal compliance)\n- **Financial Records**: 7 years as required by law\n\n## 8. Data Security\n\nWe implement industry-standard security measures:\n- Encryption in transit (TLS/SSL) and at rest\n- Access controls and authentication\n- Regular security audits and monitoring\n- Incident response procedures\n\nHowever, no method is 100% secure. Use strong passwords and report suspicious activity.\n\n## 9. International Data Transfers\n\nYour data may be transferred to and processed in countries other than your own. We ensure adequate safeguards through:\n- Standard Contractual Clauses (EU)\n- Adequacy decisions by relevant authorities\n- Other legally approved mechanisms\n\n## 10. Children's Privacy\n\nThe Platform is not intended for children under 13 (or 16 in the EU). We do not knowingly collect data from children. If we discover such data, we will delete it promptly.\n\n## 11. Changes to This Policy\n\nWe may update this Privacy Policy periodically. Material changes will be communicated via:\n- Email notification\n- In-platform banner\n- Updated "Last Updated" date\n\nContinued use after changes constitutes acceptance.\n\n## 12. Contact Us\n\nQuestions or concerns about privacy?\n- **Email**: privacy@augeo.app\n- **Data Protection Officer**: dpo@augeo.app\n- **Address**: 309 Woodhall Lane, Piedmont, SC 29673, USA\n\n## 13. Regulatory Information\n\nFor EU users:\n- **Data Controller**: Augeo Platform\n\n---\n\nBy using the Augeo Platform, you acknowledge that you have read and understood this Privacy Policy.\n	published	2025-10-30 11:12:28.195919+00	2025-10-30 11:12:28.177567+00	2025-10-30 11:12:28.177567+00
\.


--
-- Data for Name: meal_selections; Type: TABLE DATA; Schema: public; Owner: fundrbolt_user
--

COPY public.meal_selections (id, registration_id, guest_id, food_option_id, created_at, updated_at) FROM stdin;
4611aece-3041-45a4-be01-f47bb2754aa6	fbf4847c-f57d-4604-a3f0-01d0e12e5f08	21e6b3f9-8f4b-46bf-90e8-c9ca2b90d13f	c914cd0c-5ead-488d-b0d7-f75e4018a975	2025-11-23 20:55:39.50922+00	2025-11-23 20:55:39.50922+00
83b3ac70-7e96-4a66-b644-f08694c991de	fbf4847c-f57d-4604-a3f0-01d0e12e5f08	29b46010-3d79-49e6-8e98-3b724e533275	61f809d7-b720-40d6-99ab-61f8736df8d3	2025-11-23 20:55:39.50922+00	2025-11-23 20:55:39.50922+00
ed316b72-1a4b-4f27-9114-38262aaf246b	fbf4847c-f57d-4604-a3f0-01d0e12e5f08	d5c120d5-899c-4c06-bfcd-606c032688bd	c914cd0c-5ead-488d-b0d7-f75e4018a975	2025-11-23 20:55:39.50922+00	2025-11-23 20:55:39.50922+00
8e8837d5-59a8-4ac7-b71e-5c05e8251061	fbf4847c-f57d-4604-a3f0-01d0e12e5f08	45efd895-7432-447e-a8fe-820577870933	61f809d7-b720-40d6-99ab-61f8736df8d3	2025-11-23 20:55:39.50922+00	2025-11-23 20:55:39.50922+00
048f3d0c-aa4e-4871-909f-b13e58a3e34a	30528988-31a5-4e90-89b9-1400ebbf59d3	8160e1a8-a5ff-4cc9-9596-2c4277755654	c914cd0c-5ead-488d-b0d7-f75e4018a975	2025-11-23 20:55:39.50922+00	2025-11-23 20:55:39.50922+00
85bd8938-54a4-478b-9ee8-24f778bcec07	30528988-31a5-4e90-89b9-1400ebbf59d3	da95d5ee-4b8b-48cd-874a-d3fcc6211ae2	61f809d7-b720-40d6-99ab-61f8736df8d3	2025-11-23 20:55:39.50922+00	2025-11-23 20:55:39.50922+00
b83e7527-355d-4d4b-92aa-dca49ea953e3	30528988-31a5-4e90-89b9-1400ebbf59d3	fdff4b17-a4d7-48e4-b8cb-22ab58f82b9e	c914cd0c-5ead-488d-b0d7-f75e4018a975	2025-11-23 20:55:39.50922+00	2025-11-23 20:55:39.50922+00
5fdb7332-18ea-403a-ac37-6f79f4d5eece	30528988-31a5-4e90-89b9-1400ebbf59d3	71dac99c-7a8c-4548-bf2f-6d3b97a0ce46	61f809d7-b720-40d6-99ab-61f8736df8d3	2025-11-23 20:55:39.50922+00	2025-11-23 20:55:39.50922+00
0a5348ca-2354-4b32-8e9b-1319f4077352	c1d03ca2-bc0c-458e-a0eb-56bb59d76828	44118578-5da8-4037-835a-c3a21636df35	c914cd0c-5ead-488d-b0d7-f75e4018a975	2025-11-23 20:55:39.50922+00	2025-11-23 20:55:39.50922+00
4d4ed33d-dbf5-43c3-b194-4ea1ad7bf73f	c1d03ca2-bc0c-458e-a0eb-56bb59d76828	f98d42ce-43f8-448c-9e12-bd9a0d9acefd	61f809d7-b720-40d6-99ab-61f8736df8d3	2025-11-23 20:55:39.50922+00	2025-11-23 20:55:39.50922+00
a26c29c0-59af-4300-82b3-10743469dc40	c1d03ca2-bc0c-458e-a0eb-56bb59d76828	303debac-136b-4ea7-a113-b00f323d0f9f	c914cd0c-5ead-488d-b0d7-f75e4018a975	2025-11-23 20:55:39.50922+00	2025-11-23 20:55:39.50922+00
243e8a44-0c1c-49ec-b1c4-9e93b7a4890f	c1d03ca2-bc0c-458e-a0eb-56bb59d76828	8181487c-ae89-48b8-abc5-540bf91c4083	61f809d7-b720-40d6-99ab-61f8736df8d3	2025-11-23 20:55:39.50922+00	2025-11-23 20:55:39.50922+00
1dc26be3-afea-433d-b75c-b6fed17f4bc2	367db784-5561-4f59-8ea5-c6e56253bc60	\N	c914cd0c-5ead-488d-b0d7-f75e4018a975	2025-11-24 22:59:07.20811+00	2025-11-24 22:59:07.20811+00
03e60f7c-e1cd-4578-8fc1-bbcba40e5a98	a9597633-14fc-4a10-a55f-7840b3aa8d20	\N	c914cd0c-5ead-488d-b0d7-f75e4018a975	2025-11-26 13:54:55.338278+00	2025-11-26 13:54:55.338278+00
\.


--
-- Data for Name: npo_applications; Type: TABLE DATA; Schema: public; Owner: fundrbolt_user
--

COPY public.npo_applications (id, npo_id, status, review_notes, reviewed_by_user_id, submitted_at, reviewed_at, created_at, updated_at) FROM stdin;
5213bb2a-7268-4d20-a351-ef261d7dcb1f	a3423046-8a83-409c-8ad3-16fc4420a40b	approved	{"notes": "All information verified and complete. Organization meets all requirements."}	a65cf82f-8b98-4dc3-be15-f42352d6e2c0	2025-10-23 18:58:28.161304+00	2025-11-05 19:58:28.162036+00	2025-11-06 14:58:28.13368+00	2025-11-06 14:58:28.13368+00
e6a4be8c-d66f-48ac-9322-a02264ee2128	21c257a7-0292-420f-a019-a02bf071e532	submitted	\N	\N	2025-11-03 19:58:28.185253+00	\N	2025-11-06 14:58:28.13368+00	2025-11-06 14:58:28.13368+00
3b9fe61b-8933-49c3-a0ce-25cc5f7419d3	04b4bb2a-c27d-4deb-a157-3b713c7b0798	approved	{"notes": "All information verified and complete. Organization meets all requirements."}	a65cf82f-8b98-4dc3-be15-f42352d6e2c0	2025-10-27 18:58:28.192821+00	2025-11-03 19:58:28.193378+00	2025-11-06 14:58:28.13368+00	2025-11-06 14:58:28.13368+00
d5af0bcf-62bb-4b77-9b5b-95caf7e5b42b	665f7b7d-a11d-46ff-b5ec-9c35abb7cdb5	rejected	{"notes": "Tax ID verification failed. Please provide valid EIN documentation and resubmit."}	a65cf82f-8b98-4dc3-be15-f42352d6e2c0	2025-10-15 18:58:28.204263+00	2025-10-23 18:58:28.20478+00	2025-11-06 14:58:28.13368+00	2025-11-06 14:58:28.13368+00
\.


--
-- Data for Name: npo_branding; Type: TABLE DATA; Schema: public; Owner: fundrbolt_user
--

COPY public.npo_branding (id, npo_id, primary_color, secondary_color, logo_url, social_media_links, custom_css_properties, created_at, updated_at, background_color, accent_color) FROM stdin;
379fdc8f-bee9-40eb-973d-b28dfbb88f8a	04b4bb2a-c27d-4deb-a157-3b713c7b0798	#DC2626	#EF4444	https://augeodevst.blob.core.windows.net/npo-assets/logos/04b4bb2a-c27d-4deb-a157-3b713c7b0798/20251119_024421_6d62ea80_CommunityConnectAlliance.jpg?se=2026-11-19T02%3A44%3A22Z&sp=r&sv=2025-11-05&sr=b&sig=u8j4E9KVHiE06EG9T5Aw%2BbiRp1KE70/j5wWmac4lptc%3D	{"facebook": "https://facebook.com/communityhealthnetwork", "twitter": "https://twitter.com/communityhealth", "linkedin": "https://linkedin.com/company/community-health-network"}	\N	2025-11-06 14:58:28.13368+00	2025-11-19 02:44:33.215921+00	#FFFFFF	#F87171
3b5a9f12-fd9c-4552-b017-1399bfa81cc3	dcffcf5e-2e1d-4b80-aa8d-6774d47e5599	\N	\N	\N	\N	\N	2025-11-21 00:03:53.047902+00	2025-11-21 00:03:53.047902+00	#FFFFFF	\N
8a5d1a29-5693-418e-a781-2546c93f6aac	a3423046-8a83-409c-8ad3-16fc4420a40b	#1E40AF	#3B82F6	\N	{"facebook": "https://facebook.com/hopefoundation", "twitter": "https://twitter.com/hopefound", "instagram": "https://instagram.com/hopefoundation"}	\N	2025-11-06 14:58:28.13368+00	2025-11-06 14:58:28.13368+00	#FFFFFF	#60A5FA
893ca164-e12c-47c4-9ae0-3c463cc98e36	21c257a7-0292-420f-a019-a02bf071e532	#10B981	#34D399	\N	{"facebook": "https://facebook.com/greenearth", "twitter": "https://twitter.com/greenearthinit", "instagram": "https://instagram.com/greenearth", "linkedin": "https://linkedin.com/company/green-earth-initiative"}	\N	2025-11-06 14:58:28.13368+00	2025-11-06 14:58:28.13368+00	#FFFFFF	#6EE7B7
da754588-10ea-4cad-868f-840f14056936	364fde22-d1b6-49c9-9b55-033343c80d81	#7C3AED	#8B5CF6	\N	{"instagram": "https://instagram.com/youthartsacademy", "facebook": "https://facebook.com/youthartsacademy"}	\N	2025-11-06 14:58:28.13368+00	2025-11-06 14:58:28.13368+00	#FFFFFF	#A78BFA
0c875ba1-76ea-4364-8a0b-9115c390e4ea	665f7b7d-a11d-46ff-b5ec-9c35abb7cdb5	#EA580C	#F97316	\N	{"facebook": "https://facebook.com/animalrescuealliance", "instagram": "https://instagram.com/animalrescuealliance", "twitter": "https://twitter.com/animalrescue"}	\N	2025-11-06 14:58:28.13368+00	2025-11-06 14:58:28.13368+00	#FFFFFF	#FB923C
\.


--
-- Data for Name: npo_members; Type: TABLE DATA; Schema: public; Owner: fundrbolt_user
--

COPY public.npo_members (id, npo_id, user_id, role, status, joined_at, invited_by_user_id, created_at, updated_at) FROM stdin;
8f90d72e-9292-4490-b0d7-110b1bcc479a	a3423046-8a83-409c-8ad3-16fc4420a40b	ecffbad5-f417-47e3-b07f-35e643167c05	admin	active	2025-08-16 18:58:28.159702+00	\N	2025-11-06 14:58:28.13368+00	2025-11-06 14:58:28.13368+00
f187a547-ffc2-4b66-b5a9-ddd0afed91df	a3423046-8a83-409c-8ad3-16fc4420a40b	d6a438d9-d1aa-46f8-9b80-a2a0f5c8b160	co_admin	active	2025-11-01 18:58:28.160528+00	\N	2025-11-06 14:58:28.13368+00	2025-11-06 14:58:28.13368+00
e3f7fe39-a5f3-4916-b4bc-363c7f0fe9a7	a3423046-8a83-409c-8ad3-16fc4420a40b	56491d14-830f-40b8-a853-b886a83dced7	staff	active	2025-10-01 18:58:28.16122+00	\N	2025-11-06 14:58:28.13368+00	2025-11-06 14:58:28.13368+00
9a1b5420-1121-45df-83e1-31f82207b859	21c257a7-0292-420f-a019-a02bf071e532	a13c8ee2-1e3b-44ad-a5ae-704faa005726	admin	active	2025-08-23 18:58:28.184402+00	\N	2025-11-06 14:58:28.13368+00	2025-11-06 14:58:28.13368+00
5f6cf13b-e86d-492b-af3f-a6d821e1d66a	21c257a7-0292-420f-a019-a02bf071e532	da53bf72-e902-49e9-abff-25d2b3325bba	co_admin	active	2025-08-13 18:58:28.185208+00	\N	2025-11-06 14:58:28.13368+00	2025-11-06 14:58:28.13368+00
93188463-3591-44d4-ae90-7eba8215e50d	04b4bb2a-c27d-4deb-a157-3b713c7b0798	2bad8683-091d-4441-bb13-6404843b4b4e	admin	active	2025-09-17 18:58:28.190957+00	\N	2025-11-06 14:58:28.13368+00	2025-11-06 14:58:28.13368+00
e9003f43-ad8a-4f6b-b8c7-b1488abf8151	04b4bb2a-c27d-4deb-a157-3b713c7b0798	b2af51d1-1803-42d8-9d70-45cab886b933	co_admin	active	2025-09-13 18:58:28.19167+00	\N	2025-11-06 14:58:28.13368+00	2025-11-06 14:58:28.13368+00
4d40662a-8ec2-402b-ac09-071514eaf6c3	04b4bb2a-c27d-4deb-a157-3b713c7b0798	dec0a496-de0c-414d-a0d4-6b05e9f3f1d1	staff	active	2025-08-10 18:58:28.192218+00	\N	2025-11-06 14:58:28.13368+00	2025-11-06 14:58:28.13368+00
55e06fe4-b647-4c08-a620-77499b0a2f8d	04b4bb2a-c27d-4deb-a157-3b713c7b0798	db721e8f-37ac-4a26-b6f6-6b28b2cb0967	staff	active	2025-10-04 18:58:28.19278+00	\N	2025-11-06 14:58:28.13368+00	2025-11-06 14:58:28.13368+00
82c98374-efac-43fb-993e-1e710e31c71d	364fde22-d1b6-49c9-9b55-033343c80d81	53c4cb3d-2936-4d0a-8d83-52dc5078d364	admin	active	2025-10-01 18:58:28.198931+00	\N	2025-11-06 14:58:28.13368+00	2025-11-06 14:58:28.13368+00
b76584a6-3f88-48d3-97ac-42fad60ec163	665f7b7d-a11d-46ff-b5ec-9c35abb7cdb5	cdb96218-44ee-4430-9108-0fe67dc55e72	admin	active	2025-10-11 18:58:28.20363+00	\N	2025-11-06 14:58:28.13368+00	2025-11-06 14:58:28.13368+00
8c5cf5b3-27cd-4fb3-9abe-52a5d76e4933	665f7b7d-a11d-46ff-b5ec-9c35abb7cdb5	26fbd5a9-2045-4927-a61c-c05b57bbc311	staff	active	2025-09-08 18:58:28.204225+00	\N	2025-11-06 14:58:28.13368+00	2025-11-06 14:58:28.13368+00
efb0f2cd-9ee1-4ffd-b02c-2c6923236830	a3423046-8a83-409c-8ad3-16fc4420a40b	7d061c32-0c44-4f1b-851b-6c35e568eb5d	admin	active	2025-11-19 03:29:37.680138+00	\N	2025-11-19 03:29:37.680138+00	2025-11-19 03:29:37.680138+00
95e31eba-8b78-461a-a7df-e962edeca363	a3423046-8a83-409c-8ad3-16fc4420a40b	31a11d70-ae3f-4fcc-897d-756403590925	staff	active	2025-11-19 03:29:37.680138+00	\N	2025-11-19 03:29:37.680138+00	2025-11-19 03:29:37.680138+00
229ee517-1db6-4f7f-bd5f-108ce7246ca4	dcffcf5e-2e1d-4b80-aa8d-6774d47e5599	7d061c32-0c44-4f1b-851b-6c35e568eb5d	admin	active	\N	\N	2025-11-19 12:49:24.523605+00	2025-11-19 12:49:24.523605+00
1281aa27-2a36-4dfd-b052-cebfdf65420c	dcffcf5e-2e1d-4b80-aa8d-6774d47e5599	31a11d70-ae3f-4fcc-897d-756403590925	co_admin	active	\N	\N	2025-11-19 12:49:24.523605+00	2025-11-19 12:49:24.523605+00
f9a46a30-ee35-49b0-89fa-636b66727e7c	dcffcf5e-2e1d-4b80-aa8d-6774d47e5599	1de4003e-2860-4d3e-bd9e-42fd18831b50	staff	active	\N	\N	2025-11-19 12:49:24.523605+00	2025-11-19 12:49:24.523605+00
\.


--
-- Data for Name: npos; Type: TABLE DATA; Schema: public; Owner: fundrbolt_user
--

COPY public.npos (id, name, description, mission_statement, tax_id, website_url, phone, email, address, registration_number, status, created_by_user_id, created_at, updated_at, deleted_at, tagline) FROM stdin;
a3423046-8a83-409c-8ad3-16fc4420a40b	Hope Foundation	Supporting education in underserved communities worldwide. We provide scholarships, school supplies, and mentorship programs to help children reach their full potential.	\N	12-3456789	https://hopefoundation.org	+1 (555) 123-4567	contact@hopefoundation.org	{"street": "123 Education Lane", "city": "Learning City", "state": "CA", "postal_code": "90210", "country": "USA"}	NPO-2024-001	approved	ecffbad5-f417-47e3-b07f-35e643167c05	2025-11-06 14:58:28.13368+00	2025-11-06 14:58:28.13368+00	\N	\N
21c257a7-0292-420f-a019-a02bf071e532	Green Earth Initiative	Environmental conservation and sustainability programs. We focus on reforestation, ocean cleanup, and renewable energy education.	\N	23-4567890	https://greenearthinitiative.org	+1 (555) 234-5678	info@greenearthinitiative.org	{"street": "456 Forest Drive", "city": "Eco City", "state": "OR", "postal_code": "97201", "country": "USA"}	NPO-2024-002	pending_approval	a13c8ee2-1e3b-44ad-a5ae-704faa005726	2025-11-06 14:58:28.13368+00	2025-11-06 14:58:28.13368+00	\N	\N
04b4bb2a-c27d-4deb-a157-3b713c7b0798	Community Health Network	Providing free healthcare services to underserved populations. Mobile clinics, health education, and preventive care programs.	\N	34-5678901	https://communityhealthnetwork.org	+1 (555) 345-6789	contact@communityhealthnetwork.org	{"street": "789 Medical Plaza", "city": "Healthcare City", "state": "NY", "postal_code": "10001", "country": "USA"}	NPO-2024-003	approved	2bad8683-091d-4441-bb13-6404843b4b4e	2025-11-06 14:58:28.13368+00	2025-11-06 14:58:28.13368+00	\N	\N
364fde22-d1b6-49c9-9b55-033343c80d81	Youth Arts Academy	Empowering youth through creative arts programs. Music, dance, theater, and visual arts education for children and teens.	\N	45-6789012	https://youthartsacademy.org	+1 (555) 456-7890	hello@youthartsacademy.org	{"street": "321 Creative Way", "city": "Arts District", "state": "TX", "postal_code": "75001", "country": "USA"}	\N	draft	53c4cb3d-2936-4d0a-8d83-52dc5078d364	2025-11-06 14:58:28.13368+00	2025-11-06 14:58:28.13368+00	\N	\N
665f7b7d-a11d-46ff-b5ec-9c35abb7cdb5	Animal Rescue Alliance	Rescuing and rehoming abandoned animals. We provide veterinary care, foster programs, and adoption services.	\N	56-7890123	https://animalrescuealliance.org	+1 (555) 567-8901	info@animalrescuealliance.org	{"street": "654 Rescue Road", "city": "Pet City", "state": "FL", "postal_code": "33101", "country": "USA"}	NPO-2024-005	rejected	cdb96218-44ee-4430-9108-0fe67dc55e72	2025-11-06 14:58:28.13368+00	2025-11-06 14:58:28.13368+00	\N	\N
dcffcf5e-2e1d-4b80-aa8d-6774d47e5599	Test Non-Profit Organization	A test NPO for development and testing purposes	To provide excellent service to our community	12-3456789	https://test-npo.example.com/	1555551988	test-npo@example.com	{"street": "1234 Cedar Lane Road", "street2": "", "city": "Greenville", "state": "SC", "postal_code": "29617", "country": "United States"}	\N	approved	b25889fa-76a3-4008-950c-6d7ee0cb5f01	2025-11-19 12:49:24.523605+00	2025-11-21 05:24:42.555181+00	\N	Supporting our community through technology
\.


--
-- Data for Name: option_responses; Type: TABLE DATA; Schema: public; Owner: fundrbolt_user
--

COPY public.option_responses (id, ticket_purchase_id, custom_option_id, response_value, created_at) FROM stdin;
\.


--
-- Data for Name: promo_code_applications; Type: TABLE DATA; Schema: public; Owner: fundrbolt_user
--

COPY public.promo_code_applications (id, promo_code_id, ticket_purchase_id, discount_amount, applied_at) FROM stdin;
\.


--
-- Data for Name: promo_codes; Type: TABLE DATA; Schema: public; Owner: fundrbolt_user
--

COPY public.promo_codes (id, event_id, code, discount_type, discount_value, max_uses, used_count, valid_from, valid_until, is_active, created_by, created_at, updated_at, version) FROM stdin;
\.


--
-- Data for Name: registration_guests; Type: TABLE DATA; Schema: public; Owner: fundrbolt_user
--

COPY public.registration_guests (id, registration_id, user_id, name, email, phone, invited_by_admin, invitation_sent_at, created_at, updated_at, checked_in, bidder_number, table_number, bidder_number_assigned_at, is_table_captain) FROM stdin;
21e6b3f9-8f4b-46bf-90e8-c9ca2b90d13f	fbf4847c-f57d-4604-a3f0-01d0e12e5f08	\N	Sarah Thompson	sarah.thompson@example.com	+1(555)123-4567	f	\N	2025-11-23 20:55:39.50922+00	2025-12-16 13:32:35.635943+00	f	\N	1	\N	f
29b46010-3d79-49e6-8e98-3b724e533275	fbf4847c-f57d-4604-a3f0-01d0e12e5f08	\N	Michael Chen	michael.chen@example.com	+1(555)234-5678	f	\N	2025-11-23 20:55:39.50922+00	2025-12-16 13:32:38.279433+00	f	\N	3	\N	f
d5c120d5-899c-4c06-bfcd-606c032688bd	fbf4847c-f57d-4604-a3f0-01d0e12e5f08	\N	Emily Rodriguez	emily.rodriguez@example.com	+1(555)345-6789	f	\N	2025-11-23 20:55:39.50922+00	2025-12-16 13:32:43.972424+00	f	\N	2	\N	f
45efd895-7432-447e-a8fe-820577870933	fbf4847c-f57d-4604-a3f0-01d0e12e5f08	\N	David Kim	david.kim@example.com	+1(555)456-7890	f	\N	2025-11-23 20:55:39.50922+00	2025-12-16 13:32:55.139281+00	f	\N	2	\N	f
8160e1a8-a5ff-4cc9-9596-2c4277755654	30528988-31a5-4e90-89b9-1400ebbf59d3	\N	Jessica Martinez	jessica.martinez@example.com	+1(555)567-8901	f	\N	2025-11-23 20:55:39.50922+00	2025-12-16 13:33:52.548676+00	f	\N	4	\N	f
1fb4d41d-a937-4d90-b16a-3ed23c39f88a	367db784-5561-4f59-8ea5-c6e56253bc60	\N	Justin Jeanes	jeanesjustin@gmail.com	8645536738	t	2025-11-23 21:55:41.861706+00	2025-11-23 21:55:41.798478+00	2025-12-16 13:48:47.651045+00	f	\N	2	\N	f
303debac-136b-4ea7-a113-b00f323d0f9f	c1d03ca2-bc0c-458e-a0eb-56bb59d76828	\N	Sophia Anderson	sophia.anderson@example.com	+1(555)123-5678	f	\N	2025-11-23 20:55:39.50922+00	2025-12-16 13:48:47.651045+00	f	\N	1	\N	f
71dac99c-7a8c-4548-bf2f-6d3b97a0ce46	30528988-31a5-4e90-89b9-1400ebbf59d3	\N	Daniel Brown	daniel.brown@example.com	+1(555)890-1234	f	\N	2025-11-23 20:55:39.50922+00	2025-12-16 13:48:47.651045+00	f	\N	1	\N	f
8181487c-ae89-48b8-abc5-540bf91c4083	c1d03ca2-bc0c-458e-a0eb-56bb59d76828	\N	Matthew Taylor	matthew.taylor@example.com	+1(555)234-6789	f	\N	2025-11-23 20:55:39.50922+00	2025-12-16 13:48:47.651045+00	f	\N	1	\N	f
da95d5ee-4b8b-48cd-874a-d3fcc6211ae2	30528988-31a5-4e90-89b9-1400ebbf59d3	\N	Christopher Lee	christopher.lee@example.com	+1(555)678-9012	f	\N	2025-11-23 20:55:39.50922+00	2025-12-16 13:48:47.651045+00	f	\N	1	\N	f
e5dfcd84-646b-4823-8a93-e2bbd8d4ec89	367db784-5561-4f59-8ea5-c6e56253bc60	\N	John Rockefeller	John.Rockefeller@augeo.app	\N	t	2025-11-23 21:53:30.900573+00	2025-11-23 21:53:30.836306+00	2025-12-16 13:48:47.651045+00	f	\N	2	\N	f
f98d42ce-43f8-448c-9e12-bd9a0d9acefd	c1d03ca2-bc0c-458e-a0eb-56bb59d76828	\N	Ryan Wilson	ryan.wilson@example.com	+1(555)012-3456	f	\N	2025-11-23 20:55:39.50922+00	2025-12-16 13:48:47.651045+00	f	\N	1	\N	f
fdff4b17-a4d7-48e4-b8cb-22ab58f82b9e	30528988-31a5-4e90-89b9-1400ebbf59d3	\N	Amanda Johnson	amanda.johnson@example.com	+1(555)789-0123	f	\N	2025-11-23 20:55:39.50922+00	2025-12-16 13:48:47.651045+00	f	\N	1	\N	f
44118578-5da8-4037-835a-c3a21636df35	c1d03ca2-bc0c-458e-a0eb-56bb59d76828	\N	Olivia Davis	olivia.davis@example.com	+1(555)901-2345	f	\N	2025-11-23 20:55:39.50922+00	2026-01-02 16:20:17.633325+00	f	\N	1	\N	f
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: fundrbolt_user
--

COPY public.roles (id, name, description, scope, created_at, updated_at) FROM stdin;
97df5649-b5ec-43c5-bd90-093010cbc428	super_admin	Augeo platform staff with full access to all NPOs and events	platform	2025-10-24 15:07:44.077409+00	2025-10-24 15:07:44.077409+00
c03573d0-b5ad-4970-be5a-21adcb321a7a	npo_admin	Full management access within assigned nonprofit organization(s)	npo	2025-10-24 15:07:44.077409+00	2025-10-24 15:07:44.077409+00
6469ec1c-c4d4-4f14-a84b-6132f96e4f02	event_coordinator	Event and auction management within assigned NPO	npo	2025-10-24 15:07:44.077409+00	2025-10-24 15:07:44.077409+00
c2921020-3b7b-4e7a-9f29-2f7e6cfd2faf	staff	Donor registration and check-in within assigned events	event	2025-10-24 15:07:44.077409+00	2025-10-24 15:07:44.077409+00
a928717b-0764-44eb-ac09-04daf4f880f8	donor	Bidding and profile management only	own	2025-10-24 15:07:44.077409+00	2025-10-24 15:07:44.077409+00
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: fundrbolt_user
--

COPY public.sessions (id, user_id, refresh_token_jti, device_info, ip_address, user_agent, created_at, expires_at, revoked_at) FROM stdin;
6334fa2f-079f-4600-bf9c-ea16450aba09	b25889fa-76a3-4008-950c-6d7ee0cb5f01	2PBRmCwa_yGCbRkekcE9dIXgCQxgLRb3ITSPxp2lHfQ	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-19 03:27:27.442018+00	2025-11-26 08:27:27.645994+00	\N
372eb6ef-ebac-4f40-83fa-39130910910c	b25889fa-76a3-4008-950c-6d7ee0cb5f01	l0G6w9mfqinIKK2HerAH0uakFdwYIUFd2HkNf2lIBVY	curl/8.5.0	127.0.0.1	curl/8.5.0	2025-11-20 01:59:13.024508+00	2025-11-27 06:59:13.2463+00	\N
4cbcbaab-0f89-4945-9a9a-c127ee428df7	e4a276fd-8159-4a6b-91ed-5308a22dd8aa	9T2LHW1sfszzvw15GUVwaV5YOy8L6-gHvZ1TZswr6Wo	python-httpx/0.25.2	127.0.0.1	python-httpx/0.25.2	2025-10-24 17:49:49.44827+00	2025-10-31 21:49:49.658595+00	\N
a199e320-d2e6-4d16-ac3d-5269e3e7a014	a748e498-1771-4ce2-ac4e-f9d3a8c2866b	elQXOUSyPTrLf3kD9B9agYNzJ9jaiXMzF8fNyT3Kvt8	python-httpx/0.25.2	127.0.0.1	python-httpx/0.25.2	2025-10-24 17:50:07.936539+00	2025-10-31 21:50:08.143644+00	\N
e85e3e56-bf4b-4ecb-8434-b094552e440e	4a16a9c3-170e-4e6a-8d2a-9f52f5c99a6d	bz0sICOGexk13wdjhJnvT1h1AeRBXQ_5cVv7tKcEHYc	python-httpx/0.25.2	127.0.0.1	python-httpx/0.25.2	2025-10-24 17:50:23.969362+00	2025-10-31 21:50:24.17484+00	\N
c6fb8e6c-a9cc-469d-8f71-96696dec3935	958a1c7b-4cd4-4e56-ae7b-2847f6758d62	vP5VIWAtOawhyKekvJ0kkPHICaEnJhVzpiu9TthigIg	python-httpx/0.25.2	127.0.0.1	python-httpx/0.25.2	2025-10-24 17:51:05.440554+00	2025-10-31 21:51:05.647701+00	\N
30aa0f4d-5dac-4f01-b568-7c7af683d51d	b25889fa-76a3-4008-950c-6d7ee0cb5f01	CvfIyuZtGwJeBoL1PeVfrPaktXVI2TK6jKooVFTA9T0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-21 02:20:22.513492+00	2025-11-28 07:20:22.710467+00	\N
a1389351-ff48-4193-ba3f-eb52a5584cd3	b25889fa-76a3-4008-950c-6d7ee0cb5f01	_0BcYPCUyAesEnuGnOxrHlAElqedPzjmAWTaI_UeuXE	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	172.29.32.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-24 19:17:10.91847+00	2025-10-31 23:17:11.134106+00	2025-10-24 23:26:45.535401+00
d67a313c-6d71-4da2-80ec-9aa7b96fc1ed	b25889fa-76a3-4008-950c-6d7ee0cb5f01	HfZkdjx4e7RLBC9qEcrLirqWVgNcwupxpJdG4m3X9d4	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-21 22:11:08.931466+00	2025-11-29 03:11:09.15672+00	\N
b419ef1a-6232-4843-8b5e-5f32f6a98b3c	b25889fa-76a3-4008-950c-6d7ee0cb5f01	bF9fmcFBMP1JJoNLF-FHs_kUaaW7WzkDroPCqsR8Yn8	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-24 02:11:28.882738+00	2025-12-01 07:11:29.08119+00	\N
fd90c65c-d971-4f28-a2f6-a426e47ed0b9	b25889fa-76a3-4008-950c-6d7ee0cb5f01	hhlbq2SbSTbQ27OcePjqFWCTWqVkkGTAVYb1SXtRlk4	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-24 18:05:06.494242+00	2025-12-01 23:05:06.709537+00	\N
ea623678-d617-4522-b485-b910714f027e	b25889fa-76a3-4008-950c-6d7ee0cb5f01	Xk-Vpz-k6PGeviNAtmSnKUUJ20O7HnkNIwO4YUrRHzM	curl/8.5.0	127.0.0.1	curl/8.5.0	2025-11-24 21:00:45.589612+00	2025-12-02 02:00:45.792646+00	\N
b0071461-5719-4c81-ae73-52b1db8fd687	b25889fa-76a3-4008-950c-6d7ee0cb5f01	1ePbumEHFtjl3qPg-b4H4OcGnG0iuohzIGfGKy-vcKM	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2600:1700:652c:8010:92c:fc43:644f:ff95	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-24 20:11:14.289167+00	2025-11-01 00:11:14.494658+00	2025-10-25 00:16:22.766277+00
50c327fa-809c-4349-bb2f-c0cb22472590	b25889fa-76a3-4008-950c-6d7ee0cb5f01	1lCH96OHOHzYyzcSk1SDG7XFD2SP7FvnlibybG4Td6Y	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-24 21:08:58.778299+00	2025-12-02 02:08:58.973095+00	\N
86e38062-3822-4c88-af15-44e97314414e	b25889fa-76a3-4008-950c-6d7ee0cb5f01	4VGhe-s6L5or67ag12KcZBoQDpVQBHg1gtIfZsFFDfI	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2600:1700:652c:8010:92c:fc43:644f:ff95	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-24 20:16:32.455701+00	2025-11-01 00:16:32.663646+00	2025-10-25 00:21:07.570856+00
876e1d00-36d5-4c4f-9eb3-e9a3772309b1	b25889fa-76a3-4008-950c-6d7ee0cb5f01	tNR_MT8Bprz4Cgat2_1nWW9JklapP8u4VrJeqBMp_dE	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2600:1700:652c:8010:92c:fc43:644f:ff95	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-24 20:23:14.13911+00	2025-11-01 00:23:14.347611+00	2025-10-25 00:33:18.022122+00
bad035fc-1eaa-437d-b1c2-823c667db935	b25889fa-76a3-4008-950c-6d7ee0cb5f01	lHOnqJt2WrJd8Td4BMrTMBwYfyRL0j1m3Rn1YY7qydU	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-26 13:01:51.392241+00	2025-12-03 18:01:51.604074+00	2025-11-26 18:03:30.918261+00
e04f2888-a7f1-4072-8343-17e77b94d5fd	e8de48bf-8e93-429a-86af-6f1a1c7a216f	JahjgOE5pzTxdn_sGwsLVsFEMupEfkEK1kkogKOtQ-w	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-26 14:13:31.96516+00	2025-12-03 19:13:32.166489+00	\N
24d08090-dcaf-4dd7-bd8f-a79db035bc3a	b25889fa-76a3-4008-950c-6d7ee0cb5f01	XI2uC0xWbGciJEVtheBXB-W8eR9_SXF_lk6aX5ghJuc	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	172.29.32.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-24 19:26:55.664366+00	2025-10-31 23:26:55.8571+00	2025-10-25 00:38:55.700178+00
171c0333-b8ec-4836-9b51-16178c78215e	b25889fa-76a3-4008-950c-6d7ee0cb5f01	RxZSH_QMtIONSEyLebEozc03t0LRTK8B6gP1z58wdoQ	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2025-12-08 22:29:28.559009+00	2025-12-16 03:29:29.017769+00	\N
08c98d80-338b-44d2-9488-7af073136cc4	8f9a7e69-45a3-4c45-8076-98607bffd8fe	hY-1DVWgbLDqsnpEisNj2R62LcbfEud9XbGJs3EHzSg	curl/8.5.0	127.0.0.1	curl/8.5.0	2025-10-25 01:10:01.556821+00	2025-11-01 05:10:01.747693+00	\N
69e7ac97-ff8e-447f-a919-d63defac10b7	f5685f29-eb11-44ac-be25-fc2e691883ef	3_G6FEEUDoZNnxVT4YZDrJYgt4fU0rDvDYRfB6femJk	curl/8.5.0	127.0.0.1	curl/8.5.0	2025-10-25 01:25:54.651146+00	2025-11-01 05:25:54.865609+00	\N
ca416144-eab3-4e31-9954-b3db2e3d9361	b25889fa-76a3-4008-950c-6d7ee0cb5f01	5ALVEt2Z2effeJMkw5Ms_5cw9h6j2AkmnNUR-oqTS4c	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2025-12-09 14:47:14.349706+00	2025-12-16 19:47:14.566464+00	\N
906543e5-9f2c-44f8-854f-8b70daf85d6c	e8de48bf-8e93-429a-86af-6f1a1c7a216f	U1kIctrE_E5D6fL5HUeV5i4vKGmxZpv9zHXrgxVYj14	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2025-12-09 19:57:26.729849+00	2025-12-17 00:57:26.937291+00	\N
09380ade-da75-4ebf-a959-7601c88ab91d	e8de48bf-8e93-429a-86af-6f1a1c7a216f	3qHXWKs37Zmz4oe9jjNIMGSSd59O380dJyTeG-Ccjcs	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2025-12-10 13:29:22.684144+00	2025-12-17 18:29:22.913409+00	\N
7f957739-7d3b-466c-8f42-68f6890e1c1b	25d5958f-9480-4da8-914a-f1f220d67b9b	6VaO189dadPoJ7aN9vedXp2SHSfILKqR-_JRKJX9nKU	curl/8.5.0	127.0.0.1	curl/8.5.0	2025-10-31 18:04:41.490792+00	2025-11-07 23:04:41.696787+00	\N
2be55109-a594-4728-b53e-d4ad6bafbe42	d352f991-08b4-4906-add7-b166ec288681	0CmPte-I5JFRF_tKlIaDivC6gDSEVnMRtBUMF_xyX6E	curl/8.5.0	127.0.0.1	curl/8.5.0	2025-10-31 19:02:50.320893+00	2025-11-08 00:02:50.536801+00	\N
9622b067-445a-4482-98de-c7cfdfa1d930	b25889fa-76a3-4008-950c-6d7ee0cb5f01	Tb5yjfEL1aORHGUnyfD_bAUpRgpkCbY66IsufFd_jGo	curl/8.5.0	127.0.0.1	curl/8.5.0	2025-11-15 02:27:17.275051+00	2025-11-22 07:27:17.50877+00	2025-11-19 08:15:24.877247+00
d5044b81-93a0-445e-99c8-8a6680a58aff	b25889fa-76a3-4008-950c-6d7ee0cb5f01	NDSxgvuDw7-xLR5Db1rGXyVAd4ORprItYdCqIZxq-to	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-19 21:51:15.27799+00	2025-11-27 02:51:15.477199+00	\N
24527c31-ce2a-464c-9030-ff9fb72cb1ca	b25889fa-76a3-4008-950c-6d7ee0cb5f01	D66zd_pBuiQThHCLCe2XhoIjHq6gPtIA1ZNaIyhdvk0	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	127.0.0.1	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	2025-11-20 23:51:13.806742+00	2025-11-28 04:51:14.009613+00	2025-11-21 04:51:36.613134+00
bc9fee9b-505b-4f42-a10d-b72251cc94ad	b25889fa-76a3-4008-950c-6d7ee0cb5f01	F7uToJZVaWb0AbnFm4SSprdgedyrL-FPs1bi9INuCeQ	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-22 01:18:16.49498+00	2025-11-29 06:18:16.709081+00	\N
7169ce25-5039-482c-a4c2-25d891150872	b25889fa-76a3-4008-950c-6d7ee0cb5f01	qBMmx1CTa2Tf9BDAssrxLHKUc3d5zvpFLWCbJJmykgs	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-24 18:11:16.205757+00	2025-12-01 23:11:16.401171+00	\N
744511bd-d92d-4f96-97f2-9f9b098387ab	b25889fa-76a3-4008-950c-6d7ee0cb5f01	QI3NWrsoxCpnmekxhQ7Xzso4StXIZZttjtyXzLk7-0Y	curl/8.5.0	127.0.0.1	curl/8.5.0	2025-11-24 21:01:10.57712+00	2025-12-02 02:01:10.778783+00	\N
c67ed2c4-b769-4578-af44-174c9a40e99b	b25889fa-76a3-4008-950c-6d7ee0cb5f01	nVPNSZ4yxpME9yyLwfeVw4Imbp5BO7mf3ELzUEisfkw	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-24 21:09:34.739054+00	2025-12-02 02:09:34.937702+00	\N
3d6b8bc4-864c-459d-9ad6-8d539887f700	b25889fa-76a3-4008-950c-6d7ee0cb5f01	-lO0UKde0jt_Ft2A-goSC1yUQT9nDTJSgavpniu-LkQ	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-26 13:40:47.621971+00	2025-12-03 18:40:47.823314+00	2025-11-26 18:41:59.391275+00
8a10dd7d-177e-48e2-8581-d57cebd255d3	e8de48bf-8e93-429a-86af-6f1a1c7a216f	3lvnzaNwQJ3cujf1Am1Nv7j5tMCkyhnqbXCXkImp8ms	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	127.0.0.1	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	2025-11-26 14:30:24.166339+00	2025-12-03 19:30:24.362147+00	\N
860ceb93-411c-4177-aeba-f87ea4d5c9c7	e8de48bf-8e93-429a-86af-6f1a1c7a216f	2MRhx-2c9UQYOLNO5I1c3cC_3HAUjl8BppUihRwViGY	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2025-12-09 02:36:09.683263+00	2025-12-16 07:36:09.891342+00	\N
c70d7a1d-3d24-48df-9c28-ea7a978a6f78	b25889fa-76a3-4008-950c-6d7ee0cb5f01	V1S7y3kO8670Z93Rtl84ULw_0awbTRlurkJ3fahcySs	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2025-12-10 00:09:29.184112+00	2025-12-17 05:09:29.576051+00	\N
d6d8382b-6408-49c2-b5fd-8c05a668ed3e	e8de48bf-8e93-429a-86af-6f1a1c7a216f	0eVSo_DO5v-6DX0Ny8B13QGpVwVQJD8nBsO3A4EjLCg	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2025-12-10 19:32:44.280786+00	2025-12-18 00:32:44.494735+00	\N
856d666d-2c0c-4c70-9cfc-82918a593f4e	b25889fa-76a3-4008-950c-6d7ee0cb5f01	l9k_ZobAOd9_CUcSOOOYNO2P4ngwa01-wudqwlW8vWY	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2025-12-16 13:13:51.067142+00	2025-12-23 18:13:51.371725+00	\N
073ee789-7504-48c7-8b57-513247b02e8a	f5685f29-eb11-44ac-be25-fc2e691883ef	f0TmPxClDqUKoDz5VzzapgyQlS8FMvE9fvk86agppn0	python-httpx/0.25.2	127.0.0.1	python-httpx/0.25.2	2025-11-04 03:08:45.582198+00	2025-11-11 08:08:45.781408+00	\N
d8fb6f99-6b23-4a24-8705-681b7557de47	f5685f29-eb11-44ac-be25-fc2e691883ef	-srVvwO7PMGKIazHnntxAc2dRE_HzvkVvexuaRryzMo	python-httpx/0.25.2	127.0.0.1	python-httpx/0.25.2	2025-11-04 03:09:06.589404+00	2025-11-11 08:09:06.788637+00	\N
67b15d75-dca8-424e-8ce9-e19e57647b4c	b25889fa-76a3-4008-950c-6d7ee0cb5f01	Otrv8A6TatDCF2MDuL6khh_G9shjiZOD_wuQOsYiQ5M	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36	127.0.0.1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36	2025-11-19 23:05:23.6814+00	2025-11-27 04:05:23.87266+00	\N
be0a6a79-6f9a-4cd8-bfd6-5c1455b05929	b25889fa-76a3-4008-950c-6d7ee0cb5f01	0urA_2Bxvf6r8RaoxmkC8NSi7lmx7ENYhTUz6I-Ugt4	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	127.0.0.1	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	2025-11-20 23:51:42.295642+00	2025-11-28 04:51:42.493346+00	2025-11-21 04:51:53.654501+00
79cbd8bf-5e84-41fe-a60a-1b77b2a46015	b25889fa-76a3-4008-950c-6d7ee0cb5f01	La5FMjIpLAnbF6hbMtUFO9Zqc5pMlkCAR8Np6X9HGRA	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-22 12:05:10.082824+00	2025-11-29 17:05:10.294334+00	\N
2814884a-3e6c-4539-b0fd-ad8a0fdd9623	b25889fa-76a3-4008-950c-6d7ee0cb5f01	9zCQLTqNsvbCU1yWP0OuEnkppYhexMJobT-ck9SuTho	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-24 18:13:53.3006+00	2025-12-01 23:13:53.499763+00	\N
8b114228-a88a-427c-8a05-db50426ab66c	b25889fa-76a3-4008-950c-6d7ee0cb5f01	e9UJvJjmEPK-n2fUSV-YdZmGcWBSC_W8LKvDjQvnD0c	curl/8.5.0	127.0.0.1	curl/8.5.0	2025-11-24 21:01:35.262881+00	2025-12-02 02:01:35.459209+00	\N
1bf069e0-ed50-4afd-b666-62878e61c198	b25889fa-76a3-4008-950c-6d7ee0cb5f01	po7u9_1hrtPKJSCnX99vcRIPthH5PqLGqvnUOO_PsUs	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-24 21:15:09.165698+00	2025-12-02 02:15:09.371539+00	\N
37e4001d-f358-464a-b011-98917b95af4c	b25889fa-76a3-4008-950c-6d7ee0cb5f01	jYFHTJvbZ5gm1-qQ6RxslYarFrnw23XKAiVoOjv6vIM	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-04 20:56:48.71029+00	2025-11-12 01:56:48.981277+00	2025-11-05 17:26:31.952767+00
da0dfebf-7e5b-4deb-8e17-597f718f4dc5	e8de48bf-8e93-429a-86af-6f1a1c7a216f	VBKTGNyObQAw5AgBv3IB3J9lnKq2673Gi5ImUwDMLPM	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-26 13:43:05.9476+00	2025-12-03 18:43:06.14336+00	2025-11-26 18:47:37.969123+00
daa0bd56-c7c7-41ba-83b4-8dadc6fa24fd	b25889fa-76a3-4008-950c-6d7ee0cb5f01	2pRKRr1Bck3WpMKUr9cipnzY3EjaUfW2xkWdRnbGOp8	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2025-12-09 02:42:46.51909+00	2025-12-16 07:42:46.722462+00	\N
7c364343-59c3-43f9-9d79-5c73eec82554	b25889fa-76a3-4008-950c-6d7ee0cb5f01	N0-12yQkAHes_uc5po_gqtySQlqhgZVhqFFRRzApG80	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2025-12-10 01:13:04.052012+00	2025-12-17 06:13:04.452876+00	\N
b8b56124-a22a-4ac0-b733-ed4375802b68	e8de48bf-8e93-429a-86af-6f1a1c7a216f	VmFJpMf4AWLY2_xVlGy3h02Y7oJmyP-Z4wobqwhZkX0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2025-12-10 19:56:09.259536+00	2025-12-18 00:56:09.46876+00	\N
d482a248-7947-4b6e-8c2a-cf34fda3c83b	b25889fa-76a3-4008-950c-6d7ee0cb5f01	6zF1qhuPxcB3AHkiPvqAWuxXkDVC680JW94PgTRZZKg	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36	127.0.0.1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36	2025-11-05 13:11:31.024189+00	2025-11-12 18:11:31.243049+00	2025-11-05 18:23:11.630714+00
3f81e198-cd5d-43d5-aaa1-954e7742826b	b25889fa-76a3-4008-950c-6d7ee0cb5f01	uhohaE3RBhpx9CM4WQJi-Yv5o7IPC9La-GXF8cN84cc	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	127.0.0.1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2025-12-16 13:31:44.365192+00	2025-12-23 18:31:44.681961+00	\N
8aa8b741-5307-42cf-8bfd-a2157b9015ff	b25889fa-76a3-4008-950c-6d7ee0cb5f01	c2YWNGdybfy605e6GsowVjGiCdNmShPXkU37Ia_ro-o	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-05 13:45:19.418935+00	2025-11-12 18:45:19.635844+00	2025-11-05 18:57:45.175513+00
40c1aa06-23a5-4dd1-8755-cafb529a9196	b25889fa-76a3-4008-950c-6d7ee0cb5f01	M4Jx4MLJDg9iqIsX6u7df-k2j3wxn5rVN-Iai8n6tCw	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-05 14:16:13.630521+00	2025-11-12 19:16:13.851532+00	2025-11-05 19:19:13.9522+00
d134918b-50bf-418a-8f64-c6e5a7dcea50	061cd97f-9ad6-48a8-9dc4-80a8353ea255	kWHvqyp_YVuAmhfm_L1zxdEnr65txCjkHLNcl32E0vo	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36	127.0.0.1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36	2025-11-05 14:19:20.226269+00	2025-11-12 19:19:20.451861+00	2025-11-05 19:32:07.380288+00
856f63e1-d552-4bf3-aef9-0651e68d87df	b25889fa-76a3-4008-950c-6d7ee0cb5f01	Zz68aY_mqPxYWhaOpHIhsPzBnkEH9sqE2dXTy_GCK3M	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-05 14:32:13.554854+00	2025-11-12 19:32:13.765236+00	2025-11-05 19:34:06.270826+00
05881d36-c55b-4758-8870-d8baff618542	8035482b-c4bf-4b80-991b-7a03580771e4	1IMNgGcFSxQnKD7NKxfzqoa9kfWKJqR9XFRIrIL540Y	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-05 18:33:33.584161+00	2025-11-12 23:33:33.800366+00	\N
5883a9a4-5d46-400c-918b-92638338a2bd	b25889fa-76a3-4008-950c-6d7ee0cb5f01	FpFEB7nmWJZMRyxi6c3JKkGxBrW6GSEkjRV4We8EZ7g	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-19 23:23:51.268593+00	2025-11-27 04:23:51.453463+00	\N
2c245151-2160-494b-9dea-a7b4b00e243f	8035482b-c4bf-4b80-991b-7a03580771e4	ahgVT_iHuzlnr0OeVp5c57Q15ppdgcGPc6ZItdKCuO8	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36	127.0.0.1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36	2025-11-06 01:45:18.435084+00	2025-11-13 06:45:18.644909+00	2025-11-06 06:46:30.503853+00
a245cf67-3fdc-463a-8ffb-e55cc31b9aa2	b25889fa-76a3-4008-950c-6d7ee0cb5f01	gol8jyclAdewBRYDLhKxyCl79bSYVBmjTfUK-0mZ7uk	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	127.0.0.1	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	2025-11-20 23:52:00.553056+00	2025-11-28 04:52:00.752718+00	2025-11-21 04:58:02.640554+00
8c8f67bd-198a-47c8-8ac7-9791eda22455	b25889fa-76a3-4008-950c-6d7ee0cb5f01	AyxmVDG7rPZhZtrip2MPa7HeVxX8PH16k84MAnFMiSs	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-22 13:01:40.49421+00	2025-11-29 18:01:40.708638+00	\N
f3c6afb1-086f-4532-87c7-4206d4c0dec0	f5685f29-eb11-44ac-be25-fc2e691883ef	ExJs-6kTwshIsuUvRaT9t0tTXF0hYX8djoxgWbGZb2M	curl/8.5.0	127.0.0.1	curl/8.5.0	2025-11-24 18:26:17.513658+00	2025-12-01 23:26:17.725618+00	\N
9f80ae53-6d75-472e-9b9b-6b5e107ba919	b25889fa-76a3-4008-950c-6d7ee0cb5f01	NejmFKjyWw8i-U7gcnAOjG2KsYgs67OrzOlTyJBUMhw	curl/8.5.0	127.0.0.1	curl/8.5.0	2025-11-24 21:02:12.883889+00	2025-12-02 02:02:13.092007+00	\N
52ddeb85-7618-4b9d-95ac-3b1d06f441df	b25889fa-76a3-4008-950c-6d7ee0cb5f01	1kicdhiugpKhQfkfuqN--76tjrg5-OIdz2_toI4s46c	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	127.0.0.1	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	2025-11-25 02:58:19.887233+00	2025-12-02 07:58:20.088496+00	\N
0e8caec5-7f1a-466f-a719-092a12677bb4	e8de48bf-8e93-429a-86af-6f1a1c7a216f	nfzyMIdR1ztEWwQbqwSDVCBK8gurd9ZMPUFHTqMLs2g	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-26 13:47:58.030806+00	2025-12-03 18:47:58.227244+00	2025-11-26 18:51:00.972974+00
12ddff8f-d169-4d27-bbfd-4a059a303768	b25889fa-76a3-4008-950c-6d7ee0cb5f01	SBqkguEIZWs1mTO2sQ8kiR989H6bJVXcq5vcsZvhg1k	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-06 11:38:02.257949+00	2025-11-13 16:38:02.480061+00	2025-11-06 16:39:32.557127+00
d0da69f7-ad16-4ce4-ac94-1024445b4e8e	e8de48bf-8e93-429a-86af-6f1a1c7a216f	GGbLx4hC_lo1jN-TIZ_Cakv6sSNtXvtBRTIKh-0u6r0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2025-12-09 02:58:19.242893+00	2025-12-16 07:58:19.444667+00	\N
3d79a00e-3902-40ce-8a7a-8af163d23d7a	b25889fa-76a3-4008-950c-6d7ee0cb5f01	NXB4PiOKP8mJylx_g5ImiQ2TC1_3ajR1cGB879osWis	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-06 14:16:57.022187+00	2025-11-13 19:16:57.233517+00	2025-11-06 19:42:25.118635+00
c1828cad-8593-430c-bec3-3c851665dee6	e8de48bf-8e93-429a-86af-6f1a1c7a216f	vQid_QomQShwpP4h_-LI91jKJ5laM-H_kx9HqjaYcTQ	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2025-12-10 01:26:04.209684+00	2025-12-17 06:26:04.61146+00	\N
4b03092c-6a1d-45b3-8f1e-cffea79794db	b25889fa-76a3-4008-950c-6d7ee0cb5f01	d4QkZqyZ5msEePqmo1tzbNtNo4YYagfokSWgm7giik8	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-06 14:42:31.913709+00	2025-11-13 19:42:32.122494+00	2025-11-06 19:43:11.868393+00
b0cd052d-7264-4372-92cc-7ed5d7c2b911	a65cf82f-8b98-4dc3-be15-f42352d6e2c0	6DwyHsX72gIiQjuXGa__8cI6dT7Buu234eDk9QG1QOA	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-06 14:43:23.573295+00	2025-11-13 19:43:23.784836+00	\N
96656828-eaa8-48f2-a555-19419ec46605	e8de48bf-8e93-429a-86af-6f1a1c7a216f	mmfBycTIWoJwa9fJAoII5ngRC02-DF6TS8fy-bfNNVk	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2025-12-10 20:32:49.735979+00	2025-12-18 01:32:49.954373+00	\N
dd4a368b-eb90-41a0-bdf2-9476cb6d7649	b25889fa-76a3-4008-950c-6d7ee0cb5f01	snMpcLx3PPtE7m9_70nMNlhCapMvOQdsCgUqO4Jtb_0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2025-12-16 13:48:32.177075+00	2025-12-23 18:48:32.389286+00	\N
36ff42dd-b5d0-428e-8cb0-8e281abc605d	b25889fa-76a3-4008-950c-6d7ee0cb5f01	0qQ-2e9RiC57k_4vJe2sX4yyYtJ9TbgtQVoHAzGrTrA	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-07 01:44:43.968784+00	2025-11-14 06:44:44.17251+00	2025-11-07 06:49:33.367476+00
39254b6e-4a40-4259-a9ec-d19dfd7438a8	b25889fa-76a3-4008-950c-6d7ee0cb5f01	BP3YmrbqKgHvvV2A0xKE_W4yHqqSiNJUGJWgE9hUaAw	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-10 20:16:36.99183+00	2025-11-18 01:16:37.208236+00	2025-11-11 01:17:48.466432+00
0dad8482-d203-4bfb-82a7-7dea59a66a48	7d061c32-0c44-4f1b-851b-6c35e568eb5d	CZuw5zCQZcJ_6AzsNJYmYfIhB6qw9QwQS-AEnIvMI9s	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-10 20:17:59.33225+00	2025-11-18 01:17:59.552209+00	2025-11-11 01:27:35.037592+00
b487b70c-3d0b-4f1d-a8f3-50545f3642b3	b25889fa-76a3-4008-950c-6d7ee0cb5f01	sT1vcP4C5fdexULNFy9vAbaDBEiDac8hOxfDm_jDzSI	curl/8.5.0	127.0.0.1	curl/8.5.0	2025-11-15 19:56:14.331+00	2025-11-23 00:56:14.55698+00	2025-11-19 08:15:24.877247+00
0675b3ba-2227-4e43-9af0-02793a38f51a	b25889fa-76a3-4008-950c-6d7ee0cb5f01	wfBJ1C0yazSV0QT1UfI8TLg9wBzP13_XFJxG3El3_kc	curl/8.5.0	127.0.0.1	curl/8.5.0	2025-11-15 19:56:25.385073+00	2025-11-23 00:56:25.59771+00	2025-11-19 08:15:24.877247+00
5141179f-6225-40a5-9979-0a353ec959c2	b25889fa-76a3-4008-950c-6d7ee0cb5f01	r_YyO9atg58G_mrVvB_v8h-G8073A1iHCVA2yfxTFL4	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36	127.0.0.1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36	2025-11-20 00:29:15.349054+00	2025-11-27 05:29:15.539962+00	\N
7fd170c3-ce6c-4ff3-b7ce-49b64bd70538	b25889fa-76a3-4008-950c-6d7ee0cb5f01	QRT2_wFM-arKb8huylWUA4cLPM3jVW0dETC5u8mkyEY	curl/8.5.0	127.0.0.1	curl/8.5.0	2025-11-20 23:56:47.235722+00	2025-11-28 04:56:47.439247+00	\N
b8b8674d-b6ad-41af-849b-7e50e815300f	b25889fa-76a3-4008-950c-6d7ee0cb5f01	6JrZSZXXzD_M4FIpFYu-r3dnWIpP5Xo1OvMUClbMewA	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-23 20:49:05.876872+00	2025-12-01 01:49:06.088524+00	\N
2788c6e8-fc55-44e3-8361-acc9a81f89d0	b25889fa-76a3-4008-950c-6d7ee0cb5f01	QlPo2zjxC8bdKGY_dDRZ_aSDraDbNOi61qkJrwh8URU	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-24 20:48:25.70251+00	2025-12-02 01:48:25.889589+00	\N
27d95472-ff97-436f-9a78-608b25ed4d42	b25889fa-76a3-4008-950c-6d7ee0cb5f01	CHjeKyZ5CTYskpAmHaPTIXcems_MoSNgGU4LchuXBKg	curl/8.5.0	127.0.0.1	curl/8.5.0	2025-11-24 21:02:17.465776+00	2025-12-02 02:02:17.668841+00	\N
5a6ae400-d486-45d3-8986-b946787489dc	b25889fa-76a3-4008-950c-6d7ee0cb5f01	8kqWujRUz8SyoCf3_S_Yr-I1PQi7WSmz_xoThq5F_Xw	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	127.0.0.1	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	2025-11-25 11:14:47.778218+00	2025-12-02 16:14:47.995654+00	\N
539d1e7f-14d3-412f-82ce-e70b025bdbb2	e8de48bf-8e93-429a-86af-6f1a1c7a216f	E9LAwnPU_ogCdYHljI5tsBnoegwFw2xwAKGghN45zmc	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-26 13:52:10.17224+00	2025-12-03 18:52:10.378982+00	2025-11-26 18:53:25.965633+00
610c2449-80c2-4873-bd73-2d887eb1e971	e8de48bf-8e93-429a-86af-6f1a1c7a216f	RevXy2A8ONQ10GbwlpSkEBbcsfWwBM1DTyh4oFplXys	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	127.0.0.1	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	2025-12-09 13:48:05.206662+00	2025-12-16 18:48:05.408667+00	\N
628ed918-979a-4056-8f4d-5b37077de141	b25889fa-76a3-4008-950c-6d7ee0cb5f01	vOZTcTIV1IhT4vG5Mlp6JZBjlRfcFxZOZHiuOQRebN0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2025-12-12 02:53:23.878657+00	2025-12-19 07:53:24.081005+00	\N
b49cdf5c-4959-4aa4-bc67-c68c63e17b03	b25889fa-76a3-4008-950c-6d7ee0cb5f01	oDNX67KKZvyaVnbrOmU-6yLLx13AYmsnX1Jt4VqpU6o	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2025-12-17 02:22:29.707811+00	2025-12-24 07:22:29.929433+00	\N
3a3bad89-141e-4391-9239-731d5b975042	b25889fa-76a3-4008-950c-6d7ee0cb5f01	srtPWkj-NHOv9mEwC7Ar_7Uo_bViqX6yGOKGyfEsW8c	curl/8.5.0	127.0.0.1	curl/8.5.0	2025-11-15 02:17:34.071286+00	2025-11-22 07:17:34.29218+00	2025-11-19 08:15:24.877247+00
ed282305-c6c4-4833-9e7e-39d2fc990a15	b25889fa-76a3-4008-950c-6d7ee0cb5f01	VSgKODhvws_GqUgTNSlLSyWpJ5I-XqFcITVOnYQO_UA	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36	127.0.0.1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36	2025-11-20 00:53:46.312511+00	2025-11-27 05:53:46.496813+00	\N
e0a2d3ec-5798-4777-a7ad-eb8f96e20418	b25889fa-76a3-4008-950c-6d7ee0cb5f01	U7JqZm-209mBjnTLtL7KmYc7ABSXPD_xl9Ek3PNdcqA	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	127.0.0.1	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	2025-11-20 23:59:38.369985+00	2025-11-28 04:59:38.565103+00	\N
faf8665a-5f10-4406-9bad-c780d59470c5	b25889fa-76a3-4008-950c-6d7ee0cb5f01	R4_EecMrnVWO5hcQ9ZCWjPw4qkLE5ULpOroerC33Cgo	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	127.0.0.1	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	2025-11-23 21:45:45.934207+00	2025-12-01 02:45:46.140116+00	\N
bb01f13c-3385-44da-8a6b-ae879176755f	b25889fa-76a3-4008-950c-6d7ee0cb5f01	qPxhwoz8RmvL_wQ7V4fn4iGHQCbSPMEh2pHvmW-ARKI	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-24 20:57:08.700177+00	2025-12-02 01:57:08.899061+00	\N
df0be79e-0e95-4077-89ec-2a217123ee01	b25889fa-76a3-4008-950c-6d7ee0cb5f01	4WYLP971Hat-6bSQDNJydrrqG9MVxoDpRM2lfGev7cQ	curl/8.5.0	127.0.0.1	curl/8.5.0	2025-11-24 21:03:00.673863+00	2025-12-02 02:03:00.883857+00	\N
08f735e8-a265-4326-9020-177ff65dda0f	b25889fa-76a3-4008-950c-6d7ee0cb5f01	4Q8kln6vmglCXBCM4GOiKo32d4mIAhCfjWbFtKhn7VQ	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	127.0.0.1	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	2025-11-25 11:16:57.969016+00	2025-12-02 16:16:58.177761+00	\N
7e1db62a-d030-487b-aafb-800f5df98af0	e8de48bf-8e93-429a-86af-6f1a1c7a216f	0Xy0BRzzX2GZGDmT8vfcHMqaw-TSVr_FrGHa-d_JAig	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-26 13:53:55.322928+00	2025-12-03 18:53:55.519282+00	\N
a9a56fa8-3820-49a4-9094-bf90bc2719da	e8de48bf-8e93-429a-86af-6f1a1c7a216f	DjLBjXOxCo_6fIiIjfQBo6QXMBEqjkXPnYJfFZEZVNE	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2025-12-09 14:12:30.797916+00	2025-12-16 19:12:31.015089+00	\N
2bdfafae-d46a-4b02-88f6-c05eaa5b7d1e	b25889fa-76a3-4008-950c-6d7ee0cb5f01	jiFI8h6hV9_THSlAAb2ZCcjwUWz9Sa6sAo0KPRViZ28	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2025-12-12 10:36:29.596926+00	2025-12-19 15:36:29.800276+00	\N
91bcffc6-1abb-43cd-af8a-7916fe6bbb60	b25889fa-76a3-4008-950c-6d7ee0cb5f01	HtRoRS9kUptshvQCGheCB1NNu1wHt2cDCIsAGpuWj2k	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-24 15:19:05.901003+00	2025-10-31 19:19:06.141287+00	2025-11-19 08:15:24.877247+00
e9cff82e-217c-47db-80ed-dabaea3e294c	b25889fa-76a3-4008-950c-6d7ee0cb5f01	cLqZFBJ8ai0uxd-Hac-N6lZ8WhYC3mNZect82U-v3bk	curl/8.5.0	127.0.0.1	curl/8.5.0	2025-11-15 03:26:19.815826+00	2025-11-22 08:26:20.035357+00	2025-11-19 08:15:24.877247+00
8b5ab456-613b-48de-83fd-f1cccfbee69c	b25889fa-76a3-4008-950c-6d7ee0cb5f01	wDsP7MHA4x35eyIvO6xRsueUEyEFjFtj5I2R1wXAMRI	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-24 15:20:44.368991+00	2025-10-31 19:20:44.586481+00	2025-11-19 08:15:24.877247+00
6054b673-6ea1-4405-b58d-f180f1558ef2	b25889fa-76a3-4008-950c-6d7ee0cb5f01	381Jz5KFcnMFwnTX5Bf-_3TJfLZ9Zd-jviW0jhj21Oo	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2600:1700:652c:8010:92c:fc43:644f:ff95	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-24 19:51:28.526618+00	2025-10-31 23:51:28.735844+00	2025-11-19 08:15:24.877247+00
acbafde3-08fa-4a6a-87f0-f5f056524c7a	b25889fa-76a3-4008-950c-6d7ee0cb5f01	varnFvWgze3C_4AUQBvRcfJzd0Lqzny_rt1m2mdkkhs	Mozilla/5.0 (iPhone; CPU iPhone OS 18_6_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.7390.96 Mobile/15E148 Safari/604.1	38.125.100.12	Mozilla/5.0 (iPhone; CPU iPhone OS 18_6_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.7390.96 Mobile/15E148 Safari/604.1	2025-10-24 19:52:31.116447+00	2025-10-31 23:52:31.330482+00	2025-11-19 08:15:24.877247+00
93275427-4f66-4e38-bd15-a7f61802075a	b25889fa-76a3-4008-950c-6d7ee0cb5f01	rKALk9sE-AFH-pRWanVNpY5eYJgrIkg0l2adeJsFzC4	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2600:1700:652c:8010:92c:fc43:644f:ff95	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-24 20:33:34.781835+00	2025-11-01 00:33:35.005412+00	2025-11-19 08:15:24.877247+00
ec65f3e4-e29c-432e-85e9-2472feccfb93	b25889fa-76a3-4008-950c-6d7ee0cb5f01	VrV3DEyTZux7IDdhvpUYPCaTlxrg72LSti56BdnE9QE	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2600:1700:652c:8010:92c:fc43:644f:ff95	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-24 20:35:17.124148+00	2025-11-01 00:35:17.328192+00	2025-11-19 08:15:24.877247+00
d65d4078-5dac-40ad-a831-65fdae8fa173	b25889fa-76a3-4008-950c-6d7ee0cb5f01	IkeE4l74r1K4_YElYrxxlIWrMMGYz7FXU6hkEefyzJY	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2600:1700:652c:8010:92c:fc43:644f:ff95	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-24 20:39:21.162295+00	2025-11-01 00:39:21.367181+00	2025-11-19 08:15:24.877247+00
593e7ec2-1400-4eaf-bcfb-1fbde4907e1e	b25889fa-76a3-4008-950c-6d7ee0cb5f01	wRXubg9Z6LnCSsyM_tPJ5z2TxgPOx7MVZtalad-06dc	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2600:1700:652c:8010:1053:82b4:5555:820c	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-26 10:20:23.484527+00	2025-11-02 15:20:23.715465+00	2025-11-19 08:15:24.877247+00
1f77c5f1-3382-48ea-97f8-5b4bafb9173c	b25889fa-76a3-4008-950c-6d7ee0cb5f01	FbYtwMR-FzGpP3aRFtUZp2Vb7Bcpm0nmscKaxSgrE54	curl/8.5.0	127.0.0.1	curl/8.5.0	2025-10-30 00:24:55.764094+00	2025-11-06 05:24:56.082952+00	2025-11-19 08:15:24.877247+00
f207acd2-8de5-4c0c-a901-0b232d44b336	b25889fa-76a3-4008-950c-6d7ee0cb5f01	2h9Rv9s6LtAJGiDEBK_AU_3xoYw6MZPTWtLBpa_egAI	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-30 10:57:46.942192+00	2025-11-06 15:57:47.162134+00	2025-11-19 08:15:24.877247+00
3ad5e340-5e8d-4d94-9b48-0d95fb8d342d	b25889fa-76a3-4008-950c-6d7ee0cb5f01	-F4QdbN20QyCOK9y4yePHiYjHB6OzgGPfdX_4OXdk0E	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-30 11:12:56.717316+00	2025-11-06 16:12:56.936333+00	2025-11-19 08:15:24.877247+00
0fc14796-531f-41e6-9918-1843f33bbc16	b25889fa-76a3-4008-950c-6d7ee0cb5f01	w-1OkCFfLd-P6A_5zcc-isTU9Zg9P8yWTtsvaAZ43pg	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-01 11:07:53.954815+00	2025-11-08 16:07:54.163713+00	2025-11-19 08:15:24.877247+00
ecbb52aa-2a6d-4f15-b91e-617c7bc96c1a	b25889fa-76a3-4008-950c-6d7ee0cb5f01	iqsWyJm-EGN5vXo58z0-1Wap0LYnyyStsp5Qj7_sCF8	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-01 11:55:52.748228+00	2025-11-08 16:55:52.949079+00	2025-11-19 08:15:24.877247+00
08d8ffa1-7af0-40ad-95d7-4369b9a0d390	b25889fa-76a3-4008-950c-6d7ee0cb5f01	cnjLzum0K_2x-Cz1LAdTgaJyzWkvEgWh73mbG2ihPZc	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-01 12:09:51.319841+00	2025-11-08 17:09:53.258702+00	2025-11-19 08:15:24.877247+00
bdf93a51-9aef-4242-a860-1421c0caaedc	b25889fa-76a3-4008-950c-6d7ee0cb5f01	7YhzgpCNkfhAYMbz3PDn6cmRmaTxmHdL3gnNhUqmAh0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-01 13:08:13.924198+00	2025-11-08 18:08:14.138485+00	2025-11-19 08:15:24.877247+00
f5f078f5-696b-47d5-80f7-0230de70681b	b25889fa-76a3-4008-950c-6d7ee0cb5f01	XZ2zPSJD7TSAPkZlH6AqIel2RSWU9Hwrz9Tn1lVsrkg	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-01 13:32:27.449216+00	2025-11-08 18:32:27.653918+00	2025-11-19 08:15:24.877247+00
58b5758e-2d30-457d-8565-121857ed4a94	b25889fa-76a3-4008-950c-6d7ee0cb5f01	ptJNF6OL27vsZSuhsPDtwX3SLJvUprIZQFBOq7T0wVY	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-01 14:19:45.467534+00	2025-11-08 19:19:45.668681+00	2025-11-19 08:15:24.877247+00
f7ceb14a-dd89-47be-8e47-9cbd97a35eb1	b25889fa-76a3-4008-950c-6d7ee0cb5f01	oHGlPWNxwa8GQQ40N3HSMTTg2p5kK5kPHcuuW6WVNO4	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-01 14:54:33.9143+00	2025-11-08 19:54:34.117527+00	2025-11-19 08:15:24.877247+00
1a47557d-6ae3-4c4e-afdd-33b7dad5499f	b25889fa-76a3-4008-950c-6d7ee0cb5f01	f6EXCrgzzTn4GV2Bjz8XYBEMd_4JpNr2AExFBDEDLB0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-01 15:15:34.47268+00	2025-11-08 20:15:34.676088+00	2025-11-19 08:15:24.877247+00
7eecf3c5-afc7-4f2f-8072-d3703a1db8b3	b25889fa-76a3-4008-950c-6d7ee0cb5f01	FRMknHEp06SmRhAr65Tn-nJ0tjix2yyLlYRhMu79fYg	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-01 19:02:02.82432+00	2025-11-09 00:02:03.02744+00	2025-11-19 08:15:24.877247+00
1a9ff222-7763-4b53-ab98-649d27175391	b25889fa-76a3-4008-950c-6d7ee0cb5f01	Daa_RL2HCCdg-xgcra841HXr_Whtp4geAWgQBXG0gDE	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-02 14:34:40.611117+00	2025-11-09 19:34:40.822231+00	2025-11-19 08:15:24.877247+00
5bb7ca99-9d50-496d-9b5f-c870823ff103	b25889fa-76a3-4008-950c-6d7ee0cb5f01	sOTmDf82PKGn6kWGhORa2hYpE8qDsM8Gi_7kD2aK_rA	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-02 17:03:56.867647+00	2025-11-09 22:03:57.081073+00	2025-11-19 08:15:24.877247+00
ed863991-1cac-44f2-8876-2ee1931846a7	b25889fa-76a3-4008-950c-6d7ee0cb5f01	kPz87ML_0kLvYCgM9Awy8umTM2YW4rwWRZuqfQ8wzyg	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-02 17:46:56.040094+00	2025-11-09 22:46:56.257909+00	2025-11-19 08:15:24.877247+00
65810c39-42b0-4e46-a873-ae6a42929bc8	b25889fa-76a3-4008-950c-6d7ee0cb5f01	GK55PSRqPGJleRiU8jxhA5fFnFcLh_EVskbfKwcBLo8	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	127.0.0.1	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	2025-11-02 18:55:17.723528+00	2025-11-09 23:55:17.937569+00	2025-11-19 08:15:24.877247+00
80af7b50-5a4c-4915-834d-a0611c6c3872	b25889fa-76a3-4008-950c-6d7ee0cb5f01	rw0zBGzafqlaOwC5k-JW2AyL1q1ohPllPP0kn78E5Cs	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-03 02:04:28.632726+00	2025-11-10 07:04:28.845337+00	2025-11-19 08:15:24.877247+00
66c8e2f6-652f-45b1-8957-0af59bdf15f3	b25889fa-76a3-4008-950c-6d7ee0cb5f01	XIbqjNVc14QRW930JCClKHrhbi_Q6wgV21LR9Txia1Y	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-03 02:51:29.057323+00	2025-11-10 07:51:29.275595+00	2025-11-19 08:15:24.877247+00
fd8e9475-ad79-4ed3-bf00-8a194fa7274b	b25889fa-76a3-4008-950c-6d7ee0cb5f01	9tqUnL5tIYnJ6hGQu-ceMaIOd7tnLq5rnxYmI6dlT_s	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	127.0.0.1	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	2025-11-03 03:29:13.397941+00	2025-11-10 08:29:13.610342+00	2025-11-19 08:15:24.877247+00
fb74be19-d98b-4879-92b5-361ab20d74fa	b25889fa-76a3-4008-950c-6d7ee0cb5f01	Yj2xpgZJ5EHe4Lhxajjvlrv6LGkl0KwkD_-PZYGGG4I	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	127.0.0.1	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	2025-11-03 10:54:28.351146+00	2025-11-10 15:54:28.562131+00	2025-11-19 08:15:24.877247+00
2c8b8923-5305-4c5d-80e2-ce5362a04e82	b25889fa-76a3-4008-950c-6d7ee0cb5f01	40JLGWYemfvVJBDiH0bvT2EH-ou1kPwFmXvdn6xCMYU	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-03 11:50:43.027284+00	2025-11-10 16:50:43.246782+00	2025-11-19 08:15:24.877247+00
26e5a676-fd63-4f60-9328-9746614454bb	b25889fa-76a3-4008-950c-6d7ee0cb5f01	VF9PQmq-tC5zrX9DTzEvaLqfBdv_25_r6YHt8gWEWls	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-03 18:55:07.526423+00	2025-11-10 23:55:07.729963+00	2025-11-19 08:15:24.877247+00
816ff77f-2369-4c3e-9b91-84c1cb5d6b42	b25889fa-76a3-4008-950c-6d7ee0cb5f01	iHk-iWRK7W9tQQRwl0obakSFJiDeivMSXLl0CaluQcU	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-04 01:47:30.094858+00	2025-11-11 06:47:30.309733+00	2025-11-19 08:15:24.877247+00
c964c308-7590-4c13-9cf4-eb4fa3f06a3c	b25889fa-76a3-4008-950c-6d7ee0cb5f01	iiKoC2MINhPPKrQjUqcR4zis3g7d1wUHVQ9D9QfExK8	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-04 02:11:38.646679+00	2025-11-11 07:11:38.846461+00	2025-11-19 08:15:24.877247+00
35f9979b-2a33-4870-99d3-f98798b177bb	b25889fa-76a3-4008-950c-6d7ee0cb5f01	EyGLYlEMN66pRARtdZMeSWH8fNLxgunB_hrVKrBEr-U	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36	127.0.0.1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36	2025-11-04 02:26:27.117578+00	2025-11-11 07:26:27.316371+00	2025-11-19 08:15:24.877247+00
9c1a7464-cee3-4987-8289-1310ee3b8e8a	b25889fa-76a3-4008-950c-6d7ee0cb5f01	BvLe6rbExF7TY476WYKP25qSCNYynEPdP0cjh3EK3Xg	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36	127.0.0.1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36	2025-11-04 03:07:11.8679+00	2025-11-11 08:07:12.075301+00	2025-11-19 08:15:24.877247+00
0bcd749f-a661-4310-a528-109ab0622096	b25889fa-76a3-4008-950c-6d7ee0cb5f01	udm-i06TxjgwAtWc7Vf01wAKh_oMPByMu_rbW5K9CZM	python-httpx/0.25.2	127.0.0.1	python-httpx/0.25.2	2025-11-04 03:11:12.639632+00	2025-11-11 08:11:12.836472+00	2025-11-19 08:15:24.877247+00
2cca43dc-04bf-4aa4-b338-e8f7958c918d	b25889fa-76a3-4008-950c-6d7ee0cb5f01	mM-S7_EdMLlGlMBM7sRjyzNcvJjgws-Wfpg20nmgzTA	python-httpx/0.25.2	127.0.0.1	python-httpx/0.25.2	2025-11-04 03:16:46.872481+00	2025-11-11 08:16:47.078451+00	2025-11-19 08:15:24.877247+00
2a43b392-fd07-45e2-8fb5-47b215a6786b	b25889fa-76a3-4008-950c-6d7ee0cb5f01	t77jKYTjbXaF3j6hoAzhlIvixD0yWNygFzrWie6X6Sg	python-httpx/0.25.2	127.0.0.1	python-httpx/0.25.2	2025-11-04 03:17:15.78248+00	2025-11-11 08:17:15.988407+00	2025-11-19 08:15:24.877247+00
88cb0cf9-0af5-4bcc-b946-610e26451086	b25889fa-76a3-4008-950c-6d7ee0cb5f01	Rv7jL3oCUTza01ghtaJu6wy0lnxSY1Becmj44aEHtF0	python-httpx/0.25.2	127.0.0.1	python-httpx/0.25.2	2025-11-04 03:19:00.010898+00	2025-11-11 08:19:00.210414+00	2025-11-19 08:15:24.877247+00
d3217e18-1482-4a2d-812b-76a9b94238c7	b25889fa-76a3-4008-950c-6d7ee0cb5f01	8-4KF7qVyOqcREc3_2uCuBys03CA1UH7yBVfy6-rdBU	python-httpx/0.25.2	127.0.0.1	python-httpx/0.25.2	2025-11-04 03:20:13.399897+00	2025-11-11 08:20:13.603853+00	2025-11-19 08:15:24.877247+00
99b014a4-817d-4cbc-8a0f-c17a06f03a86	b25889fa-76a3-4008-950c-6d7ee0cb5f01	Kg1-XWXacJ_OKphJOhR53SieIMTB0StligeZpBCxR4o	python-httpx/0.25.2	127.0.0.1	python-httpx/0.25.2	2025-11-04 03:23:40.156069+00	2025-11-11 08:23:40.349654+00	2025-11-19 08:15:24.877247+00
5f5159a7-38d4-4ee0-a3ba-d8ca4bcca405	b25889fa-76a3-4008-950c-6d7ee0cb5f01	zRqqOs2Y64AmbmGR3CDFH5LcU1sFClg52ITr_f6UIww	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36	127.0.0.1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36	2025-11-04 03:23:46.519721+00	2025-11-11 08:23:46.730061+00	2025-11-19 08:15:24.877247+00
4bb43116-ff43-4296-b2a4-52283a91d90f	b25889fa-76a3-4008-950c-6d7ee0cb5f01	Tqo8fVXPPsM7-daCxfPacsKImZ9fESrP21PBJSN2h_Y	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36	127.0.0.1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36	2025-11-05 12:26:41.931451+00	2025-11-12 17:26:42.152418+00	2025-11-19 08:15:24.877247+00
5eab2bc7-6234-46dd-9d16-b616606e25ba	b25889fa-76a3-4008-950c-6d7ee0cb5f01	3NLlkcR67cIBPN_PZPmNoXmackJrpL3-o4X9dqpzfRM	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-05 12:42:37.645071+00	2025-11-12 17:42:37.869152+00	2025-11-19 08:15:24.877247+00
2ef472c0-69f4-402c-9d83-76cb57de515e	b25889fa-76a3-4008-950c-6d7ee0cb5f01	uEaqVkYaiZdg7SYmT2owcXsynRYPmxVI1u3e4Uhhwjg	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-05 13:03:23.215542+00	2025-11-12 18:03:23.4389+00	2025-11-19 08:15:24.877247+00
5244d9ff-6f50-4558-8b55-8a9ac8096c2f	b25889fa-76a3-4008-950c-6d7ee0cb5f01	nxRji2Q372TGCibwbPElIkGaDyzbk0g0q1YxJpakQSQ	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-05 19:38:57.841284+00	2025-11-13 00:38:58.062073+00	2025-11-19 08:15:24.877247+00
23f3fd3a-3019-4a86-a41c-7d005311a86f	b25889fa-76a3-4008-950c-6d7ee0cb5f01	FKUfvWjSYNLC-SmIm_URkf804Aex8vYBwLlyg159ojg	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-05 22:44:15.558611+00	2025-11-13 03:44:15.991371+00	2025-11-19 08:15:24.877247+00
c6966d27-0b95-4cf8-9768-8b67d266b765	b25889fa-76a3-4008-950c-6d7ee0cb5f01	z7WqFj1Tew_njlJe6blPHUEUTuqizsowY8dKdEV_1uE	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-05 23:20:38.694108+00	2025-11-13 04:20:38.906946+00	2025-11-19 08:15:24.877247+00
32011b33-c00c-4755-8ef3-6e5dba167529	b25889fa-76a3-4008-950c-6d7ee0cb5f01	TyTMbNu4H6hXQhwqS3x4rKMPrz8oDirTcgPjRqXygvg	curl/8.5.0	127.0.0.1	curl/8.5.0	2025-11-24 21:07:58.113886+00	2025-12-02 02:07:58.315656+00	\N
e4ea852b-c384-4e88-bb8a-7a7fea3d5b9b	b25889fa-76a3-4008-950c-6d7ee0cb5f01	hQ3j0OSR9wyk_7PbDGD7rtt7aRfl93bv1wm1MKeI3K8	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-05 23:47:45.006924+00	2025-11-13 04:47:45.219085+00	2025-11-19 08:15:24.877247+00
3f1cb665-bb3b-4b44-ba99-ad03438e88cf	b25889fa-76a3-4008-950c-6d7ee0cb5f01	xc-wuY_LpldxiVf1GuBfnx9za_erCKS6nTF3OjH2-F8	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-06 00:31:27.56334+00	2025-11-13 05:31:27.777017+00	2025-11-19 08:15:24.877247+00
0aaffc35-f535-4a54-bacf-15e2adac0699	b25889fa-76a3-4008-950c-6d7ee0cb5f01	aLll4DsiR-CRILYgBee3XbuHIfTOhQtrqjR_vWfBIAk	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-06 00:53:20.273998+00	2025-11-13 05:53:20.490988+00	2025-11-19 08:15:24.877247+00
70ac8dee-b9a2-4cfe-88d8-e34b7835d49a	b25889fa-76a3-4008-950c-6d7ee0cb5f01	oQeVhtM3oog_JiRz_GBj_W0HL3pvBTHBBSNDKv3w6tw	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36	127.0.0.1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36	2025-11-06 01:14:12.99361+00	2025-11-13 06:14:13.202877+00	2025-11-19 08:15:24.877247+00
3b1f01f2-549b-4bbe-bf6a-2b9494349088	b25889fa-76a3-4008-950c-6d7ee0cb5f01	TfOQZydFrdrFCR5N5iqMQpYX5KfqZ5tOMW4npS4M8N4	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-06 01:30:39.103922+00	2025-11-13 06:30:39.35196+00	2025-11-19 08:15:24.877247+00
af87cb91-767b-477d-a3cd-d92d8ad83120	b25889fa-76a3-4008-950c-6d7ee0cb5f01	RGPxHtqFG-SvsVG4BV9HReCp_DPxq1unHK7AF1f6JVo	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-06 01:46:38.50471+00	2025-11-13 06:46:38.72032+00	2025-11-19 08:15:24.877247+00
173d1e2c-9589-4c4b-90ae-917acb3d48df	b25889fa-76a3-4008-950c-6d7ee0cb5f01	En_1rsjJhrMW0Zy5trhjGJ_gO5E3C6OfKxtv1mMXHwc	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-06 02:07:48.932808+00	2025-11-13 07:07:49.155263+00	2025-11-19 08:15:24.877247+00
41155583-6e0c-4c5b-9a4a-d8840567c9c6	b25889fa-76a3-4008-950c-6d7ee0cb5f01	8csu6oMyBI-dzR2OqQU2gAjMA1yXLwbZRmjAUJMT8d4	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-06 02:24:47.979132+00	2025-11-13 07:24:48.191808+00	2025-11-19 08:15:24.877247+00
398fb0b2-3e94-4fa5-9002-e9321171d6f3	b25889fa-76a3-4008-950c-6d7ee0cb5f01	c5qUy9FUJjjRvROSDHNiLj2wAOQOzeAwxRisgk-ZVSs	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-06 02:41:20.287954+00	2025-11-13 07:41:20.502129+00	2025-11-19 08:15:24.877247+00
d195dcc7-13e4-4d8a-b563-457166a14220	b25889fa-76a3-4008-950c-6d7ee0cb5f01	Zrck5tDmqZTmwJbSMrFlCBolq2wEV9_47I7JoW7qaoU	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36	127.0.0.1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36	2025-11-06 02:58:05.123056+00	2025-11-13 07:58:05.336018+00	2025-11-19 08:15:24.877247+00
feea1367-2da5-4485-938c-0d5b5ca0b7fb	b25889fa-76a3-4008-950c-6d7ee0cb5f01	NHK34Dt5D4JhTWNF0wAdmyQhuGvEAzeJ6w4o7MqilaI	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-06 03:23:42.460884+00	2025-11-13 08:23:42.682218+00	2025-11-19 08:15:24.877247+00
fe8dce43-5c40-4126-af2d-e48f41206cf6	b25889fa-76a3-4008-950c-6d7ee0cb5f01	mNk3FXtYBUVgUUp6LhYUaiQr4aSuFMf6MoSWzwl1WyE	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	127.0.0.1	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	2025-11-06 15:14:16.544403+00	2025-11-13 20:14:16.795551+00	2025-11-19 08:15:24.877247+00
4df5eca6-861e-41dd-86ea-56a8999a85c4	b25889fa-76a3-4008-950c-6d7ee0cb5f01	Eja5_WscydukZuTGWTYrUQoRSB-JLQAUdjvwQvwpSaY	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-07 21:31:08.296058+00	2025-11-15 02:31:08.489622+00	2025-11-19 08:15:24.877247+00
f1257933-6560-41fb-8356-8aa771aff0fd	b25889fa-76a3-4008-950c-6d7ee0cb5f01	ttmqx2P0HHrPT2wXzF6qvrawZ1YO-Bkbam5Gcfm9r1I	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-10 18:43:00.004826+00	2025-11-17 23:43:00.225907+00	2025-11-19 08:15:24.877247+00
d77fcf67-6e94-4772-8e95-a93a99e698ef	b25889fa-76a3-4008-950c-6d7ee0cb5f01	X9qyi9FfiUmLbiSqK6bSYGUqqfkAA89c0UcYLy6ty9s	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-10 20:27:42.126197+00	2025-11-18 01:27:42.335873+00	2025-11-19 08:15:24.877247+00
d395e8f3-ed13-4ee0-8bb0-7e3c832f3cb0	b25889fa-76a3-4008-950c-6d7ee0cb5f01	0iYwkZu1wVQSNdCb6tDvTeSBg5bx_dNd3hVu7ryLLCU	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-11 01:47:35.564878+00	2025-11-18 06:47:35.979983+00	2025-11-19 08:15:24.877247+00
7af515ff-0a79-4e7f-85df-d3692ee65593	b25889fa-76a3-4008-950c-6d7ee0cb5f01	Tf4yUIcUKvmGZybGBRj25BjLc1J6PBoQ0Ve-buJjbyk	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-11 02:05:10.770551+00	2025-11-18 07:05:11.165874+00	2025-11-19 08:15:24.877247+00
ac6c65f9-fdfd-4f23-9b28-691de3335e96	b25889fa-76a3-4008-950c-6d7ee0cb5f01	i4EU1_MIJIWlXZQ01sx0oDfI5WJyzlTP-Hyumi1VXN4	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-11 02:46:49.152789+00	2025-11-18 07:46:49.375966+00	2025-11-19 08:15:24.877247+00
393f2487-27cb-4b65-911d-f84513ea6050	b25889fa-76a3-4008-950c-6d7ee0cb5f01	HMAsdKoHp1AxYYzP0VYd85pg5FgHIVqnWjPG9mt45gY	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	127.0.0.1	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	2025-11-11 10:58:10.892028+00	2025-11-18 15:58:11.128139+00	2025-11-19 08:15:24.877247+00
8931bc55-3c3e-4858-8c98-6e9ec42b9a1d	b25889fa-76a3-4008-950c-6d7ee0cb5f01	_R5JVJrdC3oPK692CTeOwa8lJ_WjpAZbfNmPRMz3cVg	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36	127.0.0.1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36	2025-11-11 11:46:06.594371+00	2025-11-18 16:46:06.811433+00	2025-11-19 08:15:24.877247+00
1022a15b-b983-4fea-8c74-b43564b67bb5	b25889fa-76a3-4008-950c-6d7ee0cb5f01	KeNB4TJRyMBheD5nIjcz2PIywdveStEk_seP25PwSgA	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36	127.0.0.1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36	2025-11-11 11:59:48.175664+00	2025-11-18 16:59:48.386389+00	2025-11-19 08:15:24.877247+00
2ba26fab-38fd-4416-a786-5b8e6492e552	b25889fa-76a3-4008-950c-6d7ee0cb5f01	Oo3wwh--wcAZ2We9GJvuJH6gGzPE9RhNJfJMuV4Yz-Y	curl/8.5.0	127.0.0.1	curl/8.5.0	2025-11-24 21:08:15.295725+00	2025-12-02 02:08:15.490036+00	\N
339983a7-d273-451e-98f4-dd30f895df56	b25889fa-76a3-4008-950c-6d7ee0cb5f01	Fa4kANO5AVs2NJs8bROMoK1uL4Mgzjd7bqfSNgF2J_Y	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36	127.0.0.1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36	2025-11-11 14:21:51.14097+00	2025-11-18 19:21:51.354534+00	2025-11-19 08:15:24.877247+00
a46e0655-de9e-4717-928c-8f7811e8f6cb	b25889fa-76a3-4008-950c-6d7ee0cb5f01	sIhBYA4r9ds4tnVnaH-OIOP_NUDYCUG58dJgZcZfGso	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36	127.0.0.1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36	2025-11-12 01:49:47.201559+00	2025-11-19 06:49:47.413056+00	2025-11-19 08:15:24.877247+00
7a7b4ecf-1c25-44c7-9076-c572e16523a7	b25889fa-76a3-4008-950c-6d7ee0cb5f01	_Kfar0FhiKoQ10YEZ77re8C0URe1iN3MpeboErsupsY	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36	127.0.0.1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36	2025-11-12 02:09:34.294234+00	2025-11-19 07:09:34.510296+00	2025-11-19 08:15:24.877247+00
5b035368-7171-4252-b883-dbf2baa3391f	b25889fa-76a3-4008-950c-6d7ee0cb5f01	lKJC6uo6RrPqCwfdbvrSiz6ktJA_q2tQyFEkMdCva4w	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36	127.0.0.1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36	2025-11-13 12:26:38.740786+00	2025-11-20 17:26:38.959207+00	2025-11-19 08:15:24.877247+00
1556850f-e982-4032-b630-366a3dd3c012	b25889fa-76a3-4008-950c-6d7ee0cb5f01	RfhntM9oypF4IG3GYlbPDEz1KDgH761L7wLeggYPD5c	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36	127.0.0.1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36	2025-11-13 12:44:45.133228+00	2025-11-20 17:44:45.357082+00	2025-11-19 08:15:24.877247+00
cecaa866-89d0-411a-a0f6-81c0ae2d9068	b25889fa-76a3-4008-950c-6d7ee0cb5f01	6VkluwDJhJIZ355u66uEVxcWpZalnsX4yOk2kcKxPOo	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36	127.0.0.1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36	2025-11-13 17:38:17.685008+00	2025-11-20 22:38:17.896009+00	2025-11-19 08:15:24.877247+00
3a770067-25b2-441f-8266-e4290112e47c	b25889fa-76a3-4008-950c-6d7ee0cb5f01	x37Mbrf7_54klogtyCHnPF37U8MAGewVw1CpRbZRRqs	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-13 18:20:29.555192+00	2025-11-20 23:20:29.768947+00	2025-11-19 08:15:24.877247+00
1223583e-370d-48f4-b127-02368369599d	b25889fa-76a3-4008-950c-6d7ee0cb5f01	KhA2nmUoPPblIfL9PmE20eztvp7Y8VsS2wdAhhmDCkE	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-13 18:50:01.187838+00	2025-11-20 23:50:01.398278+00	2025-11-19 08:15:24.877247+00
fe27aa31-649a-4932-957b-0655c8c5ca2a	b25889fa-76a3-4008-950c-6d7ee0cb5f01	FAiYOqLydkhMgkd_s_BFvXgbklzizDW54NG33jL2VBI	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-13 19:20:48.898525+00	2025-11-21 00:20:49.10649+00	2025-11-19 08:15:24.877247+00
4fd88e73-cbe4-4c3a-b6b5-0f2d0f196c1c	b25889fa-76a3-4008-950c-6d7ee0cb5f01	OlkRKhYmHrLLRSthU83cSqRHjzmDSLiKM6nkCU-IfYE	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-13 20:15:02.224667+00	2025-11-21 01:15:02.456375+00	2025-11-19 08:15:24.877247+00
60ec3236-7d6d-4004-b952-854efeefa154	b25889fa-76a3-4008-950c-6d7ee0cb5f01	ZnSCLvQM2y1Mf8I-ZlnzFa8mLcM9_8fzOq7uNG4g1ns	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-13 21:39:28.128501+00	2025-11-21 02:39:28.348902+00	2025-11-19 08:15:24.877247+00
88ada8cb-5b65-4c7d-b04c-4be1b7b48877	b25889fa-76a3-4008-950c-6d7ee0cb5f01	j5k9S_FB5zrcj4sOKoXifjNVqxdFTDV6FlAcOPnU4OA	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-14 02:18:31.917482+00	2025-11-21 07:18:32.131571+00	2025-11-19 08:15:24.877247+00
a04411eb-0a72-4bdf-bc86-6a420e548973	b25889fa-76a3-4008-950c-6d7ee0cb5f01	S3AAw1Qbb4LZbU20VcBZvy-aGtFDtzdNVYRHHlT1pM4	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-14 02:34:19.816502+00	2025-11-21 07:34:20.02318+00	2025-11-19 08:15:24.877247+00
c786a3b3-5251-4c61-9655-c776263a1029	b25889fa-76a3-4008-950c-6d7ee0cb5f01	TNkIOfPQhkoRItR5pznM6ek4O0MIm1KR_-l0agfx954	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-14 02:53:46.657309+00	2025-11-21 07:53:46.859032+00	2025-11-19 08:15:24.877247+00
ccd720c1-2894-4e43-a4c0-03030272932c	b25889fa-76a3-4008-950c-6d7ee0cb5f01	3Wk0EipbYlDf_UbbJ2Vc5UAezZx4lScew5wqbPcDcS8	curl/8.5.0	127.0.0.1	curl/8.5.0	2025-11-15 02:20:28.787001+00	2025-11-22 07:20:29.028107+00	2025-11-19 08:15:24.877247+00
dbc20738-1bff-418f-824d-5aaa37687cf5	b25889fa-76a3-4008-950c-6d7ee0cb5f01	W6HwDKHWj5Q0KbDhQBmJ8gLlEUdkz1qs9TDEMcXvZQ4	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	127.0.0.1	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	2025-11-15 02:32:33.211307+00	2025-11-22 07:32:33.42196+00	2025-11-19 08:15:24.877247+00
9353e232-2d9e-46d8-aed3-3b3da1a92bbe	b25889fa-76a3-4008-950c-6d7ee0cb5f01	YlxBe5IJ61wOie_h3CWzXqIIFTWHpl400jW5dOE_xhc	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-15 03:21:49.31094+00	2025-11-22 08:21:49.520678+00	2025-11-19 08:15:24.877247+00
b5b418ae-8c85-4256-9e93-d39f906cb314	b25889fa-76a3-4008-950c-6d7ee0cb5f01	7Uvnu9Cap03WCjSooUOHfnXE8fx60YdvqQsgW9WKEY8	curl/8.5.0	127.0.0.1	curl/8.5.0	2025-11-15 03:26:31.951631+00	2025-11-22 08:26:32.173326+00	2025-11-19 08:15:24.877247+00
bc6c2555-1988-41fd-9f56-d3371225a60b	b25889fa-76a3-4008-950c-6d7ee0cb5f01	AEX_itAoV8ZhdSH284IZE8PT_-2YrIAlAc4R_cBeh_g	curl/8.5.0	127.0.0.1	curl/8.5.0	2025-11-15 03:26:39.399763+00	2025-11-22 08:26:39.622864+00	2025-11-19 08:15:24.877247+00
f9804a33-242d-4517-b34a-bc9285c7dd11	b25889fa-76a3-4008-950c-6d7ee0cb5f01	4M5VFJFDx4PkgnasygyKuK_BHfo-ia3g0GhOqbEj6fY	curl/8.5.0	127.0.0.1	curl/8.5.0	2025-11-15 03:26:46.334831+00	2025-11-22 08:26:46.54914+00	2025-11-19 08:15:24.877247+00
a5d65eea-05db-440d-aeea-c9f5ad1feb3a	b25889fa-76a3-4008-950c-6d7ee0cb5f01	4GY7p1SofIl96g6C-73WaZERMMtfedVxI4Yz-5z5Mwg	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	127.0.0.1	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	2025-11-15 18:26:19.92478+00	2025-11-22 23:26:20.141911+00	2025-11-19 08:15:24.877247+00
a206b584-b11f-4e74-84e1-1c801839c209	b25889fa-76a3-4008-950c-6d7ee0cb5f01	jub7QYlSRm59zqdPaySBgj5j4ZiYLHYIjAu0rV4FKpQ	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-15 18:52:30.197308+00	2025-11-22 23:52:30.414673+00	2025-11-19 08:15:24.877247+00
76ca7274-9f11-4192-bb14-68a5469e7183	b25889fa-76a3-4008-950c-6d7ee0cb5f01	iBuVlOGJy_KT6BSCmZnhjbC9n2ROm4dODyxWP20tzsg	curl/8.5.0	127.0.0.1	curl/8.5.0	2025-11-15 19:37:19.886169+00	2025-11-23 00:37:20.097659+00	2025-11-19 08:15:24.877247+00
a4231b31-fd1f-47b3-8f84-fff27aaac627	b25889fa-76a3-4008-950c-6d7ee0cb5f01	m5fbAN1n_RuH5RUt2zzpLrC9AB-NfEcaPIfqFZKObEA	curl/8.5.0	127.0.0.1	curl/8.5.0	2025-11-15 19:37:28.700854+00	2025-11-23 00:37:28.925883+00	2025-11-19 08:15:24.877247+00
ebada1aa-a542-4ca2-9ee6-ffeb17e88279	b25889fa-76a3-4008-950c-6d7ee0cb5f01	HUcI4A28mwONOEvR_mrnrFbPaJTko09JWUPgAG08q3Q	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-15 19:57:00.65252+00	2025-11-23 00:57:00.874089+00	2025-11-19 08:15:24.877247+00
80ba8e4a-36dd-4e3c-891d-aeac6d3e9a04	b25889fa-76a3-4008-950c-6d7ee0cb5f01	xvOUJwQh_iDkwr22R3kc98241RnzjyT5rtH01TB13Gs	curl/8.5.0	127.0.0.1	curl/8.5.0	2025-11-15 20:11:03.464602+00	2025-11-23 01:11:03.683162+00	2025-11-19 08:15:24.877247+00
bc4f7b17-ab65-43e5-9869-68743aa41c53	b25889fa-76a3-4008-950c-6d7ee0cb5f01	brRtppysLNXZRnBC3xQS4u0pSVT8obRFmLQ6EiffnLc	curl/8.5.0	127.0.0.1	curl/8.5.0	2025-11-15 20:12:32.394286+00	2025-11-23 01:12:32.606539+00	2025-11-19 08:15:24.877247+00
7eba4c98-e465-4c7b-92fd-8cb59e70d11c	b25889fa-76a3-4008-950c-6d7ee0cb5f01	6ZHhU1boPR56a6YHmOWieJ1UNVcA5dJ4nUmh5e5HGu0	curl/8.5.0	127.0.0.1	curl/8.5.0	2025-11-15 20:27:03.673832+00	2025-11-23 01:27:03.885978+00	2025-11-19 08:15:24.877247+00
2a0ac44e-854f-43f6-8db9-2d0526b3b2b4	b25889fa-76a3-4008-950c-6d7ee0cb5f01	Sxiog6f4NeV8dgwhjYWvcBFMjeoHoJImowlZJSvVauA	curl/8.5.0	127.0.0.1	curl/8.5.0	2025-11-15 20:34:38.454991+00	2025-11-23 01:34:38.683734+00	2025-11-19 08:15:24.877247+00
2c98d2b8-6600-41a4-9430-4a176753ee8a	b25889fa-76a3-4008-950c-6d7ee0cb5f01	_lGIlDVM_kFE8DWZYKDdezvHjiQa0ueazQ9T1t4GYEs	curl/8.5.0	127.0.0.1	curl/8.5.0	2025-11-15 20:34:47.973391+00	2025-11-23 01:34:48.187141+00	2025-11-19 08:15:24.877247+00
df5a1fd3-b8a0-42ca-824e-1c24890bda95	b25889fa-76a3-4008-950c-6d7ee0cb5f01	SYT7BYhfbJsUHDv97O6gVEUZqsU-3CX8tAc9MttYJA8	curl/8.5.0	127.0.0.1	curl/8.5.0	2025-11-15 20:37:08.947147+00	2025-11-23 01:37:09.162338+00	2025-11-19 08:15:24.877247+00
46fb68e1-c596-4ab4-b415-1eb6230c484e	b25889fa-76a3-4008-950c-6d7ee0cb5f01	evRg5UAD7iDFf5rzV1bZTXh88rInrSFWgfUrxnM6MUw	curl/8.5.0	127.0.0.1	curl/8.5.0	2025-11-15 20:37:16.496267+00	2025-11-23 01:37:16.729455+00	2025-11-19 08:15:24.877247+00
b70d715d-c104-4173-8ea8-a38166aaf2a9	b25889fa-76a3-4008-950c-6d7ee0cb5f01	KgY9JUxxKGuyqaSi46sgiazE_k485KS-ID-5buDulL0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-15 21:03:59.299247+00	2025-11-23 02:03:59.50219+00	2025-11-19 08:15:24.877247+00
6da969da-f630-478c-a229-bf01f9df03a2	b25889fa-76a3-4008-950c-6d7ee0cb5f01	fflk3fEvPrAaQhbkhvNDVKLwsi0v50CXpOnQVjQU-18	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-16 01:18:18.651361+00	2025-11-23 06:18:18.86099+00	2025-11-19 08:15:24.877247+00
cdbccd77-f792-4902-836e-7dc0b7bd3392	b25889fa-76a3-4008-950c-6d7ee0cb5f01	HYereZI3-4ntIpCod4TJ-hvC851DdTHYN32h7Tmo2ko	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	127.0.0.1	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	2025-11-16 02:33:03.062801+00	2025-11-23 07:33:03.269932+00	2025-11-19 08:15:24.877247+00
718064a6-003b-4a24-a1fa-05f3ea527163	b25889fa-76a3-4008-950c-6d7ee0cb5f01	vV_3wyfWaPPN5Drjl-WptDh1HMK14pBoUbRm6W72Jk0	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	127.0.0.1	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	2025-11-16 14:42:56.104437+00	2025-11-23 19:42:56.307172+00	2025-11-19 08:15:24.877247+00
2841ba74-84ec-4127-8642-51c5ec55428c	b25889fa-76a3-4008-950c-6d7ee0cb5f01	_kG6IhELd9J0CX6LvZ3GzeX1ZwiRcXMN95EMCRF1n3k	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-17 14:22:04.74481+00	2025-11-24 19:22:04.948333+00	2025-11-19 08:15:24.877247+00
fc9508e2-b33b-405a-b882-264eb005d8dc	b25889fa-76a3-4008-950c-6d7ee0cb5f01	A5dNZ2r_K8sMcg6qVuYxdp4Fg-gbbx0WLc97GvcqPVI	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-17 14:38:14.69348+00	2025-11-24 19:38:14.883698+00	2025-11-19 08:15:24.877247+00
077e86dc-3b34-4b0e-b4f4-77b3ef2c1807	b25889fa-76a3-4008-950c-6d7ee0cb5f01	cF3C3mPBBD6YIaBa9iIMLxPmOew1AYR7kTgRY0dVbBw	curl/8.5.0	127.0.0.1	curl/8.5.0	2025-11-18 03:42:41.266928+00	2025-11-25 08:42:41.459542+00	2025-11-19 08:15:24.877247+00
06476b69-ad1d-460d-a4ba-00d58c2eefa9	b25889fa-76a3-4008-950c-6d7ee0cb5f01	baX8x5ZPKJcZz2rkQk9_XOIQx_J_3Hrq38ukJ6PRYDs	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-18 03:42:51.092587+00	2025-11-25 08:42:51.28253+00	2025-11-19 08:15:24.877247+00
c9e4b9ea-5734-4046-bb2c-0df2d59dd03d	b25889fa-76a3-4008-950c-6d7ee0cb5f01	k6WpQd31WpOscCV35HgD3LO48lCRCMUJIkscnYaL0AY	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-19 01:39:45.988158+00	2025-11-26 06:39:46.40952+00	2025-11-19 08:15:24.877247+00
0e3fe74e-072a-4b16-b7c7-fb24fe4231e7	b25889fa-76a3-4008-950c-6d7ee0cb5f01	8yOT85BgdGKn-jUkJPctozW2kIpFBgfVVOfBn0RRr9E	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-19 03:10:52.252632+00	2025-11-26 08:10:52.459581+00	2025-11-19 08:15:24.877247+00
ef2efc0c-54a1-41a6-9c35-34d74c471ce7	b25889fa-76a3-4008-950c-6d7ee0cb5f01	KEp5i0bv4Mlt6WEz-yw3IQN0ZQQClrVMtg8rwHlxWX8	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36	127.0.0.1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36	2025-11-20 01:56:16.413754+00	2025-11-27 06:56:16.601945+00	2025-11-20 07:03:43.605687+00
d84d925d-5b22-4a32-b7d2-22cc9db8e13a	b25889fa-76a3-4008-950c-6d7ee0cb5f01	yPCDN89pEnr3o2PdkaoGEBBtFLyliGjpdU49YE6Z-MQ	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-21 01:43:42.998523+00	2025-11-28 06:43:43.202469+00	\N
a93e9a04-30b1-4810-aeed-901c3659aa2e	b25889fa-76a3-4008-950c-6d7ee0cb5f01	naJaGTotFPw2zJGm7VtHC0A4-1Up-6pKA4oKVIs5AyM	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-24 01:54:45.279932+00	2025-12-01 06:54:45.481925+00	\N
a215548d-a9c2-41e3-8d83-a7c63b4bcae8	b25889fa-76a3-4008-950c-6d7ee0cb5f01	tPqf8TXRDDVHnP-RLI7jSCSGa-11nvh0zNlYn_k_GT8	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-24 20:57:39.387808+00	2025-12-02 01:57:39.593961+00	\N
ec704a32-0b2b-4dbd-a30a-5ae45960ba50	b25889fa-76a3-4008-950c-6d7ee0cb5f01	sWCdmLsUUZ4WCp4HIAqNyKFJ9qLuUtFz2I1sVZqdwNQ	curl/8.5.0	127.0.0.1	curl/8.5.0	2025-11-24 21:08:20.381785+00	2025-12-02 02:08:20.568714+00	\N
a1d88514-d9ce-479d-9581-69f04fe7db83	e8de48bf-8e93-429a-86af-6f1a1c7a216f	mLMCxg2QrfqS2tRoNTmW-JpsjpnmrebF5cTsnrkg44o	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36	2025-11-26 14:03:17.304689+00	2025-12-03 19:03:17.499927+00	\N
5ae6e87d-ce74-4053-b0d3-7f30ac2d8822	e8de48bf-8e93-429a-86af-6f1a1c7a216f	UKJtpYF1bk48v7ROvzVLXv9-nkpSkcb05_Ils07SzYA	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	127.0.0.1	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	2025-12-09 14:44:49.028792+00	2025-12-16 19:44:49.230559+00	\N
c7c1b295-304d-48c4-b238-278657bd0edb	b25889fa-76a3-4008-950c-6d7ee0cb5f01	MPas9M4nfPtDEPQr6-O7aao6LAmWZJ3hXgCKXX9sf9Q	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	127.0.0.1	Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1	2025-12-12 11:17:30.521327+00	2025-12-19 16:17:30.727331+00	\N
8fd74e31-3eb8-47f1-ac24-d53e90d5e945	f5685f29-eb11-44ac-be25-fc2e691883ef	8BuqbZgO4bvJgYAV4icxPjA24fwrVdshURwU1gmKOsA	curl/8.5.0	127.0.0.1	curl/8.5.0	2025-12-19 14:48:23.946326+00	2025-12-26 19:48:24.145327+00	\N
574dcb90-28c5-4067-b6b7-29db1becdc57	b25889fa-76a3-4008-950c-6d7ee0cb5f01	-mpL2Bj6b9djyYmm_Z7-ouYmYgF_1YPCCXXTWsFucHo	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2025-12-19 14:53:17.387207+00	2025-12-26 19:53:17.587619+00	\N
01a0b136-f234-4649-869f-96275bf6a1a2	b25889fa-76a3-4008-950c-6d7ee0cb5f01	qKGyEbqkvhK92o8sEF5N31ZcQvkO2bf2EuIunnMjLFY	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2025-12-29 13:27:53.155431+00	2026-01-05 18:27:53.361704+00	\N
c6ec3d70-9557-4fb5-bf8e-71ed8d61c7b7	b25889fa-76a3-4008-950c-6d7ee0cb5f01	pMfoe96MXRdFaf83Oss5_z3Hb5GEVZ_jPvVZC_m9HSs	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2025-12-29 14:22:24.472017+00	2026-01-05 19:22:24.671197+00	\N
06798626-e36e-495c-862f-bec571196ef9	b25889fa-76a3-4008-950c-6d7ee0cb5f01	-vCO96pK_gjFcGny8pD_injW92cfhvF3lrp57iD8HbI	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2025-12-29 14:59:39.622516+00	2026-01-05 19:59:39.828089+00	\N
50ed6f1b-9cb1-49e3-9932-403458d0b2db	b25889fa-76a3-4008-950c-6d7ee0cb5f01	w1Rgpn-icUxnnQukiZ8iJ8J88fuZD1JWfAvkAGNnJVc	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2025-12-29 17:42:25.829294+00	2026-01-05 22:42:26.031769+00	\N
2e6310e8-4836-41e4-ad66-f9a17ec1c211	b25889fa-76a3-4008-950c-6d7ee0cb5f01	cGJC0JUSJeZmdl5J5NdoCSm7_WFZHCliuGR8oZxOMrc	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-02 16:19:43.83725+00	2026-01-09 21:19:44.056396+00	\N
8e9f4dd6-b44f-4075-9957-17255aad08f7	b25889fa-76a3-4008-950c-6d7ee0cb5f01	ShvYUg__joncqzhAN-3N-v-h57slDDqMYOasY1wQDcY	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-13 02:00:58.905793+00	2026-01-20 07:00:59.099858+00	\N
a6ad4e5c-72a3-4b61-849a-dadc36cf91b4	b25889fa-76a3-4008-950c-6d7ee0cb5f01	fPW6n-zdKsdSZ48kaKISwDnnA8ffdm_l6vF3MlNfLJs	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-13 02:40:54.324909+00	2026-01-20 07:40:54.52147+00	\N
816937d2-51e0-4b50-b46d-1e936fc788ce	1de4003e-2860-4d3e-bd9e-42fd18831b50	7-DG76OHiExY6HRUT3KpDo4f4ns4sJ6jL07VOxnmeeY	curl/8.5.0	127.0.0.1	curl/8.5.0	2026-01-13 03:10:33.225757+00	2026-01-20 08:10:33.418688+00	\N
405e3026-0b3a-480c-aac5-d436b48c2686	b25889fa-76a3-4008-950c-6d7ee0cb5f01	8n15CHD7yzQx9fdCId0U2sw0LdAZnR7YdHCWKEQ2OVQ	curl/8.5.0	127.0.0.1	curl/8.5.0	2026-01-13 03:17:01.773652+00	2026-01-20 08:17:01.976304+00	\N
b7dc7a4f-3b1d-4ed3-9ade-0ed599595b80	b25889fa-76a3-4008-950c-6d7ee0cb5f01	DZepLx28vODunbOb0vRb9WVpXIRKmZeir1LZtawUu7o	curl/8.5.0	127.0.0.1	curl/8.5.0	2026-01-13 03:21:34.52317+00	2026-01-20 08:21:34.72288+00	\N
449d3353-4301-41a4-be50-6812fc26fed6	b25889fa-76a3-4008-950c-6d7ee0cb5f01	uBzY8--ZbbHHXj6pQA4rSNSWzHNHij1uBSNnDmB2XrA	curl/8.5.0	127.0.0.1	curl/8.5.0	2026-01-13 22:32:30.081954+00	2026-01-21 03:32:30.295945+00	\N
ea759ae1-e347-4a25-b171-ffbb2810a01b	b25889fa-76a3-4008-950c-6d7ee0cb5f01	AlR9rGiDwWF3qvTIkeEMaVVBi6E_9YQk25UXFk6nJEk	curl/8.5.0	127.0.0.1	curl/8.5.0	2026-01-13 22:33:31.881879+00	2026-01-21 03:33:32.086087+00	\N
\.


--
-- Data for Name: sponsors; Type: TABLE DATA; Schema: public; Owner: fundrbolt_user
--

COPY public.sponsors (id, event_id, name, logo_url, logo_blob_name, thumbnail_url, thumbnail_blob_name, website_url, logo_size, sponsor_level, contact_name, contact_email, contact_phone, address_line1, address_line2, city, state, postal_code, country, donation_amount, notes, display_order, created_at, updated_at, created_by) FROM stdin;
edec955e-5923-4fe7-946c-bc5a6425f138	10adb96b-75b8-4a43-8a44-c593cb853e3c	Starby's	https://augeodevst.blob.core.windows.net/npo-assets/sponsors/04b4bb2a-c27d-4deb-a157-3b713c7b0798/edec955e-5923-4fe7-946c-bc5a6425f138/20251113_182342_df93b632_Starbucks-logo-500x281.png?se=2025-11-14T18%3A23%3A43Z&sp=r&sv=2025-11-05&sr=b&sig=CxmJSFt7mjZT3c9ZnDHEAF5TsP0bcGrmO1TKSHBCF6Y%3D	sponsors/04b4bb2a-c27d-4deb-a157-3b713c7b0798/edec955e-5923-4fe7-946c-bc5a6425f138/20251113_182342_df93b632_Starbucks-logo-500x281.png	https://augeodevst.blob.core.windows.net/npo-assets/sponsors/04b4bb2a-c27d-4deb-a157-3b713c7b0798/edec955e-5923-4fe7-946c-bc5a6425f138/thumb_20251113_182342_df93b632_Starbucks-logo-500x281.png?se=2025-11-14T18%3A23%3A43Z&sp=r&sv=2025-11-05&sr=b&sig=Ox3%2BfKRECetrD10boOLs9I%2Bt1ost4r6vuLmHNfZ0Ojk%3D	sponsors/04b4bb2a-c27d-4deb-a157-3b713c7b0798/edec955e-5923-4fe7-946c-bc5a6425f138/thumb_20251113_182342_df93b632_Starbucks-logo-500x281.png	https://starbucks.com/	medium	Nice Guys	Lady Madonna	coffee@example.com	(987)654-3210	1 Goose Creek Road	\N	Alexandria	TN	37012	United States	100.67	Coffee Sponsor	1	2025-11-13 18:23:42.607779+00	2025-11-14 01:16:17.55574+00	b25889fa-76a3-4008-950c-6d7ee0cb5f01
40927f45-070a-41c7-a10c-0a92cb3ddbe1	10adb96b-75b8-4a43-8a44-c593cb853e3c	Acme Corporation	https://augeodevst.blob.core.windows.net/npo-assets/sponsors/04b4bb2a-c27d-4deb-a157-3b713c7b0798/40927f45-070a-41c7-a10c-0a92cb3ddbe1/20251113_180023_bec80eab_ACME-Logo-1981-500x282.webp?se=2025-11-14T18%3A00%3A23Z&sp=r&sv=2025-11-05&sr=b&sig=5vXRkRNGhXJ4xeY%2B6zPqH/FS017Q2ZgZYvigPB1ruGM%3D	sponsors/04b4bb2a-c27d-4deb-a157-3b713c7b0798/40927f45-070a-41c7-a10c-0a92cb3ddbe1/20251113_180023_bec80eab_ACME-Logo-1981-500x282.webp	https://augeodevst.blob.core.windows.net/npo-assets/sponsors/04b4bb2a-c27d-4deb-a157-3b713c7b0798/40927f45-070a-41c7-a10c-0a92cb3ddbe1/thumb_20251113_180023_bec80eab_ACME-Logo-1981-500x282.webp?se=2025-11-14T18%3A00%3A23Z&sp=r&sv=2025-11-05&sr=b&sig=V1cmUc8UUDyrRUuzNsd20AdYgJxCNUJKlz7NdLVDu2E%3D	sponsors/04b4bb2a-c27d-4deb-a157-3b713c7b0798/40927f45-070a-41c7-a10c-0a92cb3ddbe1/thumb_20251113_180023_bec80eab_ACME-Logo-1981-500x282.webp	http://acme.com/	large	Nice Guys	Billy Bob	bob@example.com	+1(234)567-8902	123 Main Street	\N	Piedmont	SC	29673	United States	5000.00	Anvil Sponsor	0	2025-11-13 18:00:22.740984+00	2025-11-13 23:21:03.480309+00	b25889fa-76a3-4008-950c-6d7ee0cb5f01
\.


--
-- Data for Name: ticket_audit_logs; Type: TABLE DATA; Schema: public; Owner: fundrbolt_user
--

COPY public.ticket_audit_logs (id, entity_type, entity_id, coordinator_id, field_name, old_value, new_value, changed_at) FROM stdin;
\.


--
-- Data for Name: ticket_packages; Type: TABLE DATA; Schema: public; Owner: fundrbolt_user
--

COPY public.ticket_packages (id, event_id, name, description, price, seats_per_package, quantity_limit, sold_count, display_order, image_url, is_enabled, created_by, created_at, updated_at, version, is_sponsorship) FROM stdin;
\.


--
-- Data for Name: ticket_purchases; Type: TABLE DATA; Schema: public; Owner: fundrbolt_user
--

COPY public.ticket_purchases (id, event_id, ticket_package_id, user_id, quantity, total_price, payment_status, purchased_at) FROM stdin;
\.


--
-- Data for Name: user_consents; Type: TABLE DATA; Schema: public; Owner: fundrbolt_user
--

COPY public.user_consents (id, user_id, tos_document_id, privacy_document_id, ip_address, user_agent, status, withdrawn_at, created_at, updated_at) FROM stdin;
2e6bea0d-477a-467d-ae6d-38500f16308f	f5685f29-eb11-44ac-be25-fc2e691883ef	985be23a-be9f-49dc-94bb-c2435eeb683f	eab6f5f5-ec55-4079-912a-306cd6e94418	127.0.0.1	python-httpx/0.25.2	active	\N	2025-11-04 03:09:06.929496+00	2025-11-04 03:09:06.929496+00
f1514fba-8059-4df6-a78f-8edc8eef818f	b25889fa-76a3-4008-950c-6d7ee0cb5f01	985be23a-be9f-49dc-94bb-c2435eeb683f	eab6f5f5-ec55-4079-912a-306cd6e94418	127.0.0.1	python-httpx/0.25.2	active	\N	2025-11-04 03:11:12.968853+00	2025-11-04 03:11:12.968853+00
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: fundrbolt_user
--

COPY public.users (id, email, password_hash, first_name, last_name, phone, email_verified, is_active, role_id, npo_id, created_at, updated_at, last_login_at, organization_name, address_line1, address_line2, city, state, postal_code, country, profile_picture_url, social_media_links) FROM stdin;
786394b9-db53-41b7-bef5-049245722e90	donor@test.com	$2b$12$iLl3F86MC/xgHclVpMxWr.r8UrdkjqfBUS0YuFnk.4eHCoSO0ybUi	Test	Donor	+1234567890	t	t	a928717b-0764-44eb-ac09-04daf4f880f8	\N	2025-10-24 15:16:16.808947+00	2025-10-24 15:16:16.808947+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
e4a276fd-8159-4a6b-91ed-5308a22dd8aa	debugtest@example.com	$2b$12$ncB7xhcID4gThngdec1mXe/hJtdogGWcqMrAdcQx/luqStZ6ZKCJa	Debug	Test	\N	t	t	a928717b-0764-44eb-ac09-04daf4f880f8	\N	2025-10-24 17:49:49.134922+00	2025-10-24 17:49:49.690937+00	2025-10-24 21:49:49.694158+00	\N	\N	\N	\N	\N	\N	\N	\N	\N
4a16a9c3-170e-4e6a-8d2a-9f52f5c99a6d	tokentest2@example.com	$2b$12$xqjj8sbZxi3IJHNyR5nJxO9UZvMe7Tev2ZvMUIawK5hqlV8kK8YVu	Token	Test	\N	t	t	a928717b-0764-44eb-ac09-04daf4f880f8	\N	2025-10-24 17:50:23.670696+00	2025-10-24 17:50:24.216043+00	2025-10-24 21:50:24.218885+00	\N	\N	\N	\N	\N	\N	\N	\N	\N
958a1c7b-4cd4-4e56-ae7b-2847f6758d62	debuglogout@example.com	$2b$12$3MkeZx8ceBSpVQOWvYi.Z.NpzIYGv0EAYUJwSnlTvjKLGNsiTSo1e	Debug	Logout	\N	t	t	a928717b-0764-44eb-ac09-04daf4f880f8	\N	2025-10-24 17:51:05.144364+00	2025-10-24 17:51:05.67933+00	2025-10-24 21:51:05.681854+00	\N	\N	\N	\N	\N	\N	\N	\N	\N
8f9a7e69-45a3-4c45-8076-98607bffd8fe	testverify1761354475@example.com	$2b$12$tkKo7Qp9ht30V35mggcUI..azvPrmrhm1K0v4FfDLe6Yp/dSGqnPu	Test	Verify	\N	t	t	a928717b-0764-44eb-ac09-04daf4f880f8	\N	2025-10-25 01:07:55.161525+00	2025-10-25 01:10:01.77591+00	2025-10-25 05:10:01.778886+00	\N	\N	\N	\N	\N	\N	\N	\N	\N
b6021a39-bc9b-4a6c-9edc-acb897c23616	testresend1761354659@example.com	$2b$12$EM/0lVtoyoyeQsPz85TV.OcSZXNFxsCZUmsUA90I2QCVPs9bP3XNG	Test	Resend	\N	f	f	a928717b-0764-44eb-ac09-04daf4f880f8	\N	2025-10-25 01:10:59.590341+00	2025-10-25 01:10:59.590341+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
a748e498-1771-4ce2-ac4e-f9d3a8c2866b	tokentest@example.com	$2b$12$hsKDFFXR3NJ7ulYQG7W9SOIxz4GyxCJBLTLHUpPtaQw3BBDiXx4Vi	Token	Test	\N	t	f	a928717b-0764-44eb-ac09-04daf4f880f8	\N	2025-10-24 17:50:07.638273+00	2025-10-26 10:31:54.643977+00	2025-10-24 21:50:08.176525+00	\N	\N	\N	\N	\N	\N	\N	\N	\N
6032a356-b339-479f-9dbb-e6402b7bd355	testverify@example.com	$2b$12$FTRJKsATSoJK2dEbk6v06.e/5/.vNBc8sAtRwK7hQVt/VM9WKFaaa	Test	Verify	\N	f	f	a928717b-0764-44eb-ac09-04daf4f880f8	\N	2025-10-25 01:07:37.199645+00	2025-10-25 01:07:37.199645+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
9b10617b-f6de-4aaa-9163-cf84340b3461	test@example.com	$2b$12$mkWyC3aIQ2UkmHWYcJpHt.ox2yXdsgfzKipt6ppUgWb82rt/.86u.	Test	User	+1-555-0100	f	f	a928717b-0764-44eb-ac09-04daf4f880f8	\N	2025-10-30 12:31:45.39485+00	2025-10-30 12:31:45.39485+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
f9a64323-f65d-4857-a761-60503bf3338d	josh@joshjeanes.com	$2b$12$pgk8iWr6yCcG5Z6ccE5lJOqUz047ko4Eg3wbunxlX0x5tq6EjWg3S	Test	User 1761933979	+1234567890	f	f	a928717b-0764-44eb-ac09-04daf4f880f8	\N	2025-10-31 18:06:19.848141+00	2025-10-31 18:06:19.848141+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
b75a5b2e-b408-47ce-9e61-cefe3defc875	test-resend@joshjeanes.com	$2b$12$umq2PA5zp5J3JNO1DnYN7.lChu43LDL8FX3qu/qTPkKQRszwa84zO	Test	Resend	+1234567890	f	f	a928717b-0764-44eb-ac09-04daf4f880f8	\N	2025-10-31 18:26:28.056396+00	2025-10-31 18:26:28.056396+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4582b73e-d98d-4b26-a259-360265ebd750	bluejeanes521@gmail.com	$2b$12$KXy8X/k.UxXn9XDx5V.GTO5kGnyapeccM7msrxgXN0DHzPAkS9Fyi	Test	User 1761936390	+1234567890	f	f	a928717b-0764-44eb-ac09-04daf4f880f8	\N	2025-10-31 18:46:30.303131+00	2025-10-31 18:46:30.303131+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
07d033c1-9caa-4cf2-92cc-e0a471041651	test-debug@example.com	$2b$12$HYfW/PeHTuy0T4IrLOVYseh/ycJYLHtlJpClgahMKF4Ur9yuTMhiW	Test	Debug	+1234567890	f	f	a928717b-0764-44eb-ac09-04daf4f880f8	\N	2025-10-31 18:50:13.951282+00	2025-10-31 18:50:13.951282+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
71feb847-ccab-4b29-b8c9-cbe209dc97c8	bluejeanes521+test1@gmail.com	$2b$12$FRrRrmwSh6N14aUNluMC2e2gKhQeFHNEtPwXGCea6JESJXuEnfSJS	Blue	Jeanes	+1234567890	f	f	a928717b-0764-44eb-ac09-04daf4f880f8	\N	2025-10-31 18:52:37.520267+00	2025-10-31 18:52:37.520267+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4ff64883-86f8-44df-af61-7d452081e63f	bluejeanes521+test2@gmail.com	$2b$12$aL09RGTXTe5RX85yscCdAu7ydKWk7aRzKL9XbpNwf000B0BU8gfr2	Blue	Test	+1234567890	f	f	a928717b-0764-44eb-ac09-04daf4f880f8	\N	2025-10-31 18:53:22.65921+00	2025-10-31 18:53:22.65921+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
d352f991-08b4-4906-add7-b166ec288681	bluejeanes521+test3@gmail.com	$2b$12$zqTHfb6g7DvfaRaMeOIhCOOmaWBo9/6PR4FOkSj.PdoECOAqyc5E.	Blue	Jeanes	+1234567890	t	t	a928717b-0764-44eb-ac09-04daf4f880f8	\N	2025-10-31 18:55:14.386393+00	2025-10-31 19:02:50.578713+00	2025-10-31 23:02:50.582258+00	\N	\N	\N	\N	\N	\N	\N	\N	\N
ba584b85-4a70-45ac-a2a5-f047226e8527	bluejeanes521+test4@gmail.com	$2b$12$wlq3SgbG2cOXkIWfV/uCR.7ZihFfSVOksnbTl2hBWkbEVgkgLjqlG	Blue	Jeanes	+1234567890	f	f	a928717b-0764-44eb-ac09-04daf4f880f8	\N	2025-10-31 19:08:26.607204+00	2025-10-31 19:08:26.607204+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
31a11d70-ae3f-4fcc-897d-756403590925	event_coordinator@test.com	$2b$12$.FnVDrge/vy44yWLIezacu9FNLvSxSlSU7dcG7KXEDB37zw7bc3Ee	Event	Coordinator	+1234567890	t	t	6469ec1c-c4d4-4f14-a84b-6132f96e4f02	a3423046-8a83-409c-8ad3-16fc4420a40b	2025-10-24 15:16:16.808947+00	2025-10-24 15:16:16.808947+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
7d061c32-0c44-4f1b-851b-6c35e568eb5d	npo_admin@test.com	$2b$12$/tBL4VPAjRM1p3WYX2ybV.Vin92jpxobOoRHD29cHyrZL8CFKboZS	NPO	Admin	+1234567890	t	t	c03573d0-b5ad-4970-be5a-21adcb321a7a	a3423046-8a83-409c-8ad3-16fc4420a40b	2025-10-24 15:16:16.808947+00	2025-11-10 20:17:59.59486+00	2025-11-11 01:17:59.599891+00	\N	\N	\N	\N	\N	\N	\N	\N	\N
ecffbad5-f417-47e3-b07f-35e643167c05	sarah.admin@hopefoundation.org	$2b$12$ZwVY7yr4vR.SkwviqpnOyewPBkV6/VQkQ4YaCStl/Z1SIho1uxqZi	Sarah	Johnson	\N	t	t	c03573d0-b5ad-4970-be5a-21adcb321a7a	\N	2025-11-06 14:16:09.788978+00	2025-11-06 14:16:09.788978+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
d6a438d9-d1aa-46f8-9b80-a2a0f5c8b160	mike.coadmin@hopefoundation.org	$2b$12$wdTzVyDMwsMMPGIEX2Ubiei3xBz/pxjOrsiLrMI3lCySwlhkwaQ4e	Mike	Chen	\N	t	t	c03573d0-b5ad-4970-be5a-21adcb321a7a	\N	2025-11-06 14:16:09.788978+00	2025-11-06 14:16:09.788978+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
56491d14-830f-40b8-a853-b886a83dced7	lisa.staff@hopefoundation.org	$2b$12$QJxRYaeFXCKqWB01UiycB./dErUUv7vuH9IEPStloFpQei2WgbqWy	Lisa	Rodriguez	\N	t	t	c03573d0-b5ad-4970-be5a-21adcb321a7a	\N	2025-11-06 14:16:09.788978+00	2025-11-06 14:16:09.788978+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
a13c8ee2-1e3b-44ad-a5ae-704faa005726	james.admin@greenearthinitiative.org	$2b$12$ebqagO2JB63ijV0FNFeGt.lWQfIxOdDVK0AUqc/MKNDw7.YPmn5pq	James	Green	\N	t	t	c03573d0-b5ad-4970-be5a-21adcb321a7a	\N	2025-11-06 14:16:09.788978+00	2025-11-06 14:16:09.788978+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
da53bf72-e902-49e9-abff-25d2b3325bba	emma.coadmin@greenearthinitiative.org	$2b$12$4fLG839IL49TrL3Wh0XzWOFSXTxvhUXvNPkRUCs.Ave6ASPvZ5v3K	Emma	Woods	\N	t	t	c03573d0-b5ad-4970-be5a-21adcb321a7a	\N	2025-11-06 14:16:09.788978+00	2025-11-06 14:16:09.788978+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
2bad8683-091d-4441-bb13-6404843b4b4e	dr.maria@communityhealthnetwork.org	$2b$12$x9TrWBW13eWPNhmYiLRHeuC6fpvPaxsHNI7qddlJAz9ZVA6B1t0Su	Maria	Garcia	\N	t	t	c03573d0-b5ad-4970-be5a-21adcb321a7a	\N	2025-11-06 14:16:09.788978+00	2025-11-06 14:16:09.788978+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
b2af51d1-1803-42d8-9d70-45cab886b933	john.coadmin@communityhealthnetwork.org	$2b$12$FTPsOrqNOW6KXGKlCYoSVe6NfsUEEuVgb/iid77.5K4EqLaWyWz5u	John	Smith	\N	t	t	c03573d0-b5ad-4970-be5a-21adcb321a7a	\N	2025-11-06 14:16:09.788978+00	2025-11-06 14:16:09.788978+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
1de4003e-2860-4d3e-bd9e-42fd18831b50	staff@test.com	$2b$12$XTNQJag6hr2xb8n.0NijcuGVkr4IUBoPxP7Ms02UEHMEm2I.t.juW	Staff	Member	+1234567890	t	t	c2921020-3b7b-4e7a-9f29-2f7e6cfd2faf	\N	2025-10-24 15:16:16.808947+00	2026-01-13 03:10:33.448347+00	2026-01-13 08:10:33.451381+00	\N	\N	\N	\N	\N	\N	\N	\N	\N
dec0a496-de0c-414d-a0d4-6b05e9f3f1d1	susan.staff@communityhealthnetwork.org	$2b$12$cfXv6JlrQGeNd/dYCefaw.Jsy0G7ywkggtpkMJhuQpIseyY0DRP.q	Susan	Lee	\N	t	t	c03573d0-b5ad-4970-be5a-21adcb321a7a	\N	2025-11-06 14:16:09.788978+00	2025-11-06 14:16:09.788978+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
db721e8f-37ac-4a26-b6f6-6b28b2cb0967	robert.staff@communityhealthnetwork.org	$2b$12$gNs3ZPuW1.MqB3sIDn85eeGHzBDzuLF3BcFTYnXjHhenRe9FQsubG	Robert	Brown	\N	t	t	c03573d0-b5ad-4970-be5a-21adcb321a7a	\N	2025-11-06 14:16:09.788978+00	2025-11-06 14:16:09.788978+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
53c4cb3d-2936-4d0a-8d83-52dc5078d364	alex.admin@youthartsacademy.org	$2b$12$CqcGhoOQB9kIbyA0AF2dCOWd8Gm17wJwQu0E0lfFrKO5Kk0uDlH8.	Alex	Taylor	\N	t	t	c03573d0-b5ad-4970-be5a-21adcb321a7a	\N	2025-11-06 14:16:09.788978+00	2025-11-06 14:16:09.788978+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
cdb96218-44ee-4430-9108-0fe67dc55e72	jennifer.admin@animalrescuealliance.org	$2b$12$Sv.tDHAAkZ0F/UBQgvsqJ.Oq7DAECFNh1O2dGmFDfCKRaYpIQDG7W	Jennifer	Martinez	\N	t	t	c03573d0-b5ad-4970-be5a-21adcb321a7a	\N	2025-11-06 14:16:09.788978+00	2025-11-06 14:16:09.788978+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
26fbd5a9-2045-4927-a61c-c05b57bbc311	david.staff@animalrescuealliance.org	$2b$12$FZS3KyibIkw5CcwsMpVNSeyv8JeKO5LUyZhilvaplE8nKzlM5KB4e	David	Wilson	\N	t	t	c03573d0-b5ad-4970-be5a-21adcb321a7a	\N	2025-11-06 14:16:09.788978+00	2025-11-06 14:16:09.788978+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
e8de48bf-8e93-429a-86af-6f1a1c7a216f	jeanesjustin@gmail.com	$2b$12$T6Ucn0e9mn3zFJiMQfpxLOwHQXKHwa6Qmj1qSNwv67I/yUGGYlmKy	Justin	Jeanes	8645536738	t	t	a928717b-0764-44eb-ac09-04daf4f880f8	\N	2025-11-26 13:29:56.351981+00	2025-12-10 20:32:49.996688+00	2025-12-11 01:32:49.999982+00		309 Woodhall Lane		Piedmont	SC	29673	US	\N	\N
25d5958f-9480-4da8-914a-f1f220d67b9b	josh@fundrbolt.com	$2b$12$wJzgu0ecmQ7HejjuWBo7feKXTD.1JoIVYFiVvGkbVB.eDr0YPSbJu	Josh	Jeanes	+1234567890	t	t	a928717b-0764-44eb-ac09-04daf4f880f8	\N	2025-10-31 18:03:29.339142+00	2025-10-31 18:04:41.741184+00	2025-10-31 22:04:41.744151+00	\N	\N	\N	\N	\N	\N	\N	\N	\N
061cd97f-9ad6-48a8-9dc4-80a8353ea255	staff.brightpath@fundrbolt.com	$2b$12$/XrCKfzmxvFoUBaxPhF5aeWi1o6XI7leqclYyEtlPOC88unQs1O4y	Staff	BrightPath	\N	t	t	a928717b-0764-44eb-ac09-04daf4f880f8	\N	2025-11-05 14:11:38.87934+00	2025-11-05 14:19:20.492097+00	2025-11-05 19:19:20.495737+00	\N	\N	\N	\N	\N	\N	\N	\N	\N
8035482b-c4bf-4b80-991b-7a03580771e4	co-admin.brightpath@fundrbolt.com	$2b$12$D8bCzrlxIQZ.2U8lzGNDEu2U3lRJLMgO5cu07hTRDNysGa5At0lg6	Co-Admin	Brightpath		t	t	a928717b-0764-44eb-ac09-04daf4f880f8	\N	2025-11-05 14:34:40.868274+00	2025-11-06 01:45:18.679433+00	2025-11-06 06:45:18.682666+00	\N	\N	\N	\N	\N	\N	\N	\N	\N
a65cf82f-8b98-4dc3-be15-f42352d6e2c0	superadmin@fundrbolt.com	$2b$12$0fb0a5KcM3MSA3tXDnh64.sevnw01baNcvh8CB/CQS.lOmz9b5Yaq	Super	Admin	\N	t	t	97df5649-b5ec-43c5-bd90-093010cbc428	\N	2025-11-06 14:16:09.788978+00	2025-11-06 14:43:23.824812+00	2025-11-06 19:43:23.827907+00	\N	\N	\N	\N	\N	\N	\N	\N	\N
f5685f29-eb11-44ac-be25-fc2e691883ef	admin@fundrbolt.com	$2b$12$qHMsARsehY45ifdBSakJHOqjy8xJ6wk0Bme8YahYs0dNMgP1KXmoK	Super	Admin	\N	t	t	97df5649-b5ec-43c5-bd90-093010cbc428	\N	2025-10-25 01:16:48.262787+00	2025-12-19 14:48:24.17277+00	2025-12-19 19:48:24.17581+00	\N	\N	\N	\N	\N	\N	\N	\N	\N
b25889fa-76a3-4008-950c-6d7ee0cb5f01	super_admin@test.com	$2b$12$HqpeoEd/gXqNQaRrsoqHOuO.br803IUj./yO1pHALnj3pva1M2TUe	Super	Admin	+1234567890	t	t	97df5649-b5ec-43c5-bd90-093010cbc428	\N	2025-10-24 15:16:16.808947+00	2026-01-13 22:33:32.123516+00	2026-01-14 03:33:32.126902+00	\N	\N	\N	\N	\N	\N	\N	https://augeodevst.blob.core.windows.net/npo-assets/logos/b25889fa-76a3-4008-950c-6d7ee0cb5f01/20251119_215307_8d22da8e_AugeoLogo-whiteonblack.jpg?se=2026-11-19T21%3A53%3A07Z&sp=r&sv=2025-11-05&sr=b&sig=s1VgpYJkrSFoRRb8Uk3Wfpqstn8e%2B7admX0zTkWd8eg%3D	\N
\.


--
-- Name: event_10adb96b_75b8_4a43_8a44_c593cb853e3c_bid_number_seq; Type: SEQUENCE SET; Schema: public; Owner: fundrbolt_user
--

SELECT pg_catalog.setval('public.event_10adb96b_75b8_4a43_8a44_c593cb853e3c_bid_number_seq', 103, true);


--
-- Name: event_1145ecbb_9493_4e07_b6fe_d725915d55ea_bid_number_seq; Type: SEQUENCE SET; Schema: public; Owner: fundrbolt_user
--

SELECT pg_catalog.setval('public.event_1145ecbb_9493_4e07_b6fe_d725915d55ea_bid_number_seq', 102, true);


--
-- Name: event_a2342a83_0141_4512_88b5_6e460bb11dfd_bid_number_seq; Type: SEQUENCE SET; Schema: public; Owner: fundrbolt_user
--

SELECT pg_catalog.setval('public.event_a2342a83_0141_4512_88b5_6e460bb11dfd_bid_number_seq', 103, true);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: assigned_tickets assigned_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.assigned_tickets
    ADD CONSTRAINT assigned_tickets_pkey PRIMARY KEY (id);


--
-- Name: auction_item_media auction_item_media_pkey; Type: CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.auction_item_media
    ADD CONSTRAINT auction_item_media_pkey PRIMARY KEY (id);


--
-- Name: auction_items auction_items_pkey; Type: CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.auction_items
    ADD CONSTRAINT auction_items_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: consent_audit_logs consent_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.consent_audit_logs
    ADD CONSTRAINT consent_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: cookie_consents cookie_consents_pkey; Type: CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.cookie_consents
    ADD CONSTRAINT cookie_consents_pkey PRIMARY KEY (id);


--
-- Name: custom_ticket_options custom_ticket_options_pkey; Type: CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.custom_ticket_options
    ADD CONSTRAINT custom_ticket_options_pkey PRIMARY KEY (id);


--
-- Name: event_links event_links_pkey; Type: CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.event_links
    ADD CONSTRAINT event_links_pkey PRIMARY KEY (id);


--
-- Name: event_media event_media_pkey; Type: CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.event_media
    ADD CONSTRAINT event_media_pkey PRIMARY KEY (id);


--
-- Name: event_registrations event_registrations_pkey; Type: CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.event_registrations
    ADD CONSTRAINT event_registrations_pkey PRIMARY KEY (id);


--
-- Name: event_tables event_tables_pkey; Type: CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.event_tables
    ADD CONSTRAINT event_tables_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: food_options food_options_pkey; Type: CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.food_options
    ADD CONSTRAINT food_options_pkey PRIMARY KEY (id);


--
-- Name: invitations invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_pkey PRIMARY KEY (id);


--
-- Name: legal_documents legal_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.legal_documents
    ADD CONSTRAINT legal_documents_pkey PRIMARY KEY (id);


--
-- Name: meal_selections meal_selections_pkey; Type: CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.meal_selections
    ADD CONSTRAINT meal_selections_pkey PRIMARY KEY (id);


--
-- Name: npo_applications npo_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.npo_applications
    ADD CONSTRAINT npo_applications_pkey PRIMARY KEY (id);


--
-- Name: npo_branding npo_branding_pkey; Type: CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.npo_branding
    ADD CONSTRAINT npo_branding_pkey PRIMARY KEY (id);


--
-- Name: npo_members npo_members_pkey; Type: CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.npo_members
    ADD CONSTRAINT npo_members_pkey PRIMARY KEY (id);


--
-- Name: npos npos_pkey; Type: CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.npos
    ADD CONSTRAINT npos_pkey PRIMARY KEY (id);


--
-- Name: option_responses option_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.option_responses
    ADD CONSTRAINT option_responses_pkey PRIMARY KEY (id);


--
-- Name: promo_code_applications promo_code_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.promo_code_applications
    ADD CONSTRAINT promo_code_applications_pkey PRIMARY KEY (id);


--
-- Name: promo_codes promo_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.promo_codes
    ADD CONSTRAINT promo_codes_pkey PRIMARY KEY (id);


--
-- Name: registration_guests registration_guests_pkey; Type: CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.registration_guests
    ADD CONSTRAINT registration_guests_pkey PRIMARY KEY (id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sponsors sponsors_pkey; Type: CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.sponsors
    ADD CONSTRAINT sponsors_pkey PRIMARY KEY (id);


--
-- Name: ticket_audit_logs ticket_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.ticket_audit_logs
    ADD CONSTRAINT ticket_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: ticket_packages ticket_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.ticket_packages
    ADD CONSTRAINT ticket_packages_pkey PRIMARY KEY (id);


--
-- Name: ticket_purchases ticket_purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.ticket_purchases
    ADD CONSTRAINT ticket_purchases_pkey PRIMARY KEY (id);


--
-- Name: assigned_tickets uq_assigned_ticket_qr_code; Type: CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.assigned_tickets
    ADD CONSTRAINT uq_assigned_ticket_qr_code UNIQUE (qr_code);


--
-- Name: auction_items uq_auction_items_event_bid_number; Type: CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.auction_items
    ADD CONSTRAINT uq_auction_items_event_bid_number UNIQUE (event_id, bid_number);


--
-- Name: event_tables uq_event_tables_event_table_number; Type: CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.event_tables
    ADD CONSTRAINT uq_event_tables_event_table_number UNIQUE (event_id, table_number);


--
-- Name: npo_members uq_npo_member; Type: CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.npo_members
    ADD CONSTRAINT uq_npo_member UNIQUE (npo_id, user_id);


--
-- Name: promo_codes uq_promo_code_event_code; Type: CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.promo_codes
    ADD CONSTRAINT uq_promo_code_event_code UNIQUE (event_id, code);


--
-- Name: meal_selections uq_registration_guest_meal; Type: CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.meal_selections
    ADD CONSTRAINT uq_registration_guest_meal UNIQUE (registration_id, guest_id);


--
-- Name: sponsors uq_sponsor_name_per_event; Type: CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.sponsors
    ADD CONSTRAINT uq_sponsor_name_per_event UNIQUE (event_id, name);


--
-- Name: ticket_packages uq_ticket_package_event_display_order; Type: CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.ticket_packages
    ADD CONSTRAINT uq_ticket_package_event_display_order UNIQUE (event_id, display_order);


--
-- Name: event_registrations uq_user_event_registration; Type: CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.event_registrations
    ADD CONSTRAINT uq_user_event_registration UNIQUE (user_id, event_id);


--
-- Name: user_consents user_consents_pkey; Type: CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.user_consents
    ADD CONSTRAINT user_consents_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_assigned_tickets_purchase_id; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX idx_assigned_tickets_purchase_id ON public.assigned_tickets USING btree (ticket_purchase_id);


--
-- Name: idx_assigned_tickets_qr_code; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX idx_assigned_tickets_qr_code ON public.assigned_tickets USING btree (qr_code);


--
-- Name: idx_auction_item_media_display_order; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX idx_auction_item_media_display_order ON public.auction_item_media USING btree (auction_item_id, display_order);


--
-- Name: idx_auction_item_media_item_id; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX idx_auction_item_media_item_id ON public.auction_item_media USING btree (auction_item_id);


--
-- Name: idx_auction_items_auction_type; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX idx_auction_items_auction_type ON public.auction_items USING btree (auction_type) WHERE (deleted_at IS NULL);


--
-- Name: idx_auction_items_bid_number; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX idx_auction_items_bid_number ON public.auction_items USING btree (event_id, bid_number) WHERE (deleted_at IS NULL);


--
-- Name: idx_auction_items_event_id; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX idx_auction_items_event_id ON public.auction_items USING btree (event_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_auction_items_event_status_type; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX idx_auction_items_event_status_type ON public.auction_items USING btree (event_id, status, auction_type) WHERE (deleted_at IS NULL);


--
-- Name: idx_auction_items_sponsor_id; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX idx_auction_items_sponsor_id ON public.auction_items USING btree (sponsor_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_auction_items_status; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX idx_auction_items_status ON public.auction_items USING btree (status) WHERE (deleted_at IS NULL);


--
-- Name: idx_custom_ticket_options_display_order; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX idx_custom_ticket_options_display_order ON public.custom_ticket_options USING btree (ticket_package_id, display_order);


--
-- Name: idx_custom_ticket_options_package_id; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX idx_custom_ticket_options_package_id ON public.custom_ticket_options USING btree (ticket_package_id);


--
-- Name: idx_event_tables_captain_id; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX idx_event_tables_captain_id ON public.event_tables USING btree (table_captain_id);


--
-- Name: idx_event_tables_composite; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX idx_event_tables_composite ON public.event_tables USING btree (event_id, table_number);


--
-- Name: idx_event_tables_event_id; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX idx_event_tables_event_id ON public.event_tables USING btree (event_id);


--
-- Name: idx_events_event_datetime; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX idx_events_event_datetime ON public.events USING btree (event_datetime);


--
-- Name: idx_events_npo_id; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX idx_events_npo_id ON public.events USING btree (npo_id);


--
-- Name: idx_events_npo_id_datetime; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX idx_events_npo_id_datetime ON public.events USING btree (npo_id, event_datetime);


--
-- Name: idx_events_search_vector; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX idx_events_search_vector ON public.events USING gin (search_vector);


--
-- Name: idx_npo_members_npo_id; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX idx_npo_members_npo_id ON public.npo_members USING btree (npo_id);


--
-- Name: idx_npo_members_user_id; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX idx_npo_members_user_id ON public.npo_members USING btree (user_id);


--
-- Name: idx_npos_search_vector; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX idx_npos_search_vector ON public.npos USING gin (search_vector);


--
-- Name: idx_option_responses_option_id; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX idx_option_responses_option_id ON public.option_responses USING btree (custom_option_id);


--
-- Name: idx_option_responses_purchase_id; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX idx_option_responses_purchase_id ON public.option_responses USING btree (ticket_purchase_id);


--
-- Name: idx_promo_applications_promo_id; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX idx_promo_applications_promo_id ON public.promo_code_applications USING btree (promo_code_id);


--
-- Name: idx_promo_applications_purchase_id; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX idx_promo_applications_purchase_id ON public.promo_code_applications USING btree (ticket_purchase_id);


--
-- Name: idx_promo_codes_code; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX idx_promo_codes_code ON public.promo_codes USING btree (event_id, code);


--
-- Name: idx_promo_codes_event_id; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX idx_promo_codes_event_id ON public.promo_codes USING btree (event_id);


--
-- Name: idx_registration_guest_meal; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX idx_registration_guest_meal ON public.meal_selections USING btree (registration_id, guest_id);


--
-- Name: idx_registration_guests_bidder_number; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX idx_registration_guests_bidder_number ON public.registration_guests USING btree (registration_id, bidder_number);


--
-- Name: idx_registration_guests_table_captain; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX idx_registration_guests_table_captain ON public.registration_guests USING btree (table_number, is_table_captain);


--
-- Name: idx_registration_guests_table_number; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX idx_registration_guests_table_number ON public.registration_guests USING btree (table_number);


--
-- Name: idx_sponsors_created_by; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX idx_sponsors_created_by ON public.sponsors USING btree (created_by);


--
-- Name: idx_sponsors_display_order; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX idx_sponsors_display_order ON public.sponsors USING btree (event_id, display_order);


--
-- Name: idx_sponsors_event_id; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX idx_sponsors_event_id ON public.sponsors USING btree (event_id);


--
-- Name: idx_ticket_audit_logs_changed_at; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX idx_ticket_audit_logs_changed_at ON public.ticket_audit_logs USING btree (changed_at);


--
-- Name: idx_ticket_audit_logs_coordinator_id; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX idx_ticket_audit_logs_coordinator_id ON public.ticket_audit_logs USING btree (coordinator_id);


--
-- Name: idx_ticket_audit_logs_entity; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX idx_ticket_audit_logs_entity ON public.ticket_audit_logs USING btree (entity_type, entity_id);


--
-- Name: idx_ticket_packages_display_order; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX idx_ticket_packages_display_order ON public.ticket_packages USING btree (event_id, display_order);


--
-- Name: idx_ticket_packages_event_id; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX idx_ticket_packages_event_id ON public.ticket_packages USING btree (event_id);


--
-- Name: idx_ticket_purchases_event_id; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX idx_ticket_purchases_event_id ON public.ticket_purchases USING btree (event_id);


--
-- Name: idx_ticket_purchases_package_id; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX idx_ticket_purchases_package_id ON public.ticket_purchases USING btree (ticket_package_id);


--
-- Name: idx_ticket_purchases_user_id; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX idx_ticket_purchases_user_id ON public.ticket_purchases USING btree (user_id);


--
-- Name: idx_user_event_status; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX idx_user_event_status ON public.event_registrations USING btree (user_id, event_id, status);


--
-- Name: idx_users_search_vector; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX idx_users_search_vector ON public.users USING gin (search_vector);


--
-- Name: ix_audit_logs_action; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX ix_audit_logs_action ON public.audit_logs USING btree (action);


--
-- Name: ix_audit_logs_created_at; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX ix_audit_logs_created_at ON public.audit_logs USING btree (created_at);


--
-- Name: ix_audit_logs_ip_address; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX ix_audit_logs_ip_address ON public.audit_logs USING btree (ip_address);


--
-- Name: ix_audit_logs_user_id; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX ix_audit_logs_user_id ON public.audit_logs USING btree (user_id);


--
-- Name: ix_consent_audit_logs_action; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX ix_consent_audit_logs_action ON public.consent_audit_logs USING btree (action);


--
-- Name: ix_consent_audit_logs_created_at; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX ix_consent_audit_logs_created_at ON public.consent_audit_logs USING btree (created_at);


--
-- Name: ix_consent_audit_logs_user_id; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX ix_consent_audit_logs_user_id ON public.consent_audit_logs USING btree (user_id);


--
-- Name: ix_cookie_consents_session_id; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX ix_cookie_consents_session_id ON public.cookie_consents USING btree (session_id);


--
-- Name: ix_cookie_consents_user_id; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX ix_cookie_consents_user_id ON public.cookie_consents USING btree (user_id);


--
-- Name: ix_event_links_event_id; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX ix_event_links_event_id ON public.event_links USING btree (event_id);


--
-- Name: ix_event_media_event_id; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX ix_event_media_event_id ON public.event_media USING btree (event_id);


--
-- Name: ix_event_registrations_event_id; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX ix_event_registrations_event_id ON public.event_registrations USING btree (event_id);


--
-- Name: ix_event_registrations_status; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX ix_event_registrations_status ON public.event_registrations USING btree (status);


--
-- Name: ix_event_registrations_user_id; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX ix_event_registrations_user_id ON public.event_registrations USING btree (user_id);


--
-- Name: ix_events_event_datetime; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX ix_events_event_datetime ON public.events USING btree (event_datetime);


--
-- Name: ix_events_npo_id; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX ix_events_npo_id ON public.events USING btree (npo_id);


--
-- Name: ix_events_slug; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE UNIQUE INDEX ix_events_slug ON public.events USING btree (slug);


--
-- Name: ix_events_status; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX ix_events_status ON public.events USING btree (status);


--
-- Name: ix_food_options_event_id; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX ix_food_options_event_id ON public.food_options USING btree (event_id);


--
-- Name: ix_invitations_email; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX ix_invitations_email ON public.invitations USING btree (email);


--
-- Name: ix_invitations_expires_at; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX ix_invitations_expires_at ON public.invitations USING btree (expires_at);


--
-- Name: ix_invitations_npo_id; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX ix_invitations_npo_id ON public.invitations USING btree (npo_id);


--
-- Name: ix_invitations_status; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX ix_invitations_status ON public.invitations USING btree (status);


--
-- Name: ix_invitations_token_hash; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE UNIQUE INDEX ix_invitations_token_hash ON public.invitations USING btree (token_hash);


--
-- Name: ix_legal_documents_document_type; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX ix_legal_documents_document_type ON public.legal_documents USING btree (document_type);


--
-- Name: ix_legal_documents_published_at; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX ix_legal_documents_published_at ON public.legal_documents USING btree (published_at);


--
-- Name: ix_legal_documents_status; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX ix_legal_documents_status ON public.legal_documents USING btree (status);


--
-- Name: ix_meal_selections_food_option_id; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX ix_meal_selections_food_option_id ON public.meal_selections USING btree (food_option_id);


--
-- Name: ix_meal_selections_guest_id; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX ix_meal_selections_guest_id ON public.meal_selections USING btree (guest_id);


--
-- Name: ix_meal_selections_registration_id; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX ix_meal_selections_registration_id ON public.meal_selections USING btree (registration_id);


--
-- Name: ix_npo_applications_npo_id; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX ix_npo_applications_npo_id ON public.npo_applications USING btree (npo_id);


--
-- Name: ix_npo_applications_status; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX ix_npo_applications_status ON public.npo_applications USING btree (status);


--
-- Name: ix_npo_applications_submitted_at; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX ix_npo_applications_submitted_at ON public.npo_applications USING btree (submitted_at);


--
-- Name: ix_npo_branding_npo_id; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE UNIQUE INDEX ix_npo_branding_npo_id ON public.npo_branding USING btree (npo_id);


--
-- Name: ix_npo_members_npo_id; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX ix_npo_members_npo_id ON public.npo_members USING btree (npo_id);


--
-- Name: ix_npo_members_role; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX ix_npo_members_role ON public.npo_members USING btree (role);


--
-- Name: ix_npo_members_status; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX ix_npo_members_status ON public.npo_members USING btree (status);


--
-- Name: ix_npo_members_user_id; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX ix_npo_members_user_id ON public.npo_members USING btree (user_id);


--
-- Name: ix_npos_created_by_user_id; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX ix_npos_created_by_user_id ON public.npos USING btree (created_by_user_id);


--
-- Name: ix_npos_email; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX ix_npos_email ON public.npos USING btree (email);


--
-- Name: ix_npos_name; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE UNIQUE INDEX ix_npos_name ON public.npos USING btree (name);


--
-- Name: ix_npos_status; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX ix_npos_status ON public.npos USING btree (status);


--
-- Name: ix_registration_guests_email; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX ix_registration_guests_email ON public.registration_guests USING btree (email);


--
-- Name: ix_registration_guests_registration_id; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX ix_registration_guests_registration_id ON public.registration_guests USING btree (registration_id);


--
-- Name: ix_registration_guests_user_id; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX ix_registration_guests_user_id ON public.registration_guests USING btree (user_id);


--
-- Name: ix_roles_name; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE UNIQUE INDEX ix_roles_name ON public.roles USING btree (name);


--
-- Name: ix_sessions_created_at; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX ix_sessions_created_at ON public.sessions USING btree (created_at);


--
-- Name: ix_sessions_refresh_token_jti; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE UNIQUE INDEX ix_sessions_refresh_token_jti ON public.sessions USING btree (refresh_token_jti);


--
-- Name: ix_sessions_user_id; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX ix_sessions_user_id ON public.sessions USING btree (user_id);


--
-- Name: ix_ticket_packages_is_sponsorship; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX ix_ticket_packages_is_sponsorship ON public.ticket_packages USING btree (is_sponsorship);


--
-- Name: ix_user_consents_status; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX ix_user_consents_status ON public.user_consents USING btree (status);


--
-- Name: ix_user_consents_user_id; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX ix_user_consents_user_id ON public.user_consents USING btree (user_id);


--
-- Name: ix_users_email; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE UNIQUE INDEX ix_users_email ON public.users USING btree (email);


--
-- Name: ix_users_role_id; Type: INDEX; Schema: public; Owner: fundrbolt_user
--

CREATE INDEX ix_users_role_id ON public.users USING btree (role_id);


--
-- Name: consent_audit_logs prevent_consent_audit_update; Type: TRIGGER; Schema: public; Owner: fundrbolt_user
--

CREATE TRIGGER prevent_consent_audit_update BEFORE DELETE OR UPDATE ON public.consent_audit_logs FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_modification();


--
-- Name: ticket_audit_logs prevent_ticket_audit_log_update; Type: TRIGGER; Schema: public; Owner: fundrbolt_user
--

CREATE TRIGGER prevent_ticket_audit_log_update BEFORE DELETE OR UPDATE ON public.ticket_audit_logs FOR EACH ROW EXECUTE FUNCTION public.prevent_ticket_audit_log_modification();


--
-- Name: registration_guests trg_check_bidder_number_uniqueness; Type: TRIGGER; Schema: public; Owner: fundrbolt_user
--

CREATE TRIGGER trg_check_bidder_number_uniqueness BEFORE INSERT OR UPDATE OF bidder_number ON public.registration_guests FOR EACH ROW EXECUTE FUNCTION public.check_bidder_number_uniqueness();


--
-- Name: assigned_tickets assigned_tickets_ticket_purchase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.assigned_tickets
    ADD CONSTRAINT assigned_tickets_ticket_purchase_id_fkey FOREIGN KEY (ticket_purchase_id) REFERENCES public.ticket_purchases(id) ON DELETE CASCADE;


--
-- Name: auction_item_media auction_item_media_auction_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.auction_item_media
    ADD CONSTRAINT auction_item_media_auction_item_id_fkey FOREIGN KEY (auction_item_id) REFERENCES public.auction_items(id) ON DELETE CASCADE;


--
-- Name: auction_items auction_items_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.auction_items
    ADD CONSTRAINT auction_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: auction_items auction_items_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.auction_items
    ADD CONSTRAINT auction_items_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: auction_items auction_items_sponsor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.auction_items
    ADD CONSTRAINT auction_items_sponsor_id_fkey FOREIGN KEY (sponsor_id) REFERENCES public.sponsors(id) ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: consent_audit_logs consent_audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.consent_audit_logs
    ADD CONSTRAINT consent_audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: cookie_consents cookie_consents_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.cookie_consents
    ADD CONSTRAINT cookie_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: custom_ticket_options custom_ticket_options_ticket_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.custom_ticket_options
    ADD CONSTRAINT custom_ticket_options_ticket_package_id_fkey FOREIGN KEY (ticket_package_id) REFERENCES public.ticket_packages(id) ON DELETE CASCADE;


--
-- Name: event_links event_links_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.event_links
    ADD CONSTRAINT event_links_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: event_links event_links_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.event_links
    ADD CONSTRAINT event_links_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: event_media event_media_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.event_media
    ADD CONSTRAINT event_media_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: event_media event_media_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.event_media
    ADD CONSTRAINT event_media_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: event_registrations event_registrations_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.event_registrations
    ADD CONSTRAINT event_registrations_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: event_registrations event_registrations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.event_registrations
    ADD CONSTRAINT event_registrations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: event_tables event_tables_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.event_tables
    ADD CONSTRAINT event_tables_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: event_tables event_tables_table_captain_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.event_tables
    ADD CONSTRAINT event_tables_table_captain_id_fkey FOREIGN KEY (table_captain_id) REFERENCES public.registration_guests(id) ON DELETE SET NULL;


--
-- Name: events events_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: events events_npo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_npo_id_fkey FOREIGN KEY (npo_id) REFERENCES public.npos(id) ON DELETE RESTRICT;


--
-- Name: events events_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: option_responses fk_option_responses_purchase_id; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.option_responses
    ADD CONSTRAINT fk_option_responses_purchase_id FOREIGN KEY (ticket_purchase_id) REFERENCES public.ticket_purchases(id) ON DELETE CASCADE;


--
-- Name: promo_code_applications fk_promo_applications_purchase_id; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.promo_code_applications
    ADD CONSTRAINT fk_promo_applications_purchase_id FOREIGN KEY (ticket_purchase_id) REFERENCES public.ticket_purchases(id) ON DELETE CASCADE;


--
-- Name: food_options food_options_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.food_options
    ADD CONSTRAINT food_options_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: invitations invitations_invited_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_invited_by_user_id_fkey FOREIGN KEY (invited_by_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: invitations invitations_invited_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_invited_user_id_fkey FOREIGN KEY (invited_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: invitations invitations_npo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_npo_id_fkey FOREIGN KEY (npo_id) REFERENCES public.npos(id) ON DELETE CASCADE;


--
-- Name: meal_selections meal_selections_food_option_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.meal_selections
    ADD CONSTRAINT meal_selections_food_option_id_fkey FOREIGN KEY (food_option_id) REFERENCES public.food_options(id) ON DELETE RESTRICT;


--
-- Name: meal_selections meal_selections_guest_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.meal_selections
    ADD CONSTRAINT meal_selections_guest_id_fkey FOREIGN KEY (guest_id) REFERENCES public.registration_guests(id) ON DELETE CASCADE;


--
-- Name: meal_selections meal_selections_registration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.meal_selections
    ADD CONSTRAINT meal_selections_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.event_registrations(id) ON DELETE CASCADE;


--
-- Name: npo_applications npo_applications_npo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.npo_applications
    ADD CONSTRAINT npo_applications_npo_id_fkey FOREIGN KEY (npo_id) REFERENCES public.npos(id) ON DELETE CASCADE;


--
-- Name: npo_applications npo_applications_reviewed_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.npo_applications
    ADD CONSTRAINT npo_applications_reviewed_by_user_id_fkey FOREIGN KEY (reviewed_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: npo_branding npo_branding_npo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.npo_branding
    ADD CONSTRAINT npo_branding_npo_id_fkey FOREIGN KEY (npo_id) REFERENCES public.npos(id) ON DELETE CASCADE;


--
-- Name: npo_members npo_members_invited_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.npo_members
    ADD CONSTRAINT npo_members_invited_by_user_id_fkey FOREIGN KEY (invited_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: npo_members npo_members_npo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.npo_members
    ADD CONSTRAINT npo_members_npo_id_fkey FOREIGN KEY (npo_id) REFERENCES public.npos(id) ON DELETE CASCADE;


--
-- Name: npo_members npo_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.npo_members
    ADD CONSTRAINT npo_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: npos npos_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.npos
    ADD CONSTRAINT npos_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: option_responses option_responses_custom_option_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.option_responses
    ADD CONSTRAINT option_responses_custom_option_id_fkey FOREIGN KEY (custom_option_id) REFERENCES public.custom_ticket_options(id) ON DELETE CASCADE;


--
-- Name: promo_code_applications promo_code_applications_promo_code_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.promo_code_applications
    ADD CONSTRAINT promo_code_applications_promo_code_id_fkey FOREIGN KEY (promo_code_id) REFERENCES public.promo_codes(id) ON DELETE CASCADE;


--
-- Name: promo_codes promo_codes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.promo_codes
    ADD CONSTRAINT promo_codes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: promo_codes promo_codes_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.promo_codes
    ADD CONSTRAINT promo_codes_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: registration_guests registration_guests_registration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.registration_guests
    ADD CONSTRAINT registration_guests_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.event_registrations(id) ON DELETE CASCADE;


--
-- Name: registration_guests registration_guests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.registration_guests
    ADD CONSTRAINT registration_guests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: sponsors sponsors_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.sponsors
    ADD CONSTRAINT sponsors_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: sponsors sponsors_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.sponsors
    ADD CONSTRAINT sponsors_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: ticket_audit_logs ticket_audit_logs_coordinator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.ticket_audit_logs
    ADD CONSTRAINT ticket_audit_logs_coordinator_id_fkey FOREIGN KEY (coordinator_id) REFERENCES public.users(id);


--
-- Name: ticket_packages ticket_packages_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.ticket_packages
    ADD CONSTRAINT ticket_packages_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: ticket_packages ticket_packages_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.ticket_packages
    ADD CONSTRAINT ticket_packages_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: ticket_purchases ticket_purchases_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.ticket_purchases
    ADD CONSTRAINT ticket_purchases_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: ticket_purchases ticket_purchases_ticket_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.ticket_purchases
    ADD CONSTRAINT ticket_purchases_ticket_package_id_fkey FOREIGN KEY (ticket_package_id) REFERENCES public.ticket_packages(id) ON DELETE CASCADE;


--
-- Name: ticket_purchases ticket_purchases_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.ticket_purchases
    ADD CONSTRAINT ticket_purchases_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_consents user_consents_privacy_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.user_consents
    ADD CONSTRAINT user_consents_privacy_document_id_fkey FOREIGN KEY (privacy_document_id) REFERENCES public.legal_documents(id) ON DELETE RESTRICT;


--
-- Name: user_consents user_consents_tos_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.user_consents
    ADD CONSTRAINT user_consents_tos_document_id_fkey FOREIGN KEY (tos_document_id) REFERENCES public.legal_documents(id) ON DELETE RESTRICT;


--
-- Name: user_consents user_consents_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.user_consents
    ADD CONSTRAINT user_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fundrbolt_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- PostgreSQL database dump complete
--

\unrestrict CqZB1aIdcIR4mf4KnkS7fja03rAC2TLZPFoieWaN8ynGHe4bkyCXnP6amXLqtj6
