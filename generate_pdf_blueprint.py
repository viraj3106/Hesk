import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Image, KeepTogether, HRFlowable
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
        self.drawString(54, 11 * inch - 36, "ResolveDesk Customer Support Platform — Comprehensive Blueprint")
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(54, 11 * inch - 42, 8.5 * inch - 54, 11 * inch - 42)

        # Running Footer
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(8.5 * inch - 54, 36, page_str)
        self.drawString(54, 36, "CONFIDENTIAL & PROPRIETARY — RESOLVEDESK ARCHITECTURE")
        self.line(54, 48, 8.5 * inch - 54, 48)
        self.restoreState()


def build_pdf(filename="ResolveDesk_Comprehensive_Blueprint.pdf"):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()

    # Custom Color Palette
    PRIMARY = colors.HexColor("#0F172A")     # Dark Slate
    SECONDARY = colors.HexColor("#1E3A8A")   # Deep Navy Blue
    ACCENT = colors.HexColor("#0284C7")      # Bright Sky Blue
    TEXT_COLOR = colors.HexColor("#1E293B")  # Dark Charcoal Body Text
    MUTED_BG = colors.HexColor("#F8FAFC")    # Cool Light Background
    BORDER_COLOR = colors.HexColor("#CBD5E1")

    # Typography Styles
    title_style = ParagraphStyle(
        'CoverTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=28,
        leading=34,
        textColor=PRIMARY,
        alignment=1, # Center
        spaceAfter=15
    )

    subtitle_style = ParagraphStyle(
        'CoverSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=13,
        leading=18,
        textColor=ACCENT,
        alignment=1,
        spaceAfter=30
    )

    h1_style = ParagraphStyle(
        'Heading1_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=16,
        leading=20,
        textColor=SECONDARY,
        spaceBefore=16,
        spaceAfter=8,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'Heading2_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=ACCENT,
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'Body_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14.5,
        textColor=TEXT_COLOR,
        spaceAfter=8
    )

    bullet_style = ParagraphStyle(
        'Bullet_Custom',
        parent=body_style,
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=4
    )

    code_style = ParagraphStyle(
        'Code_Custom',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#F8FAFC"),
        backColor=colors.HexColor("#0F172A"),
        spaceBefore=6,
        spaceAfter=10,
        leftIndent=10,
        rightIndent=10,
        borderPadding=8
    )

    th_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9.5,
        leading=12,
        textColor=colors.white,
        alignment=0
    )

    td_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=TEXT_COLOR,
        alignment=0
    )

    story = []

    # ==========================================================================
    # COVER PAGE
    # ==========================================================================
    story.append(Spacer(1, 40))
    story.append(Paragraph("RESOLVEDESK PLATFORM", title_style))
    story.append(Paragraph("End-to-End System Architecture, API Specifications, State Machine & Database Blueprint", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=2, color=ACCENT, spaceBefore=0, spaceAfter=40))

    meta_data = [
        [Paragraph("<b>Project Name:</b>", td_style), Paragraph("ResolveDesk Customer Support & Ticketing System", td_style)],
        [Paragraph("<b>Backend Tech:</b>", td_style), Paragraph("Java Spring Boot REST API & Supabase PostgREST Engine", td_style)],
        [Paragraph("<b>Frontend Tech:</b>", td_style), Paragraph("Vanilla JS, HTML5, Modern CSS Design Tokens", td_style)],
        [Paragraph("<b>Database System:</b>", td_style), Paragraph("Supabase PostgreSQL 15+ (Relational Schema)", td_style)],
        [Paragraph("<b>Prepared By:</b>", td_style), Paragraph("Viraj (Lead Author & Systems Architect)", td_style)],
        [Paragraph("<b>Academic Year / Dept:</b>", td_style), Paragraph("Year III — Dept of Information Technology", td_style)],
        [Paragraph("<b>Institution:</b>", td_style), Paragraph("J.J College of Engineering and Technology", td_style)],
        [Paragraph("<b>Date of Release:</b>", td_style), Paragraph("September 2026", td_style)]
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

    story.append(Spacer(1, 40))
    story.append(Paragraph("<b>EXECUTIVE SUMMARY:</b><br/>ResolveDesk eliminates ticket ownership ambiguity, enforces server-validated ticket state transitions, manages priority SLA windows, and maintains real-time conversation threads between customers and support agents.", body_style))

    story.append(PageBreak())

    # ==========================================================================
    # SECTION 1: SYSTEM OVERVIEW & ARCHITECTURE
    # ==========================================================================
    story.append(Paragraph("1. System Overview & Architecture", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=SECONDARY, spaceBefore=0, spaceAfter=10))

    story.append(Paragraph(
        "ResolveDesk is designed as a decoupled multi-tier enterprise architecture. "
        "The frontend client connects via HTTPS to a lightweight reverse proxy engine (Express/Node.js), "
        "which routes REST API calls to a high-performance Java Spring Boot backend service. "
        "The backend implements strict Role-Based Access Control (RBAC) using JSON Web Tokens (JWT) "
        "and communicates with a Supabase PostgreSQL database using RestTemplate PostgREST integration.",
        body_style
    ))

    # Architectural Layers Table
    arch_data = [
        [Paragraph("Architectural Layer", th_style), Paragraph("Technology Stack", th_style), Paragraph("Core Responsibilities", th_style)],
        [Paragraph("<b>Presentation Client</b>", td_style), Paragraph("HTML5, Vanilla JS, CSS Glassmorphism", td_style), Paragraph("Role-specific portals (Customer Dashboard, Agent Queue, Admin Panel), interactive ticket threads, OTP reset UI.", td_style)],
        [Paragraph("<b>API Gateway / Proxy</b>", td_style), Paragraph("Express.js / Node.js Proxy", td_style), Paragraph("Exposes port 3000, proxies REST calls to Spring Boot, serves client static web assets.", td_style)],
        [Paragraph("<b>Backend Services</b>", td_style), Paragraph("Java Spring Boot (Port 8080)", td_style), Paragraph("JWT verification, role authorization, state transition state machine validation, business logic.", td_style)],
        [Paragraph("<b>Database Layer</b>", td_style), Paragraph("Supabase PostgreSQL 15+", td_style), Paragraph("Relational storage, foreign key constraints, sequence identity PKs, triggers & status history logging.", td_style)]
    ]
    t_arch = Table(arch_data, colWidths=[1.8*inch, 2.0*inch, 3.0*inch])
    t_arch.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), SECONDARY),
        ('BOX', (0,0), (-1,-1), 1, BORDER_COLOR),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_arch)
    story.append(Spacer(1, 15))

    # ==========================================================================
    # SECTION 2: LEGAL TICKET STATE MACHINE WORKFLOW
    # ==========================================================================
    story.append(Paragraph("2. Ticket State Machine Workflow", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=SECONDARY, spaceBefore=0, spaceAfter=10))

    story.append(Paragraph(
        "To prevent irregular support operations, ResolveDesk enforces a legal state machine on the backend. "
        "Attempts to skip state transitions or modify tickets without assigned owners are rejected with HTTP 400/403.",
        body_style
    ))

    state_transitions = [
        "<b>OPEN:</b> Ticket created by Customer. Unassigned.",
        "<b>ASSIGNED:</b> Admin assigns ticket to an Agent. Agent assigned_agent_id is bound.",
        "<b>IN_PROGRESS:</b> Agent commences work or posts response thread updates.",
        "<b>RESOLVED:</b> Agent completes fix and submits resolution for Customer review.",
        "<b>CLOSED:</b> Customer accepts fix, closing the issue thread permanently.",
        "<b>REOPENED:</b> Customer rejects resolution (requires non-empty feedback reason comment); ticket returns to IN_PROGRESS."
    ]
    for st in state_transitions:
        story.append(Paragraph(f"• {st}", bullet_style))

    story.append(Spacer(1, 15))

    # ==========================================================================
    # SECTION 3: COMPLETE TRADITIONAL ER DIAGRAM
    # ==========================================================================
    story.append(PageBreak())
    story.append(Paragraph("3. Traditional ER Diagram & Conceptual Schema", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=SECONDARY, spaceBefore=0, spaceAfter=10))

    story.append(Paragraph(
        "The conceptual Entity-Relationship (ER) model below illustrates all 12 core system entities, "
        "their primary/foreign key attributes, relationship types, and cardinalities.",
        body_style
    ))

    if os.path.exists("er_diagram.png"):
        story.append(Spacer(1, 5))
        story.append(Image("er_diagram.png", width=6.5*inch, height=8.6*inch))

    story.append(PageBreak())

    # ==========================================================================
    # SECTION 4: REST API ENDPOINT REFERENCE
    # ==========================================================================
    story.append(Paragraph("4. REST API Endpoint Reference", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=SECONDARY, spaceBefore=0, spaceAfter=10))

    api_data = [
        [Paragraph("Method", th_style), Paragraph("Endpoint Path", th_style), Paragraph("Role Allowed", th_style), Paragraph("Description & Operations", th_style)],
        [Paragraph("POST", td_style), Paragraph("<code>/auth/signup</code>", td_style), Paragraph("Public", td_style), Paragraph("Registers new customer or agent user account.", td_style)],
        [Paragraph("POST", td_style), Paragraph("<code>/auth/login</code>", td_style), Paragraph("Public", td_style), Paragraph("Authenticates credentials and returns signed JWT token.", td_style)],
        [Paragraph("POST", td_style), Paragraph("<code>/tickets</code>", td_style), Paragraph("Customer", td_style), Paragraph("Creates a new support ticket with category & priority.", td_style)],
        [Paragraph("GET", td_style), Paragraph("<code>/tickets/my</code>", td_style), Paragraph("Customer", td_style), Paragraph("Fetches all tickets created by logged-in customer.", td_style)],
        [Paragraph("GET", td_style), Paragraph("<code>/tickets/queue</code>", td_style), Paragraph("Agent", td_style), Paragraph("Retrieves paginated queue of agent's assigned tickets.", td_style)],
        [Paragraph("GET", td_style), Paragraph("<code>/tickets/{id}</code>", td_style), Paragraph("Owner / Agent", td_style), Paragraph("Fetches full ticket details and thread comments.", td_style)],
        [Paragraph("POST", td_style), Paragraph("<code>/tickets/{id}/respond</code>", td_style), Paragraph("Owner / Agent", td_style), Paragraph("Posts reply message into ticket conversation thread.", td_style)],
        [Paragraph("PATCH", td_style), Paragraph("<code>/tickets/{id}/status</code>", td_style), Paragraph("Agent / Admin", td_style), Paragraph("Updates state (ASSIGNED ➔ IN_PROGRESS ➔ RESOLVED).", td_style)],
        [Paragraph("PATCH", td_style), Paragraph("<code>/tickets/{id}/assign</code>", td_style), Paragraph("Admin", td_style), Paragraph("Assigns or reassigns ticket to target agent ID.", td_style)],
        [Paragraph("PATCH", td_style), Paragraph("<code>/tickets/{id}/reopen</code>", td_style), Paragraph("Customer", td_style), Paragraph("Reopens ticket with mandatory reason comment.", td_style)],
        [Paragraph("PATCH", td_style), Paragraph("<code>/tickets/{id}/close</code>", td_style), Paragraph("Customer", td_style), Paragraph("Customer accepts fix and transitions ticket to CLOSED.", td_style)]
    ]
    t_api = Table(api_data, colWidths=[0.8*inch, 1.8*inch, 1.2*inch, 3.0*inch])
    t_api.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), SECONDARY),
        ('BOX', (0,0), (-1,-1), 1, BORDER_COLOR),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_api)

    story.append(Spacer(1, 15))

    # ==========================================================================
    # SECTION 5: RELATIONAL DATA DICTIONARY
    # ==========================================================================
    story.append(Paragraph("5. Relational Data Dictionary", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=SECONDARY, spaceBefore=0, spaceAfter=10))

    tables_dict = [
        ("USERS Table", [
            ("id", "BIGINT (int8)", "PRIMARY KEY GENERATED AS IDENTITY"),
            ("name", "VARCHAR(100)", "NOT NULL"),
            ("email", "VARCHAR(100)", "UNIQUE, NOT NULL"),
            ("password_hash", "VARCHAR(255)", "NOT NULL"),
            ("role", "VARCHAR(20)", "CHECK (role IN ('customer', 'agent', 'admin'))"),
            ("created_at", "TIMESTAMPTZ", "DEFAULT NOW()")
        ]),
        ("TICKETS Table", [
            ("id", "BIGINT (int8)", "PRIMARY KEY GENERATED AS IDENTITY"),
            ("customer_id", "BIGINT", "NOT NULL, FK -> users(id) ON DELETE CASCADE"),
            ("title", "VARCHAR(255)", "NOT NULL"),
            ("category", "VARCHAR(50)", "NOT NULL"),
            ("priority", "VARCHAR(20)", "DEFAULT 'medium'"),
            ("description", "TEXT", "NOT NULL"),
            ("status", "VARCHAR(30)", "DEFAULT 'open' CHECK (status IN (...))"),
            ("assigned_agent_id", "BIGINT", "FK -> users(id) ON DELETE SET NULL"),
            ("created_at", "TIMESTAMPTZ", "DEFAULT NOW()")
        ]),
        ("RESPONSES Table", [
            ("id", "BIGINT (int8)", "PRIMARY KEY GENERATED AS IDENTITY"),
            ("ticket_id", "BIGINT", "NOT NULL, FK -> tickets(id) ON DELETE CASCADE"),
            ("sender_id", "BIGINT", "NOT NULL, FK -> users(id) ON DELETE CASCADE"),
            ("message", "TEXT", "NOT NULL"),
            ("created_at", "TIMESTAMPTZ", "DEFAULT NOW()")
        ]),
        ("TICKET_STATUS_HISTORY Table", [
            ("id", "BIGINT (int8)", "PRIMARY KEY GENERATED AS IDENTITY"),
            ("ticket_id", "BIGINT", "NOT NULL, FK -> tickets(id) ON DELETE CASCADE"),
            ("old_status", "VARCHAR(30)", "NULLABLE"),
            ("new_status", "VARCHAR(30)", "NOT NULL"),
            ("changed_by", "BIGINT", "NOT NULL, FK -> users(id)"),
            ("created_at", "TIMESTAMPTZ", "DEFAULT NOW()")
        ])
    ]

    for t_name, rows in tables_dict:
        story.append(Paragraph(f"<b>{t_name}</b>", h2_style))
        t_data = [[Paragraph("Column Name", th_style), Paragraph("Data Type", th_style), Paragraph("Key / Constraints", th_style)]]
        for cname, dtype, cstr in rows:
            t_data.append([Paragraph(f"<code>{cname}</code>", td_style), Paragraph(dtype, td_style), Paragraph(cstr, td_style)])
        
        t_dict = Table(t_data, colWidths=[1.8*inch, 1.8*inch, 3.2*inch])
        t_dict.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), SECONDARY),
            ('BOX', (0,0), (-1,-1), 1, BORDER_COLOR),
            ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('LEFTPADDING', (0,0), (-1,-1), 6),
            ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ]))
        story.append(t_dict)
        story.append(Spacer(1, 8))

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Successfully generated super clean PDF: {filename}")

if __name__ == "__main__":
    build_pdf()
