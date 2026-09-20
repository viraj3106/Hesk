import docx
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
import os

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

def set_table_borders(table):
    tblPr = table._element.xpath('w:tblPr')
    if tblPr:
        tblBorders = OxmlElement('w:tblBorders')
        for border_name in ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']:
            border = OxmlElement(f'w:{border_name}')
            border.set(qn('w:val'), 'single')
            border.set(qn('w:sz'), '4')
            border.set(qn('w:space'), '0')
            border.set(qn('w:color'), '000000')
            tblBorders.append(border)
        tblPr[0].append(tblBorders)

def add_para(text, font_name="Arial", size=11, bold=False, italic=False, align=WD_ALIGN_PARAGRAPH.LEFT, space_after=12, space_before=0, line_spacing=1.15, color=RGBColor(0,0,0)):
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

# ==============================================================================
# PAGE 1: COVER PAGE & INDEX PAGE
# ==============================================================================
add_para("CUSTOMER SUPPORT AND TICKETING SYSTEM", font_name="Arial", size=16, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=20, space_after=14)
add_para("CAPSTONE PROJECT", font_name="Arial", size=14, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=14)
add_para("ACTIVITY DOCUMENT", font_name="Arial", size=14, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=20)

add_para("SUBMITTED BY", font_name="Arial", size=12, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=10)
add_para("VIRAJ", font_name="Arial", size=13, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=14)
add_para("YEAR: III", font_name="Arial", size=12, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=10)
add_para("DEPARTMENT OF INFORMATION TECHNOLOGY - B", font_name="Arial", size=12, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=10)
add_para("J.J COLLEGE OF ENGINEERING AND TECHNOLOGY", font_name="Arial", size=12, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=40)

add_para("INDEX PAGE", font_name="Arial", size=14, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=16)

# Index Table
index_table = doc.add_table(rows=5, cols=3)
index_table.alignment = WD_TABLE_ALIGNMENT.CENTER
index_table.autofit = False
set_table_borders(index_table)

headers = ["S.No", "CONTENTS", "PAGE NO."]
hdr_row = index_table.rows[0]
for idx, h_text in enumerate(headers):
    cell = hdr_row.cells[idx]
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(4)
    p.paragraph_format.space_after = Pt(4)
    run = p.add_run(h_text)
    run.bold = True
    run.font.name = "Arial"
    run.font.size = Pt(11)

index_items = [
    ("1", "Traditional ER Diagram", "2"),
    ("2", "Traditional ER Diagram Explanation", "3"),
    ("3", "Schema Mapping Rules", "4"),
    ("4", "Data Dictionary", "5 onwards")
]

for row_idx, (sno, content, pno) in enumerate(index_items, start=1):
    row = index_table.rows[row_idx]
    c0, c1, c2 = row.cells[0], row.cells[1], row.cells[2]
    
    p0 = c0.paragraphs[0]
    p0.paragraph_format.space_before = Pt(4)
    p0.paragraph_format.space_after = Pt(4)
    r0 = p0.add_run(sno)
    r0.font.name = "Arial"
    r0.font.size = Pt(11)
    r0.bold = True
    
    p1 = c1.paragraphs[0]
    p1.paragraph_format.space_before = Pt(4)
    p1.paragraph_format.space_after = Pt(4)
    r1 = p1.add_run(content)
    r1.font.name = "Arial"
    r1.font.size = Pt(11)
    r1.bold = True
    
    p2 = c2.paragraphs[0]
    p2.paragraph_format.space_before = Pt(4)
    p2.paragraph_format.space_after = Pt(4)
    r2 = p2.add_run(pno)
    r2.font.name = "Arial"
    r2.font.size = Pt(11)
    r2.bold = True

index_table.columns[0].width = Inches(1.0)
index_table.columns[1].width = Inches(4.5)
index_table.columns[2].width = Inches(1.5)

doc.add_page_break()

# ==============================================================================
# PAGE 2: TRADITIONAL ER DIAGRAM
# ==============================================================================
add_para("TRADITIONAL ER DIAGRAM", font_name="Arial", size=14, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=10, space_after=16)

# Insert the ER Diagram Image
if os.path.exists("er_diagram.png"):
    p_img = doc.add_paragraph()
    p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_img.paragraph_format.space_after = Pt(12)
    run_img = p_img.add_run()
    run_img.add_picture("er_diagram.png", width=Inches(6.2))

doc.add_page_break()

# ==============================================================================
# PAGES 3 & 4: TRADITIONAL ER DIAGRAM EXPLANATION
# ==============================================================================
add_para("TRADITIONAL ER DIAGRAM EXPLANATION", font_name="Arial", size=14, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=10, space_after=16)

