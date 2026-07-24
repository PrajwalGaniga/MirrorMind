import re

with open("c:/Users/ASUS/OneDrive/Desktop/Projects/MirrorMind/frontend/src/index.css", "r", encoding="utf-8") as f:
    content = f.read()

# Replace :root tokens
root_replacement = """:root {
  --bg-primary: #ECE8E6;
  --bg-secondary: #FFFFFF;
  --bg-card: #FFFFFF;
  --bg-card-hover: #FAFAFA;
  --bg-glass: #FFFFFF;

  --accent-primary: #DCC8FF;
  --accent-secondary: #CFF3B2;
  --accent-cyan: #CFF3B2;
  --accent-emerald: #CFF3B2;
  --accent-rose: #FFB7B7;
  --accent-amber: #FFDCA8;

  --gradient-primary: #DCC8FF;
  --gradient-glow: none;
  --gradient-card: none;
  --gradient-hero: #ECE8E6;

  --text-primary: #111111;
  --text-secondary: #3A3A3A;
  --text-muted: #6B6B6B;

  --border-subtle: #000000;
  --border-card: #000000;
  --border-glow: #000000;

  --radius-sm: 8px;
  --radius-md: 14px;
  --radius-lg: 24px;
  --radius-xl: 24px;
  --radius-full: 9999px;

  --shadow-card: 4px 4px 0px rgba(0, 0, 0, 1);
  --shadow-glow: none;
  --shadow-lg: 6px 6px 0px rgba(0, 0, 0, 1);
  --shadow-hover: 2px 2px 0px rgba(0, 0, 0, 1);

  --font-sans: 'Inter', system-ui, sans-serif;
  --font-display: 'Inter', system-ui, sans-serif;

  --transition: 0.25s ease-out;
  --transition-slow: 0.4s ease-out;
}"""
content = re.sub(r':root\s*\{.*?(?=\n\})\}', root_replacement, content, flags=re.DOTALL)

# Button changes
content = content.replace("border: none;", "border: 3px solid #000;")
content = content.replace("box-shadow: 0 4px 15px rgba(99,102,241,0.35);", "box-shadow: var(--shadow-card);")
content = content.replace("box-shadow: 0 6px 20px rgba(99,102,241,0.5);", "box-shadow: var(--shadow-hover);")
content = content.replace("transform: translateY(-1px);", "transform: scale(0.98);")

# Backgrounds
content = re.sub(r'background: linear-gradient\([^)]+\);', 'background: var(--bg-card);', content)
content = re.sub(r'background: radial-gradient\([^)]+\);', 'background: var(--bg-primary);', content)

# Dashboard Hero
content = content.replace("background: linear-gradient(135deg, #0f1629 0%, #141d35 100%);", "background: var(--bg-primary);")
content = content.replace("border-bottom: 1px solid var(--border-card);", "border-bottom: 3px solid #000;")

# Cards
content = content.replace("border: 1px solid var(--border-card);", "border: 3px solid var(--border-card);")
content = content.replace("border-bottom: 1px solid var(--border-card);", "border-bottom: 3px solid var(--border-card);")
content = content.replace("border-right: 1px solid var(--border-card);", "border-right: 3px solid var(--border-card);")
content = content.replace("border: 1px solid rgba", "border: 3px solid rgba")
content = content.replace("border: 2px solid var(--border-card);", "border: 3px solid var(--border-card);")

# Update inputs
content = content.replace("appearance: none;", "appearance: none;\n  box-shadow: var(--shadow-card);")
content = content.replace("box-shadow: 0 0 0 3px rgba(99,102,241,0.15);", "box-shadow: var(--shadow-hover);\n  transform: translate(2px, 2px);")

# Card borders specifically
content = content.replace("box-shadow: var(--shadow-card);", "box-shadow: var(--shadow-card);\n  border: 3px solid #000;")

with open("c:/Users/ASUS/OneDrive/Desktop/Projects/MirrorMind/frontend/src/index.css", "w", encoding="utf-8") as f:
    f.write(content)
