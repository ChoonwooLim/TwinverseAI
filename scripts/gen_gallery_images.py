"""Generate sample gallery images for TwinverseAI."""
from PIL import Image, ImageDraw, ImageFont
import random, os

OUT = os.path.join(os.path.dirname(__file__), "..", "uploads")
os.makedirs(OUT, exist_ok=True)

W, H = 800, 600

def hex_to_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0,2,4))

BG = hex_to_rgb("#0a0e27")
INDIGO = hex_to_rgb("#667eea")
VIOLET = hex_to_rgb("#764ba2")
CYAN = hex_to_rgb("#00d4ff")
PINK = hex_to_rgb("#f093fb")
GREEN = hex_to_rgb("#2ecc71")
ORANGE = hex_to_rgb("#f39c12")
WHITE_DIM = (180, 180, 200)

def get_font(size):
    try:
        return ImageFont.truetype("arial.ttf", size)
    except:
        return ImageFont.load_default()

def draw_glow_circle(draw, cx, cy, r, color, alpha_max=60):
    for i in range(r, 0, -4):
        a = int(alpha_max * (i / r) ** 2)
        draw.ellipse([cx-i, cy-i, cx+i, cy+i], fill=(*color, a))

def draw_grid(draw, color, spacing=40, alpha=25):
    for x in range(0, W, spacing):
        draw.line([(x,0),(x,H)], fill=(*color, alpha), width=1)
    for y in range(0, H, spacing):
        draw.line([(0,y),(W,y)], fill=(*color, alpha), width=1)

def neon_text(draw, text, pos, color, size=36):
    font = get_font(size)
    rgb = color[:3]
    for dx in range(-2,3):
        for dy in range(-2,3):
            if dx*dx + dy*dy <= 4:
                draw.text((pos[0]+dx, pos[1]+dy), text, fill=(*rgb, 60), font=font)
    alpha = color[3] if len(color) == 4 else 255
    draw.text(pos, text, fill=(*rgb, alpha), font=font)


# ──────── Image 1: Portal Main Page ────────
def gen_portal():
    img = Image.new("RGBA", (W,H), (*BG, 255))
    d = ImageDraw.Draw(img, "RGBA")
    draw_grid(d, INDIGO, 50, 15)
    draw_glow_circle(d, 400, 200, 200, INDIGO, 40)
    draw_glow_circle(d, 600, 400, 150, VIOLET, 30)
    d.rectangle([0,0,W,60], fill=(15,19,53,230))
    neon_text(d, "TwinverseAI", (30, 12), INDIGO, 28)
    for i, label in enumerate(["Home", "About", "Services", "Community"]):
        neon_text(d, label, (300+i*120, 18), WHITE_DIM, 16)
    neon_text(d, "AI-Powered Innovation", (120, 180), (255,255,255), 42)
    neon_text(d, "Transform your business with intelligent solutions", (100, 250), WHITE_DIM, 20)
    d.rounded_rectangle([280, 330, 520, 380], radius=10, fill=(*INDIGO, 200))
    neon_text(d, "Get Started", (330, 340), (255,255,255), 22)
    for i in range(3):
        x = 80 + i * 240
        d.rounded_rectangle([x, 430, x+200, 560], radius=12, fill=(255,255,255,12), outline=(*INDIGO, 40))
        draw_glow_circle(d, x+100, 470, 20, [INDIGO, CYAN, VIOLET][i], 50)
        neon_text(d, ["Consulting", "Development", "TwinverseDesk"][i], (x+20, 500), WHITE_DIM, 14)
    img.convert("RGB").save(os.path.join(OUT, "gallery-portal-main.jpg"), quality=90)