add_para(
    "The Traditional Entity Relationship (ER) Diagram represents the overall database structure of the Customer Support "
    "and Ticketing System (ResolveDesk). It illustrates the major entities, their attributes, relationships, and "
    "cardinalities used in the system. The ER Diagram helps in understanding how different entities are connected "
    "before converting the design into relational database tables."
)

add_para(
    "The USERS entity is one of the main entities in the system. It stores information such as user ID, name, email, "
    "password hash, role (customer, agent, admin), and account creation details. Users can act as customers submitting tickets, "
    "support agents resolving issues, or system administrators managing workloads and user permissions."
)

add_para(
    "The TICKETS entity forms the central part of the Customer Support Platform. It stores information related to issues "
    "raised by users. Each ticket includes details such as ticket ID, title, category, priority level, description, status "
    "(open, assigned, in_progress, resolved, closed), assigned agent ID, and creation/update timestamps. A customer can create "
    "multiple tickets over time."
)

add_para(
    "The RESPONSES entity manages communication threads for support tickets. It connects the USERS entity with the TICKETS entity. "
    "Each response record contains the response ID, associated ticket ID, sender ID, message content, and creation timestamp. "
    "Both customers and agents can post multiple response comments to maintain a complete history of the issue resolution."
)

add_para(
    "The TICKET_STATUS_HISTORY entity tracks all status transitions occurring throughout a ticket's lifecycle. It stores "
    "the history ID, ticket ID, previous status, new status, ID of the user who performed the change, and the transition date/time. "
    "This entity provides complete auditability for support compliance and SLA monitoring."
)

add_para(
    "The PASSWORD_RESET_TOKENS entity manages security authentication for password recovery workflows. It includes token ID, "
    "user ID, hashed OTP code, expiration time, verification attempt counts, verification status flags, and token usage flags. "
    "Each user can generate password reset requests when required."
)

add_para(
    "The CATEGORIES entity categorizes support tickets into functional domains (e.g., Billing, Technical, Account Access, Feature Request). "
    "This entity helps organize tickets for efficient assignment and reporting."
)

add_para(
    "The PRIORITY_SLA entity defines target response and resolution timeframe expectations based on priority levels "
    "(e.g., Low, Medium, High, Urgent). It establishes clear service level agreements for support agent teams."
)

add_para(
    "The AGENT_WORKLOAD entity tracks current ticket load and status metrics for each support agent. It stores agent ID, "
    "active ticket counts, resolved ticket counts, and total capacity limits to facilitate balanced ticket assignment."
)

add_para(
    "The NOTIFICATIONS entity stores alerts and messages generated for users. A user can receive notifications regarding "
    "ticket updates, new responses, status changes, or assignment events. Notification details include message content, type, "
    "read status, and timestamps."
)

add_para(
    "The BADGES and USER_BADGES entities form a gamification and performance recognition system for support agents. "
    "The BADGES entity defines achievement metrics (e.g., Fast Resolver, Customer Favorite), while USER_BADGES connects users "
    "to their earned badges."
)

add_para(
    "The AUDIT_LOGS entity records security events, login attempts, state modifications, and admin actions across the platform, "
    "ensuring compliance, security transparency, and operational tracking."
)

add_para(
    "Overall, the Traditional ER Diagram provides a clear representation of the entities and relationships used in the Customer Support "
    "and Ticketing System. Primary Keys are used to uniquely identify records, while Foreign Keys establish relationships "
    "between related entities. The ER Diagram was later converted into relational tables using schema mapping rules, ensuring "
    "data integrity, consistency, and proper database organization."
)

doc.add_page_break()

# ==============================================================================
# PAGE 5: SCHEMA MAPPING RULES
# ==============================================================================
add_para("SCHEMA MAPPING RULE", font_name="Arial", size=14, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=10, space_after=16)

