import matplotlib.pyplot as plt
import matplotlib.patches as patches

# Set figure canvas size and ultra high DPI
fig, ax = plt.subplots(figsize=(18, 24), dpi=300)
ax.set_xlim(0, 100)
ax.set_ylim(0, 130)
ax.axis('off')

# Title
ax.text(50, 126, "TRADITIONAL ER DIAGRAM", fontsize=22, fontweight='bold', ha='center', va='center', family='sans-serif', color='#0F172A')
ax.text(50, 123.5, "Customer Support and Ticketing System (ResolveDesk)", fontsize=13, fontstyle='italic', ha='center', va='center', family='sans-serif', color='#475569')

# Style helper functions
def draw_entity(ax, center_x, center_y, width, height, text):
    box = patches.FancyBboxPatch((center_x - width/2, center_y - height/2), width, height,
                                edgecolor='#1E3A8A', facecolor='#EFF6FF', linewidth=2,
                                boxstyle="square,pad=0.2", zorder=3)
    ax.add_patch(box)
    ax.text(center_x, center_y, text, fontsize=11, fontweight='bold', ha='center', va='center', family='sans-serif', color='#1E293B', zorder=4)

def draw_attribute(ax, center_x, center_y, width, height, text, is_pk=False):
    ellipse = patches.Ellipse((center_x, center_y), width, height,
                              linewidth=1.2, edgecolor='#475569', facecolor='#FFFFFF', zorder=3)
    ax.add_patch(ellipse)
    font_weight = 'bold' if is_pk else 'normal'
    ax.text(center_x, center_y, text, fontsize=8, fontweight=font_weight, ha='center', va='center', family='sans-serif', color='#0F172A', zorder=4)

def draw_relationship(ax, center_x, center_y, width, height, text):
    diamond_pts = [[center_x, center_y + height/2],
                   [center_x + width/2, center_y],
                   [center_x, center_y - height/2],
                   [center_x - width/2, center_y]]
    poly = patches.Polygon(diamond_pts, linewidth=1.5, edgecolor='#047857', facecolor='#ECFDF5', zorder=3)
    ax.add_patch(poly)
    ax.text(center_x, center_y, text, fontsize=8.5, fontweight='bold', ha='center', va='center', family='sans-serif', color='#065F46', zorder=4)

def draw_line(ax, x1, y1, x2, y2, label=None):
    ax.plot([x1, x2], [y1, y2], color='#64748B', linewidth=1.2, zorder=1)
    if label:
        mx, my = (x1 + x2)/2, (y1 + y2)/2
        ax.text(mx, my+0.8, label, fontsize=8.5, fontweight='bold', color='#0F172A', ha='center', va='center',
                bbox=dict(boxstyle='square,pad=0.2', facecolor='#F8FAFC', edgecolor='#CBD5E1'), zorder=2)

# ------------------------------------------------------------------------------
# LAYOUT & NODES DEFINITION (Clean Spacing)
# ------------------------------------------------------------------------------

# 1. USERS (Central top)
u_x, u_y = 50, 105
draw_entity(ax, u_x, u_y, 16, 5, "USERS")
u_attrs = [
    (24, 114, "user_id*", True),
    (24, 109, "name", False),
    (24, 104, "email", False),
    (24, 99, "password", False),
    (76, 114, "phone", False),
    (76, 109, "role", False),
    (76, 104, "created_at", False)
]
for ax_x, ax_y, atxt, apk in u_attrs:
    draw_attribute(ax, ax_x, ax_y, 12, 3.5, atxt, apk)
    draw_line(ax, u_x, u_y, ax_x, ax_y)

# 2. TICKETS (Central middle)
t_x, t_y = 50, 75
draw_entity(ax, t_x, t_y, 16, 5, "TICKETS")
t_attrs = [
    (24, 85, "ticket_id*", True),
    (24, 80, "title", False),
    (24, 75, "category", False),
    (24, 70, "priority", False),
    (76, 85, "status", False),
    (76, 80, "description", False),
    (76, 75, "created_at", False),
    (76, 70, "updated_at", False)
]
for ax_x, ax_y, atxt, apk in t_attrs:
    draw_attribute(ax, ax_x, ax_y, 12, 3.5, atxt, apk)
    draw_line(ax, t_x, t_y, ax_x, ax_y)