# ──────── Image 2: Admin Dashboard ────────
def gen_dashboard():
    img = Image.new("RGBA", (W,H), (*BG, 255))
    d = ImageDraw.Draw(img, "RGBA")
    d.rectangle([0,0,180,H], fill=(10,14,35,240))
    neon_text(d, "Admin", (20, 20), INDIGO, 20)
    for i, label in enumerate(["Dashboard", "Users", "Boards", "Claude Code", "Documents"]):
        c = CYAN if i == 0 else WHITE_DIM
        neon_text(d, label, (20, 70+i*40), c, 14)
    colors = [INDIGO, CYAN, VIOLET, GREEN]
    labels = ["Users", "Posts", "Comments", "Files"]
    values = ["127", "342", "1,205", "89"]
    for i in range(4):
        x = 210 + i * 145
        d.rounded_rectangle([x, 30, x+130, 120], radius=12, fill=(255,255,255,10), outline=(*colors[i], 50))
        neon_text(d, values[i], (x+20, 45), colors[i], 28)
        neon_text(d, labels[i], (x+20, 85), WHITE_DIM, 12)
    d.rounded_rectangle([210, 150, 580, 400], radius=12, fill=(255,255,255,8), outline=(*INDIGO, 30))
    neon_text(d, "Activity Chart", (230, 165), WHITE_DIM, 14)
    for i in range(10):
        h = random.randint(40, 180)
        x = 240 + i * 32
        col = INDIGO if random.random() > 0.5 else VIOLET
        d.rectangle([x, 380-h, x+20, 380], fill=(*col, 160))
    d.rounded_rectangle([600, 150, 780, 400], radius=12, fill=(255,255,255,8), outline=(*CYAN, 30))
    neon_text(d, "Recent Posts", (615, 165), WHITE_DIM, 14)
    for i in range(6):
        y = 200 + i * 30
        d.rectangle([615, y, 765, y+20], fill=(255,255,255,5))
        neon_text(d, f"Post #{i+1}", (620, y+2), WHITE_DIM, 11)
    d.rounded_rectangle([210, 420, 780, 580], radius=12, fill=(255,255,255,6), outline=(*VIOLET, 25))
    neon_text(d, "System Status: All services running", (230, 490), GREEN, 16)
    img.convert("RGB").save(os.path.join(OUT, "gallery-admin-dashboard.jpg"), quality=90)

# ──────── Image 3: TwinverseDesk Plan ────────
def gen_desk_plan():
    img = Image.new("RGBA", (W,H), (*BG, 255))
    d = ImageDraw.Draw(img, "RGBA")
    draw_grid(d, VIOLET, 60, 10)
    draw_glow_circle(d, 200, 300, 250, VIOLET, 25)
    draw_glow_circle(d, 600, 200, 200, CYAN, 20)
    neon_text(d, "TwinverseDesk Development Plan", (100, 30), (255,255,255), 30)
    phase_colors = [GREEN, INDIGO, VIOLET, CYAN, PINK]
    phase_names = ["Phase 1: MVP", "Phase 2: Social", "Phase 3: AI NPC", "Phase 4: Market", "Phase 5: Global"]
    statuses = ["In Progress", "Planned", "Planned", "Planned", "Vision"]
    for i in range(5):
        y = 100 + i * 95
        d.rounded_rectangle([60, y, 380, y+75], radius=10, fill=(255,255,255,10), outline=(*phase_colors[i], 80))
        neon_text(d, phase_names[i], (80, y+10), phase_colors[i], 18)
        neon_text(d, statuses[i], (80, y+45), WHITE_DIM, 12)
        if i == 0:
            d.rounded_rectangle([200, y+50, 360, y+63], radius=4, fill=(255,255,255,15))
            d.rounded_rectangle([200, y+50, 280, y+63], radius=4, fill=(*GREEN, 180))
    d.rounded_rectangle([420, 100, 760, 280], radius=12, fill=(255,255,255,8), outline=(*CYAN, 40))
    neon_text(d, "KPI Targets", (440, 115), CYAN, 18)
    kpis = ["200+ CCU", "60 FPS", "<50ms Latency", "99.9% Uptime", "10s Load", "<500MB Memory"]
    for i, kpi in enumerate(kpis):
        neon_text(d, kpi, (440, 150 + i * 20), WHITE_DIM, 12)
    d.rounded_rectangle([420, 310, 760, 570], radius=12, fill=(255,255,255,8), outline=(*VIOLET, 40))
    neon_text(d, "Architecture (7 Layers)", (440, 325), VIOLET, 16)
    layers = ["Client (UE5)", "API Gateway", "Microservices", "AI Engine", "Database", "Cache Layer", "Infra"]
    for i, layer in enumerate(layers):
        y = 360 + i * 28
        col = phase_colors[i % 5]
        d.rounded_rectangle([440, y, 740, y+22], radius=4, fill=(*col, 30), outline=(*col, 60))
        neon_text(d, layer, (450, y+3), col, 11)
    img.convert("RGB").save(os.path.join(OUT, "gallery-desk-plan.jpg"), quality=90)