mapping_rules = [
    ("1. Entity to Table Mapping", "Each entity in the ER Diagram was converted into a separate relational table. For example, USERS, TICKETS, RESPONSES, TICKET_STATUS_HISTORY, and PASSWORD_RESET_TOKENS were converted into database tables."),
    ("2. Attribute to Column Mapping", "Each attribute of an entity was converted into a column in the corresponding table."),
    ("3. Primary Key Mapping", "Each table was assigned a Primary Key to uniquely identify every record."),
    ("4. Relationship Mapping", "Relationships between entities were implemented using Foreign Keys. For example, customer_id in the TICKETS table references the USERS table."),
    ("5. One-to-Many Relationship Mapping", "For a one-to-many relationship, the Primary Key of the parent table was added as a Foreign Key in the child table."),
    ("6. One-to-One Relationship Mapping", "For a one-to-one relationship, a Foreign Key with a UNIQUE constraint was used. For example, USER_PRIVACY_SETTINGS is connected to USERS using user_id."),
    ("7. Many-to-Many Relationship Mapping", "Many-to-many relationships were represented using an intermediate or junction table when required. This approach helps maintain proper relationships between multiple entities and avoids data redundancy."),
    ("8. Foreign Key Mapping", "Foreign Keys were used to establish relationships between related tables. For example, user_id connects USERS with TICKETS, RESPONSES, NOTIFICATIONS, and AUDIT_LOGS."),
    ("9. Referential Integrity", "Referential integrity was maintained by using Foreign Key constraints. This ensures that a record in a child table cannot reference a non-existing record in a parent table."),
    ("10. Constraint Mapping", "Constraints such as NOT NULL, UNIQUE, PRIMARY KEY, FOREIGN KEY, and DEFAULT were applied to maintain data accuracy, consistency, and integrity."),
    ("11. Data Type Mapping", "Appropriate data types were selected based on the type of information stored. For example, VARCHAR and TEXT were used for text values, INT and BIGINT for numerical values, DATE and TIMESTAMP/TIMESTAMPTZ for date-related information, and BOOLEAN for flags.")
]

for title, desc in mapping_rules:
    add_para(title, font_name="Arial", size=11, bold=True, space_before=4, space_after=2)
    add_para(desc, font_name="Arial", size=11, space_before=0, space_after=8)

doc.add_page_break()

# ==============================================================================
# PAGES 5 ONWARDS: DATA DICTIONARY
# ==============================================================================
add_para("DATA DICTIONARY", font_name="Arial", size=14, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_before=10, space_after=10)
add_para("The following data dictionary describes the tables, columns, data types, keys, and constraints used in the Customer Support and Ticketing System database.", font_name="Arial", size=11, space_before=0, space_after=16)

def add_dict_table(table_title, columns_data):
    add_para(table_title, font_name="Arial", size=12, bold=True, space_before=10, space_after=6)
    t = doc.add_table(rows=len(columns_data) + 1, cols=3)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = False
    set_table_borders(t)
    
    hdr = t.rows[0]
    for idx, htext in enumerate(["Column Name", "Data Type", "Key / Constraint"]):
        cell = hdr.cells[idx]
        p = cell.paragraphs[0]
        p.paragraph_format.space_before = Pt(3)
        p.paragraph_format.space_after = Pt(3)
        run = p.add_run(htext)
        run.bold = True
        run.font.name = "Arial"
        run.font.size = Pt(10)
        
    for r_idx, col in enumerate(columns_data, start=1):
        row = t.rows[r_idx]
        for c_idx, val in enumerate(col):
            cell = row.cells[c_idx]
            p = cell.paragraphs[0]
            p.paragraph_format.space_before = Pt(3)
            p.paragraph_format.space_after = Pt(3)
            run = p.add_run(val)
            run.font.name = "Arial"
            run.font.size = Pt(10)
            
    t.columns[0].width = Inches(2.2)
    t.columns[1].width = Inches(2.2)
    t.columns[2].width = Inches(2.6)
    add_para("", space_after=8)

# Table definitions matching our project
add_dict_table("USERS Table", [
    ("user_id / id", "BIGINT / SERIAL", "PRIMARY KEY"),
    ("name", "VARCHAR(100)", "NOT NULL"),
    ("email", "VARCHAR(100)", "UNIQUE, NOT NULL"),
    ("password_hash", "VARCHAR(255)", "NOT NULL"),
    ("phone", "VARCHAR(15)", "-"),
    ("role", "VARCHAR(20)", "DEFAULT 'customer'"),
    ("created_at", "TIMESTAMP", "DEFAULT CURRENT_TIMESTAMP")
])

add_dict_table("TICKETS Table", [
    ("ticket_id / id", "BIGINT / SERIAL", "PRIMARY KEY"),
    ("customer_id", "BIGINT", "NOT NULL, FOREIGN KEY"),
    ("title", "VARCHAR(255)", "NOT NULL"),
    ("category", "VARCHAR(50)", "NOT NULL"),
    ("priority", "VARCHAR(20)", "DEFAULT 'medium'"),
    ("description", "TEXT", "NOT NULL"),
    ("status", "VARCHAR(30)", "DEFAULT 'open'"),
    ("assigned_agent_id", "BIGINT", "FOREIGN KEY"),
    ("created_at", "TIMESTAMP", "DEFAULT CURRENT_TIMESTAMP"),
    ("updated_at", "TIMESTAMP", "DEFAULT CURRENT_TIMESTAMP")
])

