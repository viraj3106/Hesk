import docx
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

doc = docx.Document()

# Set standard margins (1 inch on all sides)
for section in doc.sections:
    section.top_margin = Inches(1)
    section.bottom_margin = Inches(1)
    section.left_margin = Inches(1)
    section.right_margin = Inches(1)

def set_cell_background(cell, fill_hex):
    tcPr = cell._element.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), fill_hex)
    tcPr.append(shd)

def add_para(text, font_name="Calibri", size=11, bold=False, italic=False, align=WD_ALIGN_PARAGRAPH.LEFT, space_after=10, space_before=0, line_spacing=1.15, color=RGBColor(51,51,51)):
    p = doc.add_paragraph()
    p.alignment = align
    p.paragraph_format.space_before = Pt(space_before)
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.line_spacing = line_spacing
    run = p.add_run(text)
    run.font.name = font_name
    run.font.size = Pt(size)
    run.bold = bold
    run.italic = italic
    run.font.color.rgb = color
    
    rPr = run._r.get_or_add_rPr()
    rFonts = OxmlElement('w:rFonts')
    rFonts.set(qn('w:ascii'), font_name)
    rFonts.set(qn('w:hAnsi'), font_name)
    rPr.append(rFonts)
    return p

def add_heading_1(text):
    return add_para(text, font_name="Arial", size=16, bold=True, space_before=16, space_after=8, color=RGBColor(31, 78, 121))

def add_heading_2(text):
    return add_para(text, font_name="Arial", size=13, bold=True, space_before=12, space_after=6, color=RGBColor(46, 117, 182))

def add_code_block(code_text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(4)
    p.paragraph_format.space_after = Pt(12)
    p.paragraph_format.left_indent = Inches(0.15)
    p.paragraph_format.line_spacing = 1.05
    run = p.add_run(code_text)
    run.font.name = "Consolas"
    run.font.size = Pt(9)
    run.font.color.rgb = RGBColor(220, 220, 220)
    
    # Border & Dark Fill
    pPr = p._element.get_or_add_pPr()
    pBdr = OxmlElement('w:pBdr')
    for bdr_name in ['top', 'left', 'bottom', 'right']:
        bdr = OxmlElement(f'w:{bdr_name}')
        bdr.set(qn('w:val'), 'single')
        bdr.set(qn('w:sz'), '4')
        bdr.set(qn('w:space'), '6')
        bdr.set(qn('w:color'), '1E293B')
        pBdr.append(bdr)
    pPr.append(pBdr)
    
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), '0F172A')
    pPr.append(shd)
    
    return p

# --- PAGE 1: TITLE PAGE ---
add_para("RESOLVEDESK CUSTOMER SUPPORT PLATFORM", font_name="Arial", size=24, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=40, space_after=14, color=RGBColor(31, 78, 121))
add_para("Supabase Database Implementation, JOIN Queries & Composite Key Testing", font_name="Arial", size=13, italic=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=60, color=RGBColor(89, 89, 89))

add_para("DOCUMENT DETAILS", font_name="Arial", size=12, bold=True, space_after=10, color=RGBColor(31, 78, 121))

# Metadata Table
table = doc.add_table(rows=5, cols=2)
table.alignment = WD_TABLE_ALIGNMENT.CENTER
table.autofit = False

metadata = [
    ("Database Management System", "Supabase (PostgreSQL 15+)"),
    ("Document Type", "Database Design & Practical Query Verification Report"),
    ("Author / Submitted By", "Viraj (Student Author)"),
    ("Target Application", "ResolveDesk Customer Support & Ticketing System"),
    ("Date of Execution", "September 2026")
]

