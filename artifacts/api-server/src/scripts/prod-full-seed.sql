--
-- PostgreSQL database dump
--


-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

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
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: calc_hours_worked(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calc_hours_worked() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.clock_out IS NOT NULL AND NEW.clock_in IS NOT NULL THEN
    NEW.hours_worked := ROUND(
      EXTRACT(EPOCH FROM (NEW.clock_out - NEW.clock_in)) / 3600.0, 2
    );
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: generate_invoice_no(character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_invoice_no(p_branch_code character varying DEFAULT 'KL01'::character varying) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
  today_str VARCHAR := TO_CHAR(NOW(), 'YYYYMMDD');
  seq_num   INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO seq_num
  FROM invoices WHERE invoice_no LIKE p_branch_code || '-INV-' || today_str || '-%';
  RETURN p_branch_code || '-INV-' || today_str || '-' || LPAD(seq_num::TEXT, 4, '0');
END;
$$;


--
-- Name: generate_receipt_no(character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_receipt_no(p_branch_code character varying DEFAULT 'KL01'::character varying) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
  today_str VARCHAR := TO_CHAR(NOW(), 'YYYYMMDD');
  seq_num   INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO seq_num
  FROM receipts WHERE receipt_no LIKE p_branch_code || '-REC-' || today_str || '-%';
  RETURN p_branch_code || '-REC-' || today_str || '-' || LPAD(seq_num::TEXT, 4, '0');
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: agent_commissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_commissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id uuid NOT NULL,
    hostess_session_id uuid,
    hostess_id uuid,
    reservation_id uuid,
    period_from date,
    period_to date,
    commission_type character varying(20) DEFAULT 'percentage'::character varying NOT NULL,
    rate numeric(6,4) DEFAULT 0 NOT NULL,
    base_amount numeric(15,4) DEFAULT 0 NOT NULL,
    commission_amount numeric(15,4) NOT NULL,
    currency character(3) DEFAULT 'MYR'::bpchar NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    settled_at timestamp with time zone,
    settled_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: agent_payouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_payouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_id uuid NOT NULL,
    period_from date NOT NULL,
    period_to date NOT NULL,
    amount_myr numeric(15,4) NOT NULL,
    payout_currency character(3) DEFAULT 'MYR'::bpchar NOT NULL,
    fx_rate numeric(15,6) DEFAULT 1 NOT NULL,
    amount_fx numeric(15,4) NOT NULL,
    payment_method character varying(50),
    payment_ref character varying(255),
    balance_before numeric(15,4) NOT NULL,
    notes text,
    paid_by uuid,
    paid_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: agents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    agent_type character varying(30) DEFAULT 'agency'::character varying NOT NULL,
    name character varying(255) NOT NULL,
    contact_person character varying(255),
    phone character varying(50),
    whatsapp character varying(50),
    email character varying(255),
    commission_type character varying(30) DEFAULT 'pct'::character varying NOT NULL,
    commission_rate numeric(6,4) DEFAULT 0 NOT NULL,
    commission_base character varying(30) DEFAULT 'hostess_gross'::character varying NOT NULL,
    payment_cycle character varying(30) DEFAULT 'monthly'::character varying NOT NULL,
    payment_method character varying(50),
    bank_name character varying(100),
    bank_account character varying(100),
    bank_country character(2),
    swift_code character varying(20),
    preferred_currency character(3) DEFAULT 'MYR'::bpchar,
    credit_balance numeric(15,4) DEFAULT 0 NOT NULL,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: attendance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    staff_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    work_date date NOT NULL,
    scheduled_start timestamp with time zone,
    scheduled_end timestamp with time zone,
    clock_in timestamp with time zone,
    clock_out timestamp with time zone,
    status character varying(30) DEFAULT 'present'::character varying NOT NULL,
    late_minutes integer DEFAULT 0 NOT NULL,
    early_leave_min integer DEFAULT 0 NOT NULL,
    penalty_amount numeric(15,4) DEFAULT 0 NOT NULL,
    penalty_reason text,
    notes text,
    approved_by uuid,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    hours_worked numeric(5,2),
    gps_lat_in numeric(10,7),
    gps_lng_in numeric(10,7),
    gps_lat_out numeric(10,7),
    gps_lng_out numeric(10,7),
    clock_in_source character varying(20) DEFAULT 'admin'::character varying
);


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id uuid NOT NULL,
    action character varying(30) NOT NULL,
    changed_by uuid,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    old_values jsonb,
    new_values jsonb,
    ip_address inet,
    user_agent text
);


--
-- Name: availability_blocks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.availability_blocks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    branch_id uuid NOT NULL,
    entity_type character varying(20) NOT NULL,
    entity_id uuid NOT NULL,
    block_type character varying(30) NOT NULL,
    reservation_id uuid,
    start_dt timestamp with time zone NOT NULL,
    end_dt timestamp with time zone NOT NULL,
    created_by uuid,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_block_time CHECK ((end_dt > start_dt))
);


--
-- Name: branch_shareholders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.branch_shareholders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    branch_id uuid NOT NULL,
    shareholder_id uuid NOT NULL,
    equity_pct numeric(6,4) NOT NULL,
    agreed_rate numeric(6,4),
    effective_from date NOT NULL,
    effective_to date,
    notes text
);


--
-- Name: branches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.branches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    internal_code character varying(20) NOT NULL,
    address text,
    city character varying(100),
    country character(2) DEFAULT 'MY'::bpchar,
    phone character varying(50),
    email character varying(255),
    timezone character varying(60) DEFAULT 'Asia/Kuala_Lumpur'::character varying NOT NULL,
    currency character(3) DEFAULT 'MYR'::bpchar NOT NULL,
    operating_hours jsonb,
    tax_config jsonb DEFAULT '{"sst_rate": 0.06, "service_charge": 0.10}'::jsonb NOT NULL,
    settings jsonb DEFAULT '{"sst_reg_number": "", "invoice_footer_text": "", "default_invoice_mode": "detailed", "default_receipt_mode": "detailed", "thermal_printer_width_mm": 80, "show_hostess_name_on_invoice": true, "show_hostess_name_on_receipt": false}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    customer_code character varying(50),
    full_name character varying(255),
    phone character varying(50),
    whatsapp character varying(50),
    email character varying(255),
    password_hash text,
    nationality character varying(100),
    language_pref character varying(10) DEFAULT 'en'::character varying,
    referral_code_used character varying(50),
    referral_source character varying(30),
    referral_agent_id uuid,
    credit_balance numeric(15,4) DEFAULT 0 NOT NULL,
    payment_type character varying(30) DEFAULT 'standard'::character varying NOT NULL,
    credit_limit numeric(15,4) DEFAULT 0 NOT NULL,
    credit_due_day smallint,
    vip_tier character varying(20) DEFAULT 'standard'::character varying,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: driver_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.driver_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    driver_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    pickup_id uuid,
    message text NOT NULL,
    sent_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    branch_id uuid NOT NULL,
    category character varying(50) NOT NULL,
    description text NOT NULL,
    amount numeric(15,4) NOT NULL,
    currency character(3) DEFAULT 'MYR'::bpchar NOT NULL,
    expense_date date NOT NULL,
    period_month character(7),
    reference_type character varying(50),
    reference_id uuid,
    receipt_url text,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    vendor character varying(255),
    approved_by uuid,
    approved_at timestamp with time zone,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL
);


--
-- Name: folio_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.folio_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reservation_id uuid NOT NULL,
    order_id uuid,
    entry_type character varying(30) NOT NULL,
    description character varying(255),
    quantity numeric(8,2) DEFAULT 1 NOT NULL,
    unit_price numeric(15,4) NOT NULL,
    amount numeric(15,4) NOT NULL,
    currency character(3) DEFAULT 'MYR'::bpchar NOT NULL,
    hostess_session_id uuid,
    posted_at timestamp with time zone DEFAULT now() NOT NULL,
    posted_by uuid,
    notes text,
    is_void boolean DEFAULT false NOT NULL,
    voided_at timestamp with time zone,
    voided_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: fx_rates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fx_rates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    base_ccy character(3) DEFAULT 'MYR'::bpchar NOT NULL,
    quote_ccy character(3) NOT NULL,
    rate numeric(15,6) NOT NULL,
    source character varying(50) DEFAULT 'exchangerate-api'::character varying,
    fetched_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: hostess_payouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hostess_payouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    hostess_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    period_from date NOT NULL,
    period_to date NOT NULL,
    total_sessions integer DEFAULT 0 NOT NULL,
    total_hours numeric(8,2) DEFAULT 0 NOT NULL,
    total_gross numeric(15,4) DEFAULT 0 NOT NULL,
    total_payout numeric(15,4) DEFAULT 0 NOT NULL,
    currency character(3) DEFAULT 'MYR'::bpchar NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    paid_at timestamp with time zone,
    paid_by uuid,
    payment_method character varying(30),
    payment_ref character varying(100),
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: hostess_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hostess_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reservation_id uuid NOT NULL,
    hostess_id uuid NOT NULL,
    agent_id uuid,
    attendance_id uuid,
    session_type character varying(20) DEFAULT 'incall'::character varying NOT NULL,
    start_at timestamp with time zone NOT NULL,
    end_at timestamp with time zone,
    hours_worked numeric(5,2),
    rate_per_hour numeric(15,4) DEFAULT 0 NOT NULL,
    gross_amount numeric(15,4),
    payout_rate numeric(5,2) DEFAULT 70.00 NOT NULL,
    net_payout numeric(15,4),
    agent_commission_rate numeric(5,2) DEFAULT 0 NOT NULL,
    agent_commission numeric(15,4) DEFAULT 0 NOT NULL,
    late_charge_amount numeric(15,4) DEFAULT 0 NOT NULL,
    currency character(3) DEFAULT 'MYR'::bpchar NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: investor_export_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.investor_export_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    staff_id uuid NOT NULL,
    report_id uuid,
    report_period character(7),
    exported_at timestamp with time zone DEFAULT now(),
    ip_address character varying(45),
    file_format character varying(10) DEFAULT 'PDF'::character varying,
    watermark_text text
);


--
-- Name: investor_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.investor_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    branch_id uuid,
    branch_name character varying(255),
    period character(7) NOT NULL,
    report_type character varying(50) DEFAULT 'MONTHLY'::character varying,
    total_revenue numeric(15,2) DEFAULT 0,
    room_revenue numeric(15,2) DEFAULT 0,
    beverage_revenue numeric(15,2) DEFAULT 0,
    food_revenue numeric(15,2) DEFAULT 0,
    package_revenue numeric(15,2) DEFAULT 0,
    other_revenue numeric(15,2) DEFAULT 0,
    total_operating_cost numeric(15,2) DEFAULT 0,
    total_commission_expense numeric(15,2) DEFAULT 0,
    gross_profit numeric(15,2) DEFAULT 0,
    net_profit numeric(15,2) DEFAULT 0,
    room_utilization_pct numeric(5,2) DEFAULT 0,
    total_sessions integer DEFAULT 0,
    unique_customers integer DEFAULT 0,
    avg_spend_per_session numeric(10,2) DEFAULT 0,
    notes text,
    generated_at timestamp with time zone DEFAULT now(),
    generated_by character varying(50) DEFAULT 'SYSTEM'::character varying,
    currency_code character(3) DEFAULT 'MYR'::bpchar
);


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_no character varying(30) NOT NULL,
    reservation_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    customer_id uuid,
    customer_name character varying(255),
    subtotal numeric(15,4) DEFAULT 0 NOT NULL,
    discount_amount numeric(15,4) DEFAULT 0 NOT NULL,
    sst_amount numeric(15,4) DEFAULT 0 NOT NULL,
    service_charge numeric(15,4) DEFAULT 0 NOT NULL,
    total_amount numeric(15,4) DEFAULT 0 NOT NULL,
    amount_paid numeric(15,4) DEFAULT 0 NOT NULL,
    balance_due numeric(15,4) DEFAULT 0 NOT NULL,
    currency character(3) DEFAULT 'MYR'::bpchar NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    notes text,
    issued_at timestamp with time zone,
    issued_by uuid,
    due_date date,
    voided_at timestamp with time zone,
    void_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    item_type character varying(30) NOT NULL,
    product_id uuid,
    description text NOT NULL,
    quantity numeric(10,3) DEFAULT 1 NOT NULL,
    unit_price numeric(15,4) NOT NULL,
    discount_pct numeric(5,4) DEFAULT 0 NOT NULL,
    line_total numeric(15,4) NOT NULL,
    staff_ref_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_no character varying(50) NOT NULL,
    reservation_id uuid,
    branch_id uuid NOT NULL,
    customer_id uuid,
    order_type character varying(30) DEFAULT 'reservation'::character varying NOT NULL,
    subtotal numeric(15,4) DEFAULT 0 NOT NULL,
    discount_amount numeric(15,4) DEFAULT 0 NOT NULL,
    sst_amount numeric(15,4) DEFAULT 0 NOT NULL,
    service_charge numeric(15,4) DEFAULT 0 NOT NULL,
    total_amount numeric(15,4) DEFAULT 0 NOT NULL,
    currency character(3) DEFAULT 'MYR'::bpchar NOT NULL,
    payment_status character varying(30) DEFAULT 'pending'::character varying NOT NULL,
    payment_method character varying(30),
    payment_ref character varying(100),
    payment_notes text,
    invoice_pdf_url text,
    notes text,
    created_by uuid,
    finalized_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(100) NOT NULL,
    base_currency character(3) DEFAULT 'MYR'::bpchar NOT NULL,
    default_tz character varying(60) DEFAULT 'Asia/Kuala_Lumpur'::character varying NOT NULL,
    default_lang character varying(10) DEFAULT 'en'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    reservation_id uuid,
    amount numeric(15,4) NOT NULL,
    currency character(3) DEFAULT 'MYR'::bpchar NOT NULL,
    method character varying(30) NOT NULL,
    ref_no character varying(100),
    paid_at timestamp with time zone DEFAULT now() NOT NULL,
    received_by uuid,
    notes text,
    is_void boolean DEFAULT false NOT NULL,
    voided_at timestamp with time zone,
    voided_by uuid,
    void_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: product_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    name jsonb NOT NULL,
    sort_order smallint DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: product_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    name jsonb NOT NULL,
    sort_order smallint DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type_id uuid NOT NULL,
    branch_id uuid,
    sku character varying(100),
    name jsonb NOT NULL,
    description jsonb,
    unit_price numeric(15,4) NOT NULL,
    unit character varying(30) DEFAULT 'pcs'::character varying NOT NULL,
    tax_applicable boolean DEFAULT true NOT NULL,
    images jsonb,
    sort_order smallint DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: profit_settlements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profit_settlements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    branch_id uuid NOT NULL,
    shareholder_id uuid NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    gross_revenue numeric(15,4) NOT NULL,
    total_expenses numeric(15,4) NOT NULL,
    net_profit numeric(15,4) NOT NULL,
    equity_pct_snapshot numeric(6,4) NOT NULL,
    settlement_amount_myr numeric(15,4) NOT NULL,
    payout_currency character(3) DEFAULT 'MYR'::bpchar NOT NULL,
    fx_rate numeric(15,6) DEFAULT 1.0 NOT NULL,
    settlement_amount_fx numeric(15,4) NOT NULL,
    status character varying(30) DEFAULT 'draft'::character varying NOT NULL,
    pdf_url text,
    notes text,
    approved_by uuid,
    approved_at timestamp with time zone,
    paid_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.receipts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    receipt_no character varying(50) NOT NULL,
    order_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    customer_id uuid,
    customer_name character varying(255),
    amount_paid numeric(15,4) NOT NULL,
    currency character(3) DEFAULT 'MYR'::bpchar NOT NULL,
    payment_method character varying(30) NOT NULL,
    payment_ref character varying(100),
    payment_at timestamp with time zone DEFAULT now() NOT NULL,
    receipt_mode character varying(20) DEFAULT 'detailed'::character varying NOT NULL,
    pdf_url text,
    printed_at timestamp with time zone,
    print_count smallint DEFAULT 0 NOT NULL,
    voided_at timestamp with time zone,
    void_reason text,
    issued_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    invoice_id uuid,
    payment_id uuid
);


--
-- Name: reservation_hostesses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reservation_hostesses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reservation_id uuid NOT NULL,
    hostess_id uuid NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    status character varying(30) DEFAULT 'assigned'::character varying NOT NULL,
    commission_rate_snapshot numeric(6,4),
    session_fee numeric(15,4),
    notes text,
    assigned_by uuid,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: reservation_pickups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reservation_pickups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reservation_id uuid NOT NULL,
    driver_id uuid NOT NULL,
    pickup_address text NOT NULL,
    return_address text,
    pickup_time timestamp with time zone NOT NULL,
    return_time timestamp with time zone,
    pickup_fee numeric(15,4) DEFAULT 0 NOT NULL,
    status character varying(30) DEFAULT 'scheduled'::character varying NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: reservations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reservations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reservation_no character varying(50) NOT NULL,
    branch_id uuid NOT NULL,
    customer_id uuid,
    customer_name character varying(255),
    customer_phone character varying(50),
    guest_count smallint DEFAULT 1 NOT NULL,
    reservation_date date NOT NULL,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone,
    duration_hours numeric(4,2),
    room_id uuid,
    status character varying(30) DEFAULT 'tentative'::character varying NOT NULL,
    booking_channel character varying(30) DEFAULT 'walk_in'::character varying NOT NULL,
    referral_code character varying(50),
    agent_id uuid,
    is_outcall boolean DEFAULT false NOT NULL,
    special_requests text,
    internal_notes text,
    deposit_amount numeric(15,4) DEFAULT 0 NOT NULL,
    deposit_paid boolean DEFAULT false NOT NULL,
    deposit_paid_at timestamp with time zone,
    deposit_method character varying(30),
    confirmed_at timestamp with time zone,
    checked_in_at timestamp with time zone,
    checked_out_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    cancellation_reason text,
    no_show_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_at timestamp with time zone,
    assigned_by uuid
);


--
-- Name: rooms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rooms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    branch_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    room_type character varying(30) DEFAULT 'private_room'::character varying NOT NULL,
    capacity_min smallint DEFAULT 1 NOT NULL,
    capacity_max smallint NOT NULL,
    hourly_rate numeric(15,4),
    min_hours numeric(4,2) DEFAULT 1.0 NOT NULL,
    description text,
    amenities jsonb,
    floor_level character varying(20),
    images jsonb,
    status character varying(30) DEFAULT 'available'::character varying NOT NULL,
    sort_order smallint DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: shareholders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shareholders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255),
    phone character varying(50),
    password_hash text,
    nationality character varying(100),
    bank_name character varying(100),
    bank_account character varying(100),
    bank_country character(2),
    swift_code character varying(20),
    preferred_currency character(3) DEFAULT 'MYR'::bpchar,
    is_active boolean DEFAULT true NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: staff; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    branch_id uuid NOT NULL,
    employee_code character varying(50),
    full_name character varying(255) NOT NULL,
    legal_name character varying(255),
    nationality character varying(100),
    id_type character varying(20),
    id_number character varying(100),
    id_expiry date,
    phone character varying(50),
    whatsapp character varying(50),
    email character varying(255),
    password_hash text,
    role character varying(30) NOT NULL,
    employment_type character varying(30) DEFAULT 'full_time'::character varying NOT NULL,
    hire_date date,
    contract_start date,
    contract_end date,
    base_salary numeric(15,4),
    salary_currency character(3) DEFAULT 'MYR'::bpchar,
    commission_config jsonb,
    incentive_config jsonb,
    penalty_applies boolean DEFAULT false NOT NULL,
    agent_id uuid,
    profile_photo text,
    bank_name character varying(100),
    bank_account character varying(100),
    bank_country character(2),
    swift_code character varying(20),
    preferred_currency character(3) DEFAULT 'MYR'::bpchar,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    investor_branch_scope jsonb DEFAULT '[]'::jsonb,
    last_login_at timestamp with time zone
);


--
-- Name: staff_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    staff_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    day_of_week smallint NOT NULL,
    shift_start time without time zone NOT NULL,
    shift_end time without time zone NOT NULL,
    is_overnight boolean DEFAULT false NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT staff_schedules_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6)))
);


--
-- Name: tables; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tables (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL,
    branch_id uuid,
    name character varying(100) NOT NULL,
    capacity integer,
    location character varying(200),
    status character varying(50) DEFAULT 'available'::character varying,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT tables_status_check CHECK (((status)::text = ANY ((ARRAY['available'::character varying, 'occupied'::character varying, 'reserved'::character varying, 'maintenance'::character varying])::text[])))
);


--
-- Data for Name: agent_commissions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.agent_commissions (id, agent_id, hostess_session_id, hostess_id, reservation_id, period_from, period_to, commission_type, rate, base_amount, commission_amount, currency, status, settled_at, settled_by, notes, created_at) FROM stdin;
b7000001-0000-0000-0000-000000000001	285726d3-e898-4d38-a603-e48794fef68a	b0000001-0000-0000-0000-000000000001	1d0c0046-26ce-43ce-88ff-9aa743148424	f4782275-3461-4a26-8226-7ce19bba83d9	\N	\N	percentage	0.1200	480.0000	57.6000	MYR	settled	2026-03-17 02:00:00+00	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	\N	2026-03-20 09:21:05.912908+00
b7000001-0000-0000-0000-000000000002	285726d3-e898-4d38-a603-e48794fef68a	b0000001-0000-0000-0000-000000000002	a909cc0a-af3c-46f4-9ae1-14c9e04a6c8c	f4782275-3461-4a26-8226-7ce19bba83d9	\N	\N	percentage	0.1200	320.0000	38.4000	MYR	settled	2026-03-17 02:00:00+00	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	\N	2026-03-20 09:21:05.912908+00
b7000001-0000-0000-0000-000000000003	a9000001-0000-0000-0000-000000000001	b0000001-0000-0000-0000-000000000003	1d0c0046-26ce-43ce-88ff-9aa743148424	361c61ea-0a07-4821-9fcd-81a630407d49	\N	\N	percentage	0.1200	400.0000	48.0000	MYR	settled	2026-03-20 02:00:00+00	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	\N	2026-03-20 09:21:05.912908+00
b7000001-0000-0000-0000-000000000004	a9000001-0000-0000-0000-000000000002	b0000001-0000-0000-0000-000000000004	a909cc0a-af3c-46f4-9ae1-14c9e04a6c8c	c3feac5b-d681-4fc8-bd1d-4ed34adb6a38	\N	\N	percentage	0.1500	360.0000	54.0000	MYR	settled	2026-03-17 02:00:00+00	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	\N	2026-03-20 09:21:05.912908+00
b7000001-0000-0000-0000-000000000005	a9000001-0000-0000-0000-000000000003	b0000001-0000-0000-0000-000000000005	1d0c0046-26ce-43ce-88ff-9aa743148424	420b76ff-8f2c-4208-91fd-63e65606933c	\N	\N	percentage	0.0900	380.0000	34.2000	MYR	settled	2026-03-20 02:00:00+00	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	\N	2026-03-20 09:21:05.912908+00
b7000001-0000-0000-0000-000000000006	a9000001-0000-0000-0000-000000000001	b0000001-0000-0000-0000-000000000006	a909cc0a-af3c-46f4-9ae1-14c9e04a6c8c	cbd2ab73-430e-4145-a151-dfd2fef9e1b7	\N	\N	percentage	0.1200	500.0000	60.0000	MYR	settled	2026-03-17 02:00:00+00	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	\N	2026-03-20 09:21:05.912908+00
b7000001-0000-0000-0000-000000000007	a9000001-0000-0000-0000-000000000004	b0000001-0000-0000-0000-000000000007	1d0c0046-26ce-43ce-88ff-9aa743148424	43208b14-1549-40cc-812d-55241c3ef1d4	\N	\N	percentage	0.1000	420.0000	42.0000	MYR	pending	\N	\N	\N	2026-03-20 09:21:05.912908+00
b7000001-0000-0000-0000-000000000008	a9000001-0000-0000-0000-000000000001	b0000001-0000-0000-0000-000000000008	a909cc0a-af3c-46f4-9ae1-14c9e04a6c8c	f9000001-0000-0000-0000-000000000001	\N	\N	percentage	0.1200	460.0000	55.2000	MYR	settled	2026-03-20 02:00:00+00	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	\N	2026-03-20 09:21:05.912908+00
b7000001-0000-0000-0000-000000000009	a9000001-0000-0000-0000-000000000002	b0000001-0000-0000-0000-000000000009	1d0c0046-26ce-43ce-88ff-9aa743148424	f9000001-0000-0000-0000-000000000002	\N	\N	percentage	0.1500	340.0000	51.0000	MYR	settled	2026-03-20 02:00:00+00	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	\N	2026-03-20 09:21:05.912908+00
b7000001-0000-0000-0000-000000000010	a9000001-0000-0000-0000-000000000003	b0000001-0000-0000-0000-000000000010	a909cc0a-af3c-46f4-9ae1-14c9e04a6c8c	f9000001-0000-0000-0000-000000000003	\N	\N	percentage	0.0900	500.0000	45.0000	MYR	pending	\N	\N	\N	2026-03-20 09:21:05.912908+00
\.


--
-- Data for Name: agent_payouts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.agent_payouts (id, agent_id, period_from, period_to, amount_myr, payout_currency, fx_rate, amount_fx, payment_method, payment_ref, balance_before, notes, paid_by, paid_at, created_at) FROM stdin;
b8000001-0000-0000-0000-000000000001	285726d3-e898-4d38-a603-e48794fef68a	2026-03-01	2026-03-15	96.0000	MYR	1.000000	96.0000	bank_transfer	IBG20260317001	96.0000	\N	baa4adfd-09ee-457e-bcd5-3fa7e1569616	2026-03-20 09:21:05.925279+00	2026-03-20 09:21:05.925279+00
b8000001-0000-0000-0000-000000000002	a9000001-0000-0000-0000-000000000001	2026-03-01	2026-03-15	214.2000	MYR	1.000000	214.2000	bank_transfer	IBG20260317002	214.2000	\N	baa4adfd-09ee-457e-bcd5-3fa7e1569616	2026-03-20 09:21:05.925279+00	2026-03-20 09:21:05.925279+00
b8000001-0000-0000-0000-000000000003	a9000001-0000-0000-0000-000000000002	2026-03-01	2026-03-15	105.0000	MYR	1.000000	105.0000	bank_transfer	IBG20260317003	105.0000	\N	baa4adfd-09ee-457e-bcd5-3fa7e1569616	2026-03-20 09:21:05.925279+00	2026-03-20 09:21:05.925279+00
b8000001-0000-0000-0000-000000000004	a9000001-0000-0000-0000-000000000003	2026-03-01	2026-03-15	79.2000	MYR	1.000000	79.2000	cash	\N	79.2000	\N	baa4adfd-09ee-457e-bcd5-3fa7e1569616	2026-03-20 09:21:05.925279+00	2026-03-20 09:21:05.925279+00
b8000001-0000-0000-0000-000000000005	285726d3-e898-4d38-a603-e48794fef68a	2026-02-01	2026-02-28	288.0000	MYR	1.000000	288.0000	bank_transfer	IBG20260305001	288.0000	\N	baa4adfd-09ee-457e-bcd5-3fa7e1569616	2026-03-20 09:21:05.925279+00	2026-03-20 09:21:05.925279+00
b8000001-0000-0000-0000-000000000006	a9000001-0000-0000-0000-000000000001	2026-02-01	2026-02-28	350.4000	MYR	1.000000	350.4000	bank_transfer	IBG20260305002	350.4000	\N	baa4adfd-09ee-457e-bcd5-3fa7e1569616	2026-03-20 09:21:05.925279+00	2026-03-20 09:21:05.925279+00
b8000001-0000-0000-0000-000000000007	a9000001-0000-0000-0000-000000000002	2026-01-01	2026-01-31	425.0000	MYR	1.000000	425.0000	bank_transfer	IBG20260205001	425.0000	\N	baa4adfd-09ee-457e-bcd5-3fa7e1569616	2026-03-20 09:21:05.925279+00	2026-03-20 09:21:05.925279+00
b8000001-0000-0000-0000-000000000008	a9000001-0000-0000-0000-000000000003	2026-01-01	2026-01-31	310.0000	MYR	1.000000	310.0000	bank_transfer	IBG20260205002	310.0000	\N	baa4adfd-09ee-457e-bcd5-3fa7e1569616	2026-03-20 09:21:05.925279+00	2026-03-20 09:21:05.925279+00
b8000001-0000-0000-0000-000000000009	a9000001-0000-0000-0000-000000000004	2026-01-01	2026-01-31	195.0000	MYR	1.000000	195.0000	cash	\N	195.0000	\N	baa4adfd-09ee-457e-bcd5-3fa7e1569616	2026-03-20 09:21:05.925279+00	2026-03-20 09:21:05.925279+00
b8000001-0000-0000-0000-000000000010	285726d3-e898-4d38-a603-e48794fef68a	2025-12-01	2025-12-31	420.0000	MYR	1.000000	420.0000	bank_transfer	IBG20260105001	420.0000	\N	baa4adfd-09ee-457e-bcd5-3fa7e1569616	2026-03-20 09:21:05.925279+00	2026-03-20 09:21:05.925279+00
\.


