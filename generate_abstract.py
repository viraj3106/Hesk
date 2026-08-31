import docx
from docx.shared import Pt, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

doc = docx.Document()

# Set standard margins (1 inch on all sides)
for section in doc.sections:
    section.top_margin = Inches(1)
    section.bottom_margin = Inches(1)
    section.left_margin = Inches(1)
    section.right_margin = Inches(1)

# Helper function to format paragraph
def add_para(text, font_name="Times New Roman", size=12, bold=False, italic=False, align=WD_ALIGN_PARAGRAPH.LEFT, space_after=12, line_spacing=1.5):
    p = doc.add_paragraph()
    p.alignment = align
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.line_spacing = line_spacing
    run = p.add_run(text)
    run.font.name = font_name
    run.font.size = Pt(size)
    run.bold = bold
    run.italic = italic
    # XML manipulation to guarantee font is applied to complex elements (Word compatibility)
    rPr = run._r.get_or_add_rPr()
    rFonts = OxmlElement('w:rFonts')
    rFonts.set(qn('w:ascii'), font_name)
    rFonts.set(qn('w:hAnsi'), font_name)
    rPr.append(rFonts)
    return p

# --- PAGE 1: TITLE PAGE ---
add_para("CAPSTONE PROJECT ABSTRACT", size=14, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=24)
add_para("\n" * 2, space_after=12) # Spacing

add_para("RESOLVEDESK: A SECURE AND ROLE-BASED CUSTOMER SUPPORT AND TICKETING SYSTEM", size=16, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=24)

add_para("\n" * 3, space_after=12)

add_para("Submitted in partial fulfillment of the requirements for the Capstone Project", size=12, italic=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=36)

add_para("Submitted By:", size=12, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=6)
add_para("Viraj\n(Student Author)", size=12, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=24)

add_para("Under the Guidance of:", size=12, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=6)
add_para("[Project Guide Name]\n[Guide Designation]", size=12, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=48)

add_para("Department of Computer Science and Engineering", size=12, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=6)
add_para("Date: August 18, 2026", size=12, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=12)

# Page Break to start Abstract on Page 2
doc.add_page_break()

# --- PAGE 2: ABSTRACT CONTENT ---
add_para("ABSTRACT", size=12, bold=True, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=18)

paragraphs = [
    "This capstone project presents ResolveDesk, a secure, role-based customer support and ticketing "
    "platform designed to streamline issue tracking, assignment, communication, and resolution. "
    "Modern customer support workflows often suffer from ambiguities regarding ticket ownership, "
    "communication history, and strict status progression, which undermines customer trust. ResolveDesk "
    "addresses these challenges by implementing a robust state-transition engine that guarantees "
    "structured ticket lifecycles.",
    
    "The system features strict Role-Based Access Control (RBAC) for customers, support agents, "
    "and administrators. Key functionalities include secure OTP-based password resets, a glassmorphic "
    "user interface for issue resolution, detailed state history tracking, and interactive real-time "
    "communication threads.",
    
    "ResolveDesk is engineered using a Java Spring Boot backend communicating with a Supabase PostgreSQL "
    "database via a REST API, and a lightweight, high-performance frontend crafted in Vanilla HTML, CSS, "
    "and JavaScript. An Express-based reverse proxy integrates the application modules. By enforcing strict "
    "validation rules and providing an intuitive user experience, ResolveDesk ensures accountability, "
    "eliminates support pipeline latency, and offers a highly scalable, enterprise-ready ticketing solution."
]

for para_text in paragraphs:
    add_para(para_text, size=12, align=WD_ALIGN_PARAGRAPH.JUSTIFY, space_after=12, line_spacing=1.5)

# Add keywords
add_para("Keywords: Customer Support, Ticketing System, Spring Boot, Supabase, Role-Based Access Control (RBAC), State Transition Machine.", size=11, italic=True, align=WD_ALIGN_PARAGRAPH.LEFT, space_after=36)

# Signatures Block
add_para("\n" * 3, space_after=12) # Push to bottom of page 2
p_sig = doc.add_paragraph()
p_sig.paragraph_format.line_spacing = 1.15
p_sig.paragraph_format.space_after = Pt(6)

run_sig1 = p_sig.add_run("_____________________\t\t\t\t_____________________\n")
run_sig1.font.name = "Times New Roman"
run_sig1.font.size = Pt(12)

run_sig2 = p_sig.add_run("Viraj (Student Author)\t\t\t\tProject Guide / Advisor")
run_sig2.font.name = "Times New Roman"
run_sig2.font.size = Pt(12)
run_sig2.bold = True

doc.save("ResolveDesk_Abstract.docx")
print("ResolveDesk_Abstract.docx generated successfully!")