# ──────── Image 4: Design System Colors ────────
def gen_design_system():
    img = Image.new("RGBA", (W,H), (*BG, 255))
    d = ImageDraw.Draw(img, "RGBA")
    neon_text(d, "Dark Glass Neon Design System", (120, 30), (255,255,255), 30)
    colors_list = [
        ("--dark-900", "#050810", hex_to_rgb("#050810")),
        ("--dark-800", "#0a0e27", hex_to_rgb("#0a0e27")),
        ("--dark-700", "#0f1335", hex_to_rgb("#0f1335")),
        ("--neon-indigo", "#667eea", INDIGO),
        ("--neon-violet", "#8b5cf6", hex_to_rgb("#8b5cf6")),
        ("--neon-cyan", "#00d4ff", CYAN),
        ("--neon-pink", "#f093fb", PINK),
        ("--neon-green", "#2ecc71", GREEN),
    ]
    for i, (name, hexval, rgb) in enumerate(colors_list):
        x = 50 + (i % 4) * 185
        y = 90 + (i // 4) * 150
        d.rounded_rectangle([x, y, x+160, y+90], radius=12, fill=(*rgb, 255), outline=(255,255,255,40))
        neon_text(d, name, (x+8, y+95), WHITE_DIM, 10)
        neon_text(d, hexval, (x+8, y+110), rgb, 12)
    neon_text(d, "Glassmorphism Examples", (50, 390), WHITE_DIM, 20)
    for i in range(3):
        x = 50 + i * 250
        alpha_fill = int(6+i*8)
        alpha_border = int(20+i*15)
        d.rounded_rectangle([x, 430, x+220, 550], radius=16, fill=(255,255,255,alpha_fill), outline=(255,255,255,alpha_border))
        neon_text(d, f"Glass Level {i+1}", (x+30, 460), WHITE_DIM, 16)
        neon_text(d, f"opacity: {0.06+i*0.04:.2f}", (x+30, 495), (255,255,255,120), 12)
    neon_text(d, "Fonts: Inter + Noto Sans KR  |  backdrop-filter: blur(20px)", (80, 570), CYAN, 13)
    img.convert("RGB").save(os.path.join(OUT, "gallery-design-system.jpg"), quality=90)

# ──────── Image 5: Claude Code Skills ────────
def gen_skills_page():
    img = Image.new("RGBA", (W,H), (*BG, 255))
    d = ImageDraw.Draw(img, "RGBA")
    draw_grid(d, CYAN, 80, 8)
    draw_glow_circle(d, 700, 100, 180, CYAN, 25)
    neon_text(d, "Claude Code AI Skills", (150, 25), (255,255,255), 32)
    neon_text(d, "25 Skills  |  14 Plugins  |  10 MCP Servers", (150, 70), WHITE_DIM, 16)
    skills = [
        ("/start", "Session Start", INDIGO),
        ("/end", "Session End", INDIGO),
        ("/init", "Project Init", GREEN),
        ("/optimize", "Performance", ORANGE),
        ("/code-review", "Code Review", CYAN),
        ("/frontend-design", "Design", VIOLET),
        ("/animate", "Animation", PINK),
        ("/audit", "Quality Audit", hex_to_rgb("#ef4444")),
        ("/polish", "Final Polish", hex_to_rgb("#8b5cf6")),
    ]
    for i, (cmd, name, color) in enumerate(skills):
        x = 40 + (i % 3) * 260
        y = 120 + (i // 3) * 150
        d.rounded_rectangle([x, y, x+235, y+125], radius=12, fill=(255,255,255,10), outline=(*color, 70))
        d.rounded_rectangle([x+15, y+15, x+15+len(cmd)*9+10, y+42], radius=6, fill=(*color, 40))
        neon_text(d, cmd, (x+22, y+18), color, 14)
        neon_text(d, name, (x+15, y+55), (255,255,255), 20)
        neon_text(d, "Click to expand details", (x+15, y+90), WHITE_DIM, 10)
    d.rounded_rectangle([40, 555, 760, 590], radius=8, fill=(*INDIGO, 25), outline=(*INDIGO, 50))
    neon_text(d, "Admin > Claude Code > AI Skills for full documentation", (80, 562), INDIGO, 14)
    img.convert("RGB").save(os.path.join(OUT, "gallery-skills-page.jpg"), quality=90)

if __name__ == "__main__":
    gen_portal()
    gen_dashboard()
    gen_desk_plan()
    gen_design_system()
    gen_skills_page()
    print("Generated 5 gallery images:")
    for f in sorted(os.listdir(OUT)):
        if f.startswith("gallery-"):
            size = os.path.getsize(os.path.join(OUT, f))
            print(f"  {f}: {size/1024:.1f}KB")