--
-- Data for Name: agents; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.agents (id, org_id, agent_type, name, contact_person, phone, whatsapp, email, commission_type, commission_rate, commission_base, payment_cycle, payment_method, bank_name, bank_account, bank_country, swift_code, preferred_currency, credit_balance, notes, is_active, created_at, deleted_at) FROM stdin;
285726d3-e898-4d38-a603-e48794fef68a	00000000-0000-0000-0000-000000000001	agency	Star Agency	David Lim	+60192345678	\N	\N	pct	0.3000	hostess_gross	monthly	\N	\N	\N	\N	\N	MYR	0.0000	\N	t	2026-03-19 11:11:11.258361+00	\N
a9000001-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000001	individual	Tan Wei Liang	Tan Wei Liang	+60123456001	+60123456001	tanwl@agent.my	pct	0.1200	hostess_gross	monthly	bank_transfer	Maybank	5501234001	MY	\N	MYR	0.0000	\N	t	2026-03-20 09:14:02.292555+00	\N
a9000001-0000-0000-0000-000000000002	00000000-0000-0000-0000-000000000001	agency	Star KTV Agency	Lim Siew Ping	+60123456002	+60123456002	lsp@starktvagency.com	pct	0.1500	hostess_gross	monthly	bank_transfer	CIMB	7701234002	MY	\N	MYR	0.0000	\N	t	2026-03-20 09:14:02.292555+00	\N
a9000001-0000-0000-0000-000000000003	00000000-0000-0000-0000-000000000001	individual	Ahmad Firdaus	Ahmad Firdaus	+60133456003	+60133456003	ahmad.f@agent.my	pct	0.0900	hostess_gross	bi_weekly	bank_transfer	RHB	2201234003	MY	\N	MYR	0.0000	\N	t	2026-03-20 09:14:02.292555+00	\N
a9000001-0000-0000-0000-000000000004	00000000-0000-0000-0000-000000000001	agency	Golden Night Agency	Chua Mei Xuan	+60143456004	+60143456004	cmx@goldennight.my	pct	0.1000	hostess_gross	monthly	bank_transfer	Hong Leong	4401234004	MY	\N	MYR	0.0000	\N	t	2026-03-20 09:14:02.292555+00	\N
a9000001-0000-0000-0000-000000000005	00000000-0000-0000-0000-000000000001	individual	Kevin Ong	Kevin Ong	+60153456005	+60153456005	kevin.o@agent.my	pct	0.0800	room_revenue	monthly	cash	\N	\N	\N	\N	MYR	0.0000	\N	t	2026-03-20 09:14:02.292555+00	\N
a9000001-0000-0000-0000-000000000006	00000000-0000-0000-0000-000000000001	agency	Prestige Talent Mgmt	Jessica Wong	+60163456006	+60163456006	jw@prestige.my	pct	0.1800	hostess_gross	monthly	bank_transfer	Maybank	5501234006	MY	\N	MYR	0.0000	\N	t	2026-03-20 09:14:02.292555+00	\N
a9000001-0000-0000-0000-000000000007	00000000-0000-0000-0000-000000000001	individual	Raj Kumar	Raj Kumar	+60173456007	+60173456007	raj.k@agent.my	pct	0.1100	hostess_gross	monthly	bank_transfer	Public Bank	1101234007	MY	\N	MYR	0.0000	\N	t	2026-03-20 09:14:02.292555+00	\N
a9000001-0000-0000-0000-000000000008	00000000-0000-0000-0000-000000000001	agency	Elite Entertainment	Siti Nadia	+60183456008	+60183456008	sn@eliteent.my	pct	0.1300	hostess_gross	monthly	bank_transfer	CIMB	7701234008	MY	\N	MYR	0.0000	\N	t	2026-03-20 09:14:02.292555+00	\N
a9000001-0000-0000-0000-000000000009	00000000-0000-0000-0000-000000000001	individual	David Cheah	David Cheah	+60193456009	+60193456009	david.c@agent.my	pct	0.1100	room_revenue	monthly	bank_transfer	RHB	2201234009	MY	\N	MYR	0.0000	\N	t	2026-03-20 09:14:02.292555+00	\N
\.


--
-- Data for Name: attendance; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.attendance (id, staff_id, branch_id, work_date, scheduled_start, scheduled_end, clock_in, clock_out, status, late_minutes, early_leave_min, penalty_amount, penalty_reason, notes, approved_by, approved_at, created_at, hours_worked, gps_lat_in, gps_lng_in, gps_lat_out, gps_lng_out, clock_in_source) FROM stdin;
9c816176-03a7-47fa-8118-c601492f509e	a909cc0a-af3c-46f4-9ae1-14c9e04a6c8c	d44ca290-a086-439d-9657-07fc5ebb689c	2026-03-19	\N	\N	2026-03-19 11:11:11.557+00	2026-03-19 11:11:11.685857+00	present	0	0	0.0000	\N	\N	\N	\N	2026-03-19 11:11:11.559289+00	\N	\N	\N	\N	\N	admin
d01ba288-5c4b-433c-8d0c-40ec4a78068a	a909cc0a-af3c-46f4-9ae1-14c9e04a6c8c	d44ca290-a086-439d-9657-07fc5ebb689c	2026-03-18	\N	\N	\N	\N	absent	0	0	0.0000	\N	\N	\N	\N	2026-03-20 04:31:12.901097+00	\N	\N	\N	\N	\N	admin
20e5c7b1-06aa-4ddb-b147-45aa5bde4b8c	a909cc0a-af3c-46f4-9ae1-14c9e04a6c8c	d44ca290-a086-439d-9657-07fc5ebb689c	2026-03-17	\N	\N	2026-03-17 21:31:12.901097+00	2026-03-18 04:31:12.901097+00	late	15	0	0.0000	\N	\N	\N	\N	2026-03-20 04:31:12.901097+00	7.00	\N	\N	\N	\N	admin
312ec201-9728-4ca9-9e12-16ffb37b6f34	a909cc0a-af3c-46f4-9ae1-14c9e04a6c8c	d44ca290-a086-439d-9657-07fc5ebb689c	2026-03-16	\N	\N	2026-03-16 20:31:12.901097+00	2026-03-17 04:31:12.901097+00	present	0	0	0.0000	\N	\N	\N	\N	2026-03-20 04:31:12.901097+00	8.00	\N	\N	\N	\N	admin
f4aafecd-5de9-4f4e-8c04-2414640f3892	a909cc0a-af3c-46f4-9ae1-14c9e04a6c8c	d44ca290-a086-439d-9657-07fc5ebb689c	2026-03-15	\N	\N	2026-03-15 21:31:12.901097+00	2026-03-16 04:31:12.901097+00	present	0	0	0.0000	\N	\N	\N	\N	2026-03-20 04:31:12.901097+00	7.00	\N	\N	\N	\N	admin
e8a86d76-5b05-4381-9370-c68a34c87f88	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	d44ca290-a086-439d-9657-07fc5ebb689c	2026-03-20	\N	\N	2026-03-20 08:28:46.968177+00	\N	present	0	0	0.0000	\N	\N	\N	\N	2026-03-20 08:28:46.968177+00	\N	\N	\N	\N	\N	self_service
af000001-0000-0000-0000-000000000001	1d0c0046-26ce-43ce-88ff-9aa743148424	d44ca290-a086-439d-9657-07fc5ebb689c	2026-03-18	\N	\N	2026-03-18 11:30:00+00	2026-03-18 17:30:00+00	present	0	0	0.0000	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	\N	2026-03-20 09:16:14.22339+00	6.00	\N	\N	\N	\N	gps
af000001-0000-0000-0000-000000000002	1d0c0046-26ce-43ce-88ff-9aa743148424	d44ca290-a086-439d-9657-07fc5ebb689c	2026-03-17	\N	\N	2026-03-17 11:45:00+00	2026-03-17 18:00:00+00	present	0	0	0.0000	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	\N	2026-03-20 09:16:14.22339+00	6.25	\N	\N	\N	\N	gps
af000001-0000-0000-0000-000000000003	c4624bd2-a4b3-48da-ad7b-a174dec55668	d44ca290-a086-439d-9657-07fc5ebb689c	2026-03-18	\N	\N	2026-03-18 10:00:00+00	2026-03-18 16:00:00+00	present	0	0	0.0000	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	\N	2026-03-20 09:16:14.22339+00	6.00	\N	\N	\N	\N	gps
af000001-0000-0000-0000-000000000004	2b905497-fb89-4294-9774-4a23a118e9dd	d44ca290-a086-439d-9657-07fc5ebb689c	2026-03-19	\N	\N	2026-03-19 10:00:00+00	2026-03-19 16:30:00+00	present	0	0	0.0000	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	\N	2026-03-20 09:16:14.22339+00	6.50	\N	\N	\N	\N	manual
e4000001-0000-0000-0000-000000000001	bd2a4a52-70f4-4416-8931-d181d0158998	d44ca290-a086-439d-9657-07fc5ebb689c	2026-03-20	\N	\N	2026-03-20 11:45:00+00	\N	present	0	0	0.0000	\N	\N	\N	\N	2026-03-20 09:31:22.994553+00	\N	\N	\N	\N	\N	admin
\.


--
-- Data for Name: audit_log; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.audit_log (id, entity_type, entity_id, action, changed_by, changed_at, old_values, new_values, ip_address, user_agent) FROM stdin;
e8f130a2-7bff-4ed7-a1f3-168fd0c6f552	reservation	cbd2ab73-430e-4145-a151-dfd2fef9e1b7	status_change	baa4adfd-09ee-457e-bcd5-3fa7e1569616	2026-03-19 09:59:04.302461+00	{"status": "tentative"}	{"status": "confirmed"}	\N	\N
ad061bc3-6abf-477d-86e3-2bd489853e22	reservation	cbd2ab73-430e-4145-a151-dfd2fef9e1b7	status_change	baa4adfd-09ee-457e-bcd5-3fa7e1569616	2026-03-19 13:32:41.297643+00	{"status": "confirmed"}	{"status": "checked_in"}	\N	\N
2b8fd143-1f77-4d34-9083-55f1eb9c12e4	reservation	cbd2ab73-430e-4145-a151-dfd2fef9e1b7	status_change	baa4adfd-09ee-457e-bcd5-3fa7e1569616	2026-03-19 13:32:49.32713+00	{"status": "checked_in"}	{"status": "checked_out"}	\N	\N
445a4fed-2bee-4050-b5b3-6828c706ba08	reservation	43208b14-1549-40cc-812d-55241c3ef1d4	status_change	baa4adfd-09ee-457e-bcd5-3fa7e1569616	2026-03-20 00:59:40.526255+00	{"status": "tentative"}	{"status": "confirmed"}	\N	\N
9dca5f7d-1b8a-46c8-8c25-3fd9c3af336f	reservation	43208b14-1549-40cc-812d-55241c3ef1d4	status_change	baa4adfd-09ee-457e-bcd5-3fa7e1569616	2026-03-20 00:59:52.099842+00	{"status": "confirmed"}	{"status": "checked_in"}	\N	\N
aee42c0e-e9a8-454c-b888-9d84ec6578f2	reservation	f4782275-3461-4a26-8226-7ce19bba83d9	status_change	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:22:08.105267+00	{"status": "tentative"}	{"status": "confirmed"}	192.168.1.10	\N
67887c79-e609-46fd-af03-f149964e5beb	reservation	361c61ea-0a07-4821-9fcd-81a630407d49	check_in	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:22:08.105267+00	{"status": "confirmed"}	{"status": "checked_in", "checked_in_at": "2026-03-19T20:05:00+08:00"}	192.168.1.10	\N
857209fe-8830-4b37-b8ce-d14c7ad3f3a2	staff	1d0c0046-26ce-43ce-88ff-9aa743148424	profile_update	baa4adfd-09ee-457e-bcd5-3fa7e1569616	2026-03-20 09:22:08.105267+00	{"role": "general"}	{"role": "hostess"}	192.168.1.1	\N
b5777d7e-b787-4d7a-9d0a-7a13361019ac	invoice	ac000001-0000-0000-0000-000000000001	status_change	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:22:08.105267+00	{"status": "draft"}	{"status": "paid"}	192.168.1.10	\N
07bb7288-27ab-40a8-9e64-48bdca6474e1	order	ab000001-0000-0000-0000-000000000003	payment_update	cb9837c5-33f1-4c67-8b4a-85e4922258f3	2026-03-20 09:22:08.105267+00	{"payment_status": "pending"}	{"payment_status": "partial"}	192.168.1.20	\N
db000001-0000-0000-0000-000000000001	staff	2b905497-fb89-4294-9774-4a23a118e9dd	password_reset	baa4adfd-09ee-457e-bcd5-3fa7e1569616	2026-03-20 09:30:20.502066+00	{"reason": "user_request"}	{"reset_at": "2026-03-20T09:05:00+08:00", "password_reset": true}	10.0.0.1	Mozilla/5.0 (Dashboard Admin Panel)
db000001-0000-0000-0000-000000000002	staff	0e851835-0578-499c-9a13-3a68cd3b6177	role_update	ce5ccfb6-aecd-41b3-9632-1aa3095e9436	2026-03-20 09:30:20.510187+00	{"role": "general"}	{"role": "hall", "updated_at": "2026-03-20T09:30:00+08:00"}	10.0.0.2	Mozilla/5.0 (Admin Dashboard)
db000001-0000-0000-0000-000000000003	order	ce000001-0000-0000-0000-000000000001	kitchen_received	1a1aa56c-0e3f-4a56-98ce-b39754873aa0	2026-03-20 09:30:20.56902+00	{"kitchen_status": "pending"}	{"received_at": "2026-03-20T21:15:00+08:00", "kitchen_status": "received"}	192.168.1.50	KDS Kitchen Display System v2.1
db000001-0000-0000-0000-000000000004	tables	e7370cf9-47aa-4f4b-9d6c-9a2a6955d23a	status_change	bd2a4a52-70f4-4416-8931-d181d0158998	2026-03-20 09:30:20.580815+00	{"status": "available"}	{"status": "occupied", "updated_at": "2026-03-20T19:50:00+08:00"}	192.168.1.55	Mozilla/5.0 (Club Noir KL POS Tablet)
\.


--
-- Data for Name: availability_blocks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.availability_blocks (id, branch_id, entity_type, entity_id, block_type, reservation_id, start_dt, end_dt, created_by, notes, is_active, created_at) FROM stdin;
fc6bdc6e-017f-4a32-9915-d95dc317f351	d44ca290-a086-439d-9657-07fc5ebb689c	room	ddf4f071-48fa-41f1-9843-7ad019d3e258	maintenance	\N	2026-03-20 10:00:00+00	2026-03-20 12:00:00+00	baa4adfd-09ee-457e-bcd5-3fa7e1569616	정기 청소	t	2026-03-20 04:33:24.141493+00
8ecabbd8-1560-4623-a2d9-5599d4d6d602	d44ca290-a086-439d-9657-07fc5ebb689c	room	ddf4f071-48fa-41f1-9843-7ad019d3e258	closed	\N	2026-03-21 10:00:00+00	2026-03-21 12:00:00+00	baa4adfd-09ee-457e-bcd5-3fa7e1569616	임시 휴관	t	2026-03-20 04:33:24.141493+00
44000001-0000-0000-0000-000000000001	d44ca290-a086-439d-9657-07fc5ebb689c	room	3c095c9b-3c80-401e-bcec-d0b87cb48559	maintenance	\N	2026-03-22 02:00:00+00	2026-03-22 10:00:00+00	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	VIP Suite A - deep cleaning	t	2026-03-20 09:16:14.22956+00
44000001-0000-0000-0000-000000000002	d44ca290-a086-439d-9657-07fc5ebb689c	room	ec9af592-9b4b-4373-aeb8-b81dc29f63bc	maintenance	\N	2026-04-04 16:00:00+00	2026-04-05 15:59:00+00	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	Public holiday closure	t	2026-03-20 09:16:14.22956+00
44000001-0000-0000-0000-000000000003	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	room	2cbdd664-130d-48f5-b3c6-a50ce9630545	maintenance	\N	2026-03-25 02:00:00+00	2026-03-25 08:00:00+00	cb9837c5-33f1-4c67-8b4a-85e4922258f3	Health inspection PJ	t	2026-03-20 09:16:14.22956+00
44000001-0000-0000-0000-000000000004	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	room	44695522-f27d-42cb-a5d5-29f4b5cda8eb	private_booking	\N	2026-04-09 16:00:00+00	2026-04-10 15:59:00+00	cb9837c5-33f1-4c67-8b4a-85e4922258f3	Private event booking	t	2026-03-20 09:16:14.22956+00
44000001-0000-0000-0000-000000000005	d44ca290-a086-439d-9657-07fc5ebb689c	staff	1d0c0046-26ce-43ce-88ff-9aa743148424	leave	\N	2026-03-27 16:00:00+00	2026-03-28 16:00:00+00	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	Annual leave	t	2026-03-20 09:16:14.22956+00
44000001-0000-0000-0000-000000000006	d44ca290-a086-439d-9657-07fc5ebb689c	staff	a909cc0a-af3c-46f4-9ae1-14c9e04a6c8c	leave	\N	2026-04-14 16:00:00+00	2026-04-15 16:00:00+00	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	Medical leave	t	2026-03-20 09:16:14.22956+00
44000001-0000-0000-0000-000000000007	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	staff	c4624bd2-a4b3-48da-ad7b-a174dec55668	training	\N	2026-03-30 01:00:00+00	2026-03-30 07:00:00+00	cb9837c5-33f1-4c67-8b4a-85e4922258f3	Driver safety training	t	2026-03-20 09:16:14.22956+00
44000001-0000-0000-0000-000000000008	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	room	ddf4f071-48fa-41f1-9843-7ad019d3e258	maintenance	\N	2026-04-19 16:00:00+00	2026-04-20 16:00:00+00	cb9837c5-33f1-4c67-8b4a-85e4922258f3	Annual maintenance	t	2026-03-20 09:16:14.22956+00
df000001-0000-0000-0000-000000000001	d44ca290-a086-439d-9657-07fc5ebb689c	staff	1d0c0046-26ce-43ce-88ff-9aa743148424	personal	\N	2026-03-21 06:00:00+00	2026-03-21 10:00:00+00	1d0c0046-26ce-43ce-88ff-9aa743148424	Personal appointment — not available for afternoon calls	t	2026-03-20 09:30:20.554787+00
\.


--
-- Data for Name: branch_shareholders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.branch_shareholders (id, branch_id, shareholder_id, equity_pct, agreed_rate, effective_from, effective_to, notes) FROM stdin;
71bd8a18-f9ac-48b5-8231-2d6554fc9704	d44ca290-a086-439d-9657-07fc5ebb689c	241e5e68-7371-4bca-be51-44d61e9fbf96	0.3000	0.3000	2025-01-01	\N	\N
246229f8-1c87-4492-b5c8-8d2d4f26446d	d44ca290-a086-439d-9657-07fc5ebb689c	d9000001-0000-0000-0000-000000000001	0.2000	0.2000	2024-01-01	\N	\N
5e4eb4ad-308e-41fc-aefe-00ce11678c93	d44ca290-a086-439d-9657-07fc5ebb689c	d9000001-0000-0000-0000-000000000002	0.1500	0.1500	2024-01-01	\N	\N
5c0abf6c-43da-45c0-8ba3-cf2c78d1d803	d44ca290-a086-439d-9657-07fc5ebb689c	d9000001-0000-0000-0000-000000000003	0.1000	0.1000	2024-01-01	\N	\N
c625efcd-3e42-4ab8-bcfb-d0ad9b5762bc	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	d9000001-0000-0000-0000-000000000004	0.3000	0.3000	2024-01-01	\N	\N
9ca31686-dbbd-4304-957a-e18623a2124f	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	d9000001-0000-0000-0000-000000000005	0.2000	0.2000	2024-01-01	\N	\N
2ca50ccb-e5d5-46c3-a2ee-4042a2cb824b	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	d9000001-0000-0000-0000-000000000006	0.1500	0.1500	2024-01-01	\N	\N
c469cc0b-3d80-4108-b539-2a94331c74e2	d44ca290-a086-439d-9657-07fc5ebb689c	d9000001-0000-0000-0000-000000000007	0.0800	0.0800	2024-06-01	\N	\N
99d6e9d2-0c61-4caa-b39a-3afd4f54f713	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	d9000001-0000-0000-0000-000000000008	0.0500	0.0500	2025-01-01	\N	\N
b5b7729e-b82f-4040-8a5d-44de2bd37005	d44ca290-a086-439d-9657-07fc5ebb689c	d9000001-0000-0000-0000-000000000009	0.0500	0.0500	2025-01-01	\N	\N
\.


--
-- Data for Name: branches; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.branches (id, org_id, name, internal_code, address, city, country, phone, email, timezone, currency, operating_hours, tax_config, settings, is_active, created_at, deleted_at) FROM stdin;
d44ca290-a086-439d-9657-07fc5ebb689c	00000000-0000-0000-0000-000000000001	Club Noir KL	KL01	\N	Kuala Lumpur	MY	\N	\N	Asia/Kuala_Lumpur	MYR	\N	{"sst_rate": 0.06, "service_charge": 0.10}	{"sst_reg_number": "", "invoice_footer_text": "", "default_invoice_mode": "detailed", "default_receipt_mode": "detailed", "thermal_printer_width_mm": 80, "show_hostess_name_on_invoice": true, "show_hostess_name_on_receipt": false}	t	2026-03-19 09:12:16.669578+00	\N
6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	00000000-0000-0000-0000-000000000001	Velvet Lounge PJ	KL02	\N	Petaling Jaya	MY	\N	\N	Asia/Kuala_Lumpur	MYR	\N	{"sst_rate": 0.06, "service_charge": 0.10}	{"sst_reg_number": "", "invoice_footer_text": "", "default_invoice_mode": "detailed", "default_receipt_mode": "detailed", "thermal_printer_width_mm": 80, "show_hostess_name_on_invoice": true, "show_hostess_name_on_receipt": false}	t	2026-03-19 09:12:16.669578+00	\N
\.


--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.customers (id, org_id, customer_code, full_name, phone, whatsapp, email, password_hash, nationality, language_pref, referral_code_used, referral_source, referral_agent_id, credit_balance, payment_type, credit_limit, credit_due_day, vip_tier, notes, is_active, created_at, deleted_at) FROM stdin;
fe8efacd-0148-4b05-b09d-f799a6094266	00000000-0000-0000-0000-000000000001	CMMXECWIK	Lee Soo-jin	+60123456789	\N	lee.soojin@test.com	$2b$12$LPQpDNIX2E8SllrrrOLINu5AJ9i6RxPlBET3L6LnbY8/JNC6poy2G	\N	ko	\N	\N	\N	0.0000	standard	0.0000	\N	standard	\N	t	2026-03-19 11:38:41.949377+00	\N
a85891ea-4fe4-4e7b-83ac-9cd1debd8557	00000000-0000-0000-0000-000000000001	CMMXEGQ7K	Test Customer	+60123456789	\N	testcustomer123@portal.test	$2b$12$x4gLFuovjE8hwUmaoQ/N3..RiuINQy/goYXDNx3t29cy1DqjP.0NO	\N	en	\N	\N	\N	0.0000	standard	0.0000	\N	standard	\N	t	2026-03-19 11:41:40.400904+00	\N
bac61958-a403-4cab-b57c-ad0a1b2d6f49	00000000-0000-0000-0000-000000000001	CMMXEM4ZO	Portal Tester	+60155551234	\N	portaltester99@test.com	$2b$12$EesZpcIzgOqM.l4jEFJRAeUMhUXXN1/ClxoYbyc8z3h2wf25Idn0G	\N	en	\N	\N	\N	0.0000	standard	0.0000	\N	standard	\N	t	2026-03-19 11:45:52.836403+00	\N
29da004e-e84c-4520-beb1-9257085db4d9	00000000-0000-0000-0000-000000000001	CMMXEQ4LQ	Chunk06 Tester	+60199990001	\N	chunk06@test.com	$2b$12$CnDk6Vo5/e9t0acwjP98.ef3UhAp9pixZa3iGBt7U1pmP.KQhUqOG	\N	zh	\N	\N	\N	0.0000	standard	0.0000	\N	standard	\N	t	2026-03-19 11:48:58.959153+00	\N
f298ab23-a849-4efe-ab49-9c8b8bee49c8	00000000-0000-0000-0000-000000000001	CMMXERBNH	FinalTest	+60111111111	\N	finaltest@test.com	$2b$12$K5KlRIky4U3n8sABYU1rb.uB82EhL98Q/hnuFgdMP/K/F9UC6Nwui	\N	ms	\N	\N	\N	0.0000	standard	0.0000	\N	standard	\N	t	2026-03-19 11:49:54.750404+00	\N
c9000001-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000001	KL-CUS-006	Lee Chong Wei	+60178881001	+60178881001	lcw@gmail.com	\N	Malaysian	en	\N	\N	\N	0.0000	standard	0.0000	\N	standard	\N	t	2026-03-20 09:14:02.327406+00	\N
c9000001-0000-0000-0000-000000000002	00000000-0000-0000-0000-000000000001	KL-CUS-007	Nurul Ain Binti Aziz	+60168882002	+60168882002	nurul.ain@gmail.com	\N	Malaysian	ms	\N	\N	\N	0.0000	standard	0.0000	\N	standard	\N	t	2026-03-20 09:14:02.327406+00	\N
c9000001-0000-0000-0000-000000000003	00000000-0000-0000-0000-000000000001	KL-CUS-008	Park Joon Ho	+60158883003	+60158883003	parkjh@kakao.com	\N	Korean	ko	\N	\N	\N	0.0000	standard	0.0000	\N	standard	\N	t	2026-03-20 09:14:02.327406+00	\N
c9000001-0000-0000-0000-000000000004	00000000-0000-0000-0000-000000000001	KL-CUS-009	Watanabe Kenji	+60148884004	+60148884004	watanabe@mail.jp	\N	Japanese	ja	\N	\N	\N	0.0000	standard	0.0000	\N	standard	\N	t	2026-03-20 09:14:02.327406+00	\N
c9000001-0000-0000-0000-000000000005	00000000-0000-0000-0000-000000000001	KL-CUS-010	Chen Hai Long	+60138885005	+60138885005	chen.hl@qq.com	\N	Chinese	zh	\N	\N	\N	0.0000	standard	0.0000	\N	standard	\N	t	2026-03-20 09:14:02.327406+00	\N
\.