add_dict_table("RESPONSES Table", [
    ("response_id / id", "BIGINT / SERIAL", "PRIMARY KEY"),
    ("ticket_id", "BIGINT", "NOT NULL, FOREIGN KEY"),
    ("sender_id", "BIGINT", "NOT NULL, FOREIGN KEY"),
    ("message", "TEXT", "NOT NULL"),
    ("created_at", "TIMESTAMP", "DEFAULT CURRENT_TIMESTAMP")
])

add_dict_table("TICKET_STATUS_HISTORY Table", [
    ("history_id / id", "BIGINT / SERIAL", "PRIMARY KEY"),
    ("ticket_id", "BIGINT", "NOT NULL, FOREIGN KEY"),
    ("old_status", "VARCHAR(30)", "-"),
    ("new_status", "VARCHAR(30)", "NOT NULL"),
    ("changed_by", "BIGINT", "NOT NULL, FOREIGN KEY"),
    ("created_at", "TIMESTAMP", "DEFAULT CURRENT_TIMESTAMP")
])

add_dict_table("PASSWORD_RESET_TOKENS Table", [
    ("token_id / id", "BIGINT / SERIAL", "PRIMARY KEY"),
    ("user_id", "BIGINT", "NOT NULL, FOREIGN KEY"),
    ("otp_hash", "TEXT", "NOT NULL"),
    ("expires_at", "TIMESTAMP", "NOT NULL"),
    ("attempts", "INT", "DEFAULT 0"),
    ("verified", "BOOLEAN", "DEFAULT FALSE"),
    ("used", "BOOLEAN", "DEFAULT FALSE"),
    ("created_at", "TIMESTAMP", "DEFAULT CURRENT_TIMESTAMP")
])

add_dict_table("CATEGORIES Table", [
    ("category_id", "SERIAL", "PRIMARY KEY"),
    ("category_name", "VARCHAR(50)", "UNIQUE, NOT NULL"),
    ("description", "TEXT", "-"),
    ("created_at", "TIMESTAMP", "DEFAULT CURRENT_TIMESTAMP")
])

add_dict_table("PRIORITY_SLA Table", [
    ("sla_id", "SERIAL", "PRIMARY KEY"),
    ("priority_level", "VARCHAR(20)", "UNIQUE, NOT NULL"),
    ("response_time_hours", "INT", "NOT NULL"),
    ("resolution_time_hours", "INT", "NOT NULL")
])

add_dict_table("AGENT_WORKLOAD Table", [
    ("workload_id", "SERIAL", "PRIMARY KEY"),
    ("agent_id", "BIGINT", "NOT NULL, FOREIGN KEY"),
    ("active_tickets", "INT", "DEFAULT 0"),
    ("resolved_tickets", "INT", "DEFAULT 0"),
    ("max_capacity", "INT", "DEFAULT 10")
])

add_dict_table("NOTIFICATIONS Table", [
    ("notification_id", "BIGINT / SERIAL", "PRIMARY KEY"),
    ("user_id", "BIGINT", "NOT NULL, FOREIGN KEY"),
    ("message", "TEXT", "NOT NULL"),
    ("type", "VARCHAR(50)", "-"),
    ("is_read", "BOOLEAN", "DEFAULT FALSE"),
    ("created_at", "TIMESTAMP", "DEFAULT CURRENT_TIMESTAMP")
])

add_dict_table("BADGES Table", [
    ("badge_id", "SERIAL", "PRIMARY KEY"),
    ("badge_name", "VARCHAR(100)", "NOT NULL"),
    ("description", "TEXT", "-"),
    ("icon_url", "TEXT", "-")
])

add_dict_table("USER_BADGES Table", [
    ("user_badge_id", "SERIAL", "PRIMARY KEY"),
    ("user_id", "BIGINT", "NOT NULL, FOREIGN KEY"),
    ("badge_id", "INT", "NOT NULL, FOREIGN KEY"),
    ("awarded_at", "TIMESTAMP", "DEFAULT CURRENT_TIMESTAMP")
])

add_dict_table("AUDIT_LOGS Table", [
    ("log_id", "BIGINT / SERIAL", "PRIMARY KEY"),
    ("user_id", "BIGINT", "FOREIGN KEY"),
    ("action", "VARCHAR(100)", "NOT NULL"),
    ("details", "TEXT", "-"),
    ("ip_address", "VARCHAR(45)", "-"),
    ("created_at", "TIMESTAMP", "DEFAULT CURRENT_TIMESTAMP")
])

output_filename = "ResolveDesk_Activity_Document_Final.docx"
doc.save(output_filename)
print(f"Successfully generated {output_filename} with ER Diagram embedded!")