# Relationship: USERS CREATES TICKETS
rel_creates_x, rel_creates_y = 40, 90
draw_relationship(ax, rel_creates_x, rel_creates_y, 12, 5, "CREATES")
draw_line(ax, u_x, u_y, rel_creates_x, rel_creates_y, "1")
draw_line(ax, rel_creates_x, rel_creates_y, t_x, t_y, "N")

# Relationship: USERS HANDLES TICKETS (Agent assignment)
rel_handles_x, rel_handles_y = 60, 90
draw_relationship(ax, rel_handles_x, rel_handles_y, 12, 5, "HANDLES")
draw_line(ax, u_x, u_y, rel_handles_x, rel_handles_y, "1")
draw_line(ax, rel_handles_x, rel_handles_y, t_x, t_y, "N")


# 3. RESPONSES (Right side)
r_x, r_y = 86, 60
draw_entity(ax, r_x, r_y, 16, 5, "RESPONSES")
r_attrs = [
    (86, 70, "response_id*", True),
    (96, 64, "message", False),
    (96, 56, "created_at", False)
]
for ax_x, ax_y, atxt, apk in r_attrs:
    draw_attribute(ax, ax_x, ax_y, 12, 3.5, atxt, apk)
    draw_line(ax, r_x, r_y, ax_x, ax_y)

# Relationship: TICKETS CONTAINS RESPONSES
rel_contains_x, rel_contains_y = 68, 68
draw_relationship(ax, rel_contains_x, rel_contains_y, 12, 5, "CONTAINS")
draw_line(ax, t_x, t_y, rel_contains_x, rel_contains_y, "1")
draw_line(ax, rel_contains_x, rel_contains_y, r_x, r_y, "N")


# 4. TICKET_STATUS_HISTORY (Left side)
h_x, h_y = 14, 60
draw_entity(ax, h_x, h_y, 18, 5, "TICKET_HISTORY")
h_attrs = [
    (14, 70, "history_id*", True),
    (4, 64, "old_status", False),
    (4, 58, "new_status", False),
    (4, 52, "created_at", False)
]
for ax_x, ax_y, atxt, apk in h_attrs:
    draw_attribute(ax, ax_x, ax_y, 12, 3.5, atxt, apk)
    draw_line(ax, h_x, h_y, ax_x, ax_y)

# Relationship: TICKETS LOGS HISTORY
rel_logs_x, rel_logs_y = 32, 68
draw_relationship(ax, rel_logs_x, rel_logs_y, 12, 5, "LOGS")
draw_line(ax, t_x, t_y, rel_logs_x, rel_logs_y, "1")
draw_line(ax, rel_logs_x, rel_logs_y, h_x, h_y, "N")


# 5. PASSWORD_RESET_TOKENS (Top Left)
p_x, p_y = 14, 105
draw_entity(ax, p_x, p_y, 18, 5, "RESET_TOKENS")
p_attrs = [
    (14, 118, "token_id*", True),
    (4, 112, "otp_hash", False),
    (4, 106, "expires_at", False),
    (4, 100, "verified", False)
]
for ax_x, ax_y, atxt, apk in p_attrs:
    draw_attribute(ax, ax_x, ax_y, 12, 3.5, atxt, apk)
    draw_line(ax, p_x, p_y, ax_x, ax_y)

# Relationship: USERS REQUESTS RESET_TOKENS
rel_req_x, rel_req_y = 32, 105
draw_relationship(ax, rel_req_x, rel_req_y, 12, 5, "REQUESTS")
draw_line(ax, u_x, u_y, rel_req_x, rel_req_y, "1")
draw_line(ax, rel_req_x, rel_req_y, p_x, p_y, "N")


# 6. CATEGORIES (Bottom Left)
c_x, c_y = 25, 38
draw_entity(ax, c_x, c_y, 16, 5, "CATEGORIES")
c_attrs = [
    (10, 42, "cat_id*", True),
    (10, 38, "name", False),
    (10, 34, "desc", False)
]
for ax_x, ax_y, atxt, apk in c_attrs:
    draw_attribute(ax, ax_x, ax_y, 11, 3.5, atxt, apk)
    draw_line(ax, c_x, c_y, ax_x, ax_y)