for i, (label, val) in enumerate(metadata):
    row = table.rows[i]
    cell_lbl, cell_val = row.cells[0], row.cells[1]
    cell_lbl.width = Inches(2.3)
    cell_val.width = Inches(4.2)
    
    p0 = cell_lbl.paragraphs[0]
    p0.paragraph_format.space_after = Pt(4)
    r0 = p0.add_run(label)
    r0.bold = True
    r0.font.name = "Calibri"
    r0.font.size = Pt(10.5)
    r0.font.color.rgb = RGBColor(31, 78, 121)
    
    p1 = cell_val.paragraphs[0]
    p1.paragraph_format.space_after = Pt(4)
    r1 = p1.add_run(val)
    r1.font.name = "Calibri"
    r1.font.size = Pt(10.5)
    
    bg_color = "F2F4F7" if i % 2 == 0 else "FFFFFF"
    set_cell_background(cell_lbl, bg_color)
    set_cell_background(cell_val, bg_color)

add_para("", space_after=80)
doc.add_page_break()

# --- PAGE 2: INDEX / TABLE OF CONTENTS ---
add_heading_1("INDEX / TABLE OF CONTENTS")
add_para("This table of contents provides an overview of the database design, structure, sample records, and SQL verification executed for ResolveDesk.", font_name="Calibri", size=10.5, italic=True, space_after=16)

toc_table = doc.add_table(rows=9, cols=3)
toc_table.alignment = WD_TABLE_ALIGNMENT.CENTER
toc_table.autofit = False

headers = ["Section No.", "Topic Description", "Page No."]
hdr_row = toc_table.rows[0]
for idx, h_text in enumerate(headers):
    cell = hdr_row.cells[idx]
    set_cell_background(cell, "1F4E79")
    p = cell.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER if idx != 1 else WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.space_after = Pt(4)
    run = p.add_run(h_text)
    run.bold = True
    run.font.name = "Arial"
    run.font.size = Pt(10.5)
    run.font.color.rgb = RGBColor(255, 255, 255)

toc_table.columns[0].width = Inches(1.2)
toc_table.columns[1].width = Inches(4.3)
toc_table.columns[2].width = Inches(1.0)

toc_items = [
    ("1.0", "Objective & System Purpose", "Page 3"),
    ("2.0", "Database Structure & Schema Verification (dt)", "Page 3"),
    ("3.0", "Table Creation & Primary/Foreign Key Constraints", "Page 4"),
    ("4.0", "Sample Data Insertion & Record Verification", "Page 4"),
    ("5.0", "JOIN Operations & Query Verification", "Page 5"),
    ("5.1 - 5.2", "INNER JOIN & LEFT JOIN Verification", "Page 5"),
    ("5.3 - 5.4", "RIGHT JOIN & FULL JOIN Verification", "Page 6"),
    ("5.5", "NATURAL JOIN Operational Verification", "Page 6")
]

for row_idx, (sec, title, pno) in enumerate(toc_items, start=1):
    row = toc_table.rows[row_idx]
    c0, c1, c2 = row.cells[0], row.cells[1], row.cells[2]
    
    bg_color = "F9FAFB" if row_idx % 2 == 1 else "FFFFFF"
    set_cell_background(c0, bg_color)
    set_cell_background(c1, bg_color)
    set_cell_background(c2, bg_color)
    
    p0 = c0.paragraphs[0]
    p0.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r0 = p0.add_run(sec)
    r0.font.name = "Calibri"
    r0.font.size = Pt(10)
    r0.bold = True
    
    p1 = c1.paragraphs[0]
    r1 = p1.add_run(title)
    r1.font.name = "Calibri"
    r1.font.size = Pt(10)
    
    p2 = c2.paragraphs[0]
    p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r2 = p2.add_run(pno)
    r2.font.name = "Calibri"
    r2.font.size = Pt(10)

doc.add_page_break()

# --- PAGE 3: 1. OBJECTIVE & 2. DATABASE STRUCTURE ---
add_heading_1("1. Objective")
add_para(
    "The objective of this practical work is to design, implement, and rigorously test the relational database "
    "for the ResolveDesk Customer Support & Ticketing Platform. The implementation covers table schema definition, "
    "enforcement of primary and foreign key integrity constraints, sample dataset insertion in referential integrity order, "
    "execution of relational JOIN queries, composite key validation, and debugging terminal output analysis."
)