--
-- Data for Name: driver_messages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.driver_messages (id, driver_id, branch_id, pickup_id, message, sent_at) FROM stdin;
ba000001-0000-0000-0000-000000000001	c4624bd2-a4b3-48da-ad7b-a174dec55668	d44ca290-a086-439d-9657-07fc5ebb689c	b2000001-0000-0000-0000-000000000001	On my way to pick up guest at The Gardens. ETA 15 mins.	2026-03-20 09:22:08.093323+00
ba000001-0000-0000-0000-000000000002	c4624bd2-a4b3-48da-ad7b-a174dec55668	d44ca290-a086-439d-9657-07fc5ebb689c	b2000001-0000-0000-0000-000000000001	Guest picked up. Heading to Club Noir KL now.	2026-03-20 09:22:08.093323+00
ba000001-0000-0000-0000-000000000003	c4624bd2-a4b3-48da-ad7b-a174dec55668	d44ca290-a086-439d-9657-07fc5ebb689c	b2000001-0000-0000-0000-000000000002	Arrived at Pavilion KL. Waiting for guest.	2026-03-20 09:22:08.093323+00
ba000001-0000-0000-0000-000000000004	c4624bd2-a4b3-48da-ad7b-a174dec55668	d44ca290-a086-439d-9657-07fc5ebb689c	b2000001-0000-0000-0000-000000000002	Guest confirmed. Departing now.	2026-03-20 09:22:08.093323+00
ba000001-0000-0000-0000-000000000005	c4624bd2-a4b3-48da-ad7b-a174dec55668	d44ca290-a086-439d-9657-07fc5ebb689c	b2000001-0000-0000-0000-000000000003	Heavy traffic on KESAS. Will be 10 mins late.	2026-03-20 09:22:08.093323+00
ba000001-0000-0000-0000-000000000006	c4624bd2-a4b3-48da-ad7b-a174dec55668	d44ca290-a086-439d-9657-07fc5ebb689c	b2000001-0000-0000-0000-000000000004	Picked up 2 guests from KLCC. All good.	2026-03-20 09:22:08.093323+00
ba000001-0000-0000-0000-000000000007	c4624bd2-a4b3-48da-ad7b-a174dec55668	d44ca290-a086-439d-9657-07fc5ebb689c	b2000001-0000-0000-0000-000000000006	Currently at 1 Utama. Guest is running 15 mins late.	2026-03-20 09:22:08.093323+00
ba000001-0000-0000-0000-000000000008	c4624bd2-a4b3-48da-ad7b-a174dec55668	d44ca290-a086-439d-9657-07fc5ebb689c	b2000001-0000-0000-0000-000000000006	Guest boarded. Heading to venue now.	2026-03-20 09:22:08.093323+00
ba000001-0000-0000-0000-000000000009	c4624bd2-a4b3-48da-ad7b-a174dec55668	d44ca290-a086-439d-9657-07fc5ebb689c	b2000001-0000-0000-0000-000000000009	Departed for Sunway Velocity pickup. On schedule.	2026-03-20 09:22:08.093323+00
ba000001-0000-0000-0000-000000000010	c4624bd2-a4b3-48da-ad7b-a174dec55668	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	b2000001-0000-0000-0000-000000000010	Confirmed pickup at Empire Shopping Gallery for 6:45PM.	2026-03-20 09:22:08.093323+00
e2000001-0000-0000-0000-000000000001	c4624bd2-a4b3-48da-ad7b-a174dec55668	d44ca290-a086-439d-9657-07fc5ebb689c	e1000001-0000-0000-0000-000000000001	Pickup confirmed for 25 Mar 20:30 at Pavilion KL. Will WhatsApp guest 30 mins before.	2026-03-20 09:31:22.981679+00
ed000001-0000-0000-0000-000000000001	c4624bd2-a4b3-48da-ad7b-a174dec55668	d44ca290-a086-439d-9657-07fc5ebb689c	ec000001-0000-0000-0000-000000000001	On the way to Pavilion Hotel. ETA 15 mins.	2026-03-15 12:15:00+00
ed000001-0000-0000-0000-000000000002	c4624bd2-a4b3-48da-ad7b-a174dec55668	d44ca290-a086-439d-9657-07fc5ebb689c	ec000001-0000-0000-0000-000000000001	Guest Lee Soo-jin picked up. Heading to venue.	2026-03-15 12:38:00+00
ed000001-0000-0000-0000-000000000003	c4624bd2-a4b3-48da-ad7b-a174dec55668	d44ca290-a086-439d-9657-07fc5ebb689c	ec000001-0000-0000-0000-000000000002	Parked at Mandarin Oriental basement. Waiting for guest.	2026-03-16 11:28:00+00
ed000001-0000-0000-0000-000000000004	c4624bd2-a4b3-48da-ad7b-a174dec55668	d44ca290-a086-439d-9657-07fc5ebb689c	ec000001-0000-0000-0000-000000000002	VIP guest Jason Wong and 3 companions on board. ETA 20 mins.	2026-03-16 11:45:00+00
ed000001-0000-0000-0000-000000000005	c4624bd2-a4b3-48da-ad7b-a174dec55668	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	ec000001-0000-0000-0000-000000000003	At Empire Shopping Gallery carpark B1. Guest confirmed.	2026-03-17 12:32:00+00
ed000001-0000-0000-0000-000000000006	c4624bd2-a4b3-48da-ad7b-a174dec55668	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	ec000001-0000-0000-0000-000000000003	Michael Lim picked up from Empire. En route to PJ branch.	2026-03-17 12:45:00+00
ed000001-0000-0000-0000-000000000007	c4624bd2-a4b3-48da-ad7b-a174dec55668	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	ec000001-0000-0000-0000-000000000004	7-seater dispatched to Sunway Pyramid Hotel. 10 mins away.	2026-03-18 12:22:00+00
ed000001-0000-0000-0000-000000000008	c4624bd2-a4b3-48da-ad7b-a174dec55668	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	ec000001-0000-0000-0000-000000000004	David Ng and 2 friends boarded. Heading to PJ lounge.	2026-03-18 12:38:00+00
ed000001-0000-0000-0000-000000000009	c4624bd2-a4b3-48da-ad7b-a174dec55668	d44ca290-a086-439d-9657-07fc5ebb689c	ec000001-0000-0000-0000-000000000005	Leaving now to Gardens Hotel Mid Valley. Called guest.	2026-03-19 11:48:00+00
ed000001-0000-0000-0000-000000000010	c4624bd2-a4b3-48da-ad7b-a174dec55668	d44ca290-a086-439d-9657-07fc5ebb689c	ec000001-0000-0000-0000-000000000005	Ahmad Rizal boarded at Gardens Hotel lobby. ETA 25 mins.	2026-03-19 12:06:00+00
\.


--
-- Data for Name: expenses; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.expenses (id, branch_id, category, description, amount, currency, expense_date, period_month, reference_type, reference_id, receipt_url, notes, created_by, created_at, vendor, approved_by, approved_at, status) FROM stdin;
e0000001-0000-0000-0000-000000000001	d44ca290-a086-439d-9657-07fc5ebb689c	utilities	March electricity bill	1850.0000	MYR	2026-03-01	\N	\N	\N	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:15:27.134992+00	\N	baa4adfd-09ee-457e-bcd5-3fa7e1569616	\N	approved
e0000001-0000-0000-0000-000000000002	d44ca290-a086-439d-9657-07fc5ebb689c	supplies	Bar supplies restocking	620.0000	MYR	2026-03-05	\N	\N	\N	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:15:27.134992+00	\N	baa4adfd-09ee-457e-bcd5-3fa7e1569616	\N	approved
e0000001-0000-0000-0000-000000000003	d44ca290-a086-439d-9657-07fc5ebb689c	maintenance	Sound system repair Room 3	2200.0000	MYR	2026-03-08	\N	\N	\N	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:15:27.134992+00	\N	baa4adfd-09ee-457e-bcd5-3fa7e1569616	\N	approved
e0000001-0000-0000-0000-000000000004	d44ca290-a086-439d-9657-07fc5ebb689c	marketing	Social media campaign March	5000.0000	MYR	2026-03-10	\N	\N	\N	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:15:27.134992+00	\N	baa4adfd-09ee-457e-bcd5-3fa7e1569616	\N	approved
e0000001-0000-0000-0000-000000000005	d44ca290-a086-439d-9657-07fc5ebb689c	salary	Staff salary payout March	28000.0000	MYR	2026-03-15	\N	\N	\N	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:15:27.134992+00	\N	baa4adfd-09ee-457e-bcd5-3fa7e1569616	\N	approved
e0000001-0000-0000-0000-000000000006	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	utilities	March electricity bill PJ	1420.0000	MYR	2026-03-01	\N	\N	\N	\N	\N	cb9837c5-33f1-4c67-8b4a-85e4922258f3	2026-03-20 09:15:27.134992+00	\N	baa4adfd-09ee-457e-bcd5-3fa7e1569616	\N	approved
e0000001-0000-0000-0000-000000000007	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	supplies	Cleaning supplies	480.0000	MYR	2026-03-06	\N	\N	\N	\N	\N	cb9837c5-33f1-4c67-8b4a-85e4922258f3	2026-03-20 09:15:27.134992+00	\N	baa4adfd-09ee-457e-bcd5-3fa7e1569616	\N	approved
e0000001-0000-0000-0000-000000000008	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	maintenance	Air conditioning service	880.0000	MYR	2026-03-12	\N	\N	\N	\N	\N	cb9837c5-33f1-4c67-8b4a-85e4922258f3	2026-03-20 09:15:27.134992+00	\N	baa4adfd-09ee-457e-bcd5-3fa7e1569616	\N	approved
e0000001-0000-0000-0000-000000000009	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	salary	Staff salary payout March PJ	22000.0000	MYR	2026-03-15	\N	\N	\N	\N	\N	cb9837c5-33f1-4c67-8b4a-85e4922258f3	2026-03-20 09:15:27.134992+00	\N	baa4adfd-09ee-457e-bcd5-3fa7e1569616	\N	approved
e0000001-0000-0000-0000-000000000010	d44ca290-a086-439d-9657-07fc5ebb689c	other	Office stationery and printing	350.0000	MYR	2026-03-18	\N	\N	\N	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:15:27.134992+00	\N	\N	\N	pending
da000001-0000-0000-0000-000000000001	d44ca290-a086-439d-9657-07fc5ebb689c	it_infrastructure	Cloud server & POS license renewal Q1 2026	4800.0000	MYR	2026-03-20	2026-03	\N	\N	\N	\N	baa4adfd-09ee-457e-bcd5-3fa7e1569616	2026-03-20 09:30:20.469918+00	AWS / Toast POS MY	baa4adfd-09ee-457e-bcd5-3fa7e1569616	2026-03-20 01:00:00+00	approved
da000001-0000-0000-0000-000000000002	d44ca290-a086-439d-9657-07fc5ebb689c	maintenance	Sound system servicing & PA calibration — March 2026	1200.0000	MYR	2026-03-20	2026-03	\N	\N	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:30:20.5258+00	SoundPro Audio Services KL	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 02:30:00+00	approved
da000001-0000-0000-0000-000000000003	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	supplies	Bar consumables restock — ice, straws, garnish, napkins	380.0000	MYR	2026-03-20	2026-03	\N	\N	\N	\N	cb9837c5-33f1-4c67-8b4a-85e4922258f3	2026-03-20 09:30:20.534368+00	Star Supply Mart PJ	\N	\N	pending
\.


--
-- Data for Name: folio_entries; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.folio_entries (id, reservation_id, order_id, entry_type, description, quantity, unit_price, amount, currency, hostess_session_id, posted_at, posted_by, notes, is_void, voided_at, voided_by, created_at) FROM stdin;
732ab149-bcca-4886-9f72-0b157cc35e71	f4782275-3461-4a26-8226-7ce19bba83d9	\N	room_charge	룸 기본 요금 (2시간)	2.00	500.0000	1000.0000	MYR	\N	2026-03-20 04:33:20.133163+00	baa4adfd-09ee-457e-bcd5-3fa7e1569616	\N	f	\N	\N	2026-03-20 04:33:20.133163+00
e5d2cf8e-0939-432b-b2a7-701a3de8dcaa	f4782275-3461-4a26-8226-7ce19bba83d9	\N	pos_item	음료 (맥주 2병)	2.00	200.0000	400.0000	MYR	\N	2026-03-20 04:33:20.133163+00	baa4adfd-09ee-457e-bcd5-3fa7e1569616	\N	f	\N	\N	2026-03-20 04:33:20.133163+00
428c1aa2-da2b-4b4b-9789-e51b0cc45a67	f4782275-3461-4a26-8226-7ce19bba83d9	\N	hostess_charge	호스티스 지명 요금 (2시간)	2.00	800.0000	1600.0000	MYR	\N	2026-03-20 04:33:20.133163+00	baa4adfd-09ee-457e-bcd5-3fa7e1569616	\N	f	\N	\N	2026-03-20 04:33:20.133163+00
69bc1536-7a1d-4d11-8a6c-9468b27ea01b	f4782275-3461-4a26-8226-7ce19bba83d9	\N	tax	SST 6%	1.00	180.0000	180.0000	MYR	\N	2026-03-20 04:33:20.133163+00	baa4adfd-09ee-457e-bcd5-3fa7e1569616	\N	f	\N	\N	2026-03-20 04:33:20.133163+00
b5000001-0000-0000-0000-000000000001	f9000001-0000-0000-0000-000000000001	\N	room_charge	VIP Suite A - 5 hours	5.00	180.0000	900.0000	MYR	\N	2026-03-20 09:17:39.826127+00	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	\N	f	\N	\N	2026-03-20 09:17:39.826127+00
b5000001-0000-0000-0000-000000000002	f9000001-0000-0000-0000-000000000001	\N	beverage	Hennessy VSOP 1 bottle	1.00	680.0000	680.0000	MYR	\N	2026-03-20 09:17:39.826127+00	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	\N	f	\N	\N	2026-03-20 09:17:39.826127+00
b5000001-0000-0000-0000-000000000003	f9000001-0000-0000-0000-000000000002	\N	room_charge	VIP Suite B - 5 hours	5.00	150.0000	750.0000	MYR	\N	2026-03-20 09:17:39.826127+00	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	\N	f	\N	\N	2026-03-20 09:17:39.826127+00
b5000001-0000-0000-0000-000000000004	f9000001-0000-0000-0000-000000000002	\N	food	Fruit platter deluxe	1.00	120.0000	120.0000	MYR	\N	2026-03-20 09:17:39.826127+00	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	\N	f	\N	\N	2026-03-20 09:17:39.826127+00
b5000001-0000-0000-0000-000000000005	f9000001-0000-0000-0000-000000000003	\N	room_charge	VVIP Prestige - 6 hours	6.00	280.0000	1680.0000	MYR	\N	2026-03-20 09:17:39.826127+00	cb9837c5-33f1-4c67-8b4a-85e4922258f3	\N	f	\N	\N	2026-03-20 09:17:39.826127+00
b5000001-0000-0000-0000-000000000006	f9000001-0000-0000-0000-000000000003	\N	hostess_service	Hostess service - 6 hours	1.00	500.0000	500.0000	MYR	\N	2026-03-20 09:17:39.826127+00	cb9837c5-33f1-4c67-8b4a-85e4922258f3	\N	f	\N	\N	2026-03-20 09:17:39.826127+00
de000001-0000-0000-0000-000000000001	43208b14-1549-40cc-812d-55241c3ef1d4	\N	room_charge	VIP Suite room charge — 5hr block (posted by manager)	1.00	1260.0000	1260.0000	MYR	\N	2026-03-20 09:30:20.543031+00	2b905497-fb89-4294-9774-4a23a118e9dd	Posted manually after room time confirmed	f	\N	\N	2026-03-20 09:30:20.543031+00
de000001-0000-0000-0000-000000000002	43208b14-1549-40cc-812d-55241c3ef1d4	ce000001-0000-0000-0000-000000000001	beverage	Chivas Regal 12yr + Mixer Set	1.00	480.0000	480.0000	MYR	\N	2026-03-20 09:31:22.990951+00	0e851835-0578-499c-9a13-3a68cd3b6177	Added by hall staff at guest request — 21:30	f	\N	\N	2026-03-20 09:31:22.990951+00
\.


--
-- Data for Name: fx_rates; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.fx_rates (id, base_ccy, quote_ccy, rate, source, fetched_at) FROM stdin;
a3d2a45c-3166-4112-981a-11b6f1a12c90	MYR	JPY	33.800000	exchangerate-api	2026-03-19 09:12:02.320361+00
0eed47e0-cd6b-48b2-a921-d7c6c174d116	MYR	CNY	1.592400	exchangerate-api	2026-03-20 09:14:16.037849+00
a1afbcb4-d588-459d-8a69-1412d12dafba	MYR	KRW	303.000000	exchangerate-api	2026-03-20 09:14:16.037849+00
f212e6ac-fda4-4565-8ba9-ab11b00f7cf1	MYR	THB	7.751900	manual	2026-03-20 09:14:16.037849+00
89941de6-a9bb-4479-99df-4a0107f5d09a	MYR	AUD	0.348400	exchangerate-api	2026-03-20 09:14:16.037849+00
9463f74d-baf5-4589-9a50-cc7f8f0a6136	MYR	HKD	1.798600	manual	2026-03-20 09:14:16.037849+00
538c67d7-8250-4c67-8892-dadf50523401	MYR	EUR	0.208800	manual	2026-03-20 09:14:16.037849+00
\.


--
-- Data for Name: hostess_payouts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.hostess_payouts (id, hostess_id, branch_id, period_from, period_to, total_sessions, total_hours, total_gross, total_payout, currency, status, paid_at, paid_by, payment_method, payment_ref, notes, created_by, created_at) FROM stdin;
b6000001-0000-0000-0000-000000000001	1d0c0046-26ce-43ce-88ff-9aa743148424	d44ca290-a086-439d-9657-07fc5ebb689c	2026-03-01	2026-03-15	5	22.50	2000.0000	600.0000	MYR	paid	2026-03-17 02:00:00+00	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	\N	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:21:05.908035+00
b6000001-0000-0000-0000-000000000002	a909cc0a-af3c-46f4-9ae1-14c9e04a6c8c	d44ca290-a086-439d-9657-07fc5ebb689c	2026-03-01	2026-03-15	4	18.00	1640.0000	492.0000	MYR	paid	2026-03-17 02:30:00+00	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	\N	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:21:05.908035+00
b6000001-0000-0000-0000-000000000003	1d0c0046-26ce-43ce-88ff-9aa743148424	d44ca290-a086-439d-9657-07fc5ebb689c	2026-02-01	2026-02-28	8	36.00	3200.0000	960.0000	MYR	paid	2026-03-05 02:00:00+00	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	\N	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:21:05.908035+00
b6000001-0000-0000-0000-000000000004	a909cc0a-af3c-46f4-9ae1-14c9e04a6c8c	d44ca290-a086-439d-9657-07fc5ebb689c	2026-02-01	2026-02-28	7	31.50	2800.0000	840.0000	MYR	paid	2026-03-05 02:30:00+00	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	\N	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:21:05.908035+00
b6000001-0000-0000-0000-000000000005	1d0c0046-26ce-43ce-88ff-9aa743148424	d44ca290-a086-439d-9657-07fc5ebb689c	2026-01-01	2026-01-31	10	45.00	4000.0000	1200.0000	MYR	paid	2026-02-05 02:00:00+00	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	\N	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:21:05.908035+00
b6000001-0000-0000-0000-000000000006	a909cc0a-af3c-46f4-9ae1-14c9e04a6c8c	d44ca290-a086-439d-9657-07fc5ebb689c	2026-01-01	2026-01-31	9	40.50	3600.0000	1080.0000	MYR	paid	2026-02-05 02:30:00+00	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	\N	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:21:05.908035+00
b6000001-0000-0000-0000-000000000007	1d0c0046-26ce-43ce-88ff-9aa743148424	d44ca290-a086-439d-9657-07fc5ebb689c	2025-12-01	2025-12-31	11	49.50	4400.0000	1320.0000	MYR	paid	2026-01-05 02:00:00+00	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	\N	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:21:05.908035+00
b6000001-0000-0000-0000-000000000008	a909cc0a-af3c-46f4-9ae1-14c9e04a6c8c	d44ca290-a086-439d-9657-07fc5ebb689c	2025-12-01	2025-12-31	9	40.50	3600.0000	1080.0000	MYR	paid	2026-01-05 02:30:00+00	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	\N	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:21:05.908035+00
b6000001-0000-0000-0000-000000000009	1d0c0046-26ce-43ce-88ff-9aa743148424	d44ca290-a086-439d-9657-07fc5ebb689c	2026-03-16	2026-03-31	0	0.00	0.0000	0.0000	MYR	pending	\N	\N	\N	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:21:05.908035+00
b6000001-0000-0000-0000-000000000010	a909cc0a-af3c-46f4-9ae1-14c9e04a6c8c	d44ca290-a086-439d-9657-07fc5ebb689c	2026-03-16	2026-03-31	0	0.00	0.0000	0.0000	MYR	pending	\N	\N	\N	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:21:05.908035+00
\.


--
-- Data for Name: hostess_sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.hostess_sessions (id, reservation_id, hostess_id, agent_id, attendance_id, session_type, start_at, end_at, hours_worked, rate_per_hour, gross_amount, payout_rate, net_payout, agent_commission_rate, agent_commission, late_charge_amount, currency, status, notes, created_by, created_at, updated_at) FROM stdin;
b0000001-0000-0000-0000-000000000001	f4782275-3461-4a26-8226-7ce19bba83d9	1d0c0046-26ce-43ce-88ff-9aa743148424	285726d3-e898-4d38-a603-e48794fef68a	\N	incall	2026-03-13 13:00:00+00	2026-03-13 18:00:00+00	5.00	96.0000	480.0000	70.00	\N	0.00	0.0000	0.0000	MYR	settled	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:19:30.028401+00	2026-03-20 09:19:30.028401+00
b0000001-0000-0000-0000-000000000002	f4782275-3461-4a26-8226-7ce19bba83d9	a909cc0a-af3c-46f4-9ae1-14c9e04a6c8c	285726d3-e898-4d38-a603-e48794fef68a	\N	incall	2026-03-13 13:30:00+00	2026-03-13 18:00:00+00	4.50	71.1100	320.0000	70.00	\N	0.00	0.0000	0.0000	MYR	settled	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:19:30.028401+00	2026-03-20 09:19:30.028401+00
b0000001-0000-0000-0000-000000000003	361c61ea-0a07-4821-9fcd-81a630407d49	1d0c0046-26ce-43ce-88ff-9aa743148424	a9000001-0000-0000-0000-000000000001	\N	incall	2026-03-19 13:00:00+00	2026-03-19 17:30:00+00	4.50	88.8900	400.0000	70.00	\N	0.00	0.0000	0.0000	MYR	settled	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:19:30.028401+00	2026-03-20 09:19:30.028401+00
b0000001-0000-0000-0000-000000000004	c3feac5b-d681-4fc8-bd1d-4ed34adb6a38	a909cc0a-af3c-46f4-9ae1-14c9e04a6c8c	a9000001-0000-0000-0000-000000000002	f4aafecd-5de9-4f4e-8c04-2414640f3892	incall	2026-03-15 13:00:00+00	2026-03-15 17:00:00+00	4.00	90.0000	360.0000	70.00	\N	0.00	0.0000	0.0000	MYR	settled	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:19:30.028401+00	2026-03-20 09:19:30.028401+00
b0000001-0000-0000-0000-000000000005	420b76ff-8f2c-4208-91fd-63e65606933c	1d0c0046-26ce-43ce-88ff-9aa743148424	a9000001-0000-0000-0000-000000000003	\N	incall	2026-03-19 13:30:00+00	2026-03-19 18:00:00+00	4.50	84.4400	380.0000	70.00	\N	0.00	0.0000	0.0000	MYR	settled	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:19:30.028401+00	2026-03-20 09:19:30.028401+00
b0000001-0000-0000-0000-000000000006	cbd2ab73-430e-4145-a151-dfd2fef9e1b7	a909cc0a-af3c-46f4-9ae1-14c9e04a6c8c	a9000001-0000-0000-0000-000000000001	312ec201-9728-4ca9-9e12-16ffb37b6f34	incall	2026-03-16 13:00:00+00	2026-03-16 18:00:00+00	5.00	100.0000	500.0000	70.00	\N	0.00	0.0000	0.0000	MYR	settled	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:19:30.028401+00	2026-03-20 09:19:30.028401+00
b0000001-0000-0000-0000-000000000007	43208b14-1549-40cc-812d-55241c3ef1d4	1d0c0046-26ce-43ce-88ff-9aa743148424	a9000001-0000-0000-0000-000000000004	af000001-0000-0000-0000-000000000001	incall	2026-03-20 12:30:00+00	\N	\N	93.3300	\N	70.00	\N	0.00	0.0000	0.0000	MYR	ongoing	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:19:30.028401+00	2026-03-20 09:19:30.028401+00
b0000001-0000-0000-0000-000000000008	f9000001-0000-0000-0000-000000000001	a909cc0a-af3c-46f4-9ae1-14c9e04a6c8c	a9000001-0000-0000-0000-000000000001	d01ba288-5c4b-433c-8d0c-40ec4a78068a	incall	2026-03-18 12:30:00+00	2026-03-18 18:00:00+00	5.50	83.6400	460.0000	70.00	\N	0.00	0.0000	0.0000	MYR	settled	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:19:30.028401+00	2026-03-20 09:19:30.028401+00
b0000001-0000-0000-0000-000000000009	f9000001-0000-0000-0000-000000000002	1d0c0046-26ce-43ce-88ff-9aa743148424	a9000001-0000-0000-0000-000000000002	af000001-0000-0000-0000-000000000002	incall	2026-03-17 13:30:00+00	2026-03-17 18:30:00+00	5.00	68.0000	340.0000	70.00	\N	0.00	0.0000	0.0000	MYR	settled	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:19:30.028401+00	2026-03-20 09:19:30.028401+00
b0000001-0000-0000-0000-000000000010	f9000001-0000-0000-0000-000000000003	a909cc0a-af3c-46f4-9ae1-14c9e04a6c8c	a9000001-0000-0000-0000-000000000003	9c816176-03a7-47fa-8118-c601492f509e	incall	2026-03-19 12:30:00+00	\N	\N	100.0000	\N	70.00	\N	0.00	0.0000	0.0000	MYR	ongoing	\N	cb9837c5-33f1-4c67-8b4a-85e4922258f3	2026-03-20 09:19:30.028401+00	2026-03-20 09:19:30.028401+00
e0000001-0000-0000-0000-000000000001	cf000001-0000-0000-0000-000000000001	1d0c0046-26ce-43ce-88ff-9aa743148424	a9000001-0000-0000-0000-000000000001	\N	incall	2026-03-25 13:00:00+00	\N	\N	96.0000	\N	70.00	\N	0.00	0.0000	0.0000	MYR	scheduled	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:30:20.559175+00	2026-03-20 09:30:20.559175+00
ea000001-0000-0000-0000-000000000001	e5000001-0000-0000-0000-000000000001	1d0c0046-26ce-43ce-88ff-9aa743148424	285726d3-e898-4d38-a603-e48794fef68a	\N	incall	2026-03-10 13:00:00+00	2026-03-10 18:00:00+00	5.00	96.0000	480.0000	70.00	\N	0.00	0.0000	0.0000	MYR	settled	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:46:34.458886+00	2026-03-20 09:46:34.458886+00
ea000001-0000-0000-0000-000000000002	e5000001-0000-0000-0000-000000000002	a909cc0a-af3c-46f4-9ae1-14c9e04a6c8c	a9000001-0000-0000-0000-000000000001	\N	incall	2026-03-11 13:00:00+00	2026-03-11 18:00:00+00	5.00	96.0000	480.0000	70.00	\N	0.00	0.0000	0.0000	MYR	settled	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:46:34.458886+00	2026-03-20 09:46:34.458886+00
ea000001-0000-0000-0000-000000000003	e5000001-0000-0000-0000-000000000003	1d0c0046-26ce-43ce-88ff-9aa743148424	285726d3-e898-4d38-a603-e48794fef68a	\N	incall	2026-03-12 12:00:00+00	2026-03-12 18:00:00+00	6.00	96.0000	576.0000	70.00	\N	0.00	0.0000	0.0000	MYR	settled	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:46:34.458886+00	2026-03-20 09:46:34.458886+00
ea000001-0000-0000-0000-000000000004	e5000001-0000-0000-0000-000000000003	a909cc0a-af3c-46f4-9ae1-14c9e04a6c8c	285726d3-e898-4d38-a603-e48794fef68a	\N	incall	2026-03-12 12:30:00+00	2026-03-12 18:00:00+00	5.50	96.0000	528.0000	70.00	\N	0.00	0.0000	0.0000	MYR	settled	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:46:34.458886+00	2026-03-20 09:46:34.458886+00
ea000001-0000-0000-0000-000000000005	e5000001-0000-0000-0000-000000000004	1d0c0046-26ce-43ce-88ff-9aa743148424	a9000001-0000-0000-0000-000000000002	\N	incall	2026-03-13 13:00:00+00	2026-03-13 18:00:00+00	5.00	96.0000	480.0000	70.00	\N	0.00	0.0000	0.0000	MYR	settled	\N	cb9837c5-33f1-4c67-8b4a-85e4922258f3	2026-03-20 09:46:34.458886+00	2026-03-20 09:46:34.458886+00
ea000001-0000-0000-0000-000000000006	e5000001-0000-0000-0000-000000000005	a909cc0a-af3c-46f4-9ae1-14c9e04a6c8c	a9000001-0000-0000-0000-000000000001	\N	incall	2026-03-14 13:00:00+00	2026-03-14 19:00:00+00	6.00	96.0000	576.0000	70.00	\N	0.00	0.0000	0.0000	MYR	settled	\N	cb9837c5-33f1-4c67-8b4a-85e4922258f3	2026-03-20 09:46:34.458886+00	2026-03-20 09:46:34.458886+00
ea000001-0000-0000-0000-000000000007	e5000001-0000-0000-0000-000000000005	1d0c0046-26ce-43ce-88ff-9aa743148424	a9000001-0000-0000-0000-000000000001	\N	incall	2026-03-14 13:30:00+00	2026-03-14 19:00:00+00	5.50	96.0000	528.0000	70.00	\N	0.00	0.0000	0.0000	MYR	settled	\N	cb9837c5-33f1-4c67-8b4a-85e4922258f3	2026-03-20 09:46:34.458886+00	2026-03-20 09:46:34.458886+00
ea000001-0000-0000-0000-000000000008	e5000001-0000-0000-0000-000000000006	1d0c0046-26ce-43ce-88ff-9aa743148424	a9000001-0000-0000-0000-000000000003	\N	outcall	2026-03-15 13:00:00+00	2026-03-15 17:00:00+00	4.00	96.0000	384.0000	70.00	\N	0.00	0.0000	0.0000	MYR	settled	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:46:34.458886+00	2026-03-20 09:46:34.458886+00
ea000001-0000-0000-0000-000000000009	e5000001-0000-0000-0000-000000000007	a909cc0a-af3c-46f4-9ae1-14c9e04a6c8c	285726d3-e898-4d38-a603-e48794fef68a	\N	outcall	2026-03-16 12:00:00+00	2026-03-16 18:00:00+00	6.00	96.0000	576.0000	70.00	\N	0.00	0.0000	0.0000	MYR	settled	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:46:34.458886+00	2026-03-20 09:46:34.458886+00
ea000001-0000-0000-0000-000000000010	e5000001-0000-0000-0000-000000000007	1d0c0046-26ce-43ce-88ff-9aa743148424	285726d3-e898-4d38-a603-e48794fef68a	\N	outcall	2026-03-16 12:30:00+00	2026-03-16 18:00:00+00	5.50	96.0000	528.0000	70.00	\N	0.00	0.0000	0.0000	MYR	settled	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:46:34.458886+00	2026-03-20 09:46:34.458886+00
ea000001-0000-0000-0000-000000000011	e5000001-0000-0000-0000-000000000008	a909cc0a-af3c-46f4-9ae1-14c9e04a6c8c	a9000001-0000-0000-0000-000000000002	\N	outcall	2026-03-17 13:00:00+00	2026-03-17 17:00:00+00	4.00	96.0000	384.0000	70.00	\N	0.00	0.0000	0.0000	MYR	settled	\N	cb9837c5-33f1-4c67-8b4a-85e4922258f3	2026-03-20 09:46:34.458886+00	2026-03-20 09:46:34.458886+00
ea000001-0000-0000-0000-000000000012	e5000001-0000-0000-0000-000000000009	1d0c0046-26ce-43ce-88ff-9aa743148424	a9000001-0000-0000-0000-000000000003	\N	outcall	2026-03-18 13:00:00+00	2026-03-18 18:00:00+00	5.00	96.0000	480.0000	70.00	\N	0.00	0.0000	0.0000	MYR	settled	\N	cb9837c5-33f1-4c67-8b4a-85e4922258f3	2026-03-20 09:46:34.458886+00	2026-03-20 09:46:34.458886+00
ea000001-0000-0000-0000-000000000013	e5000001-0000-0000-0000-000000000009	a909cc0a-af3c-46f4-9ae1-14c9e04a6c8c	a9000001-0000-0000-0000-000000000003	\N	outcall	2026-03-18 13:30:00+00	2026-03-18 18:00:00+00	4.50	96.0000	432.0000	70.00	\N	0.00	0.0000	0.0000	MYR	settled	\N	cb9837c5-33f1-4c67-8b4a-85e4922258f3	2026-03-20 09:46:34.458886+00	2026-03-20 09:46:34.458886+00
ea000001-0000-0000-0000-000000000014	e5000001-0000-0000-0000-000000000010	1d0c0046-26ce-43ce-88ff-9aa743148424	a9000001-0000-0000-0000-000000000004	\N	outcall	2026-03-19 12:30:00+00	2026-03-19 17:30:00+00	5.00	96.0000	480.0000	70.00	\N	0.00	0.0000	0.0000	MYR	settled	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:46:34.458886+00	2026-03-20 09:46:34.458886+00
\.