# Relationship: TICKETS CLASSIFIED_BY CATEGORIES
rel_cat_x, rel_cat_y = 37.5, 52
draw_relationship(ax, rel_cat_x, rel_cat_y, 14, 5, "CLASSIFIED_BY")
draw_line(ax, t_x, t_y, rel_cat_x, rel_cat_y, "N")
draw_line(ax, rel_cat_x, rel_cat_y, c_x, c_y, "1")


# 7. PRIORITY_SLA (Bottom Right)
s_x, s_y = 75, 38
draw_entity(ax, s_x, s_y, 16, 5, "PRIORITY_SLA")
s_attrs = [
    (90, 42, "sla_id*", True),
    (90, 38, "level", False),
    (90, 34, "target_hrs", False)
]
for ax_x, ax_y, atxt, apk in s_attrs:
    draw_attribute(ax, ax_x, ax_y, 11, 3.5, atxt, apk)
    draw_line(ax, s_x, s_y, ax_x, ax_y)

# Relationship: TICKETS GOVERNED_BY PRIORITY_SLA
rel_sla_x, rel_sla_y = 62.5, 52
draw_relationship(ax, rel_sla_x, rel_sla_y, 14, 5, "GOVERNED_BY")
draw_line(ax, t_x, t_y, rel_sla_x, rel_sla_y, "N")
draw_line(ax, rel_sla_x, rel_sla_y, s_x, s_y, "1")


# 8. NOTIFICATIONS (Bottom Center)
n_x, n_y = 50, 18
draw_entity(ax, n_x, n_y, 18, 5, "NOTIFICATIONS")
n_attrs = [
    (32, 18, "notif_id*", True),
    (32, 12, "message", False),
    (68, 18, "is_read", False),
    (68, 12, "type", False)
]
for ax_x, ax_y, atxt, apk in n_attrs:
    draw_attribute(ax, ax_x, ax_y, 11, 3.5, atxt, apk)
    draw_line(ax, n_x, n_y, ax_x, ax_y)

# Relationship: USERS RECEIVES NOTIFICATIONS
rel_notif_x, rel_notif_y = 50, 40
draw_relationship(ax, rel_notif_x, rel_notif_y, 12, 5, "RECEIVES")
draw_line(ax, u_x, u_y, rel_notif_x, rel_notif_y, "1")
draw_line(ax, rel_notif_x, rel_notif_y, n_x, n_y, "N")


# 9. AGENT_WORKLOAD & BADGES
w_x, w_y = 14, 18
draw_entity(ax, w_x, w_y, 18, 5, "AGENT_WORKLOAD")
w_attrs = [(4, 22, "active_cnt", False), (4, 14, "max_cap", False)]
for ax_x, ax_y, atxt, apk in w_attrs:
    draw_attribute(ax, ax_x, ax_y, 11, 3.5, atxt, apk)
    draw_line(ax, w_x, w_y, ax_x, ax_y)

rel_work_x, rel_work_y = 25, 28
draw_relationship(ax, rel_work_x, rel_work_y, 11, 4.5, "TRACKS")
draw_line(ax, u_x, u_y, rel_work_x, rel_work_y, "1")
draw_line(ax, rel_work_x, rel_work_y, w_x, w_y, "1")


b_x, b_y = 86, 18
draw_entity(ax, b_x, b_y, 16, 5, "BADGES")
b_attrs = [(96, 22, "badge_name", False), (96, 14, "icon_url", False)]
for ax_x, ax_y, atxt, apk in b_attrs:
    draw_attribute(ax, ax_x, ax_y, 11, 3.5, atxt, apk)
    draw_line(ax, b_x, b_y, ax_x, ax_y)

rel_badge_x, rel_badge_y = 75, 28
draw_relationship(ax, rel_badge_x, rel_badge_y, 11, 4.5, "EARNS")
draw_line(ax, u_x, u_y, rel_badge_x, rel_badge_y, "N")
draw_line(ax, rel_badge_x, rel_badge_y, b_x, b_y, "M")

plt.tight_layout()
plt.savefig("er_diagram.png", bbox_inches='tight', dpi=300)
print("er_diagram.png successfully created with clean layout!")