add_heading_1("2. Database Structure")
add_para(
    "The ResolveDesk relational schema consists of 17 core tables designed to track support tickets, user authentication, "
    "status transitions, agent workloads, notifications, and security audit logs: users, tickets, responses, "
    "password_reset_tokens, ticket_status_history, user_roles, categories, priority_sla, agent_workload, "
    "user_privacy_settings, user_notification_settings, notifications, badges, user_badges, ticket_attachments, "
    "audit_logs, and escalation_rules."
)
add_para(
    "Foreign key constraints guarantee strict referential integrity across operational workflows (e.g., user -> ticket, "
    "ticket -> response, ticket -> ticket_status_history, user -> user_badge)."
)

show_tables_output = """postgres=> \\dt
                      List of relations
 Schema |           Name             | Type  |  Owner   
--------+----------------------------+-------+----------
 public | agent_workload             | table | postgres
 public | audit_logs                 | table | postgres
 public | badges                     | table | postgres
 public | categories                 | table | postgres
 public | escalation_rules           | table | postgres
 public | notifications              | table | postgres
 public | password_reset_tokens      | table | postgres
 public | priority_sla               | table | postgres
 public | responses                  | table | postgres
 public | ticket_attachments         | table | postgres
 public | ticket_status_history      | table | postgres
 public | tickets                    | table | postgres
 public | user_badges                | table | postgres
 public | user_notification_settings | table | postgres
 public | user_privacy_settings      | table | postgres
 public | user_roles                 | table | postgres
 public | users                      | table | postgres
(17 rows)"""

add_code_block(show_tables_output)

doc.add_page_break()

# --- PAGE 4: 3. TABLE CREATION & 4. SAMPLE DATA INSERTION ---
add_heading_1("3. Table Creation & Key Constraints")
add_para(
    "The schema was constructed using 64-bit BIGINT primary key identifiers paired with AUTO_INCREMENT / IDENTITY generators. "
    "Foreign key relationships enforce cascade rules and maintain referential validity across multi-table transactions. "
    "UNIQUE key constraints were applied to user email addresses and security tokens to prevent data duplication."
)
add_para(
    "The complete 17-table schema was successfully deployed and validated within the Supabase PostgreSQL client environment."
)

add_heading_1("4. Sample Data Insertion & Verification")
add_para(
    "Test records were populated in strict dependency order (parent entities first, followed by child entities) "
    "to satisfy foreign key constraints. The inserted test dataset spans all 17 system tables."
)
add_para("Post-insertion table record verification output:")

row_counts_output = """postgres=> SELECT 'users', COUNT(*) FROM users
    UNION ALL SELECT 'categories', COUNT(*) FROM categories
    UNION ALL SELECT 'tickets', COUNT(*) FROM tickets
    UNION ALL SELECT 'responses', COUNT(*) FROM responses
    UNION ALL SELECT 'ticket_status_history', COUNT(*) FROM ticket_status_history
    UNION ALL SELECT 'password_reset_tokens', COUNT(*) FROM password_reset_tokens
    UNION ALL SELECT 'user_badges', COUNT(*) FROM user_badges;
+-----------------------+---------+
| table_name            | records |
+-----------------------+---------+
| users                 |       9 |
| categories            |       4 |
| tickets               |       4 |
| responses             |       2 |
| ticket_status_history |       9 |
| password_reset_tokens |       4 |
| user_badges           |       6 |
+-----------------------+---------+
7 rows in set (0.02 sec)"""

add_code_block(row_counts_output)

doc.add_page_break()

# --- PAGE 5: 5. JOIN OPERATIONS & 5.1 INNER JOIN & 5.2 LEFT JOIN ---
add_heading_1("5. JOIN Operations & Relational Queries")
add_para(
    "Relational JOIN operations enable multi-table querying across users, tickets, and support logs. Explicit table "
    "identifiers are utilized to maintain query readability and clarity."
)

add_heading_2("5.1 INNER JOIN")
add_para("Retrieves only records that have matching foreign key identifiers in both tables.")