--
-- Data for Name: investor_export_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.investor_export_logs (id, staff_id, report_id, report_period, exported_at, ip_address, file_format, watermark_text) FROM stdin;
4301ba34-a978-4a78-b189-c6371ae8c43e	baa4adfd-09ee-457e-bcd5-3fa7e1569616	\N	2026-02	2026-03-20 08:14:28.082201+00	::1	JSON	CONFIDENTIAL — baa4adfd-09ee-457e-bcd5-3fa7e1569616 — 2026-03-20T08:14:28.080Z
bb000001-0000-0000-0000-000000000001	a1e57548-38dc-44be-9a0a-a06d535592ff	391e36cd-98eb-41c9-b584-6ee637117055	2026-03	2026-03-20 09:22:51.809989+00	192.168.2.100	PDF	\N
bb000001-0000-0000-0000-000000000002	a1e57548-38dc-44be-9a0a-a06d535592ff	b1e43c45-dd68-43a5-8e32-add1e997aeb7	2026-03	2026-03-20 09:22:51.809989+00	192.168.2.100	PDF	\N
bb000001-0000-0000-0000-000000000003	a1e57548-38dc-44be-9a0a-a06d535592ff	b8173d1f-c24a-4efd-b1cd-68e798b50e43	2026-02	2026-03-20 09:22:51.809989+00	192.168.2.100	PDF	\N
bb000001-0000-0000-0000-000000000004	a1e57548-38dc-44be-9a0a-a06d535592ff	a14158d8-4ecb-4032-aa9c-c0777682d437	2026-02	2026-03-20 09:22:51.809989+00	192.168.2.101	PDF	\N
bb000001-0000-0000-0000-000000000005	a1e57548-38dc-44be-9a0a-a06d535592ff	1683e017-ea38-4ef4-84f6-e9db7bfdf571	2026-02	2026-03-20 09:22:51.809989+00	192.168.2.100	CSV	\N
bb000001-0000-0000-0000-000000000006	baa4adfd-09ee-457e-bcd5-3fa7e1569616	7752f55b-8bce-48eb-b51a-983e405f3f6f	2026-01	2026-03-20 09:22:51.809989+00	192.168.1.1	PDF	\N
bb000001-0000-0000-0000-000000000007	a1e57548-38dc-44be-9a0a-a06d535592ff	c1000001-0000-0000-0000-000000000001	2025-12	2026-03-20 09:22:51.809989+00	192.168.2.100	PDF	\N
bb000001-0000-0000-0000-000000000008	a1e57548-38dc-44be-9a0a-a06d535592ff	c1000001-0000-0000-0000-000000000002	2025-12	2026-03-20 09:22:51.809989+00	192.168.2.100	PDF	\N
bb000001-0000-0000-0000-000000000009	baa4adfd-09ee-457e-bcd5-3fa7e1569616	c1000001-0000-0000-0000-000000000003	2025-11	2026-03-20 09:22:51.809989+00	192.168.1.1	PDF	\N
dd000001-0000-0000-0000-000000000001	a1e57548-38dc-44be-9a0a-a06d535592ff	391e36cd-98eb-41c9-b584-6ee637117055	2026-03	2026-03-20 09:30:20.513479+00	203.112.50.88	PDF	\N
dd000001-0000-0000-0000-000000000002	a1e57548-38dc-44be-9a0a-a06d535592ff	12fe0968-a992-4ed5-b6c9-1fb0e5c5453a	2026-02	2026-03-20 09:30:20.517049+00	203.112.50.88	CSV	\N
\.


--
-- Data for Name: investor_reports; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.investor_reports (id, org_id, branch_id, branch_name, period, report_type, total_revenue, room_revenue, beverage_revenue, food_revenue, package_revenue, other_revenue, total_operating_cost, total_commission_expense, gross_profit, net_profit, room_utilization_pct, total_sessions, unique_customers, avg_spend_per_session, notes, generated_at, generated_by, currency_code) FROM stdin;
a14158d8-4ecb-4032-aa9c-c0777682d437	00000000-0000-0000-0000-000000000001	\N	KL Branch 01	2026-02	MONTHLY	120000.00	80000.00	25000.00	15000.00	0.00	0.00	65000.00	10000.00	45000.00	30000.00	78.50	210	180	571.43	Q1 strong performance	2026-03-20 08:14:13.2112+00	baa4adfd-09ee-457e-bcd5-3fa7e1569616	MYR
7752f55b-8bce-48eb-b51a-983e405f3f6f	00000000-0000-0000-0000-000000000001	\N	KL Branch 01	2026-01	MONTHLY	98000.00	65000.00	20000.00	13000.00	0.00	0.00	51000.00	9000.00	38000.00	22000.00	71.20	190	155	515.79	\N	2026-03-20 08:14:27.923795+00	baa4adfd-09ee-457e-bcd5-3fa7e1569616	MYR
b8173d1f-c24a-4efd-b1cd-68e798b50e43	00000000-0000-0000-0000-000000000001	\N	KL Branch 02	2026-02	MONTHLY	85000.00	55000.00	18000.00	12000.00	0.00	0.00	45000.00	8000.00	32000.00	18000.00	65.00	175	142	485.71	\N	2026-03-20 08:14:27.961214+00	baa4adfd-09ee-457e-bcd5-3fa7e1569616	MYR
391e36cd-98eb-41c9-b584-6ee637117055	00000000-0000-0000-0000-000000000001	d44ca290-a086-439d-9657-07fc5ebb689c	Club Noir KL	2026-03	MONTHLY	362.50	0.00	0.00	0.00	0.00	362.50	0.00	0.00	362.50	362.50	66.67	6	0	140.17	\N	2026-03-20 08:40:04.139777+00	SYSTEM_NIGHTLY_JOB	MYR
1683e017-ea38-4ef4-84f6-e9db7bfdf571	00000000-0000-0000-0000-000000000001	d44ca290-a086-439d-9657-07fc5ebb689c	Club Noir KL	2026-02	MONTHLY	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0	0	0.00	\N	2026-03-20 08:40:04.145545+00	SYSTEM_NIGHTLY_JOB	MYR
b1e43c45-dd68-43a5-8e32-add1e997aeb7	00000000-0000-0000-0000-000000000001	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	Velvet Lounge PJ	2026-03	MONTHLY	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0	0	0.00	\N	2026-03-20 08:40:04.150323+00	SYSTEM_NIGHTLY_JOB	MYR
12fe0968-a992-4ed5-b6c9-1fb0e5c5453a	00000000-0000-0000-0000-000000000001	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	Velvet Lounge PJ	2026-02	MONTHLY	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0	0	0.00	\N	2026-03-20 08:40:04.155622+00	SYSTEM_NIGHTLY_JOB	MYR
c1000001-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000001	d44ca290-a086-439d-9657-07fc5ebb689c	Club Noir KL	2025-12	MONTHLY	188000.00	68000.00	72000.00	0.00	0.00	10000.00	64000.00	0.00	124000.00	124000.00	82.00	0	0	2350.00	\N	2026-03-20 09:22:51.803706+00	SYSTEM	MYR
c1000001-0000-0000-0000-000000000002	00000000-0000-0000-0000-000000000001	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	Velvet Lounge PJ	2025-12	MONTHLY	145000.00	52000.00	56000.00	0.00	0.00	8000.00	49000.00	0.00	96000.00	96000.00	78.00	0	0	1980.00	\N	2026-03-20 09:22:51.803706+00	SYSTEM	MYR
c1000001-0000-0000-0000-000000000003	00000000-0000-0000-0000-000000000001	d44ca290-a086-439d-9657-07fc5ebb689c	Club Noir KL	2025-11	MONTHLY	172000.00	62000.00	66000.00	0.00	0.00	10000.00	58000.00	0.00	114000.00	114000.00	75.00	0	0	2150.00	\N	2026-03-20 09:22:51.803706+00	SYSTEM	MYR
\.


--
-- Data for Name: invoices; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.invoices (id, invoice_no, reservation_id, branch_id, customer_id, customer_name, subtotal, discount_amount, sst_amount, service_charge, total_amount, amount_paid, balance_due, currency, status, notes, issued_at, issued_by, due_date, voided_at, void_reason, created_at, updated_at) FROM stdin;
81b7ad47-1c5f-4759-9b2f-cb5af622a081	KL01-INV-20260320-0001	f4782275-3461-4a26-8226-7ce19bba83d9	d44ca290-a086-439d-9657-07fc5ebb689c	fe8efacd-0148-4b05-b09d-f799a6094266	Lee Soo-jin	3000.0000	0.0000	180.0000	0.0000	3180.0000	0.0000	0.0000	MYR	issued	\N	2026-03-20 04:34:00.565226+00	baa4adfd-09ee-457e-bcd5-3fa7e1569616	\N	\N	\N	2026-03-20 04:34:00.565226+00	2026-03-20 04:34:00.565226+00
ac000001-0000-0000-0000-000000000001	KL01-INV-20260318-0001	f9000001-0000-0000-0000-000000000001	d44ca290-a086-439d-9657-07fc5ebb689c	fe8efacd-0148-4b05-b09d-f799a6094266	Lee Chong Wei	1850.0000	0.0000	111.0000	185.0000	2146.0000	0.0000	0.0000	MYR	paid	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	\N	\N	\N	2026-03-20 09:17:39.812807+00	2026-03-20 09:17:39.812807+00
ac000001-0000-0000-0000-000000000002	KL01-INV-20260317-0001	f9000001-0000-0000-0000-000000000002	d44ca290-a086-439d-9657-07fc5ebb689c	a85891ea-4fe4-4e7b-83ac-9cd1debd8557	Ahmad Rizal	1200.0000	0.0000	72.0000	120.0000	1392.0000	0.0000	0.0000	MYR	paid	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	\N	\N	\N	2026-03-20 09:17:39.812807+00	2026-03-20 09:17:39.812807+00
ac000001-0000-0000-0000-000000000003	PJ01-INV-20260319-0001	f9000001-0000-0000-0000-000000000003	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	c9000001-0000-0000-0000-000000000001	Lee Chong Wei	2800.0000	200.0000	156.0000	252.0000	3008.0000	0.0000	0.0000	MYR	draft	\N	\N	cb9837c5-33f1-4c67-8b4a-85e4922258f3	\N	\N	\N	2026-03-20 09:17:39.812807+00	2026-03-20 09:17:39.812807+00
ac000001-0000-0000-0000-000000000004	PJ01-INV-20260321-0001	f9000001-0000-0000-0000-000000000004	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	c9000001-0000-0000-0000-000000000002	Nurul Ain Binti Aziz	950.0000	0.0000	57.0000	95.0000	1102.0000	0.0000	0.0000	MYR	draft	\N	\N	cb9837c5-33f1-4c67-8b4a-85e4922258f3	\N	\N	\N	2026-03-20 09:17:39.812807+00	2026-03-20 09:17:39.812807+00
ac000001-0000-0000-0000-000000000005	KL01-INV-20260316-0001	cbd2ab73-430e-4145-a151-dfd2fef9e1b7	d44ca290-a086-439d-9657-07fc5ebb689c	bac61958-a403-4cab-b57c-ad0a1b2d6f49	Sarah Lim	3200.0000	320.0000	177.6000	288.0000	3345.6000	0.0000	0.0000	MYR	paid	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	\N	\N	\N	2026-03-20 09:17:39.812807+00	2026-03-20 09:17:39.812807+00
ac000001-0000-0000-0000-000000000006	KL01-INV-20260315-0001	c3feac5b-d681-4fc8-bd1d-4ed34adb6a38	d44ca290-a086-439d-9657-07fc5ebb689c	29da004e-e84c-4520-beb1-9257085db4d9	Michael Tan	1680.0000	0.0000	100.8000	168.0000	1948.8000	0.0000	0.0000	MYR	paid	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	\N	\N	\N	2026-03-20 09:17:39.812807+00	2026-03-20 09:17:39.812807+00
ac000001-0000-0000-0000-000000000007	KL01-INV-20260313-0001	f4782275-3461-4a26-8226-7ce19bba83d9	d44ca290-a086-439d-9657-07fc5ebb689c	f298ab23-a849-4efe-ab49-9c8b8bee49c8	Jason Wong	4500.0000	450.0000	243.0000	405.0000	4698.0000	0.0000	0.0000	MYR	paid	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	\N	\N	\N	2026-03-20 09:17:39.812807+00	2026-03-20 09:17:39.812807+00
ac000001-0000-0000-0000-000000000008	KL01-INV-20260319-0001	361c61ea-0a07-4821-9fcd-81a630407d49	d44ca290-a086-439d-9657-07fc5ebb689c	a85891ea-4fe4-4e7b-83ac-9cd1debd8557	Ahmad Rizal	2100.0000	0.0000	126.0000	210.0000	2436.0000	0.0000	0.0000	MYR	paid	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	\N	\N	\N	2026-03-20 09:17:39.812807+00	2026-03-20 09:17:39.812807+00
ac000001-0000-0000-0000-000000000009	KL01-INV-20260319-0002	420b76ff-8f2c-4208-91fd-63e65606933c	d44ca290-a086-439d-9657-07fc5ebb689c	bac61958-a403-4cab-b57c-ad0a1b2d6f49	Sarah Lim	1550.0000	0.0000	93.0000	155.0000	1798.0000	0.0000	0.0000	MYR	paid	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	\N	\N	\N	2026-03-20 09:17:39.812807+00	2026-03-20 09:17:39.812807+00
e7000001-0000-0000-0000-000000000001	INV-KL01-20260310-001	e5000001-0000-0000-0000-000000000001	d44ca290-a086-439d-9657-07fc5ebb689c	c9000001-0000-0000-0000-000000000001	Lee Chong Wei	1516.0000	0.0000	121.2800	151.6000	1788.8800	1788.8800	0.0000	MYR	paid	\N	2026-03-10 18:00:00+00	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-11	\N	\N	2026-03-20 09:42:10.391265+00	2026-03-20 09:42:10.391265+00
e7000001-0000-0000-0000-000000000002	INV-KL01-20260311-001	e5000001-0000-0000-0000-000000000002	d44ca290-a086-439d-9657-07fc5ebb689c	c9000001-0000-0000-0000-000000000003	Park Joon Ho	1178.0000	0.0000	94.2400	117.8000	1390.0400	1390.0400	0.0000	MYR	paid	\N	2026-03-11 18:00:00+00	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-12	\N	\N	2026-03-20 09:42:10.391265+00	2026-03-20 09:42:10.391265+00
e7000001-0000-0000-0000-000000000003	INV-KL01-20260312-001	e5000001-0000-0000-0000-000000000003	d44ca290-a086-439d-9657-07fc5ebb689c	c9000001-0000-0000-0000-000000000005	Chen Hai Long	2703.0000	0.0000	216.2400	270.3000	3189.5400	3189.5400	0.0000	MYR	paid	\N	2026-03-12 18:00:00+00	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-13	\N	\N	2026-03-20 09:42:10.391265+00	2026-03-20 09:42:10.391265+00
e7000001-0000-0000-0000-000000000004	INV-PJ01-20260313-001	e5000001-0000-0000-0000-000000000004	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	c9000001-0000-0000-0000-000000000004	Watanabe Kenji	1320.0000	0.0000	105.6000	132.0000	1557.6000	1557.6000	0.0000	MYR	paid	\N	2026-03-13 18:00:00+00	cb9837c5-33f1-4c67-8b4a-85e4922258f3	2026-03-14	\N	\N	2026-03-20 09:42:10.391265+00	2026-03-20 09:42:10.391265+00
e7000001-0000-0000-0000-000000000005	INV-PJ01-20260314-001	e5000001-0000-0000-0000-000000000005	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	c9000001-0000-0000-0000-000000000002	Nurul Ain Binti Aziz	2998.0000	0.0000	239.8400	299.8000	3537.6400	3537.6400	0.0000	MYR	paid	\N	2026-03-14 19:00:00+00	cb9837c5-33f1-4c67-8b4a-85e4922258f3	2026-03-15	\N	\N	2026-03-20 09:42:10.391265+00	2026-03-20 09:42:10.391265+00
e7000001-0000-0000-0000-000000000006	INV-KL01-20260315-002	e5000001-0000-0000-0000-000000000006	d44ca290-a086-439d-9657-07fc5ebb689c	fe8efacd-0148-4b05-b09d-f799a6094266	Lee Soo-jin	1028.0000	0.0000	82.2400	102.8000	1213.0400	1213.0400	0.0000	MYR	paid	\N	2026-03-15 17:00:00+00	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-16	\N	\N	2026-03-20 09:42:10.391265+00	2026-03-20 09:42:10.391265+00
e7000001-0000-0000-0000-000000000007	INV-KL01-20260316-002	e5000001-0000-0000-0000-000000000007	d44ca290-a086-439d-9657-07fc5ebb689c	f298ab23-a849-4efe-ab49-9c8b8bee49c8	Jason Wong	2756.0000	0.0000	220.4800	275.6000	3252.0800	3252.0800	0.0000	MYR	paid	\N	2026-03-16 18:00:00+00	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-17	\N	\N	2026-03-20 09:42:10.391265+00	2026-03-20 09:42:10.391265+00
e7000001-0000-0000-0000-000000000008	INV-PJ01-20260317-001	e5000001-0000-0000-0000-000000000008	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	bac61958-a403-4cab-b57c-ad0a1b2d6f49	Michael Lim	920.0000	0.0000	73.6000	92.0000	1085.6000	1085.6000	0.0000	MYR	paid	\N	2026-03-17 17:00:00+00	cb9837c5-33f1-4c67-8b4a-85e4922258f3	2026-03-18	\N	\N	2026-03-20 09:42:10.391265+00	2026-03-20 09:42:10.391265+00
e7000001-0000-0000-0000-000000000009	INV-PJ01-20260318-001	e5000001-0000-0000-0000-000000000009	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	29da004e-e84c-4520-beb1-9257085db4d9	David Ng	1360.0000	0.0000	108.8000	136.0000	1604.8000	1604.8000	0.0000	MYR	paid	\N	2026-03-18 18:00:00+00	cb9837c5-33f1-4c67-8b4a-85e4922258f3	2026-03-19	\N	\N	2026-03-20 09:42:10.391265+00	2026-03-20 09:42:10.391265+00
e7000001-0000-0000-0000-000000000010	INV-KL01-20260319-002	e5000001-0000-0000-0000-000000000010	d44ca290-a086-439d-9657-07fc5ebb689c	a85891ea-4fe4-4e7b-83ac-9cd1debd8557	Ahmad Rizal	928.0000	0.0000	74.2400	92.8000	1095.0400	1095.0400	0.0000	MYR	paid	\N	2026-03-19 17:30:00+00	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20	\N	\N	2026-03-20 09:42:10.391265+00	2026-03-20 09:42:10.391265+00
\.


