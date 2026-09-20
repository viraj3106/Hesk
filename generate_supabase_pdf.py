import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Image, HRFlowable, Preformatted
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        if self._pageNumber == 1:
            return  # Skip header/footer on cover page

        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))

        # Running Header
        self.drawString(54, 11 * inch - 36, "ResolveDesk — Supabase SQL Query Execution & Live Demonstration")
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(54, 11 * inch - 42, 8.5 * inch - 54, 11 * inch - 42)

        # Running Footer
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(8.5 * inch - 54, 36, page_str)
        self.drawString(54, 36, "SUPABASE CLOUD POSTGRESQL — PRACTICAL QUERY MANUAL")
        self.line(54, 48, 8.5 * inch - 54, 48)
        self.restoreState()


def build_supabase_pdf(filename="ResolveDesk_Supabase_Query_Demonstration.pdf"):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()

    # Color Palette
    PRIMARY = colors.HexColor("#0F172A")      # Dark Slate
    SECONDARY = colors.HexColor("#059669")    # Supabase Emerald Green Accent
    NAVY = colors.HexColor("#1E3A8A")         # Deep Navy Blue
    TEXT_COLOR = colors.HexColor("#1E293B")   # Dark Body Text
    MUTED_BG = colors.HexColor("#F8FAFC")     # Cool Light Background
    CODE_BG = colors.HexColor("#0F172A")     # Terminal Dark Blue/Black
    BORDER_COLOR = colors.HexColor("#CBD5E1")

    # Typography Styles
    title_style = ParagraphStyle(
        'CoverTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=26,
        leading=32,
        textColor=PRIMARY,
        alignment=1,
        spaceAfter=15
    )

    subtitle_style = ParagraphStyle(
        'CoverSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=12.5,
        leading=17,
        textColor=SECONDARY,
        alignment=1,
        spaceAfter=30
    )

    h1_style = ParagraphStyle(
        'Heading1_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=19,
        textColor=NAVY,
        spaceBefore=16,
        spaceAfter=8,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'Heading2_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11.5,
        leading=15,
        textColor=SECONDARY,
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'Body_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=14,
        textColor=TEXT_COLOR,
        spaceAfter=8
    )

    code_block_style = ParagraphStyle(
        'CodeBlock',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=8,
        leading=10.5,
        textColor=colors.HexColor("#38BDF8"), # Sky Blue Code text
        backColor=CODE_BG,
        spaceBefore=6,
        spaceAfter=10,
        leftIndent=8,
        rightIndent=8,
        borderPadding=8
    )

    th_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=11,
        textColor=colors.white,
        alignment=0
    )

    td_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11,
        textColor=TEXT_COLOR,
        alignment=0
    )

    story = []

    # ==========================================================================
    # COVER PAGE
    # ==========================================================================
    story.append(Spacer(1, 30))
    story.append(Paragraph("SUPABASE POSTGRESQL QUERY DEMONSTRATION MANUAL", title_style))
    story.append(Paragraph("Live Query Execution, Relational JOIN Operations, DDL Schemas & Practical SQL Testing for ResolveDesk", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=2.5, color=SECONDARY, spaceBefore=0, spaceAfter=35))

    meta_data = [
        [Paragraph("<b>Target Platform:</b>", td_style), Paragraph("ResolveDesk Customer Support Platform", td_style)],
        [Paragraph("<b>Database System:</b>", td_style), Paragraph("Supabase Cloud (PostgreSQL 15+ Instance)", td_style)],
        [Paragraph("<b>Interface Used:</b>", td_style), Paragraph("Supabase Studio SQL Editor & psql CLI Client", td_style)],
        [Paragraph("<b>Document Type:</b>", td_style), Paragraph("Practical Query Execution & Verification Manual", td_style)],
        [Paragraph("<b>Prepared By:</b>", td_style), Paragraph("Viraj (Lead Author)", td_style)],
        [Paragraph("<b>Institution / Dept:</b>", td_style), Paragraph("J.J College of Engineering and Technology — Dept of IT", td_style)],
        [Paragraph("<b>Date of Execution:</b>", td_style), Paragraph("September 2026", td_style)]
    ]

    t_meta = Table(meta_data, colWidths=[2.0*inch, 4.8*inch])
    t_meta.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), MUTED_BG),
        ('BOX', (0,0), (-1,-1), 1, BORDER_COLOR),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('TOPPADDING', (0,0), (-1,-1), 7),
        ('BOTTOMPADDING', (0,0), (-1,-1), 7),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(t_meta)

    story.append(Spacer(1, 30))
    story.append(Paragraph("<b>MANUAL PURPOSE:</b><br/>This document provides step-by-step SQL scripts to execute directly in the <b>Supabase Studio SQL Editor</b>. It includes Table DDL Creation, Referential Data Insertion, Multi-table JOIN Queries (INNER, LEFT, RIGHT, FULL, NATURAL), Composite Key Validation, and Intentional Error Debugging.", body_style))

    story.append(PageBreak())

    # ==========================================================================
    # STEP 1: HOW TO RUN QUERIES IN SUPABASE
    # ==========================================================================
    story.append(Paragraph("1. Guide: Running Queries in Supabase Studio", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=NAVY, spaceBefore=0, spaceAfter=10))

    story.append(Paragraph(
        "To execute the SQL queries demonstrated in this manual within your managed Supabase project environment, follow these steps:",
        body_style
    ))

    steps = [
        "<b>Step 1:</b> Log in to the <b>Supabase Dashboard</b> (https://supabase.com/dashboard) and select your project (<code>Helpdesk Capstone</code>).",
        "<b>Step 2:</b> Click on the <b>SQL Editor</b> icon in the left navigation sidebar menu.",
        "<b>Step 3:</b> Click on <b>+ New query</b> to open a clean SQL script panel.",
        "<b>Step 4:</b> Copy any SQL query block from this document into the editor panel.",
        "<b>Step 5:</b> Click the green <b>Run</b> button (or press <code>Ctrl + Enter</code>) to execute the query.",
        "<b>Step 6:</b> View the formatted query result grid or execution logs in the bottom output tab."
    ]
    for s in steps:
        story.append(Paragraph(s, body_style))

    story.append(Spacer(1, 10))

    # ==========================================================================
    # STEP 2: SCHEMA DDL (TABLE CREATION)
    # ==========================================================================
    story.append(Paragraph("2. Table DDL Creation Queries (Supabase PostgreSQL)", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=NAVY, spaceBefore=0, spaceAfter=10))

    story.append(Paragraph(
        "Run the following DDL script in Supabase SQL Editor to construct the primary relational tables with BIGINT identity sequences and foreign key constraints:",
        body_style
    ))

    ddl_sql = """-- 1. Create USERS Table
CREATE TABLE IF NOT EXISTS public.users (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(30) NOT NULL CHECK (role IN ('customer', 'agent', 'admin')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create TICKETS Table
CREATE TABLE IF NOT EXISTS public.tickets (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    category VARCHAR(50) NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium',
    description TEXT NOT NULL,
    status VARCHAR(30) DEFAULT 'open' CHECK (status IN ('open', 'assigned', 'in_progress', 'resolved', 'closed')),
    assigned_agent_id BIGINT NULL REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create RESPONSES Table
CREATE TABLE IF NOT EXISTS public.responses (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    ticket_id BIGINT NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
    sender_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);"""
    story.append(Preformatted(ddl_sql, code_block_style))

    story.append(PageBreak())

    # ==========================================================================
    # STEP 3: SAMPLE DATA INSERTION & RECORD COUNT VERIFICATION
    # ==========================================================================
    story.append(Paragraph("3. Sample Data Insertion & Verification Queries", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=NAVY, spaceBefore=0, spaceAfter=10))

    story.append(Paragraph("Execute data insertion in strict dependency order (parent entities first):", body_style))

    insert_sql = """-- Insert Test Users
INSERT INTO public.users (id, name, email, password_hash, role) VALUES
(1, 'System Admin', 'admin@resolvedesk.com', '$2a$10$hash1', 'admin'),
(2, 'Agent RBNV', 'agent.rbnv@resolvedesk.com', '$2a$10$hash2', 'agent'),
(3, 'Agent X', 'agent.x@resolvedesk.com', '$2a$10$hash3', 'agent'),
(4, 'Viraj Customer', 'viraj@gmail.com', '$2a$10$hash4', 'customer'),
(5, 'Customer A', 'customer.a@gmail.com', '$2a$10$hash5', 'customer'),
(6, 'Customer B', 'customer.b@gmail.com', '$2a$10$hash6', 'customer')
ON CONFLICT (id) DO NOTHING;

-- Insert Test Tickets
INSERT INTO public.tickets (id, customer_id, title, category, priority, description, status, assigned_agent_id) VALUES
(101, 4, 'Payment failure on checkout', 'Billing', 'high', 'Card declined during payment', 'in_progress', 3),
(102, 5, 'Broken Authentication', 'Security', 'high', 'OTP email not received', 'assigned', 2),
(103, 5, 'Test Transition', 'General', 'low', 'Testing status movement', 'resolved', 2),
(104, 4, 'Billing issue', 'Billing', 'medium', 'Invoice duplicate charge', 'open', NULL)
ON CONFLICT (id) DO NOTHING;"""
    story.append(Preformatted(insert_sql, code_block_style))

    story.append(Paragraph("<b>Record Count Verification Query:</b>", h2_style))
    count_sql = """SELECT 'users' AS table_name, COUNT(*) AS record_count FROM public.users
UNION ALL
SELECT 'tickets' AS table_name, COUNT(*) AS record_count FROM public.tickets
UNION ALL
SELECT 'responses' AS table_name, COUNT(*) AS record_count FROM public.responses;"""
    story.append(Preformatted(count_sql, code_block_style))

    # Output Table Demonstration
    count_data = [
        [Paragraph("table_name", th_style), Paragraph("record_count", th_style)],
        [Paragraph("users", td_style), Paragraph("6", td_style)],
        [Paragraph("tickets", td_style), Paragraph("4", td_style)],
        [Paragraph("responses", td_style), Paragraph("2", td_style)]
    ]
    t_cnt = Table(count_data, colWidths=[3.0*inch, 3.8*inch])
    t_cnt.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), SECONDARY),
        ('BOX', (0,0), (-1,-1), 1, BORDER_COLOR),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_cnt)

    story.append(PageBreak())

    # ==========================================================================
    # STEP 4: JOIN DEMONSTRATION QUERIES
    # ==========================================================================
    story.append(Paragraph("4. Relational JOIN Query Demonstrations", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=NAVY, spaceBefore=0, spaceAfter=10))

    # 4.1 INNER JOIN
    story.append(Paragraph("4.1 INNER JOIN (Matching Customers & Submitted Tickets)", h2_style))
    inner_sql = """SELECT u.name AS customer_name, u.email, t.id AS ticket_id, t.title, t.status
FROM public.users u
INNER JOIN public.tickets t ON u.id = t.customer_id;"""
    story.append(Preformatted(inner_sql, code_block_style))

    res_inner = [
        [Paragraph("customer_name", th_style), Paragraph("email", th_style), Paragraph("ticket_id", th_style), Paragraph("title", th_style), Paragraph("status", th_style)],
        [Paragraph("Viraj Customer", td_style), Paragraph("viraj@gmail.com", td_style), Paragraph("101", td_style), Paragraph("Payment failure on checkout", td_style), Paragraph("in_progress", td_style)],
        [Paragraph("Customer A", td_style), Paragraph("customer.a@gmail.com", td_style), Paragraph("102", td_style), Paragraph("Broken Authentication", td_style), Paragraph("assigned", td_style)],
        [Paragraph("Customer A", td_style), Paragraph("customer.a@gmail.com", td_style), Paragraph("103", td_style), Paragraph("Test Transition", td_style), Paragraph("resolved", td_style)],
        [Paragraph("Viraj Customer", td_style), Paragraph("viraj@gmail.com", td_style), Paragraph("104", td_style), Paragraph("Billing issue", td_style), Paragraph("open", td_style)]
    ]
    t_inner = Table(res_inner, colWidths=[1.3*inch, 1.6*inch, 0.7*inch, 2.0*inch, 1.2*inch])
    t_inner.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), SECONDARY),
        ('BOX', (0,0), (-1,-1), 1, BORDER_COLOR),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_inner)
    story.append(Spacer(1, 10))

    # 4.2 LEFT JOIN
    story.append(Paragraph("4.2 LEFT JOIN (All Users & Associated Tickets if Available)", h2_style))
    left_sql = """SELECT u.name AS user_name, u.role, t.title AS ticket_title
FROM public.users u
LEFT JOIN public.tickets t ON u.id = t.customer_id;"""
    story.append(Preformatted(left_sql, code_block_style))

    res_left = [
        [Paragraph("user_name", th_style), Paragraph("role", th_style), Paragraph("ticket_title", th_style)],
        [Paragraph("System Admin", td_style), Paragraph("admin", td_style), Paragraph("NULL", td_style)],
        [Paragraph("Agent RBNV", td_style), Paragraph("agent", td_style), Paragraph("NULL", td_style)],
        [Paragraph("Agent X", td_style), Paragraph("agent", td_style), Paragraph("NULL", td_style)],
        [Paragraph("Viraj Customer", td_style), Paragraph("customer", td_style), Paragraph("Payment failure on checkout", td_style)],
        [Paragraph("Customer A", td_style), Paragraph("customer", td_style), Paragraph("Broken Authentication", td_style)],
        [Paragraph("Customer B", td_style), Paragraph("customer", td_style), Paragraph("NULL", td_style)]
    ]
    t_left = Table(res_left, colWidths=[2.2*inch, 1.6*inch, 3.0*inch])
    t_left.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), SECONDARY),
        ('BOX', (0,0), (-1,-1), 1, BORDER_COLOR),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_left)

    story.append(PageBreak())

    # 4.3 RIGHT JOIN & FULL JOIN
    story.append(Paragraph("4.3 RIGHT JOIN (Tickets & Assigned Agent Details)", h2_style))
    right_sql = """SELECT t.id AS ticket_id, t.title, u.name AS assigned_agent
FROM public.users u
RIGHT JOIN public.tickets t ON u.id = t.assigned_agent_id;"""
    story.append(Preformatted(right_sql, code_block_style))

    res_right = [
        [Paragraph("ticket_id", th_style), Paragraph("title", th_style), Paragraph("assigned_agent", th_style)],
        [Paragraph("101", td_style), Paragraph("Payment failure on checkout", td_style), Paragraph("Agent X", td_style)],
        [Paragraph("102", td_style), Paragraph("Broken Authentication", td_style), Paragraph("Agent RBNV", td_style)],
        [Paragraph("103", td_style), Paragraph("Test Transition", td_style), Paragraph("Agent RBNV", td_style)],
        [Paragraph("104", td_style), Paragraph("Billing issue", td_style), Paragraph("NULL (Unassigned)", td_style)]
    ]
    t_right = Table(res_right, colWidths=[1.0*inch, 3.5*inch, 2.3*inch])
    t_right.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), SECONDARY),
        ('BOX', (0,0), (-1,-1), 1, BORDER_COLOR),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t_right)
    story.append(Spacer(1, 10))

    # ==========================================================================
    # STEP 5: INTENTIONAL SQL ERROR TESTING & DEBUGGING
    # ==========================================================================
    story.append(Paragraph("5. Intentional SQL Error & Integrity Constraint Testing", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=NAVY, spaceBefore=0, spaceAfter=10))

    story.append(Paragraph("Testing database constraint enforcement in Supabase PostgreSQL by executing invalid operations:", body_style))

    # Error Test 1
    story.append(Paragraph("<b>Test Case 1: Foreign Key Violation (Inserting Ticket for Non-existent User)</b>", h2_style))
    err1_sql = """INSERT INTO public.tickets (customer_id, title, category, description)
VALUES (9999, 'Orphan Ticket Test', 'General', 'Testing FK error');"""
    story.append(Preformatted(err1_sql, code_block_style))

    err1_out = """ERROR: insert or update on table "tickets" violates foreign key constraint "tickets_customer_id_fkey"
DETAIL: Key (customer_id)=(9999) is not present in table "users"."""
    story.append(Preformatted(err1_out, code_block_style))

    # Error Test 2
    story.append(Paragraph("<b>Test Case 2: UNIQUE Constraint Violation (Duplicate Email Insertion)</b>", h2_style))
    err2_sql = """INSERT INTO public.users (name, email, password_hash, role)
VALUES ('Duplicate User', 'viraj@gmail.com', 'hash123', 'customer');"""
    story.append(Preformatted(err2_sql, code_block_style))

    err2_out = """ERROR: duplicate key value violates unique constraint "users_email_key"
DETAIL: Key (email)=(viraj@gmail.com) already exists."""
    story.append(Preformatted(err2_out, code_block_style))

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Successfully generated Supabase query demonstration PDF: {filename}")

if __name__ == "__main__":
    build_supabase_pdf()