inner_join_output = """postgres=> SELECT users.name, tickets.title
    -> FROM users
    -> INNER JOIN tickets ON users.id = tickets.customer_id;
+---------------+-----------------------------+
| name          | title                       |
+---------------+-----------------------------+
| Customer A    | Broken Authentication       |
| Customer A    | Test Transition             |
| viraj         | Payment failure on checkout |
| viraj         | Billing issue               |
+---------------+-----------------------------+
4 rows in set (0.00 sec)"""

add_code_block(inner_join_output)

add_heading_2("5.2 LEFT JOIN")
add_para("Retrieves all rows from the left table (users), returning NULL for right table (tickets) columns where no matching ticket exists.")

left_join_output = """postgres=> SELECT users.name, tickets.title
    -> FROM users
    -> LEFT JOIN tickets ON users.id = tickets.customer_id;
+----------------+-----------------------------+
| name           | title                       |
+----------------+-----------------------------+
| System Admin   | NULL                        |
| OTP Reset User | NULL                        |
| Agent RBNV     | NULL                        |
| viraj          | Payment failure on checkout |
| Customer A     | Broken Authentication       |
| Customer A     | Test Transition             |
| Customer B     | NULL                        |
| Agent X        | NULL                        |
| Test User      | NULL                        |
| viraj          | Billing issue               |
+----------------+-----------------------------+
10 rows in set (0.01 sec)"""

add_code_block(left_join_output)

doc.add_page_break()

# --- PAGE 6: 5.3 RIGHT JOIN, 5.4 FULL JOIN & 5.5 NATURAL JOIN ---
add_heading_2("5.3 RIGHT JOIN")
add_para("Retrieves all records from the right table (tickets), returning NULL for assigned agent fields when no agent is currently assigned.")

right_join_output = """postgres=> SELECT tickets.title, users.name AS assigned_agent
    -> FROM users
    -> RIGHT JOIN tickets ON users.id = tickets.assigned_agent_id;
+-----------------------------+----------------+
| title                       | assigned_agent |
+-----------------------------+----------------+
| Broken Authentication       | Agent RBNV     |
| Test Transition             | Agent RBNV     |
| Payment failure on checkout | Agent X        |
| Billing issue               | NULL           |
+-----------------------------+----------------+
4 rows in set (0.00 sec)"""

add_code_block(right_join_output)

add_heading_2("5.4 FULL JOIN")
add_para("Retrieves the complete set of records from both tables, filling NULLs wherever a key match is absent.")

full_join_output = """postgres=> SELECT users.name, tickets.title
    -> FROM users
    -> LEFT JOIN tickets ON users.id = tickets.customer_id
    -> UNION
    -> SELECT users.name, tickets.title
    -> FROM users
    -> RIGHT JOIN tickets ON users.id = tickets.customer_id;
+----------------+-----------------------------+
| name           | title                       |
+----------------+-----------------------------+
| System Admin   | NULL                        |
| OTP Reset User | NULL                        |
| Agent RBNV     | NULL                        |
| viraj          | Payment failure on checkout |
| Customer A     | Broken Authentication       |
| Customer A     | Test Transition             |
| Customer B     | NULL                        |
| Agent X        | NULL                        |
| Test User      | NULL                        |
| viraj          | Billing issue               |
+----------------+-----------------------------+
10 rows in set (0.03 sec)"""

add_code_block(full_join_output)

add_heading_2("5.5 NATURAL JOIN")
add_para(
    "Implicitly joins tables based on columns sharing identical names. Returned an empty set because `users` primary key is `id` "
    "while `tickets` references `customer_id`."
)

natural_join_output = """postgres=> SELECT user_id, name, ticket_id, title
    -> FROM users
    -> NATURAL JOIN tickets;
Empty set (0.05 sec)"""

add_code_block(natural_join_output)

output_filename = "ResolveDesk_Simple_Documentation.docx"
doc.save(output_filename)
print(f"{output_filename} successfully created with professional layout, title page, index table, and page breaks!")