--
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.order_items (id, order_id, item_type, product_id, description, quantity, unit_price, discount_pct, line_total, staff_ref_id, created_at) FROM stdin;
7db6ec27-9013-4065-ae9b-db32b8e4bb67	96515b40-1ec7-4878-9b96-92e0bc4409e3	product	\N	Tiger Beer (Can)	4.000	25.0000	0.0000	100.0000	\N	2026-03-19 09:58:52.356383+00
69edc8a7-9fe0-44f1-863d-3f7962e265f1	96515b40-1ec7-4878-9b96-92e0bc4409e3	product	\N	Fruit Platter	1.000	88.0000	0.0000	88.0000	\N	2026-03-19 09:58:52.40445+00
e6b2c0ed-a1f4-4c38-bb23-3a0ded66dc19	5b377661-6fd7-4200-9fc5-19338aafd0fc	product	f7f0c75a-2301-4031-99a3-a4d44bd969b7	Tiger Beer (Can)	3.000	25.0000	0.0000	75.0000	\N	2026-03-19 10:56:08.486671+00
a2e2c080-7f1f-4485-ad58-887907ad9137	941d7984-61db-4ab4-80a8-e5ecde05ff80	product	\N	Beer (1 bottle)	1.000	25.0000	0.0000	25.0000	\N	2026-03-20 01:00:11.762662+00
a6b176d7-7701-4313-a630-c08805482155	941d7984-61db-4ab4-80a8-e5ecde05ff80	product	\N	Soft Drink	1.000	12.0000	0.0000	12.0000	\N	2026-03-20 01:00:15.843374+00
4c3d378d-2ee9-4da9-9423-be4e7537f9d5	941d7984-61db-4ab4-80a8-e5ecde05ff80	product	\N	Beer (1 bottle)	2.500	25.0000	0.0000	62.5000	\N	2026-03-20 01:00:36.03617+00
c0000001-0000-0000-0000-000000000001	ab000001-0000-0000-0000-000000000001	room_charge	\N	VIP Suite A room charge (5hr)	1.000	900.0000	0.0000	900.0000	\N	2026-03-20 09:18:43.957058+00
c0000001-0000-0000-0000-000000000002	ab000001-0000-0000-0000-000000000001	beverage	54848cd9-0544-4815-ac6e-06c6c1697ef6	Hennessy VSOP 1 bottle	1.000	680.0000	0.0000	680.0000	\N	2026-03-20 09:18:43.957058+00
c0000001-0000-0000-0000-000000000003	ab000001-0000-0000-0000-000000000002	room_charge	\N	VIP Suite B room charge (5hr)	1.000	750.0000	0.0000	750.0000	\N	2026-03-20 09:18:43.957058+00
c0000001-0000-0000-0000-000000000004	ab000001-0000-0000-0000-000000000002	food	f7f0c75a-2301-4031-99a3-a4d44bd969b7	Seasonal Fruit Platter	1.000	120.0000	0.0000	120.0000	\N	2026-03-20 09:18:43.957058+00
c0000001-0000-0000-0000-000000000005	ab000001-0000-0000-0000-000000000003	room_charge	\N	VVIP Prestige room charge (6hr)	1.000	1680.0000	0.0000	1680.0000	\N	2026-03-20 09:18:43.957058+00
c0000001-0000-0000-0000-000000000006	ab000001-0000-0000-0000-000000000003	hostess	57e66e21-7354-4946-8a39-2f122988b466	Hostess service (6hr)	1.000	500.0000	0.0000	500.0000	\N	2026-03-20 09:18:43.957058+00
c0000001-0000-0000-0000-000000000007	ab000001-0000-0000-0000-000000000004	room_charge	\N	Standard room charge (4hr)	1.000	600.0000	0.0000	600.0000	\N	2026-03-20 09:18:43.957058+00
c0000001-0000-0000-0000-000000000008	ab000001-0000-0000-0000-000000000005	room_charge	\N	VIP Suite A charge (6hr)	1.000	1080.0000	0.0000	1080.0000	\N	2026-03-20 09:18:43.957058+00
c0000001-0000-0000-0000-000000000009	ab000001-0000-0000-0000-000000000006	room_charge	\N	VIP room charge (5hr)	1.000	750.0000	0.0000	750.0000	\N	2026-03-20 09:18:43.957058+00
c0000001-0000-0000-0000-000000000010	ab000001-0000-0000-0000-000000000007	room_charge	\N	VVIP Prestige room charge (7hr)	1.000	1960.0000	0.0000	1960.0000	\N	2026-03-20 09:18:43.957058+00
e3000001-0000-0000-0000-000000000001	ce000001-0000-0000-0000-000000000001	food	\N	Signature Chicken Wings (6pc)	2.000	38.0000	0.0000	76.0000	1a1aa56c-0e3f-4a56-98ce-b39754873aa0	2026-03-20 09:31:22.987041+00
ee000001-0000-0000-0000-000000000001	e6000001-0000-0000-0000-000000000001	room_charge	\N	VIP Suite A — 5hr room charge	1.000	900.0000	0.0000	900.0000	\N	2026-03-20 09:44:04.740932+00
ee000001-0000-0000-0000-000000000002	e6000001-0000-0000-0000-000000000001	beverage	7e38fc46-497a-48f6-adba-706faaab6137	Hennessy VSOP 1 bottle	1.000	520.0000	0.0000	520.0000	\N	2026-03-20 09:44:04.740932+00
ee000001-0000-0000-0000-000000000003	e6000001-0000-0000-0000-000000000001	beverage	f0000001-0000-0000-0000-000000000001	Tiger Beer Jug × 2	2.000	48.0000	0.0000	96.0000	\N	2026-03-20 09:44:04.740932+00
ee000001-0000-0000-0000-000000000004	e6000001-0000-0000-0000-000000000002	room_charge	\N	VIP Suite B — 5hr room charge	1.000	750.0000	0.0000	750.0000	\N	2026-03-20 09:44:04.740932+00
ee000001-0000-0000-0000-000000000005	e6000001-0000-0000-0000-000000000002	beverage	54848cd9-0544-4815-ac6e-06c6c1697ef6	Chivas Regal 12Y 1 bottle	1.000	380.0000	0.0000	380.0000	\N	2026-03-20 09:44:04.740932+00
ee000001-0000-0000-0000-000000000006	e6000001-0000-0000-0000-000000000002	beverage	f0000001-0000-0000-0000-000000000001	Tiger Beer Jug	1.000	48.0000	0.0000	48.0000	\N	2026-03-20 09:44:04.740932+00
ee000001-0000-0000-0000-000000000007	e6000001-0000-0000-0000-000000000003	room_charge	\N	VVIP Prestige — 6hr room charge	1.000	1680.0000	0.0000	1680.0000	\N	2026-03-20 09:44:04.740932+00
ee000001-0000-0000-0000-000000000008	e6000001-0000-0000-0000-000000000003	beverage	7e38fc46-497a-48f6-adba-706faaab6137	Hennessy VSOP 1 bottle	1.000	520.0000	0.0000	520.0000	\N	2026-03-20 09:44:04.740932+00
ee000001-0000-0000-0000-000000000009	e6000001-0000-0000-0000-000000000003	beverage	54848cd9-0544-4815-ac6e-06c6c1697ef6	Chivas Regal 12Y 1 bottle	1.000	380.0000	0.0000	380.0000	\N	2026-03-20 09:44:04.740932+00
ee000001-0000-0000-0000-000000000010	e6000001-0000-0000-0000-000000000003	food	8f41072b-7f24-43ff-8d1d-0fd998c1bd14	Fruit Platter	1.000	88.0000	0.0000	88.0000	\N	2026-03-20 09:44:04.740932+00
ee000001-0000-0000-0000-000000000011	e6000001-0000-0000-0000-000000000003	food	a5a9ce4d-2f26-4350-af6d-30e38685cd26	Chips & Nuts Mix	1.000	35.0000	0.0000	35.0000	\N	2026-03-20 09:44:04.740932+00
ee000001-0000-0000-0000-000000000012	e6000001-0000-0000-0000-000000000004	room_charge	\N	VIP Suite A (PJ) — 5hr room charge	1.000	850.0000	0.0000	850.0000	\N	2026-03-20 09:44:04.740932+00
ee000001-0000-0000-0000-000000000013	e6000001-0000-0000-0000-000000000004	beverage	54848cd9-0544-4815-ac6e-06c6c1697ef6	Chivas Regal 12Y 1 bottle	1.000	380.0000	0.0000	380.0000	\N	2026-03-20 09:44:04.740932+00
ee000001-0000-0000-0000-000000000014	e6000001-0000-0000-0000-000000000004	beverage	a4ef998a-2e87-4379-9f27-4dbbe0b37034	Heineken Bottle × 3	3.000	30.0000	0.0000	90.0000	\N	2026-03-20 09:44:04.740932+00
ee000001-0000-0000-0000-000000000015	e6000001-0000-0000-0000-000000000005	room_charge	\N	VVIP Prestige (PJ) — 6hr room charge	1.000	1980.0000	0.0000	1980.0000	\N	2026-03-20 09:44:04.740932+00
ee000001-0000-0000-0000-000000000016	e6000001-0000-0000-0000-000000000005	beverage	7e38fc46-497a-48f6-adba-706faaab6137	Hennessy VSOP 1 bottle	1.000	520.0000	0.0000	520.0000	\N	2026-03-20 09:44:04.740932+00
ee000001-0000-0000-0000-000000000017	e6000001-0000-0000-0000-000000000005	beverage	54848cd9-0544-4815-ac6e-06c6c1697ef6	Chivas Regal 12Y 1 bottle	1.000	380.0000	0.0000	380.0000	\N	2026-03-20 09:44:04.740932+00
ee000001-0000-0000-0000-000000000018	e6000001-0000-0000-0000-000000000005	food	8f41072b-7f24-43ff-8d1d-0fd998c1bd14	Fruit Platter	1.000	88.0000	0.0000	88.0000	\N	2026-03-20 09:44:04.740932+00
ee000001-0000-0000-0000-000000000019	e6000001-0000-0000-0000-000000000005	beverage	49540e33-2c07-4574-a32e-e6dfefc14d59	Ice Bucket × 2	2.000	15.0000	0.0000	30.0000	\N	2026-03-20 09:44:04.740932+00
ee000001-0000-0000-0000-000000000020	e6000001-0000-0000-0000-000000000006	room_charge	\N	Standard Room 2 — 4hr room charge	1.000	600.0000	0.0000	600.0000	\N	2026-03-20 09:44:04.740932+00
ee000001-0000-0000-0000-000000000021	e6000001-0000-0000-0000-000000000006	beverage	54848cd9-0544-4815-ac6e-06c6c1697ef6	Chivas Regal 12Y 1 bottle	1.000	380.0000	0.0000	380.0000	\N	2026-03-20 09:44:04.740932+00
ee000001-0000-0000-0000-000000000022	e6000001-0000-0000-0000-000000000006	other	\N	Pickup fee (Bukit Bintang Hotel)	1.000	48.0000	0.0000	48.0000	\N	2026-03-20 09:44:04.740932+00
ee000001-0000-0000-0000-000000000023	e6000001-0000-0000-0000-000000000007	room_charge	\N	VVIP Prestige — 6hr room charge	1.000	1680.0000	0.0000	1680.0000	\N	2026-03-20 09:44:04.740932+00
ee000001-0000-0000-0000-000000000024	e6000001-0000-0000-0000-000000000007	beverage	7e38fc46-497a-48f6-adba-706faaab6137	Hennessy VSOP 1 bottle	1.000	520.0000	0.0000	520.0000	\N	2026-03-20 09:44:04.740932+00
ee000001-0000-0000-0000-000000000025	e6000001-0000-0000-0000-000000000007	beverage	54848cd9-0544-4815-ac6e-06c6c1697ef6	Chivas Regal 12Y 1 bottle	1.000	380.0000	0.0000	380.0000	\N	2026-03-20 09:44:04.740932+00
ee000001-0000-0000-0000-000000000026	e6000001-0000-0000-0000-000000000007	food	8f41072b-7f24-43ff-8d1d-0fd998c1bd14	Fruit Platter × 2	2.000	88.0000	0.0000	176.0000	\N	2026-03-20 09:44:04.740932+00
ee000001-0000-0000-0000-000000000027	e6000001-0000-0000-0000-000000000008	room_charge	\N	Standard Room 2 (PJ) — 4hr room charge	1.000	480.0000	0.0000	480.0000	\N	2026-03-20 09:44:04.740932+00
ee000001-0000-0000-0000-000000000028	e6000001-0000-0000-0000-000000000008	beverage	54848cd9-0544-4815-ac6e-06c6c1697ef6	Chivas Regal 12Y 1 bottle	1.000	380.0000	0.0000	380.0000	\N	2026-03-20 09:44:04.740932+00
ee000001-0000-0000-0000-000000000029	e6000001-0000-0000-0000-000000000008	beverage	a4ef998a-2e87-4379-9f27-4dbbe0b37034	Heineken Bottle × 2	2.000	30.0000	0.0000	60.0000	\N	2026-03-20 09:44:04.740932+00
ee000001-0000-0000-0000-000000000030	e6000001-0000-0000-0000-000000000009	room_charge	\N	VIP Suite B (PJ) — 5hr room charge	1.000	750.0000	0.0000	750.0000	\N	2026-03-20 09:44:04.740932+00
ee000001-0000-0000-0000-000000000031	e6000001-0000-0000-0000-000000000009	beverage	7e38fc46-497a-48f6-adba-706faaab6137	Hennessy VSOP 1 bottle	1.000	520.0000	0.0000	520.0000	\N	2026-03-20 09:44:04.740932+00
ee000001-0000-0000-0000-000000000032	e6000001-0000-0000-0000-000000000009	beverage	a4ef998a-2e87-4379-9f27-4dbbe0b37034	Heineken Bottle × 3	3.000	30.0000	0.0000	90.0000	\N	2026-03-20 09:44:04.740932+00
ee000001-0000-0000-0000-000000000033	e6000001-0000-0000-0000-000000000010	room_charge	\N	Standard Room 3 — 5hr room charge	1.000	500.0000	0.0000	500.0000	\N	2026-03-20 09:44:04.740932+00
ee000001-0000-0000-0000-000000000034	e6000001-0000-0000-0000-000000000010	beverage	54848cd9-0544-4815-ac6e-06c6c1697ef6	Chivas Regal 12Y 1 bottle	1.000	380.0000	0.0000	380.0000	\N	2026-03-20 09:44:04.740932+00
ee000001-0000-0000-0000-000000000035	e6000001-0000-0000-0000-000000000010	beverage	f0000001-0000-0000-0000-000000000001	Tiger Beer Jug	1.000	48.0000	0.0000	48.0000	\N	2026-03-20 09:44:04.740932+00
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.orders (id, order_no, reservation_id, branch_id, customer_id, order_type, subtotal, discount_amount, sst_amount, service_charge, total_amount, currency, payment_status, payment_method, payment_ref, payment_notes, invoice_pdf_url, notes, created_by, finalized_at, created_at, updated_at) FROM stdin;
96515b40-1ec7-4878-9b96-92e0bc4409e3	ORD-KL01-20260319-001	361c61ea-0a07-4821-9fcd-81a630407d49	d44ca290-a086-439d-9657-07fc5ebb689c	\N	reservation	188.0000	0.0000	11.2800	18.8000	218.0800	MYR	paid	cash	\N	\N	\N	\N	baa4adfd-09ee-457e-bcd5-3fa7e1569616	2026-03-19 09:58:52.453515+00	2026-03-19 09:58:52.311794+00	2026-03-19 09:58:52.503559+00
5b377661-6fd7-4200-9fc5-19338aafd0fc	ORD-KL01-20260319-002	420b76ff-8f2c-4208-91fd-63e65606933c	d44ca290-a086-439d-9657-07fc5ebb689c	\N	reservation	75.0000	0.0000	4.5000	7.5000	87.0000	MYR	paid	cash	\N	\N	\N	\N	baa4adfd-09ee-457e-bcd5-3fa7e1569616	2026-03-19 10:56:08.579404+00	2026-03-19 10:56:08.401015+00	2026-03-19 10:56:08.669858+00
941d7984-61db-4ab4-80a8-e5ecde05ff80	ORD-KL01-20260320-001	43208b14-1549-40cc-812d-55241c3ef1d4	d44ca290-a086-439d-9657-07fc5ebb689c	\N	reservation	99.5000	0.0000	5.9700	9.9500	115.4200	MYR	paid	cash	\N	\N	\N	\N	baa4adfd-09ee-457e-bcd5-3fa7e1569616	2026-03-20 01:00:52.602461+00	2026-03-20 01:00:04.089809+00	2026-03-20 01:03:31.387196+00
ab000001-0000-0000-0000-000000000001	ORD-KL01-20260318-001	f9000001-0000-0000-0000-000000000001	d44ca290-a086-439d-9657-07fc5ebb689c	fe8efacd-0148-4b05-b09d-f799a6094266	reservation	1850.0000	0.0000	111.0000	185.0000	2146.0000	MYR	paid	\N	\N	\N	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	\N	2026-03-20 09:17:39.80409+00	2026-03-20 09:17:39.80409+00
ab000001-0000-0000-0000-000000000002	ORD-KL01-20260317-001	f9000001-0000-0000-0000-000000000002	d44ca290-a086-439d-9657-07fc5ebb689c	a85891ea-4fe4-4e7b-83ac-9cd1debd8557	reservation	1200.0000	0.0000	72.0000	120.0000	1392.0000	MYR	paid	\N	\N	\N	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	\N	2026-03-20 09:17:39.80409+00	2026-03-20 09:17:39.80409+00
ab000001-0000-0000-0000-000000000003	ORD-PJ01-20260319-001	f9000001-0000-0000-0000-000000000003	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	c9000001-0000-0000-0000-000000000001	reservation	2800.0000	200.0000	156.0000	252.0000	3008.0000	MYR	pending	\N	\N	\N	\N	\N	cb9837c5-33f1-4c67-8b4a-85e4922258f3	\N	2026-03-20 09:17:39.80409+00	2026-03-20 09:17:39.80409+00
ab000001-0000-0000-0000-000000000004	ORD-PJ01-20260321-001	f9000001-0000-0000-0000-000000000004	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	c9000001-0000-0000-0000-000000000002	reservation	950.0000	0.0000	57.0000	95.0000	1102.0000	MYR	pending	\N	\N	\N	\N	\N	cb9837c5-33f1-4c67-8b4a-85e4922258f3	\N	2026-03-20 09:17:39.80409+00	2026-03-20 09:17:39.80409+00
ab000001-0000-0000-0000-000000000005	ORD-KL01-20260316-001	cbd2ab73-430e-4145-a151-dfd2fef9e1b7	d44ca290-a086-439d-9657-07fc5ebb689c	bac61958-a403-4cab-b57c-ad0a1b2d6f49	reservation	3200.0000	320.0000	177.6000	288.0000	3345.6000	MYR	paid	\N	\N	\N	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	\N	2026-03-20 09:17:39.80409+00	2026-03-20 09:17:39.80409+00
ab000001-0000-0000-0000-000000000006	ORD-KL01-20260315-001	c3feac5b-d681-4fc8-bd1d-4ed34adb6a38	d44ca290-a086-439d-9657-07fc5ebb689c	29da004e-e84c-4520-beb1-9257085db4d9	reservation	1680.0000	0.0000	100.8000	168.0000	1948.8000	MYR	paid	\N	\N	\N	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	\N	2026-03-20 09:17:39.80409+00	2026-03-20 09:17:39.80409+00
ab000001-0000-0000-0000-000000000007	ORD-KL01-20260313-001	f4782275-3461-4a26-8226-7ce19bba83d9	d44ca290-a086-439d-9657-07fc5ebb689c	f298ab23-a849-4efe-ab49-9c8b8bee49c8	reservation	4500.0000	450.0000	243.0000	405.0000	4698.0000	MYR	paid	\N	\N	\N	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	\N	2026-03-20 09:17:39.80409+00	2026-03-20 09:17:39.80409+00
ce000001-0000-0000-0000-000000000002	ORD-KL01-20260320-002	\N	d44ca290-a086-439d-9657-07fc5ebb689c	\N	walk_in	320.0000	0.0000	19.2000	32.0000	371.2000	MYR	pending	\N	\N	\N	\N	Table T-03 walk-in — 2 pax, beverage only	0e851835-0578-499c-9a13-3a68cd3b6177	\N	2026-03-20 09:30:20.5754+00	2026-03-20 09:30:20.5754+00
ce000001-0000-0000-0000-000000000001	ORD-KL01-20260320-003	\N	d44ca290-a086-439d-9657-07fc5ebb689c	29da004e-e84c-4520-beb1-9257085db4d9	walk_in	980.0000	0.0000	58.8000	98.0000	1136.8000	MYR	pending	\N	\N	\N	\N	Walk-in table order — T-01, 3 pax	2b905497-fb89-4294-9774-4a23a118e9dd	\N	2026-03-20 09:31:22.942386+00	2026-03-20 09:31:22.942386+00
e6000001-0000-0000-0000-000000000001	ORD-KL01-20260310-001	e5000001-0000-0000-0000-000000000001	d44ca290-a086-439d-9657-07fc5ebb689c	c9000001-0000-0000-0000-000000000001	reservation	1516.0000	0.0000	121.2800	151.6000	1788.8800	MYR	paid	\N	\N	\N	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-10 18:20:00+00	2026-03-20 09:44:04.665626+00	2026-03-20 09:44:04.665626+00
e6000001-0000-0000-0000-000000000002	ORD-KL01-20260311-001	e5000001-0000-0000-0000-000000000002	d44ca290-a086-439d-9657-07fc5ebb689c	c9000001-0000-0000-0000-000000000003	reservation	1178.0000	0.0000	94.2400	117.8000	1390.0400	MYR	paid	\N	\N	\N	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-11 18:15:00+00	2026-03-20 09:44:04.697926+00	2026-03-20 09:44:04.697926+00
e6000001-0000-0000-0000-000000000003	ORD-KL01-20260312-001	e5000001-0000-0000-0000-000000000003	d44ca290-a086-439d-9657-07fc5ebb689c	c9000001-0000-0000-0000-000000000005	reservation	2703.0000	0.0000	216.2400	270.3000	3189.5400	MYR	paid	\N	\N	\N	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-12 18:25:00+00	2026-03-20 09:44:04.709027+00	2026-03-20 09:44:04.709027+00
e6000001-0000-0000-0000-000000000004	ORD-PJ01-20260313-001	e5000001-0000-0000-0000-000000000004	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	c9000001-0000-0000-0000-000000000004	reservation	1320.0000	0.0000	105.6000	132.0000	1557.6000	MYR	paid	\N	\N	\N	\N	\N	cb9837c5-33f1-4c67-8b4a-85e4922258f3	2026-03-13 18:30:00+00	2026-03-20 09:44:04.712875+00	2026-03-20 09:44:04.712875+00
e6000001-0000-0000-0000-000000000005	ORD-PJ01-20260314-001	e5000001-0000-0000-0000-000000000005	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	c9000001-0000-0000-0000-000000000002	reservation	2998.0000	0.0000	239.8400	299.8000	3537.6400	MYR	paid	\N	\N	\N	\N	\N	cb9837c5-33f1-4c67-8b4a-85e4922258f3	2026-03-14 19:20:00+00	2026-03-20 09:44:04.716047+00	2026-03-20 09:44:04.716047+00
e6000001-0000-0000-0000-000000000006	ORD-KL01-20260315-002	e5000001-0000-0000-0000-000000000006	d44ca290-a086-439d-9657-07fc5ebb689c	fe8efacd-0148-4b05-b09d-f799a6094266	reservation	1028.0000	0.0000	82.2400	102.8000	1213.0400	MYR	paid	\N	\N	\N	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-15 17:20:00+00	2026-03-20 09:44:04.721998+00	2026-03-20 09:44:04.721998+00
e6000001-0000-0000-0000-000000000007	ORD-KL01-20260316-002	e5000001-0000-0000-0000-000000000007	d44ca290-a086-439d-9657-07fc5ebb689c	f298ab23-a849-4efe-ab49-9c8b8bee49c8	reservation	2756.0000	0.0000	220.4800	275.6000	3252.0800	MYR	paid	\N	\N	\N	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-16 18:25:00+00	2026-03-20 09:44:04.725583+00	2026-03-20 09:44:04.725583+00
e6000001-0000-0000-0000-000000000008	ORD-PJ01-20260317-001	e5000001-0000-0000-0000-000000000008	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	bac61958-a403-4cab-b57c-ad0a1b2d6f49	reservation	920.0000	0.0000	73.6000	92.0000	1085.6000	MYR	paid	\N	\N	\N	\N	\N	cb9837c5-33f1-4c67-8b4a-85e4922258f3	2026-03-17 17:20:00+00	2026-03-20 09:44:04.729004+00	2026-03-20 09:44:04.729004+00
e6000001-0000-0000-0000-000000000009	ORD-PJ01-20260318-001	e5000001-0000-0000-0000-000000000009	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	29da004e-e84c-4520-beb1-9257085db4d9	reservation	1360.0000	0.0000	108.8000	136.0000	1604.8000	MYR	paid	\N	\N	\N	\N	\N	cb9837c5-33f1-4c67-8b4a-85e4922258f3	2026-03-18 18:10:00+00	2026-03-20 09:44:04.732472+00	2026-03-20 09:44:04.732472+00
e6000001-0000-0000-0000-000000000010	ORD-KL01-20260319-003	e5000001-0000-0000-0000-000000000010	d44ca290-a086-439d-9657-07fc5ebb689c	a85891ea-4fe4-4e7b-83ac-9cd1debd8557	reservation	928.0000	0.0000	74.2400	92.8000	1095.0400	MYR	paid	\N	\N	\N	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-19 17:40:00+00	2026-03-20 09:44:04.736322+00	2026-03-20 09:44:04.736322+00
\.


--
-- Data for Name: organizations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.organizations (id, name, slug, base_currency, default_tz, default_lang, created_at, deleted_at) FROM stdin;
00000000-0000-0000-0000-000000000001	KL Entertainment Group	kl-entertainment	MYR	Asia/Kuala_Lumpur	en	2026-03-19 09:12:16.669578+00	\N
\.


--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.payments (id, invoice_id, branch_id, reservation_id, amount, currency, method, ref_no, paid_at, received_by, notes, is_void, voided_at, voided_by, void_reason, created_at) FROM stdin;
ad000001-0000-0000-0000-000000000001	81b7ad47-1c5f-4759-9b2f-cb5af622a081	d44ca290-a086-439d-9657-07fc5ebb689c	f4782275-3461-4a26-8226-7ce19bba83d9	4698.0000	MYR	cash	\N	2026-03-20 09:18:44.062423+00	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	\N	f	\N	\N	\N	2026-03-20 09:18:44.062423+00
ad000001-0000-0000-0000-000000000002	ac000001-0000-0000-0000-000000000001	d44ca290-a086-439d-9657-07fc5ebb689c	f9000001-0000-0000-0000-000000000001	2146.0000	MYR	card	TXNKL2603180001	2026-03-20 09:18:44.062423+00	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	\N	f	\N	\N	\N	2026-03-20 09:18:44.062423+00
ad000001-0000-0000-0000-000000000003	ac000001-0000-0000-0000-000000000002	d44ca290-a086-439d-9657-07fc5ebb689c	f9000001-0000-0000-0000-000000000002	1392.0000	MYR	cash	\N	2026-03-20 09:18:44.062423+00	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	\N	f	\N	\N	\N	2026-03-20 09:18:44.062423+00
ad000001-0000-0000-0000-000000000004	ac000001-0000-0000-0000-000000000005	d44ca290-a086-439d-9657-07fc5ebb689c	cbd2ab73-430e-4145-a151-dfd2fef9e1b7	3345.6000	MYR	qr	TNG20260316KL001	2026-03-20 09:18:44.062423+00	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	\N	f	\N	\N	\N	2026-03-20 09:18:44.062423+00
ad000001-0000-0000-0000-000000000005	ac000001-0000-0000-0000-000000000006	d44ca290-a086-439d-9657-07fc5ebb689c	c3feac5b-d681-4fc8-bd1d-4ed34adb6a38	1948.8000	MYR	bank_transfer	IBG20260315001	2026-03-20 09:18:44.062423+00	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	\N	f	\N	\N	\N	2026-03-20 09:18:44.062423+00
ad000001-0000-0000-0000-000000000006	ac000001-0000-0000-0000-000000000007	d44ca290-a086-439d-9657-07fc5ebb689c	f4782275-3461-4a26-8226-7ce19bba83d9	4698.0000	MYR	card	TXNKL2603130001	2026-03-20 09:18:44.062423+00	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	\N	f	\N	\N	\N	2026-03-20 09:18:44.062423+00
ad000001-0000-0000-0000-000000000007	ac000001-0000-0000-0000-000000000008	d44ca290-a086-439d-9657-07fc5ebb689c	361c61ea-0a07-4821-9fcd-81a630407d49	2436.0000	MYR	cash	\N	2026-03-20 09:18:44.062423+00	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	\N	f	\N	\N	\N	2026-03-20 09:18:44.062423+00
ad000001-0000-0000-0000-000000000008	ac000001-0000-0000-0000-000000000009	d44ca290-a086-439d-9657-07fc5ebb689c	420b76ff-8f2c-4208-91fd-63e65606933c	1798.0000	MYR	qr	TNG20260319KL002	2026-03-20 09:18:44.062423+00	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	\N	f	\N	\N	\N	2026-03-20 09:18:44.062423+00
ad000001-0000-0000-0000-000000000009	ac000001-0000-0000-0000-000000000001	d44ca290-a086-439d-9657-07fc5ebb689c	f9000001-0000-0000-0000-000000000001	500.0000	MYR	cash	DEPOSIT	2026-03-20 09:18:44.062423+00	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	\N	f	\N	\N	\N	2026-03-20 09:18:44.062423+00
ad000001-0000-0000-0000-000000000010	ac000001-0000-0000-0000-000000000002	d44ca290-a086-439d-9657-07fc5ebb689c	f9000001-0000-0000-0000-000000000002	300.0000	MYR	cash	DEPOSIT	2026-03-20 09:18:44.062423+00	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	\N	f	\N	\N	\N	2026-03-20 09:18:44.062423+00
e8000001-0000-0000-0000-000000000001	e7000001-0000-0000-0000-000000000001	d44ca290-a086-439d-9657-07fc5ebb689c	e5000001-0000-0000-0000-000000000001	1788.8800	MYR	cash	\N	2026-03-10 18:15:00+00	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	\N	f	\N	\N	\N	2026-03-20 09:45:42.283972+00
e8000001-0000-0000-0000-000000000002	e7000001-0000-0000-0000-000000000002	d44ca290-a086-439d-9657-07fc5ebb689c	e5000001-0000-0000-0000-000000000002	1390.0400	MYR	card	TXNKL2603110001	2026-03-11 18:10:00+00	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	\N	f	\N	\N	\N	2026-03-20 09:45:42.283972+00
e8000001-0000-0000-0000-000000000003	e7000001-0000-0000-0000-000000000003	d44ca290-a086-439d-9657-07fc5ebb689c	e5000001-0000-0000-0000-000000000003	3189.5400	MYR	bank_transfer	IBG20260312001	2026-03-12 18:20:00+00	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	\N	f	\N	\N	\N	2026-03-20 09:45:42.283972+00
e8000001-0000-0000-0000-000000000004	e7000001-0000-0000-0000-000000000004	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	e5000001-0000-0000-0000-000000000004	1557.6000	MYR	qr	TNG20260313001	2026-03-13 18:25:00+00	cb9837c5-33f1-4c67-8b4a-85e4922258f3	\N	f	\N	\N	\N	2026-03-20 09:45:42.283972+00
e8000001-0000-0000-0000-000000000005	e7000001-0000-0000-0000-000000000005	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	e5000001-0000-0000-0000-000000000005	3537.6400	MYR	card	TXNPJ2603140001	2026-03-14 19:05:00+00	cb9837c5-33f1-4c67-8b4a-85e4922258f3	\N	f	\N	\N	\N	2026-03-20 09:45:42.283972+00
e8000001-0000-0000-0000-000000000006	e7000001-0000-0000-0000-000000000006	d44ca290-a086-439d-9657-07fc5ebb689c	e5000001-0000-0000-0000-000000000006	1213.0400	MYR	cash	\N	2026-03-15 17:15:00+00	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	\N	f	\N	\N	\N	2026-03-20 09:45:42.283972+00
e8000001-0000-0000-0000-000000000007	e7000001-0000-0000-0000-000000000007	d44ca290-a086-439d-9657-07fc5ebb689c	e5000001-0000-0000-0000-000000000007	3252.0800	MYR	card	TXNKL2603160001	2026-03-16 18:15:00+00	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	\N	f	\N	\N	\N	2026-03-20 09:45:42.283972+00
e8000001-0000-0000-0000-000000000008	e7000001-0000-0000-0000-000000000008	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	e5000001-0000-0000-0000-000000000008	1085.6000	MYR	qr	TNG20260317001	2026-03-17 17:10:00+00	cb9837c5-33f1-4c67-8b4a-85e4922258f3	\N	f	\N	\N	\N	2026-03-20 09:45:42.283972+00
e8000001-0000-0000-0000-000000000009	e7000001-0000-0000-0000-000000000009	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	e5000001-0000-0000-0000-000000000009	1604.8000	MYR	bank_transfer	IBG20260318001	2026-03-18 18:05:00+00	cb9837c5-33f1-4c67-8b4a-85e4922258f3	\N	f	\N	\N	\N	2026-03-20 09:45:42.283972+00
e8000001-0000-0000-0000-000000000010	e7000001-0000-0000-0000-000000000010	d44ca290-a086-439d-9657-07fc5ebb689c	e5000001-0000-0000-0000-000000000010	1095.0400	MYR	cash	\N	2026-03-19 17:35:00+00	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	\N	f	\N	\N	\N	2026-03-20 09:45:42.283972+00
\.


--
-- Data for Name: product_groups; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.product_groups (id, org_id, name, sort_order, is_active, created_at) FROM stdin;
b7a71225-375e-4fca-8748-4b02a6237f24	00000000-0000-0000-0000-000000000001	{"en": "Beverages", "ja": "飲み物", "ko": "음료", "ms": "Minuman", "th": "เครื่องดื่ม", "zh": "饮料"}	1	t	2026-03-19 09:12:16.669578+00
4dd5e5e1-8aec-4f68-a6a9-3307b27483b4	00000000-0000-0000-0000-000000000001	{"en": "Food", "ja": "食べ物", "ko": "음식", "ms": "Makanan", "th": "อาหาร", "zh": "食物"}	2	t	2026-03-19 09:12:16.669578+00
0d4bf5a7-71f4-4319-a50b-8a78e359a8dc	00000000-0000-0000-0000-000000000001	{"en": "Packages", "ja": "パッケージ", "ko": "패키지", "ms": "Pakej", "th": "แพ็กเกจ", "zh": "套餐"}	3	t	2026-03-19 09:12:16.669578+00
\.


--
-- Data for Name: product_types; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.product_types (id, group_id, name, sort_order, is_active, created_at) FROM stdin;
63df21b1-a446-4da9-aad7-32034767905f	b7a71225-375e-4fca-8748-4b02a6237f24	{"en": "Alcohol & Beverages", "ja": null, "ko": null, "ms": "Alkohol & Minuman", "th": null, "zh": "酒水饮料"}	1	t	2026-03-19 09:57:56.199621+00
b3000001-0000-0000-0000-000000000001	b7a71225-375e-4fca-8748-4b02a6237f24	{"en": "Beer", "ms": "Bir", "zh": "啤酒"}	1	t	2026-03-20 09:14:02.352148+00
b3000001-0000-0000-0000-000000000002	b7a71225-375e-4fca-8748-4b02a6237f24	{"en": "Spirits", "ms": "Minuman Keras", "zh": "烈酒"}	2	t	2026-03-20 09:14:02.352148+00
b3000001-0000-0000-0000-000000000003	b7a71225-375e-4fca-8748-4b02a6237f24	{"en": "Champagne", "ms": "Champagne", "zh": "香槟"}	3	t	2026-03-20 09:14:02.352148+00
b3000001-0000-0000-0000-000000000004	4dd5e5e1-8aec-4f68-a6a9-3307b27483b4	{"en": "Fruit Platter", "ms": "Pinggan Buah", "zh": "水果拼盘"}	4	t	2026-03-20 09:14:02.352148+00
b3000001-0000-0000-0000-000000000005	4dd5e5e1-8aec-4f68-a6a9-3307b27483b4	{"en": "Snacks", "ms": "Snek", "zh": "小吃"}	5	t	2026-03-20 09:14:02.352148+00
b3000001-0000-0000-0000-000000000006	4dd5e5e1-8aec-4f68-a6a9-3307b27483b4	{"en": "Hot Food", "ms": "Makanan Panas", "zh": "热食"}	6	t	2026-03-20 09:14:02.352148+00
b3000001-0000-0000-0000-000000000007	0d4bf5a7-71f4-4319-a50b-8a78e359a8dc	{"en": "Room Package", "ms": "Pakej Bilik", "zh": "包厢套餐"}	7	t	2026-03-20 09:14:02.352148+00
b3000001-0000-0000-0000-000000000008	0d4bf5a7-71f4-4319-a50b-8a78e359a8dc	{"en": "Hostess Service", "ms": "Perkhidmatan Hostess", "zh": "公主服务"}	8	t	2026-03-20 09:14:02.352148+00
b3000001-0000-0000-0000-000000000009	0d4bf5a7-71f4-4319-a50b-8a78e359a8dc	{"en": "Special Add-on", "ms": "Tambahan Khas", "zh": "特别加项"}	9	t	2026-03-20 09:14:02.352148+00
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.products (id, type_id, branch_id, sku, name, description, unit_price, unit, tax_applicable, images, sort_order, is_active, created_at, deleted_at) FROM stdin;
54848cd9-0544-4815-ac6e-06c6c1697ef6	63df21b1-a446-4da9-aad7-32034767905f	\N	BEV-SPIRIT-001	{"en": "Chivas Regal 12Y", "ja": null, "ko": null, "ms": "Chivas Regal 12Y", "th": null, "zh": "芝华士12年"}	\N	380.0000	bottle	t	\N	3	t	2026-03-19 09:57:56.199621+00	\N
f7f0c75a-2301-4031-99a3-a4d44bd969b7	63df21b1-a446-4da9-aad7-32034767905f	\N	BEV-BEER-001	{"en": "Tiger Beer (Can)", "ja": null, "ko": null, "ms": "Tiger Beer", "th": null, "zh": "老虎啤酒"}	\N	25.0000	can	t	\N	1	t	2026-03-19 09:57:56.199621+00	\N
57e66e21-7354-4946-8a39-2f122988b466	63df21b1-a446-4da9-aad7-32034767905f	\N	BEV-SOFT-001	{"en": "Red Bull", "ja": null, "ko": null, "ms": "Red Bull", "th": null, "zh": "红牛"}	\N	18.0000	can	t	\N	5	t	2026-03-19 09:57:56.199621+00	\N
f8e149c9-a64c-4bf1-b239-51266f8090e7	63df21b1-a446-4da9-aad7-32034767905f	\N	BEV-SOFT-002	{"en": "Mineral Water", "ja": null, "ko": null, "ms": "Air Mineral", "th": null, "zh": "矿泉水"}	\N	8.0000	bottle	f	\N	6	t	2026-03-19 09:57:56.199621+00	\N
a4ef998a-2e87-4379-9f27-4dbbe0b37034	63df21b1-a446-4da9-aad7-32034767905f	\N	BEV-BEER-002	{"en": "Heineken (Bottle)", "ja": null, "ko": null, "ms": "Heineken Botol", "th": null, "zh": "喜力啤酒"}	\N	30.0000	bottle	t	\N	2	t	2026-03-19 09:57:56.199621+00	\N
8f41072b-7f24-43ff-8d1d-0fd998c1bd14	63df21b1-a446-4da9-aad7-32034767905f	\N	FOOD-001	{"en": "Fruit Platter", "ja": null, "ko": null, "ms": "Platter Buah", "th": null, "zh": "水果拼盘"}	\N	88.0000	plate	t	\N	7	t	2026-03-19 09:57:56.199621+00	\N
7e38fc46-497a-48f6-adba-706faaab6137	63df21b1-a446-4da9-aad7-32034767905f	\N	BEV-SPIRIT-002	{"en": "Hennessy VSOP", "ja": null, "ko": null, "ms": "Hennessy VSOP", "th": null, "zh": "轩尼诗VSOP"}	\N	520.0000	bottle	t	\N	4	t	2026-03-19 09:57:56.199621+00	\N
a5a9ce4d-2f26-4350-af6d-30e38685cd26	63df21b1-a446-4da9-aad7-32034767905f	\N	FOOD-002	{"en": "Chips & Nuts Mix", "ja": null, "ko": null, "ms": "Kerepek & Kacang", "th": null, "zh": "薯片坚果拼盘"}	\N	35.0000	plate	t	\N	8	t	2026-03-19 09:57:56.199621+00	\N
49540e33-2c07-4574-a32e-e6dfefc14d59	63df21b1-a446-4da9-aad7-32034767905f	\N	FOOD-003	{"en": "Ice Bucket", "ja": null, "ko": null, "ms": "Baldi Ais", "th": null, "zh": "冰桶"}	\N	15.0000	bucket	f	\N	9	t	2026-03-19 09:57:56.199621+00	\N
f0000001-0000-0000-0000-000000000001	b3000001-0000-0000-0000-000000000001	d44ca290-a086-439d-9657-07fc5ebb689c	BEV-BEER-01	{"en": "Tiger Beer (Jug)", "ms": "Tiger Beer (Jug)", "zh": "老虎啤酒(壶)"}	\N	48.0000	pcs	t	\N	0	t	2026-03-20 09:15:27.12134+00	\N
\.


--
-- Data for Name: profit_settlements; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.profit_settlements (id, branch_id, shareholder_id, period_start, period_end, gross_revenue, total_expenses, net_profit, equity_pct_snapshot, settlement_amount_myr, payout_currency, fx_rate, settlement_amount_fx, status, pdf_url, notes, approved_by, approved_at, paid_at, created_by, created_at) FROM stdin;
bae21257-4019-42e9-ac35-32e97a5eab73	d44ca290-a086-439d-9657-07fc5ebb689c	241e5e68-7371-4bca-be51-44d61e9fbf96	2025-01-01	2026-03-19	523.1600	0.0000	523.1600	0.3000	156.9500	MYR	1.000000	156.9500	draft	\N	\N	\N	\N	\N	baa4adfd-09ee-457e-bcd5-3fa7e1569616	2026-03-19 11:22:34.475899+00
b9000001-0000-0000-0000-000000000001	d44ca290-a086-439d-9657-07fc5ebb689c	d9000001-0000-0000-0000-000000000001	2026-02-01	2026-02-28	185000.0000	62000.0000	123000.0000	0.2000	24600.0000	MYR	1.000000	24600.0000	paid	\N	\N	baa4adfd-09ee-457e-bcd5-3fa7e1569616	2026-03-07 02:00:00+00	\N	baa4adfd-09ee-457e-bcd5-3fa7e1569616	2026-03-20 09:22:08.060006+00
b9000001-0000-0000-0000-000000000002	d44ca290-a086-439d-9657-07fc5ebb689c	d9000001-0000-0000-0000-000000000002	2026-02-01	2026-02-28	185000.0000	62000.0000	123000.0000	0.1500	18450.0000	MYR	1.000000	18450.0000	paid	\N	\N	baa4adfd-09ee-457e-bcd5-3fa7e1569616	2026-03-07 02:00:00+00	\N	baa4adfd-09ee-457e-bcd5-3fa7e1569616	2026-03-20 09:22:08.060006+00
b9000001-0000-0000-0000-000000000003	d44ca290-a086-439d-9657-07fc5ebb689c	d9000001-0000-0000-0000-000000000003	2026-02-01	2026-02-28	185000.0000	62000.0000	123000.0000	0.1000	12300.0000	MYR	1.000000	12300.0000	paid	\N	\N	baa4adfd-09ee-457e-bcd5-3fa7e1569616	2026-03-07 02:00:00+00	\N	baa4adfd-09ee-457e-bcd5-3fa7e1569616	2026-03-20 09:22:08.060006+00
b9000001-0000-0000-0000-000000000004	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	d9000001-0000-0000-0000-000000000004	2026-02-01	2026-02-28	142000.0000	48000.0000	94000.0000	0.3000	28200.0000	MYR	1.000000	28200.0000	paid	\N	\N	baa4adfd-09ee-457e-bcd5-3fa7e1569616	2026-03-07 03:00:00+00	\N	baa4adfd-09ee-457e-bcd5-3fa7e1569616	2026-03-20 09:22:08.060006+00
b9000001-0000-0000-0000-000000000005	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	d9000001-0000-0000-0000-000000000005	2026-02-01	2026-02-28	142000.0000	48000.0000	94000.0000	0.2000	18800.0000	MYR	1.000000	18800.0000	paid	\N	\N	baa4adfd-09ee-457e-bcd5-3fa7e1569616	2026-03-07 03:00:00+00	\N	baa4adfd-09ee-457e-bcd5-3fa7e1569616	2026-03-20 09:22:08.060006+00
b9000001-0000-0000-0000-000000000006	d44ca290-a086-439d-9657-07fc5ebb689c	d9000001-0000-0000-0000-000000000001	2026-01-01	2026-01-31	176000.0000	59000.0000	117000.0000	0.2000	23400.0000	MYR	1.000000	23400.0000	paid	\N	\N	baa4adfd-09ee-457e-bcd5-3fa7e1569616	2026-02-07 02:00:00+00	\N	baa4adfd-09ee-457e-bcd5-3fa7e1569616	2026-03-20 09:22:08.060006+00
b9000001-0000-0000-0000-000000000007	d44ca290-a086-439d-9657-07fc5ebb689c	d9000001-0000-0000-0000-000000000002	2026-01-01	2026-01-31	176000.0000	59000.0000	117000.0000	0.1500	17550.0000	MYR	1.000000	17550.0000	paid	\N	\N	baa4adfd-09ee-457e-bcd5-3fa7e1569616	2026-02-07 02:00:00+00	\N	baa4adfd-09ee-457e-bcd5-3fa7e1569616	2026-03-20 09:22:08.060006+00
b9000001-0000-0000-0000-000000000008	d44ca290-a086-439d-9657-07fc5ebb689c	d9000001-0000-0000-0000-000000000001	2026-03-01	2026-03-31	0.0000	0.0000	0.0000	0.2000	0.0000	MYR	1.000000	0.0000	draft	\N	\N	\N	\N	\N	baa4adfd-09ee-457e-bcd5-3fa7e1569616	2026-03-20 09:22:08.060006+00
b9000001-0000-0000-0000-000000000009	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	d9000001-0000-0000-0000-000000000004	2026-03-01	2026-03-31	0.0000	0.0000	0.0000	0.3000	0.0000	MYR	1.000000	0.0000	draft	\N	\N	\N	\N	\N	baa4adfd-09ee-457e-bcd5-3fa7e1569616	2026-03-20 09:22:08.060006+00
\.


--
-- Data for Name: receipts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.receipts (id, receipt_no, order_id, branch_id, customer_id, customer_name, amount_paid, currency, payment_method, payment_ref, payment_at, receipt_mode, pdf_url, printed_at, print_count, voided_at, void_reason, issued_by, created_at, invoice_id, payment_id) FROM stdin;
22fb30a0-6e2e-4f73-9aaa-972c48a0a89e	RCP-KL01-20260319-001	96515b40-1ec7-4878-9b96-92e0bc4409e3	d44ca290-a086-439d-9657-07fc5ebb689c	\N	Lee Mei Ling	218.0800	MYR	cash	\N	2026-03-19 09:58:52.50052+00	detailed	\N	\N	0	\N	\N	baa4adfd-09ee-457e-bcd5-3fa7e1569616	2026-03-19 09:58:52.50052+00	\N	\N
4af5c869-6b27-4e42-95b0-37676f03035d	RCP-KL01-20260319-002	5b377661-6fd7-4200-9fc5-19338aafd0fc	d44ca290-a086-439d-9657-07fc5ebb689c	\N	\N	87.0000	MYR	cash	\N	2026-03-19 10:56:08.666973+00	detailed	\N	\N	0	\N	\N	baa4adfd-09ee-457e-bcd5-3fa7e1569616	2026-03-19 10:56:08.666973+00	\N	\N
1b9229d4-a6a1-4363-ac7e-8e3abdf81fba	RCP-KL01-20260320-001	941d7984-61db-4ab4-80a8-e5ecde05ff80	d44ca290-a086-439d-9657-07fc5ebb689c	\N	\N	115.4200	MYR	cash	\N	2026-03-20 01:03:31.355671+00	detailed	\N	\N	0	\N	\N	baa4adfd-09ee-457e-bcd5-3fa7e1569616	2026-03-20 01:03:31.355671+00	\N	\N
ae000001-0000-0000-0000-000000000001	RCP-KL01-20260318-001	ab000001-0000-0000-0000-000000000001	d44ca290-a086-439d-9657-07fc5ebb689c	fe8efacd-0148-4b05-b09d-f799a6094266	Lee Chong Wei	2146.0000	MYR	card	\N	2026-03-20 09:21:05.871041+00	detailed	\N	\N	0	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:21:05.871041+00	ac000001-0000-0000-0000-000000000001	ad000001-0000-0000-0000-000000000002
ae000001-0000-0000-0000-000000000002	RCP-KL01-20260317-001	ab000001-0000-0000-0000-000000000002	d44ca290-a086-439d-9657-07fc5ebb689c	a85891ea-4fe4-4e7b-83ac-9cd1debd8557	Ahmad Rizal	1392.0000	MYR	cash	\N	2026-03-20 09:21:05.871041+00	detailed	\N	\N	0	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:21:05.871041+00	ac000001-0000-0000-0000-000000000002	ad000001-0000-0000-0000-000000000003
ae000001-0000-0000-0000-000000000003	RCP-KL01-20260316-001	ab000001-0000-0000-0000-000000000005	d44ca290-a086-439d-9657-07fc5ebb689c	bac61958-a403-4cab-b57c-ad0a1b2d6f49	Sarah Lim	3345.6000	MYR	qr	\N	2026-03-20 09:21:05.871041+00	detailed	\N	\N	0	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:21:05.871041+00	ac000001-0000-0000-0000-000000000005	ad000001-0000-0000-0000-000000000004
ae000001-0000-0000-0000-000000000004	RCP-KL01-20260315-001	ab000001-0000-0000-0000-000000000006	d44ca290-a086-439d-9657-07fc5ebb689c	29da004e-e84c-4520-beb1-9257085db4d9	Michael Tan	1948.8000	MYR	bank_transfer	\N	2026-03-20 09:21:05.871041+00	detailed	\N	\N	0	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:21:05.871041+00	ac000001-0000-0000-0000-000000000006	ad000001-0000-0000-0000-000000000005
ae000001-0000-0000-0000-000000000005	RCP-KL01-20260313-001	ab000001-0000-0000-0000-000000000007	d44ca290-a086-439d-9657-07fc5ebb689c	f298ab23-a849-4efe-ab49-9c8b8bee49c8	Jason Wong	4698.0000	MYR	card	\N	2026-03-20 09:21:05.871041+00	detailed	\N	\N	0	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:21:05.871041+00	ac000001-0000-0000-0000-000000000007	ad000001-0000-0000-0000-000000000006
ae000001-0000-0000-0000-000000000006	RCP-KL01-20260319-003	96515b40-1ec7-4878-9b96-92e0bc4409e3	d44ca290-a086-439d-9657-07fc5ebb689c	a85891ea-4fe4-4e7b-83ac-9cd1debd8557	Ahmad Rizal	2436.0000	MYR	cash	\N	2026-03-20 09:21:05.871041+00	detailed	\N	\N	0	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:21:05.871041+00	ac000001-0000-0000-0000-000000000008	ad000001-0000-0000-0000-000000000007
ae000001-0000-0000-0000-000000000007	RCP-KL01-20260319-004	5b377661-6fd7-4200-9fc5-19338aafd0fc	d44ca290-a086-439d-9657-07fc5ebb689c	bac61958-a403-4cab-b57c-ad0a1b2d6f49	Sarah Lim	1798.0000	MYR	qr	\N	2026-03-20 09:21:05.871041+00	detailed	\N	\N	0	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:21:05.871041+00	ac000001-0000-0000-0000-000000000009	ad000001-0000-0000-0000-000000000008
e9000001-0000-0000-0000-000000000001	RCP-KL01-20260310-001	e6000001-0000-0000-0000-000000000001	d44ca290-a086-439d-9657-07fc5ebb689c	c9000001-0000-0000-0000-000000000001	Lee Chong Wei	1788.8800	MYR	cash	\N	2026-03-10 18:15:00+00	detailed	\N	\N	0	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:45:42.312791+00	e7000001-0000-0000-0000-000000000001	e8000001-0000-0000-0000-000000000001
e9000001-0000-0000-0000-000000000002	RCP-KL01-20260311-001	e6000001-0000-0000-0000-000000000002	d44ca290-a086-439d-9657-07fc5ebb689c	c9000001-0000-0000-0000-000000000003	Park Joon Ho	1390.0400	MYR	card	TXNKL2603110001	2026-03-11 18:10:00+00	detailed	\N	\N	0	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:45:42.312791+00	e7000001-0000-0000-0000-000000000002	e8000001-0000-0000-0000-000000000002
e9000001-0000-0000-0000-000000000003	RCP-KL01-20260312-001	e6000001-0000-0000-0000-000000000003	d44ca290-a086-439d-9657-07fc5ebb689c	c9000001-0000-0000-0000-000000000005	Chen Hai Long	3189.5400	MYR	bank_transfer	IBG20260312001	2026-03-12 18:20:00+00	detailed	\N	\N	0	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:45:42.312791+00	e7000001-0000-0000-0000-000000000003	e8000001-0000-0000-0000-000000000003
e9000001-0000-0000-0000-000000000004	RCP-PJ01-20260313-001	e6000001-0000-0000-0000-000000000004	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	c9000001-0000-0000-0000-000000000004	Watanabe Kenji	1557.6000	MYR	qr	TNG20260313001	2026-03-13 18:25:00+00	detailed	\N	\N	0	\N	\N	cb9837c5-33f1-4c67-8b4a-85e4922258f3	2026-03-20 09:45:42.312791+00	e7000001-0000-0000-0000-000000000004	e8000001-0000-0000-0000-000000000004
e9000001-0000-0000-0000-000000000005	RCP-PJ01-20260314-001	e6000001-0000-0000-0000-000000000005	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	c9000001-0000-0000-0000-000000000002	Nurul Ain Binti Aziz	3537.6400	MYR	card	TXNPJ2603140001	2026-03-14 19:05:00+00	detailed	\N	\N	0	\N	\N	cb9837c5-33f1-4c67-8b4a-85e4922258f3	2026-03-20 09:45:42.312791+00	e7000001-0000-0000-0000-000000000005	e8000001-0000-0000-0000-000000000005
e9000001-0000-0000-0000-000000000006	RCP-KL01-20260315-002	e6000001-0000-0000-0000-000000000006	d44ca290-a086-439d-9657-07fc5ebb689c	fe8efacd-0148-4b05-b09d-f799a6094266	Lee Soo-jin	1213.0400	MYR	cash	\N	2026-03-15 17:15:00+00	detailed	\N	\N	0	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:45:42.312791+00	e7000001-0000-0000-0000-000000000006	e8000001-0000-0000-0000-000000000006
e9000001-0000-0000-0000-000000000007	RCP-KL01-20260316-002	e6000001-0000-0000-0000-000000000007	d44ca290-a086-439d-9657-07fc5ebb689c	f298ab23-a849-4efe-ab49-9c8b8bee49c8	Jason Wong	3252.0800	MYR	card	TXNKL2603160001	2026-03-16 18:15:00+00	detailed	\N	\N	0	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:45:42.312791+00	e7000001-0000-0000-0000-000000000007	e8000001-0000-0000-0000-000000000007
e9000001-0000-0000-0000-000000000008	RCP-PJ01-20260317-001	e6000001-0000-0000-0000-000000000008	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	bac61958-a403-4cab-b57c-ad0a1b2d6f49	Michael Lim	1085.6000	MYR	qr	TNG20260317001	2026-03-17 17:10:00+00	detailed	\N	\N	0	\N	\N	cb9837c5-33f1-4c67-8b4a-85e4922258f3	2026-03-20 09:45:42.312791+00	e7000001-0000-0000-0000-000000000008	e8000001-0000-0000-0000-000000000008
e9000001-0000-0000-0000-000000000009	RCP-PJ01-20260318-001	e6000001-0000-0000-0000-000000000009	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	29da004e-e84c-4520-beb1-9257085db4d9	David Ng	1604.8000	MYR	bank_transfer	IBG20260318001	2026-03-18 18:05:00+00	detailed	\N	\N	0	\N	\N	cb9837c5-33f1-4c67-8b4a-85e4922258f3	2026-03-20 09:45:42.312791+00	e7000001-0000-0000-0000-000000000009	e8000001-0000-0000-0000-000000000009
e9000001-0000-0000-0000-000000000010	RCP-KL01-20260319-005	e6000001-0000-0000-0000-000000000010	d44ca290-a086-439d-9657-07fc5ebb689c	a85891ea-4fe4-4e7b-83ac-9cd1debd8557	Ahmad Rizal	1095.0400	MYR	cash	\N	2026-03-19 17:35:00+00	detailed	\N	\N	0	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:45:42.312791+00	e7000001-0000-0000-0000-000000000010	e8000001-0000-0000-0000-000000000010
\.


--
-- Data for Name: reservation_hostesses; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.reservation_hostesses (id, reservation_id, hostess_id, is_primary, status, commission_rate_snapshot, session_fee, notes, assigned_by, assigned_at) FROM stdin;
b1000001-0000-0000-0000-000000000001	f4782275-3461-4a26-8226-7ce19bba83d9	1d0c0046-26ce-43ce-88ff-9aa743148424	t	completed	0.3000	480.0000	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:17:39.816675+00
b1000001-0000-0000-0000-000000000002	f4782275-3461-4a26-8226-7ce19bba83d9	a909cc0a-af3c-46f4-9ae1-14c9e04a6c8c	f	completed	0.3000	320.0000	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:17:39.816675+00
b1000001-0000-0000-0000-000000000003	361c61ea-0a07-4821-9fcd-81a630407d49	1d0c0046-26ce-43ce-88ff-9aa743148424	t	completed	0.3000	400.0000	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:17:39.816675+00
b1000001-0000-0000-0000-000000000004	c3feac5b-d681-4fc8-bd1d-4ed34adb6a38	a909cc0a-af3c-46f4-9ae1-14c9e04a6c8c	t	completed	0.3000	360.0000	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:17:39.816675+00
b1000001-0000-0000-0000-000000000005	420b76ff-8f2c-4208-91fd-63e65606933c	1d0c0046-26ce-43ce-88ff-9aa743148424	t	completed	0.3000	380.0000	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:17:39.816675+00
b1000001-0000-0000-0000-000000000006	cbd2ab73-430e-4145-a151-dfd2fef9e1b7	a909cc0a-af3c-46f4-9ae1-14c9e04a6c8c	t	completed	0.3000	500.0000	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:17:39.816675+00
b1000001-0000-0000-0000-000000000007	43208b14-1549-40cc-812d-55241c3ef1d4	1d0c0046-26ce-43ce-88ff-9aa743148424	t	active	0.3000	420.0000	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:17:39.816675+00
b1000001-0000-0000-0000-000000000008	f9000001-0000-0000-0000-000000000001	a909cc0a-af3c-46f4-9ae1-14c9e04a6c8c	t	completed	0.3000	460.0000	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:17:39.816675+00
b1000001-0000-0000-0000-000000000009	f9000001-0000-0000-0000-000000000002	1d0c0046-26ce-43ce-88ff-9aa743148424	t	completed	0.3000	340.0000	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:17:39.816675+00
b1000001-0000-0000-0000-000000000010	f9000001-0000-0000-0000-000000000003	a909cc0a-af3c-46f4-9ae1-14c9e04a6c8c	t	assigned	0.3000	500.0000	\N	cb9837c5-33f1-4c67-8b4a-85e4922258f3	2026-03-20 09:17:39.816675+00
eb000001-0000-0000-0000-000000000001	e5000001-0000-0000-0000-000000000001	1d0c0046-26ce-43ce-88ff-9aa743148424	t	completed	0.1200	480.0000	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:46:34.444942+00
eb000001-0000-0000-0000-000000000002	e5000001-0000-0000-0000-000000000002	a909cc0a-af3c-46f4-9ae1-14c9e04a6c8c	t	completed	0.1200	480.0000	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:46:34.444942+00
eb000001-0000-0000-0000-000000000003	e5000001-0000-0000-0000-000000000003	1d0c0046-26ce-43ce-88ff-9aa743148424	t	completed	0.1200	576.0000	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:46:34.444942+00
eb000001-0000-0000-0000-000000000004	e5000001-0000-0000-0000-000000000003	a909cc0a-af3c-46f4-9ae1-14c9e04a6c8c	f	completed	0.1200	576.0000	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:46:34.444942+00
eb000001-0000-0000-0000-000000000005	e5000001-0000-0000-0000-000000000004	1d0c0046-26ce-43ce-88ff-9aa743148424	t	completed	0.1200	480.0000	\N	cb9837c5-33f1-4c67-8b4a-85e4922258f3	2026-03-20 09:46:34.444942+00
eb000001-0000-0000-0000-000000000006	e5000001-0000-0000-0000-000000000005	a909cc0a-af3c-46f4-9ae1-14c9e04a6c8c	t	completed	0.1200	576.0000	\N	cb9837c5-33f1-4c67-8b4a-85e4922258f3	2026-03-20 09:46:34.444942+00
eb000001-0000-0000-0000-000000000007	e5000001-0000-0000-0000-000000000005	1d0c0046-26ce-43ce-88ff-9aa743148424	f	completed	0.1200	576.0000	\N	cb9837c5-33f1-4c67-8b4a-85e4922258f3	2026-03-20 09:46:34.444942+00
eb000001-0000-0000-0000-000000000008	e5000001-0000-0000-0000-000000000006	1d0c0046-26ce-43ce-88ff-9aa743148424	t	completed	0.1200	384.0000	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:46:34.444942+00
eb000001-0000-0000-0000-000000000009	e5000001-0000-0000-0000-000000000007	a909cc0a-af3c-46f4-9ae1-14c9e04a6c8c	t	completed	0.1200	576.0000	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:46:34.444942+00
eb000001-0000-0000-0000-000000000010	e5000001-0000-0000-0000-000000000007	1d0c0046-26ce-43ce-88ff-9aa743148424	f	completed	0.1200	576.0000	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:46:34.444942+00
eb000001-0000-0000-0000-000000000011	e5000001-0000-0000-0000-000000000008	a909cc0a-af3c-46f4-9ae1-14c9e04a6c8c	t	completed	0.1200	384.0000	\N	cb9837c5-33f1-4c67-8b4a-85e4922258f3	2026-03-20 09:46:34.444942+00
eb000001-0000-0000-0000-000000000012	e5000001-0000-0000-0000-000000000009	1d0c0046-26ce-43ce-88ff-9aa743148424	t	completed	0.1200	480.0000	\N	cb9837c5-33f1-4c67-8b4a-85e4922258f3	2026-03-20 09:46:34.444942+00
eb000001-0000-0000-0000-000000000013	e5000001-0000-0000-0000-000000000009	a909cc0a-af3c-46f4-9ae1-14c9e04a6c8c	f	completed	0.1200	480.0000	\N	cb9837c5-33f1-4c67-8b4a-85e4922258f3	2026-03-20 09:46:34.444942+00
eb000001-0000-0000-0000-000000000014	e5000001-0000-0000-0000-000000000010	1d0c0046-26ce-43ce-88ff-9aa743148424	t	completed	0.1200	480.0000	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:46:34.444942+00
\.


--
-- Data for Name: reservation_pickups; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.reservation_pickups (id, reservation_id, driver_id, pickup_address, return_address, pickup_time, return_time, pickup_fee, status, notes, created_at) FROM stdin;
b2000001-0000-0000-0000-000000000001	f4782275-3461-4a26-8226-7ce19bba83d9	c4624bd2-a4b3-48da-ad7b-a174dec55668	The Gardens, Mid Valley, KL	Club Noir KL	2026-03-13 11:30:00+00	2026-03-13 18:00:00+00	80.0000	completed	\N	2026-03-20 09:17:39.820816+00
b2000001-0000-0000-0000-000000000002	361c61ea-0a07-4821-9fcd-81a630407d49	c4624bd2-a4b3-48da-ad7b-a174dec55668	Pavilion KL, Bukit Bintang	Club Noir KL	2026-03-19 12:00:00+00	2026-03-19 17:30:00+00	60.0000	completed	\N	2026-03-20 09:17:39.820816+00
b2000001-0000-0000-0000-000000000003	c3feac5b-d681-4fc8-bd1d-4ed34adb6a38	c4624bd2-a4b3-48da-ad7b-a174dec55668	Sunway Pyramid, Subang	Club Noir KL	2026-03-15 12:30:00+00	2026-03-15 17:00:00+00	90.0000	completed	\N	2026-03-20 09:17:39.820816+00
b2000001-0000-0000-0000-000000000004	420b76ff-8f2c-4208-91fd-63e65606933c	c4624bd2-a4b3-48da-ad7b-a174dec55668	KLCC, Jalan Ampang	Club Noir KL	2026-03-19 13:00:00+00	2026-03-19 18:00:00+00	70.0000	completed	\N	2026-03-20 09:17:39.820816+00
b2000001-0000-0000-0000-000000000005	cbd2ab73-430e-4145-a151-dfd2fef9e1b7	c4624bd2-a4b3-48da-ad7b-a174dec55668	Bangsar Village, Bangsar	Club Noir KL	2026-03-16 12:00:00+00	2026-03-16 17:30:00+00	65.0000	completed	\N	2026-03-20 09:17:39.820816+00
b2000001-0000-0000-0000-000000000006	43208b14-1549-40cc-812d-55241c3ef1d4	c4624bd2-a4b3-48da-ad7b-a174dec55668	1 Utama, PJ	Club Noir KL	2026-03-20 12:00:00+00	\N	75.0000	in_progress	\N	2026-03-20 09:17:39.820816+00
b2000001-0000-0000-0000-000000000007	f9000001-0000-0000-0000-000000000001	c4624bd2-a4b3-48da-ad7b-a174dec55668	TRX Exchange, Jalan Tun Razak	Club Noir KL	2026-03-18 11:45:00+00	2026-03-18 17:30:00+00	85.0000	completed	\N	2026-03-20 09:17:39.820816+00
b2000001-0000-0000-0000-000000000008	f9000001-0000-0000-0000-000000000002	c4624bd2-a4b3-48da-ad7b-a174dec55668	Damansara City Mall, PJ	Club Noir KL	2026-03-17 12:30:00+00	2026-03-17 18:00:00+00	80.0000	completed	\N	2026-03-20 09:17:39.820816+00
b2000001-0000-0000-0000-000000000009	f9000001-0000-0000-0000-000000000003	c4624bd2-a4b3-48da-ad7b-a174dec55668	Sunway Velocity, Cheras	Velvet Lounge PJ	2026-03-19 11:30:00+00	\N	95.0000	scheduled	\N	2026-03-20 09:17:39.820816+00
b2000001-0000-0000-0000-000000000010	f9000001-0000-0000-0000-000000000004	c4624bd2-a4b3-48da-ad7b-a174dec55668	Empire Shopping Gallery, Subang	Velvet Lounge PJ	2026-03-21 10:45:00+00	\N	70.0000	scheduled	\N	2026-03-20 09:17:39.820816+00
e1000001-0000-0000-0000-000000000001	cf000001-0000-0000-0000-000000000001	c4624bd2-a4b3-48da-ad7b-a174dec55668	Pavilion KL, Jalan Bukit Bintang, KL City Centre	\N	2026-03-25 12:30:00+00	\N	0.0000	scheduled	Guest at main entrance. Confirm WhatsApp before departure.	2026-03-20 09:31:22.9771+00
ec000001-0000-0000-0000-000000000001	e5000001-0000-0000-0000-000000000006	c4624bd2-a4b3-48da-ad7b-a174dec55668	Pavilion Hotel Kuala Lumpur, Bukit Bintang	KL Entertainment Lounge, Jalan Imbi	2026-03-15 12:30:00+00	2026-03-15 17:30:00+00	48.0000	completed	Guest at Hotel Lobby — call before arrival	2026-03-20 09:47:56.34583+00
ec000001-0000-0000-0000-000000000002	e5000001-0000-0000-0000-000000000007	c4624bd2-a4b3-48da-ad7b-a174dec55668	Mandarin Oriental Hotel, KLCC	KL Entertainment Lounge, Jalan Imbi	2026-03-16 11:30:00+00	2026-03-16 18:30:00+00	68.0000	completed	VIP — park at hotel basement, text upon arrival	2026-03-20 09:47:56.34583+00
ec000001-0000-0000-0000-000000000003	e5000001-0000-0000-0000-000000000008	c4624bd2-a4b3-48da-ad7b-a174dec55668	Empire Shopping Gallery, Subang Jaya	PJ Entertainment Lounge, Damansara	2026-03-17 12:30:00+00	2026-03-17 17:30:00+00	45.0000	completed	Guest will be at carpark level B1	2026-03-20 09:47:56.34583+00
ec000001-0000-0000-0000-000000000004	e5000001-0000-0000-0000-000000000009	c4624bd2-a4b3-48da-ad7b-a174dec55668	Sunway Pyramid Hotel West, Petaling Jaya	PJ Entertainment Lounge, Damansara	2026-03-18 12:30:00+00	2026-03-18 18:30:00+00	55.0000	completed	Client has 2 guests — use 7-seater	2026-03-20 09:47:56.34583+00
ec000001-0000-0000-0000-000000000005	e5000001-0000-0000-0000-000000000010	c4624bd2-a4b3-48da-ad7b-a174dec55668	Gardens Hotel, Mid Valley City	KL Entertainment Lounge, Jalan Imbi	2026-03-19 12:00:00+00	2026-03-19 18:00:00+00	42.0000	completed	Call 15 minutes before arrival	2026-03-20 09:47:56.34583+00
\.


--
-- Data for Name: reservations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.reservations (id, reservation_no, branch_id, customer_id, customer_name, customer_phone, guest_count, reservation_date, start_time, end_time, duration_hours, room_id, status, booking_channel, referral_code, agent_id, is_outcall, special_requests, internal_notes, deposit_amount, deposit_paid, deposit_paid_at, deposit_method, confirmed_at, checked_in_at, checked_out_at, cancelled_at, cancellation_reason, no_show_at, created_by, created_at, updated_at, assigned_at, assigned_by) FROM stdin;
f4782275-3461-4a26-8226-7ce19bba83d9	RES-001	d44ca290-a086-439d-9657-07fc5ebb689c	\N	Wong Wai Kit	+60123456789	4	2026-03-19	2026-03-19 11:00:00+00	2026-03-19 14:00:00+00	3.00	d7dbc46e-a51b-4144-929b-55ea7e7099d3	confirmed	phone	\N	\N	f	\N	\N	200.0000	t	\N	cash	2026-03-19 09:57:56.199621+00	\N	\N	\N	\N	\N	baa4adfd-09ee-457e-bcd5-3fa7e1569616	2026-03-19 09:57:56.199621+00	2026-03-19 09:57:56.199621+00	\N	\N
361c61ea-0a07-4821-9fcd-81a630407d49	RES-002	d44ca290-a086-439d-9657-07fc5ebb689c	\N	Lee Mei Ling	+60198765432	6	2026-03-19	2026-03-19 12:00:00+00	2026-03-19 15:00:00+00	3.00	ddf4f071-48fa-41f1-9843-7ad019d3e258	checked_in	whatsapp	\N	\N	f	\N	\N	300.0000	t	\N	bank_transfer	2026-03-19 09:57:56.199621+00	2026-03-19 09:57:56.199621+00	\N	\N	\N	\N	baa4adfd-09ee-457e-bcd5-3fa7e1569616	2026-03-19 09:57:56.199621+00	2026-03-19 09:57:56.199621+00	\N	\N
c3feac5b-d681-4fc8-bd1d-4ed34adb6a38	RES-004	d44ca290-a086-439d-9657-07fc5ebb689c	\N	Tan Siew Fong	+60167890123	8	2026-03-19	2026-03-19 10:30:00+00	2026-03-19 14:30:00+00	4.00	3c095c9b-3c80-401e-bcec-d0b87cb48559	confirmed	app	\N	\N	f	\N	\N	500.0000	t	\N	ewallet	2026-03-19 09:57:56.199621+00	\N	\N	\N	\N	\N	baa4adfd-09ee-457e-bcd5-3fa7e1569616	2026-03-19 09:57:56.199621+00	2026-03-19 09:57:56.199621+00	\N	\N
420b76ff-8f2c-4208-91fd-63e65606933c	RES-E2E	d44ca290-a086-439d-9657-07fc5ebb689c	\N	E2E Test Guest	+60111111111	3	2026-03-19	2026-03-19 12:00:00+00	2026-03-19 15:00:00+00	3.00	ec9af592-9b4b-4373-aeb8-b81dc29f63bc	checked_in	walk_in	\N	\N	f	\N	\N	0.0000	f	\N	\N	2026-03-19 10:08:46.08706+00	2026-03-19 10:08:46.08706+00	\N	\N	\N	\N	baa4adfd-09ee-457e-bcd5-3fa7e1569616	2026-03-19 10:08:46.08706+00	2026-03-19 10:08:46.08706+00	\N	\N
cbd2ab73-430e-4145-a151-dfd2fef9e1b7	RES-003	d44ca290-a086-439d-9657-07fc5ebb689c	\N	Ahmad Faizal	+60112233445	2	2026-03-19	2026-03-19 13:00:00+00	2026-03-19 15:00:00+00	2.00	7d4e2d97-a078-4752-bdd1-5fdd701a4c70	checked_out	walk_in	\N	\N	f	\N	\N	0.0000	f	\N	\N	2026-03-19 09:59:04.272+00	2026-03-19 13:32:41.026+00	2026-03-19 13:32:49.319+00	\N	\N	\N	baa4adfd-09ee-457e-bcd5-3fa7e1569616	2026-03-19 09:57:56.199621+00	2026-03-19 13:32:49.319+00	\N	\N
43208b14-1549-40cc-812d-55241c3ef1d4	KL01-20260320-001	d44ca290-a086-439d-9657-07fc5ebb689c	\N	Test Customer	601234567	3	2026-03-20	2026-03-20 20:00:00+00	2026-03-20 22:00:00+00	2.00	d7dbc46e-a51b-4144-929b-55ea7e7099d3	checked_in	walk_in	\N	\N	f	\N	\N	0.0000	f	\N	\N	2026-03-20 00:59:40.522+00	2026-03-20 00:59:52.093+00	\N	\N	\N	\N	baa4adfd-09ee-457e-bcd5-3fa7e1569616	2026-03-20 00:51:24.317914+00	2026-03-20 00:59:52.093+00	\N	\N
f9000001-0000-0000-0000-000000000001	KL01-20260318-001	d44ca290-a086-439d-9657-07fc5ebb689c	fe8efacd-0148-4b05-b09d-f799a6094266	\N	\N	6	2026-03-18	2026-03-18 12:00:00+00	2026-03-18 17:00:00+00	5.00	3c095c9b-3c80-401e-bcec-d0b87cb48559	checked_out	phone	\N	a9000001-0000-0000-0000-000000000001	f	\N	\N	500.0000	t	\N	\N	\N	\N	\N	\N	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:15:27.088377+00	2026-03-20 09:15:27.088377+00	\N	\N
f9000001-0000-0000-0000-000000000002	KL01-20260317-001	d44ca290-a086-439d-9657-07fc5ebb689c	a85891ea-4fe4-4e7b-83ac-9cd1debd8557	\N	\N	4	2026-03-17	2026-03-17 13:00:00+00	2026-03-17 18:00:00+00	5.00	ec9af592-9b4b-4373-aeb8-b81dc29f63bc	checked_out	whatsapp	\N	a9000001-0000-0000-0000-000000000002	f	\N	\N	300.0000	t	\N	\N	\N	\N	\N	\N	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:15:27.088377+00	2026-03-20 09:15:27.088377+00	\N	\N
f9000001-0000-0000-0000-000000000003	PJ01-20260319-001	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	c9000001-0000-0000-0000-000000000001	\N	\N	8	2026-03-19	2026-03-19 12:00:00+00	2026-03-19 18:00:00+00	6.00	2cbdd664-130d-48f5-b3c6-a50ce9630545	confirmed	online	\N	a9000001-0000-0000-0000-000000000003	f	\N	\N	800.0000	t	\N	\N	\N	\N	\N	\N	\N	\N	cb9837c5-33f1-4c67-8b4a-85e4922258f3	2026-03-20 09:15:27.088377+00	2026-03-20 09:15:27.088377+00	\N	\N
f9000001-0000-0000-0000-000000000004	PJ01-20260321-001	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	c9000001-0000-0000-0000-000000000002	\N	\N	5	2026-03-21	2026-03-21 11:00:00+00	2026-03-21 15:00:00+00	4.00	44695522-f27d-42cb-a5d5-29f4b5cda8eb	tentative	walk_in	\N	\N	f	\N	\N	0.0000	f	\N	\N	\N	\N	\N	\N	\N	\N	cb9837c5-33f1-4c67-8b4a-85e4922258f3	2026-03-20 09:15:27.088377+00	2026-03-20 09:15:27.088377+00	\N	\N
cf000001-0000-0000-0000-000000000001	KL01-20260325-001	d44ca290-a086-439d-9657-07fc5ebb689c	fe8efacd-0148-4b05-b09d-f799a6094266	Lee Chong Wei	+60121234567	4	2026-03-25	2026-03-25 13:00:00+00	2026-03-25 18:00:00+00	5.00	ddf4f071-48fa-41f1-9843-7ad019d3e258	confirmed	phone	\N	\N	f	\N	VIP customer — preferred room: Standard 2. Birthday celebration.	500.0000	t	2026-03-20 02:00:00+00	bank_transfer	2026-03-20 02:05:00+00	\N	\N	\N	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:30:20.521146+00	2026-03-20 09:30:20.521146+00	\N	\N
cf000001-0000-0000-0000-000000000002	PJ01-20260327-001	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	a85891ea-4fe4-4e7b-83ac-9cd1debd8557	Ahmad Rizal	+60199876543	6	2026-03-27	2026-03-27 12:30:00+00	2026-03-27 17:30:00+00	5.00	eea5242e-5314-4a5e-b9a9-f9ea8e36c8d7	confirmed	whatsapp	\N	\N	f	\N	Group booking. Require 2 hostesses and pickup from Mid Valley.	800.0000	f	\N	\N	2026-03-20 03:00:00+00	\N	\N	\N	\N	\N	cb9837c5-33f1-4c67-8b4a-85e4922258f3	2026-03-20 09:30:20.530447+00	2026-03-20 09:30:20.530447+00	\N	\N
e5000001-0000-0000-0000-000000000001	KL01-20260310-001	d44ca290-a086-439d-9657-07fc5ebb689c	c9000001-0000-0000-0000-000000000001	Lee Chong Wei	+60178881001	4	2026-03-10	2026-03-10 13:00:00+00	2026-03-10 18:00:00+00	5.00	3c095c9b-3c80-401e-bcec-d0b87cb48559	checked_out	phone	\N	285726d3-e898-4d38-a603-e48794fef68a	f	\N	Regular VIP. Prefers Hennessy. Seat near stage.	500.0000	t	2026-03-09 07:00:00+00	bank_transfer	2026-03-09 07:05:00+00	2026-03-10 13:05:00+00	2026-03-10 18:10:00+00	\N	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:40:09.439157+00	2026-03-20 09:40:09.439157+00	\N	\N
e5000001-0000-0000-0000-000000000002	KL01-20260311-001	d44ca290-a086-439d-9657-07fc5ebb689c	c9000001-0000-0000-0000-000000000003	Park Joon Ho	+60158883003	3	2026-03-11	2026-03-11 13:00:00+00	2026-03-11 18:00:00+00	5.00	ec9af592-9b4b-4373-aeb8-b81dc29f63bc	checked_out	whatsapp	\N	a9000001-0000-0000-0000-000000000001	f	\N	Korean VIP group. Whisky preferred. Birthday celebration.	400.0000	t	2026-03-10 06:00:00+00	bank_transfer	2026-03-10 06:10:00+00	2026-03-11 13:10:00+00	2026-03-11 18:05:00+00	\N	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:40:09.941746+00	2026-03-20 09:40:09.941746+00	\N	\N
e5000001-0000-0000-0000-000000000003	KL01-20260312-001	d44ca290-a086-439d-9657-07fc5ebb689c	c9000001-0000-0000-0000-000000000005	Chen Hai Long	+60138885005	6	2026-03-12	2026-03-12 12:00:00+00	2026-03-12 18:00:00+00	6.00	2cbdd664-130d-48f5-b3c6-a50ce9630545	checked_out	agent	\N	285726d3-e898-4d38-a603-e48794fef68a	f	\N	VVIP client. Requires 2 hostesses. Full package with food.	1000.0000	t	2026-03-11 02:00:00+00	cash	2026-03-11 02:10:00+00	2026-03-12 12:05:00+00	2026-03-12 18:15:00+00	\N	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:40:10.036593+00	2026-03-20 09:40:10.036593+00	\N	\N
e5000001-0000-0000-0000-000000000004	PJ01-20260313-001	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	c9000001-0000-0000-0000-000000000004	Watanabe Kenji	+60148884004	5	2026-03-13	2026-03-13 13:00:00+00	2026-03-13 18:00:00+00	5.00	eea5242e-5314-4a5e-b9a9-f9ea8e36c8d7	checked_out	agent	\N	a9000001-0000-0000-0000-000000000002	f	\N	Japanese corporate client. Sake & whisky. Very private.	500.0000	t	2026-03-12 03:00:00+00	bank_transfer	2026-03-12 03:05:00+00	2026-03-13 13:08:00+00	2026-03-13 18:20:00+00	\N	\N	\N	cb9837c5-33f1-4c67-8b4a-85e4922258f3	2026-03-20 09:40:10.041051+00	2026-03-20 09:40:10.041051+00	\N	\N
e5000001-0000-0000-0000-000000000005	PJ01-20260314-001	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	c9000001-0000-0000-0000-000000000002	Nurul Ain Binti Aziz	+60168882002	8	2026-03-14	2026-03-14 13:00:00+00	2026-03-14 19:00:00+00	6.00	7044f2e0-cdb9-477a-90b0-eb640d3cddc6	checked_out	whatsapp	\N	a9000001-0000-0000-0000-000000000001	f	\N	Large group, VVIP. 2 hostesses required. Fruit platter + food set.	1200.0000	t	2026-03-13 01:00:00+00	qr	2026-03-13 01:10:00+00	2026-03-14 13:12:00+00	2026-03-14 19:10:00+00	\N	\N	\N	cb9837c5-33f1-4c67-8b4a-85e4922258f3	2026-03-20 09:40:10.044714+00	2026-03-20 09:40:10.044714+00	\N	\N
e5000001-0000-0000-0000-000000000006	KL01-20260315-002	d44ca290-a086-439d-9657-07fc5ebb689c	fe8efacd-0148-4b05-b09d-f799a6094266	Lee Soo-jin	+60123456789	4	2026-03-15	2026-03-15 13:00:00+00	2026-03-15 17:00:00+00	4.00	ddf4f071-48fa-41f1-9843-7ad019d3e258	checked_out	phone	\N	a9000001-0000-0000-0000-000000000003	t	\N	OUTCALL. Pickup from Bukit Bintang Hotel. 4 pax, incl. 1 hostess.	400.0000	t	2026-03-14 08:00:00+00	bank_transfer	2026-03-14 08:05:00+00	2026-03-15 13:05:00+00	2026-03-15 17:10:00+00	\N	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:40:10.048353+00	2026-03-20 09:40:10.048353+00	\N	\N
e5000001-0000-0000-0000-000000000007	KL01-20260316-002	d44ca290-a086-439d-9657-07fc5ebb689c	f298ab23-a849-4efe-ab49-9c8b8bee49c8	Jason Wong	+60111111111	6	2026-03-16	2026-03-16 12:00:00+00	2026-03-16 18:00:00+00	6.00	2cbdd664-130d-48f5-b3c6-a50ce9630545	checked_out	agent	\N	285726d3-e898-4d38-a603-e48794fef68a	t	\N	OUTCALL. Pickup from KLCC Mandarin Oriental. Full VVIP pkg. 2 hostesses.	1000.0000	t	2026-03-15 02:00:00+00	bank_transfer	2026-03-15 02:05:00+00	2026-03-16 12:08:00+00	2026-03-16 18:20:00+00	\N	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:40:10.053063+00	2026-03-20 09:40:10.053063+00	\N	\N
e5000001-0000-0000-0000-000000000008	PJ01-20260317-001	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	bac61958-a403-4cab-b57c-ad0a1b2d6f49	Michael Lim	+60155551234	3	2026-03-17	2026-03-17 13:00:00+00	2026-03-17 17:00:00+00	4.00	3dc7e917-facc-48d5-a383-93d718bad552	checked_out	whatsapp	\N	a9000001-0000-0000-0000-000000000002	t	\N	OUTCALL. Pickup from Empire Shopping Gallery PJ. 1 hostess req.	300.0000	t	2026-03-16 06:00:00+00	qr	2026-03-16 06:05:00+00	2026-03-17 13:05:00+00	2026-03-17 17:15:00+00	\N	\N	\N	cb9837c5-33f1-4c67-8b4a-85e4922258f3	2026-03-20 09:40:10.056832+00	2026-03-20 09:40:10.056832+00	\N	\N
e5000001-0000-0000-0000-000000000009	PJ01-20260318-001	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	29da004e-e84c-4520-beb1-9257085db4d9	David Ng	+60199990001	5	2026-03-18	2026-03-18 13:00:00+00	2026-03-18 18:00:00+00	5.00	498fa06c-faa8-4790-9678-fc1b96526c28	checked_out	phone	\N	a9000001-0000-0000-0000-000000000003	t	\N	OUTCALL. Pickup from Sunway Pyramid. 2 hostesses. VIP pkg.	600.0000	t	2026-03-17 04:00:00+00	cash	2026-03-17 04:05:00+00	2026-03-18 13:00:00+00	2026-03-18 18:05:00+00	\N	\N	\N	cb9837c5-33f1-4c67-8b4a-85e4922258f3	2026-03-20 09:40:10.06059+00	2026-03-20 09:40:10.06059+00	\N	\N
e5000001-0000-0000-0000-000000000010	KL01-20260319-002	d44ca290-a086-439d-9657-07fc5ebb689c	a85891ea-4fe4-4e7b-83ac-9cd1debd8557	Ahmad Rizal	+60123456789	4	2026-03-19	2026-03-19 12:30:00+00	2026-03-19 17:30:00+00	5.00	7d4e2d97-a078-4752-bdd1-5fdd701a4c70	checked_out	whatsapp	\N	a9000001-0000-0000-0000-000000000004	t	\N	OUTCALL. Pickup from Mid Valley Megamall. Standard pkg + 1 hostess.	400.0000	t	2026-03-18 05:00:00+00	bank_transfer	2026-03-18 05:05:00+00	2026-03-19 12:35:00+00	2026-03-19 17:35:00+00	\N	\N	\N	3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	2026-03-20 09:40:10.064142+00	2026-03-20 09:40:10.064142+00	\N	\N
\.


--
-- Data for Name: rooms; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.rooms (id, branch_id, name, room_type, capacity_min, capacity_max, hourly_rate, min_hours, description, amenities, floor_level, images, status, sort_order, is_active, created_at, deleted_at) FROM stdin;
ddf4f071-48fa-41f1-9843-7ad019d3e258	d44ca290-a086-439d-9657-07fc5ebb689c	Standard Room 2	private_room	2	8	80.0000	1.00	\N	\N	\N	\N	occupied	2	t	2026-03-19 09:29:22.478779+00	\N
3c095c9b-3c80-401e-bcec-d0b87cb48559	d44ca290-a086-439d-9657-07fc5ebb689c	VIP Suite A	vip_room	4	15	200.0000	1.00	\N	\N	\N	\N	available	4	t	2026-03-19 09:29:29.988049+00	\N
ec9af592-9b4b-4373-aeb8-b81dc29f63bc	d44ca290-a086-439d-9657-07fc5ebb689c	VIP Suite B	vip_room	4	15	200.0000	1.00	\N	\N	\N	\N	occupied	5	t	2026-03-19 09:29:33.67659+00	\N
2cbdd664-130d-48f5-b3c6-a50ce9630545	d44ca290-a086-439d-9657-07fc5ebb689c	VVIP Prestige	vvip_room	6	20	500.0000	1.00	\N	\N	\N	\N	available	6	t	2026-03-19 09:29:37.320926+00	\N
44695522-f27d-42cb-a5d5-29f4b5cda8eb	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	Standard Room 1	private_room	2	8	80.0000	1.00	\N	\N	\N	\N	available	1	t	2026-03-19 09:29:44.766269+00	\N
3dc7e917-facc-48d5-a383-93d718bad552	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	Standard Room 2	private_room	2	8	80.0000	1.00	\N	\N	\N	\N	occupied	2	t	2026-03-19 09:29:48.476029+00	\N
688e53cb-46e0-47b0-bfd2-d3db3511f799	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	Standard Room 3	private_room	2	10	100.0000	1.00	\N	\N	\N	\N	cleaning	3	t	2026-03-19 09:29:52.267996+00	\N
eea5242e-5314-4a5e-b9a9-f9ea8e36c8d7	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	VIP Suite A	vip_room	4	15	200.0000	1.00	\N	\N	\N	\N	available	4	t	2026-03-19 09:29:56.007819+00	\N
498fa06c-faa8-4790-9678-fc1b96526c28	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	VIP Suite B	vip_room	4	15	200.0000	1.00	\N	\N	\N	\N	occupied	5	t	2026-03-19 09:29:59.794552+00	\N
7044f2e0-cdb9-477a-90b0-eb640d3cddc6	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	VVIP Prestige	vvip_room	6	20	500.0000	1.00	\N	\N	\N	\N	available	6	t	2026-03-19 09:30:03.55245+00	\N
7d4e2d97-a078-4752-bdd1-5fdd701a4c70	d44ca290-a086-439d-9657-07fc5ebb689c	Standard Room 3	private_room	2	10	100.0000	1.00	\N	\N	\N	\N	available	3	t	2026-03-19 09:29:26.182231+00	\N
d7dbc46e-a51b-4144-929b-55ea7e7099d3	d44ca290-a086-439d-9657-07fc5ebb689c	Standard Room 1	private_room	2	8	80.0000	1.00	\N	\N	\N	\N	occupied	1	t	2026-03-19 09:29:18.580584+00	\N
\.


--
-- Data for Name: shareholders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.shareholders (id, org_id, name, email, phone, password_hash, nationality, bank_name, bank_account, bank_country, swift_code, preferred_currency, is_active, notes, created_at) FROM stdin;
241e5e68-7371-4bca-be51-44d61e9fbf96	00000000-0000-0000-0000-000000000001	David Wong	david@investor.com	+60122334455	\N	Malaysian	CIMB	1234567890	\N	\N	MYR	t	\N	2026-03-19 11:22:21.952345+00
d9000001-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000001	Dato Lim Boon Seng	lbs@kldevelopment.my	+60123330001	\N	Malaysian	Maybank	1111222201	MY	\N	MYR	t	\N	2026-03-20 09:14:02.334053+00
d9000001-0000-0000-0000-000000000002	00000000-0000-0000-0000-000000000001	Puan Sri Norzaharah Hamid	norzaharah@invest.my	+60133330002	\N	Malaysian	CIMB	2222333302	MY	\N	MYR	t	\N	2026-03-20 09:14:02.334053+00
d9000001-0000-0000-0000-000000000003	00000000-0000-0000-0000-000000000001	Lee Kah Chun	lkc@lcholdings.my	+60143330003	\N	Malaysian	Hong Leong	3333444403	MY	\N	MYR	t	\N	2026-03-20 09:14:02.334053+00
d9000001-0000-0000-0000-000000000004	00000000-0000-0000-0000-000000000001	James Tan Kok Wai	jtan@invest.my	+60153330004	\N	Malaysian	Public Bank	4444555504	MY	\N	MYR	t	\N	2026-03-20 09:14:02.334053+00
d9000001-0000-0000-0000-000000000005	00000000-0000-0000-0000-000000000001	Wong Chee Meng	wcm@wcmgroup.my	+60163330005	\N	Malaysian	RHB	5555666605	MY	\N	MYR	t	\N	2026-03-20 09:14:02.334053+00
d9000001-0000-0000-0000-000000000006	00000000-0000-0000-0000-000000000001	Datin Faridah Osman	faridah@trustinvest.my	+60173330006	\N	Malaysian	Maybank	6666777706	MY	\N	MYR	t	\N	2026-03-20 09:14:02.334053+00
d9000001-0000-0000-0000-000000000007	00000000-0000-0000-0000-000000000001	Yap Siew Hoong	ysh@yshinvest.my	+60183330007	\N	Malaysian	CIMB	7777888807	MY	\N	MYR	t	\N	2026-03-20 09:14:02.334053+00
d9000001-0000-0000-0000-000000000008	00000000-0000-0000-0000-000000000001	Haji Mohd Razali	mrazali@bumiinvest.my	+60193330008	\N	Malaysian	Bank Islam	8888999908	MY	\N	MYR	t	\N	2026-03-20 09:14:02.334053+00
d9000001-0000-0000-0000-000000000009	00000000-0000-0000-0000-000000000001	Koh Swee Lin	ksl@kslholdings.my	+60123330009	\N	Malaysian	Hong Leong	9999000009	MY	\N	MYR	t	\N	2026-03-20 09:14:02.334053+00
\.


--
-- Data for Name: staff; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.staff (id, branch_id, employee_code, full_name, legal_name, nationality, id_type, id_number, id_expiry, phone, whatsapp, email, password_hash, role, employment_type, hire_date, contract_start, contract_end, base_salary, salary_currency, commission_config, incentive_config, penalty_applies, agent_id, profile_photo, bank_name, bank_account, bank_country, swift_code, preferred_currency, notes, is_active, created_at, deleted_at, investor_branch_scope, last_login_at) FROM stdin;
cb9837c5-33f1-4c67-8b4a-85e4922258f3	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	\N	Velvet Lounge PJ Manager	\N	\N	\N	\N	\N	\N	\N	kl02@klproject.com	$2b$10$Wpkr6o8HUo8WRoiZpMFXruhFR0bGrWy2Pdl6UG84Z3zF5m.Qu8B4K	branch_manager	full_time	\N	\N	\N	\N	MYR	\N	\N	f	\N	\N	\N	\N	\N	\N	MYR	\N	t	2026-03-19 09:28:08.455079+00	\N	[]	\N
a909cc0a-af3c-46f4-9ae1-14c9e04a6c8c	d44ca290-a086-439d-9657-07fc5ebb689c	KL01-S003	Mei Lin	\N	\N	\N	\N	\N	+60123456789	\N	\N	\N	hostess	contract	2025-01-15	\N	\N	\N	MYR	\N	\N	t	\N	\N	\N	\N	\N	\N	MYR	\N	t	2026-03-19 11:10:53.851248+00	\N	[]	\N
2b905497-fb89-4294-9774-4a23a118e9dd	d44ca290-a086-439d-9657-07fc5ebb689c	\N	Demo Manager	\N	\N	\N	\N	\N	\N	\N	manager@klproject.com	$2b$12$arRkuZ7EbelOrMw3ZjaWZuVEwMhkvWP1puwNEhWS8lZJEbIw.yf.O	manager	full_time	\N	\N	\N	\N	MYR	\N	\N	f	\N	\N	\N	\N	\N	\N	MYR	\N	t	2026-03-20 09:01:18.046277+00	\N	[]	2026-03-20 09:02:11.992837+00
c4624bd2-a4b3-48da-ad7b-a174dec55668	d44ca290-a086-439d-9657-07fc5ebb689c	\N	Demo Driver	\N	\N	\N	\N	\N	\N	\N	driver@klproject.com	$2b$12$S5XuI5tb1gsn3ZL67vtIxOuiv5r.GgEuZEt.Q.iwA8ce09zBSGITC	driver	full_time	\N	\N	\N	\N	MYR	\N	\N	f	\N	\N	\N	\N	\N	\N	MYR	\N	t	2026-03-20 09:01:18.046277+00	\N	[]	2026-03-20 09:02:12.709652+00
1a1aa56c-0e3f-4a56-98ce-b39754873aa0	d44ca290-a086-439d-9657-07fc5ebb689c	\N	Demo Kitchen	\N	\N	\N	\N	\N	\N	\N	kitchen@klproject.com	$2b$12$fXezMLfq8AXieYfuovV/eO2cWzJpfAhHJGmRKPvHw.HggyfUsheA.	kitchen	full_time	\N	\N	\N	\N	MYR	\N	\N	f	\N	\N	\N	\N	\N	\N	MYR	\N	t	2026-03-20 09:01:18.046277+00	\N	[]	2026-03-20 09:02:13.065836+00
0e851835-0578-499c-9a13-3a68cd3b6177	d44ca290-a086-439d-9657-07fc5ebb689c	\N	Demo Hall Staff	\N	\N	\N	\N	\N	\N	\N	hall@klproject.com	$2b$12$/m0oHwc4uBF/Cuj1ChzpD.V33XRQhfrX6/mGo4RAgelwpF7apOq3W	hall	full_time	\N	\N	\N	\N	MYR	\N	\N	f	\N	\N	\N	\N	\N	\N	MYR	\N	t	2026-03-20 09:01:18.046277+00	\N	[]	2026-03-20 09:02:13.422669+00
bd2a4a52-70f4-4416-8931-d181d0158998	d44ca290-a086-439d-9657-07fc5ebb689c	\N	Demo General Staff	\N	\N	\N	\N	\N	\N	\N	general@klproject.com	$2b$12$fCf18lOA26Of8jfG3E0vXu87pRSI0J93lR7jFrexIl36iVxBM6L8y	general	full_time	\N	\N	\N	\N	MYR	\N	\N	f	\N	\N	\N	\N	\N	\N	MYR	\N	t	2026-03-20 09:01:18.046277+00	\N	[]	2026-03-20 09:02:13.780965+00
a1e57548-38dc-44be-9a0a-a06d535592ff	d44ca290-a086-439d-9657-07fc5ebb689c	\N	Demo Investor	\N	\N	\N	\N	\N	\N	\N	investor@klproject.com	$2b$12$vQlbtK3g7GmI.1He1/ySLOwW.qtkg77ghC/qsEEN1zUzjiyMsM.sq	investor	full_time	\N	\N	\N	\N	MYR	\N	\N	f	\N	\N	\N	\N	\N	\N	MYR	\N	t	2026-03-20 09:01:18.046277+00	\N	["d44ca290-a086-439d-9657-07fc5ebb689c", "6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c"]	2026-03-20 09:03:14.005614+00
1d0c0046-26ce-43ce-88ff-9aa743148424	d44ca290-a086-439d-9657-07fc5ebb689c	\N	Demo Hostess	\N	\N	\N	\N	\N	\N	\N	hostess@klproject.com	$2b$12$7ZcQFPi.FTfVT.1ic/I3r.LSY4EM6Y9wME9KUoeUant4YWmfL65AS	hostess	full_time	\N	\N	\N	\N	MYR	\N	\N	f	\N	\N	\N	\N	\N	\N	MYR	\N	t	2026-03-20 09:01:18.046277+00	\N	[]	2026-03-20 09:05:23.649705+00
baa4adfd-09ee-457e-bcd5-3fa7e1569616	d44ca290-a086-439d-9657-07fc5ebb689c	\N	Super Admin	\N	\N	\N	\N	\N	\N	\N	admin@klproject.com	$2b$10$lliUNyH1Hhwq76rFwzLj.eJhfR5KoH9Qd5bc6KXTnhHMbWxQ3wSJ6	super_admin	full_time	\N	\N	\N	\N	MYR	\N	\N	f	\N	\N	\N	\N	\N	\N	MYR	\N	t	2026-03-19 09:27:44.716581+00	\N	[]	2026-03-20 09:49:48.708094+00
3b9300ec-caa6-48b6-8ce2-6aa5fcf07363	d44ca290-a086-439d-9657-07fc5ebb689c	\N	Club Noir KL Manager	\N	\N	\N	\N	\N	\N	\N	kl01@klproject.com	$2b$10$Wpkr6o8HUo8WRoiZpMFXruhFR0bGrWy2Pdl6UG84Z3zF5m.Qu8B4K	branch_manager	full_time	\N	\N	\N	\N	MYR	\N	\N	f	\N	\N	\N	\N	\N	\N	MYR	\N	t	2026-03-19 09:28:08.417694+00	\N	[]	2026-03-20 08:40:03.719863+00
ce5ccfb6-aecd-41b3-9632-1aa3095e9436	d44ca290-a086-439d-9657-07fc5ebb689c	\N	Admin User	\N	\N	\N	\N	\N	\N	\N	admin2@klproject.com	$2b$12$WGrJLlxRRM2vwRePTn7b0uCgl7NEDWkhfV3LDdDn6kv1rs3xbn9zC	admin	full_time	\N	\N	\N	\N	MYR	\N	\N	f	\N	\N	\N	\N	\N	\N	MYR	\N	t	2026-03-20 09:01:18.046277+00	\N	[]	\N
\.


--
-- Data for Name: staff_schedules; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.staff_schedules (id, staff_id, branch_id, day_of_week, shift_start, shift_end, is_overnight, effective_from, effective_to, created_at) FROM stdin;
e0940156-a336-41f0-acba-2a3f09699ea4	a909cc0a-af3c-46f4-9ae1-14c9e04a6c8c	d44ca290-a086-439d-9657-07fc5ebb689c	5	18:00:00	02:00:00	t	2026-03-16	\N	2026-03-19 11:12:19.158459+00
55000001-0000-0000-0000-000000000001	1d0c0046-26ce-43ce-88ff-9aa743148424	d44ca290-a086-439d-9657-07fc5ebb689c	1	19:00:00	02:00:00	t	2026-01-01	\N	2026-03-20 09:15:27.139841+00
55000001-0000-0000-0000-000000000002	1d0c0046-26ce-43ce-88ff-9aa743148424	d44ca290-a086-439d-9657-07fc5ebb689c	3	19:00:00	02:00:00	t	2026-01-01	\N	2026-03-20 09:15:27.139841+00
55000001-0000-0000-0000-000000000003	1d0c0046-26ce-43ce-88ff-9aa743148424	d44ca290-a086-439d-9657-07fc5ebb689c	5	19:00:00	03:00:00	t	2026-01-01	\N	2026-03-20 09:15:27.139841+00
55000001-0000-0000-0000-000000000004	a909cc0a-af3c-46f4-9ae1-14c9e04a6c8c	d44ca290-a086-439d-9657-07fc5ebb689c	2	19:30:00	02:00:00	t	2026-01-01	\N	2026-03-20 09:15:27.139841+00
55000001-0000-0000-0000-000000000005	a909cc0a-af3c-46f4-9ae1-14c9e04a6c8c	d44ca290-a086-439d-9657-07fc5ebb689c	4	19:30:00	02:00:00	t	2026-01-01	\N	2026-03-20 09:15:27.139841+00
55000001-0000-0000-0000-000000000006	c4624bd2-a4b3-48da-ad7b-a174dec55668	d44ca290-a086-439d-9657-07fc5ebb689c	1	17:00:00	01:00:00	t	2026-01-01	\N	2026-03-20 09:15:27.139841+00
55000001-0000-0000-0000-000000000007	c4624bd2-a4b3-48da-ad7b-a174dec55668	d44ca290-a086-439d-9657-07fc5ebb689c	5	17:00:00	01:00:00	t	2026-01-01	\N	2026-03-20 09:15:27.139841+00
55000001-0000-0000-0000-000000000008	0e851835-0578-499c-9a13-3a68cd3b6177	d44ca290-a086-439d-9657-07fc5ebb689c	6	18:00:00	02:00:00	t	2026-01-01	\N	2026-03-20 09:15:27.139841+00
55000001-0000-0000-0000-000000000009	1a1aa56c-0e3f-4a56-98ce-b39754873aa0	d44ca290-a086-439d-9657-07fc5ebb689c	0	17:00:00	02:00:00	t	2026-01-01	\N	2026-03-20 09:15:27.139841+00
dc000001-0000-0000-0000-000000000001	bd2a4a52-70f4-4416-8931-d181d0158998	d44ca290-a086-439d-9657-07fc5ebb689c	5	20:00:00	02:00:00	t	2026-03-21	2026-04-30	2026-03-20 09:30:20.506119+00
\.


--
-- Data for Name: tables; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tables (id, org_id, branch_id, name, capacity, location, status, notes, created_at, updated_at) FROM stdin;
e7370cf9-47aa-4f4b-9d6c-9a2a6955d23a	00000000-0000-0000-0000-000000000001	d44ca290-a086-439d-9657-07fc5ebb689c	T-01	4	1층 홀	available	\N	2026-03-20 04:37:46.599041+00	2026-03-20 04:37:46.599041+00
e2c170eb-c414-4421-8296-6fbc7224a399	00000000-0000-0000-0000-000000000001	d44ca290-a086-439d-9657-07fc5ebb689c	T-02	6	1층 홀	occupied	\N	2026-03-20 04:37:46.599041+00	2026-03-20 04:37:46.599041+00
804aa2e4-4139-4859-9b7c-fe90b0739e17	00000000-0000-0000-0000-000000000001	d44ca290-a086-439d-9657-07fc5ebb689c	T-03	4	2층 VIP	available	\N	2026-03-20 04:37:46.599041+00	2026-03-20 04:37:46.599041+00
f92dae15-7262-4831-bbf7-d41274a1bc4b	00000000-0000-0000-0000-000000000001	d44ca290-a086-439d-9657-07fc5ebb689c	T-04	8	2층 VIP	reserved	\N	2026-03-20 04:37:46.599041+00	2026-03-20 04:37:46.599041+00
52d55715-6ff3-451d-b1f6-b5a7753683fe	00000000-0000-0000-0000-000000000001	d44ca290-a086-439d-9657-07fc5ebb689c	T-05	4	바 카운터	available	\N	2026-03-20 04:37:46.599041+00	2026-03-20 04:37:46.599041+00
5e174a29-047a-42f1-b5a3-917266d81039	00000000-0000-0000-0000-000000000001	d44ca290-a086-439d-9657-07fc5ebb689c	T-06	6	야외 테라스	maintenance	\N	2026-03-20 04:37:46.599041+00	2026-03-20 04:37:46.599041+00
0fce9742-7733-40a2-a13b-3991bd670d0c	00000000-0000-0000-0000-000000000001	d44ca290-a086-439d-9657-07fc5ebb689c	Table 7	10	Main Hall	available	\N	2026-03-20 09:12:03.531242+00	2026-03-20 09:12:03.531242+00
b154d433-2682-41f6-a582-10c0a9c2700e	00000000-0000-0000-0000-000000000001	d44ca290-a086-439d-9657-07fc5ebb689c	Table 8	8	Bar Area	available	\N	2026-03-20 09:12:03.531242+00	2026-03-20 09:12:03.531242+00
d850ab2f-33f7-457b-b4dc-8a2697e5eae7	00000000-0000-0000-0000-000000000001	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	Table 9	12	VIP Section	occupied	\N	2026-03-20 09:12:03.531242+00	2026-03-20 09:12:03.531242+00
7be7712e-7966-4cc0-b7fc-4b5c2e44df80	00000000-0000-0000-0000-000000000001	6b38c6a1-6b2b-4d17-8281-fbf0b6f1fb9c	Table 10	6	Lounge	available	\N	2026-03-20 09:12:03.531242+00	2026-03-20 09:12:03.531242+00
\.


--
-- Name: agent_commissions agent_commissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_commissions
    ADD CONSTRAINT agent_commissions_pkey PRIMARY KEY (id);


--
-- Name: agent_payouts agent_payouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_payouts
    ADD CONSTRAINT agent_payouts_pkey PRIMARY KEY (id);


--
-- Name: agents agents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agents
    ADD CONSTRAINT agents_pkey PRIMARY KEY (id);


--
-- Name: attendance attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_pkey PRIMARY KEY (id);


--
-- Name: attendance attendance_staff_id_work_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_staff_id_work_date_key UNIQUE (staff_id, work_date);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: availability_blocks availability_blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_blocks
    ADD CONSTRAINT availability_blocks_pkey PRIMARY KEY (id);


--
-- Name: branch_shareholders branch_shareholders_branch_id_shareholder_id_effective_from_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_shareholders
    ADD CONSTRAINT branch_shareholders_branch_id_shareholder_id_effective_from_key UNIQUE (branch_id, shareholder_id, effective_from);


--
-- Name: branch_shareholders branch_shareholders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_shareholders
    ADD CONSTRAINT branch_shareholders_pkey PRIMARY KEY (id);


--
-- Name: branches branches_internal_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_internal_code_key UNIQUE (internal_code);


--
-- Name: branches branches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_pkey PRIMARY KEY (id);


--
-- Name: customers customers_customer_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_customer_code_key UNIQUE (customer_code);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: driver_messages driver_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_messages
    ADD CONSTRAINT driver_messages_pkey PRIMARY KEY (id);


--
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


--
-- Name: folio_entries folio_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folio_entries
    ADD CONSTRAINT folio_entries_pkey PRIMARY KEY (id);


--
-- Name: fx_rates fx_rates_base_ccy_quote_ccy_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fx_rates
    ADD CONSTRAINT fx_rates_base_ccy_quote_ccy_key UNIQUE (base_ccy, quote_ccy);


--
-- Name: fx_rates fx_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fx_rates
    ADD CONSTRAINT fx_rates_pkey PRIMARY KEY (id);


--
-- Name: hostess_payouts hostess_payouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hostess_payouts
    ADD CONSTRAINT hostess_payouts_pkey PRIMARY KEY (id);


--
-- Name: hostess_sessions hostess_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hostess_sessions
    ADD CONSTRAINT hostess_sessions_pkey PRIMARY KEY (id);


--
-- Name: investor_export_logs investor_export_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investor_export_logs
    ADD CONSTRAINT investor_export_logs_pkey PRIMARY KEY (id);


--
-- Name: investor_reports investor_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investor_reports
    ADD CONSTRAINT investor_reports_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_invoice_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_invoice_no_key UNIQUE (invoice_no);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_order_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_order_no_key UNIQUE (order_no);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_slug_key UNIQUE (slug);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: product_groups product_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_groups
    ADD CONSTRAINT product_groups_pkey PRIMARY KEY (id);


--
-- Name: product_types product_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_types
    ADD CONSTRAINT product_types_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: profit_settlements profit_settlements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profit_settlements
    ADD CONSTRAINT profit_settlements_pkey PRIMARY KEY (id);


--
-- Name: receipts receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_pkey PRIMARY KEY (id);


--
-- Name: receipts receipts_receipt_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_receipt_no_key UNIQUE (receipt_no);


--
-- Name: reservation_hostesses reservation_hostesses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_hostesses
    ADD CONSTRAINT reservation_hostesses_pkey PRIMARY KEY (id);


--
-- Name: reservation_pickups reservation_pickups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_pickups
    ADD CONSTRAINT reservation_pickups_pkey PRIMARY KEY (id);


--
-- Name: reservations reservations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_pkey PRIMARY KEY (id);


--
-- Name: reservations reservations_reservation_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_reservation_no_key UNIQUE (reservation_no);


--
-- Name: rooms rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_pkey PRIMARY KEY (id);


--
-- Name: shareholders shareholders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shareholders
    ADD CONSTRAINT shareholders_pkey PRIMARY KEY (id);


--
-- Name: staff staff_employee_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_employee_code_key UNIQUE (employee_code);


--
-- Name: staff staff_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_pkey PRIMARY KEY (id);


--
-- Name: staff_schedules staff_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_schedules
    ADD CONSTRAINT staff_schedules_pkey PRIMARY KEY (id);


--
-- Name: tables tables_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tables
    ADD CONSTRAINT tables_pkey PRIMARY KEY (id);


--
-- Name: investor_reports uq_investor_report; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investor_reports
    ADD CONSTRAINT uq_investor_report UNIQUE (org_id, branch_id, period);


--
-- Name: idx_agent_commissions_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_commissions_agent ON public.agent_commissions USING btree (agent_id, status);


--
-- Name: idx_agent_commissions_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_commissions_session ON public.agent_commissions USING btree (hostess_session_id);


--
-- Name: idx_audit_changed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_changed_at ON public.audit_log USING btree (changed_at);


--
-- Name: idx_audit_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_entity ON public.audit_log USING btree (entity_type, entity_id);


--
-- Name: idx_avail_entity_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_avail_entity_time ON public.availability_blocks USING btree (entity_type, entity_id, start_dt, end_dt) WHERE (is_active = true);


--
-- Name: idx_driver_messages_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_driver_messages_branch ON public.driver_messages USING btree (branch_id);


--
-- Name: idx_driver_messages_driver; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_driver_messages_driver ON public.driver_messages USING btree (driver_id);


--
-- Name: idx_folio_reservation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_folio_reservation ON public.folio_entries USING btree (reservation_id);


--
-- Name: idx_hostess_payouts_hostess; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hostess_payouts_hostess ON public.hostess_payouts USING btree (hostess_id, period_from);


--
-- Name: idx_hostess_sessions_hostess; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hostess_sessions_hostess ON public.hostess_sessions USING btree (hostess_id);


--
-- Name: idx_hostess_sessions_reservation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hostess_sessions_reservation ON public.hostess_sessions USING btree (reservation_id);


--
-- Name: idx_investor_export_logs_staff; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_investor_export_logs_staff ON public.investor_export_logs USING btree (staff_id);


--
-- Name: idx_investor_reports_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_investor_reports_branch ON public.investor_reports USING btree (branch_id, period);


--
-- Name: idx_investor_reports_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_investor_reports_period ON public.investor_reports USING btree (org_id, period);


--
-- Name: idx_invoices_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_branch ON public.invoices USING btree (branch_id, issued_at);


--
-- Name: idx_invoices_reservation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_reservation ON public.invoices USING btree (reservation_id);


--
-- Name: idx_orders_reservation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_reservation ON public.orders USING btree (reservation_id);


--
-- Name: idx_payments_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_branch ON public.payments USING btree (branch_id, paid_at);


--
-- Name: idx_payments_invoice; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_invoice ON public.payments USING btree (invoice_id);


--
-- Name: idx_receipts_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_receipts_branch ON public.receipts USING btree (branch_id, payment_at);


--
-- Name: idx_receipts_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_receipts_order ON public.receipts USING btree (order_id);


--
-- Name: idx_reservations_branch_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservations_branch_date ON public.reservations USING btree (branch_id, reservation_date);


--
-- Name: idx_reservations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reservations_status ON public.reservations USING btree (status);


--
-- Name: idx_rooms_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rooms_branch ON public.rooms USING btree (branch_id);


--
-- Name: idx_staff_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staff_branch ON public.staff USING btree (branch_id);


--
-- Name: idx_staff_investor_scope; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staff_investor_scope ON public.staff USING gin (investor_branch_scope);


--
-- Name: idx_staff_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staff_role ON public.staff USING btree (role);


--
-- Name: attendance trg_calc_hours; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_calc_hours BEFORE INSERT OR UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.calc_hours_worked();


--
-- Name: agent_commissions agent_commissions_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_commissions
    ADD CONSTRAINT agent_commissions_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id);


--
-- Name: agent_commissions agent_commissions_hostess_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_commissions
    ADD CONSTRAINT agent_commissions_hostess_id_fkey FOREIGN KEY (hostess_id) REFERENCES public.staff(id);


--
-- Name: agent_commissions agent_commissions_hostess_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_commissions
    ADD CONSTRAINT agent_commissions_hostess_session_id_fkey FOREIGN KEY (hostess_session_id) REFERENCES public.hostess_sessions(id);


--
-- Name: agent_commissions agent_commissions_reservation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_commissions
    ADD CONSTRAINT agent_commissions_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES public.reservations(id);


--
-- Name: agent_commissions agent_commissions_settled_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_commissions
    ADD CONSTRAINT agent_commissions_settled_by_fkey FOREIGN KEY (settled_by) REFERENCES public.staff(id);


--
-- Name: agent_payouts agent_payouts_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_payouts
    ADD CONSTRAINT agent_payouts_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id);


--
-- Name: agent_payouts agent_payouts_paid_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_payouts
    ADD CONSTRAINT agent_payouts_paid_by_fkey FOREIGN KEY (paid_by) REFERENCES public.staff(id);


--
-- Name: agents agents_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agents
    ADD CONSTRAINT agents_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: attendance attendance_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.staff(id);


--
-- Name: attendance attendance_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: attendance attendance_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id);


--
-- Name: audit_log audit_log_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.staff(id);


--
-- Name: availability_blocks availability_blocks_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_blocks
    ADD CONSTRAINT availability_blocks_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: availability_blocks availability_blocks_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_blocks
    ADD CONSTRAINT availability_blocks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff(id);


--
-- Name: availability_blocks availability_blocks_reservation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.availability_blocks
    ADD CONSTRAINT availability_blocks_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES public.reservations(id);


--
-- Name: branch_shareholders branch_shareholders_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_shareholders
    ADD CONSTRAINT branch_shareholders_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: branch_shareholders branch_shareholders_shareholder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_shareholders
    ADD CONSTRAINT branch_shareholders_shareholder_id_fkey FOREIGN KEY (shareholder_id) REFERENCES public.shareholders(id);


--
-- Name: branches branches_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: customers customers_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: customers customers_referral_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_referral_agent_id_fkey FOREIGN KEY (referral_agent_id) REFERENCES public.agents(id);


--
-- Name: driver_messages driver_messages_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_messages
    ADD CONSTRAINT driver_messages_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: driver_messages driver_messages_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_messages
    ADD CONSTRAINT driver_messages_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.staff(id);


--
-- Name: driver_messages driver_messages_pickup_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_messages
    ADD CONSTRAINT driver_messages_pickup_id_fkey FOREIGN KEY (pickup_id) REFERENCES public.reservation_pickups(id);


--
-- Name: expenses expenses_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.staff(id);


--
-- Name: expenses expenses_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: expenses expenses_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff(id);


--
-- Name: folio_entries folio_entries_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folio_entries
    ADD CONSTRAINT folio_entries_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: folio_entries folio_entries_posted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folio_entries
    ADD CONSTRAINT folio_entries_posted_by_fkey FOREIGN KEY (posted_by) REFERENCES public.staff(id);


--
-- Name: folio_entries folio_entries_reservation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folio_entries
    ADD CONSTRAINT folio_entries_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES public.reservations(id);


--
-- Name: folio_entries folio_entries_voided_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.folio_entries
    ADD CONSTRAINT folio_entries_voided_by_fkey FOREIGN KEY (voided_by) REFERENCES public.staff(id);


--
-- Name: hostess_payouts hostess_payouts_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hostess_payouts
    ADD CONSTRAINT hostess_payouts_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: hostess_payouts hostess_payouts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hostess_payouts
    ADD CONSTRAINT hostess_payouts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff(id);


--
-- Name: hostess_payouts hostess_payouts_hostess_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hostess_payouts
    ADD CONSTRAINT hostess_payouts_hostess_id_fkey FOREIGN KEY (hostess_id) REFERENCES public.staff(id);


--
-- Name: hostess_payouts hostess_payouts_paid_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hostess_payouts
    ADD CONSTRAINT hostess_payouts_paid_by_fkey FOREIGN KEY (paid_by) REFERENCES public.staff(id);


--
-- Name: hostess_sessions hostess_sessions_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hostess_sessions
    ADD CONSTRAINT hostess_sessions_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id);


--
-- Name: hostess_sessions hostess_sessions_attendance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hostess_sessions
    ADD CONSTRAINT hostess_sessions_attendance_id_fkey FOREIGN KEY (attendance_id) REFERENCES public.attendance(id);


--
-- Name: hostess_sessions hostess_sessions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hostess_sessions
    ADD CONSTRAINT hostess_sessions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff(id);


--
-- Name: hostess_sessions hostess_sessions_hostess_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hostess_sessions
    ADD CONSTRAINT hostess_sessions_hostess_id_fkey FOREIGN KEY (hostess_id) REFERENCES public.staff(id);


--
-- Name: hostess_sessions hostess_sessions_reservation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hostess_sessions
    ADD CONSTRAINT hostess_sessions_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES public.reservations(id);


--
-- Name: investor_export_logs investor_export_logs_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investor_export_logs
    ADD CONSTRAINT investor_export_logs_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.investor_reports(id);


--
-- Name: investor_export_logs investor_export_logs_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investor_export_logs
    ADD CONSTRAINT investor_export_logs_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id);


--
-- Name: investor_reports investor_reports_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investor_reports
    ADD CONSTRAINT investor_reports_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: investor_reports investor_reports_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investor_reports
    ADD CONSTRAINT investor_reports_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: invoices invoices_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: invoices invoices_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: invoices invoices_issued_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_issued_by_fkey FOREIGN KEY (issued_by) REFERENCES public.staff(id);


--
-- Name: invoices invoices_reservation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES public.reservations(id);


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: order_items order_items_staff_ref_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_staff_ref_id_fkey FOREIGN KEY (staff_ref_id) REFERENCES public.staff(id);


--
-- Name: orders orders_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: orders orders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff(id);


--
-- Name: orders orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: orders orders_reservation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES public.reservations(id);


--
-- Name: payments payments_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: payments payments_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);


--
-- Name: payments payments_received_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_received_by_fkey FOREIGN KEY (received_by) REFERENCES public.staff(id);


--
-- Name: payments payments_reservation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES public.reservations(id);


--
-- Name: payments payments_voided_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_voided_by_fkey FOREIGN KEY (voided_by) REFERENCES public.staff(id);


--
-- Name: product_groups product_groups_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_groups
    ADD CONSTRAINT product_groups_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: product_types product_types_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_types
    ADD CONSTRAINT product_types_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.product_groups(id);


--
-- Name: products products_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: products products_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_type_id_fkey FOREIGN KEY (type_id) REFERENCES public.product_types(id);


--
-- Name: profit_settlements profit_settlements_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profit_settlements
    ADD CONSTRAINT profit_settlements_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.staff(id);


--
-- Name: profit_settlements profit_settlements_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profit_settlements
    ADD CONSTRAINT profit_settlements_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: profit_settlements profit_settlements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profit_settlements
    ADD CONSTRAINT profit_settlements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff(id);


--
-- Name: profit_settlements profit_settlements_shareholder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profit_settlements
    ADD CONSTRAINT profit_settlements_shareholder_id_fkey FOREIGN KEY (shareholder_id) REFERENCES public.shareholders(id);


--
-- Name: receipts receipts_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: receipts receipts_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: receipts receipts_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);


--
-- Name: receipts receipts_issued_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_issued_by_fkey FOREIGN KEY (issued_by) REFERENCES public.staff(id);


--
-- Name: receipts receipts_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: receipts receipts_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id);


--
-- Name: reservation_hostesses reservation_hostesses_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_hostesses
    ADD CONSTRAINT reservation_hostesses_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.staff(id);


--
-- Name: reservation_hostesses reservation_hostesses_hostess_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_hostesses
    ADD CONSTRAINT reservation_hostesses_hostess_id_fkey FOREIGN KEY (hostess_id) REFERENCES public.staff(id);


--
-- Name: reservation_hostesses reservation_hostesses_reservation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_hostesses
    ADD CONSTRAINT reservation_hostesses_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES public.reservations(id);


--
-- Name: reservation_pickups reservation_pickups_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_pickups
    ADD CONSTRAINT reservation_pickups_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.staff(id);


--
-- Name: reservation_pickups reservation_pickups_reservation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservation_pickups
    ADD CONSTRAINT reservation_pickups_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES public.reservations(id);


--
-- Name: reservations reservations_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id);


--
-- Name: reservations reservations_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.staff(id);


--
-- Name: reservations reservations_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: reservations reservations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff(id);


--
-- Name: reservations reservations_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: reservations reservations_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id);


--
-- Name: rooms rooms_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: shareholders shareholders_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shareholders
    ADD CONSTRAINT shareholders_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: staff staff_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id);


--
-- Name: staff staff_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: staff_schedules staff_schedules_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_schedules
    ADD CONSTRAINT staff_schedules_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: staff_schedules staff_schedules_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_schedules
    ADD CONSTRAINT staff_schedules_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id);


--
-- PostgreSQL database dump complete
--

\unrestrict cmZqDqhTriq5cBowKdelTVF5yqckRdwxFlUUMUF3U7eGXdI9AE1IspIxYktKIoq

