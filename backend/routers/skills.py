"""스킬 목록 및 상세 정보 API -- .claude/skills/ 디렉토리를 스캔"""
import re
from pathlib import Path
from fastapi import APIRouter, HTTPException

router = APIRouter()

SKILLS_DIR = Path(__file__).resolve().parent.parent.parent / ".claude" / "skills"


def _parse_skill(skill_dir: Path) -> dict | None:
    skill_file = skill_dir / "SKILL.md"
    if not skill_file.exists():
        return None
    text = skill_file.read_text(encoding="utf-8")

    meta = {}
    body = text
    fm_match = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)$", text, re.DOTALL)
    if fm_match:
        for line in fm_match.group(1).splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                meta[k.strip()] = v.strip()
        body = fm_match.group(2)

    return {
        "key": skill_dir.name,
        "name": meta.get("name", skill_dir.name),
        "description": meta.get("description", ""),
        "user_invocable": meta.get("user-invocable", "false").lower() == "true",
        "body": body.strip(),
    }


@router.get("/list")
def list_skills():
    if not SKILLS_DIR.exists():
        return []
    skills = []
    for d in sorted(SKILLS_DIR.iterdir()):
        if d.is_dir():
            parsed = _parse_skill(d)
            if parsed:
                skills.append({
                    "key": parsed["key"],
                    "name": parsed["name"],
                    "description": parsed["description"],
                    "user_invocable": parsed["user_invocable"],
                })
    return skills


@router.get("/{skill_key}")
def get_skill(skill_key: str):
    skill_dir = SKILLS_DIR / skill_key
    if not skill_dir.exists():
        raise HTTPException(status_code=404, detail="Skill not found")
    parsed = _parse_skill(skill_dir)
    if not parsed:
        raise HTTPException(status_code=404, detail="SKILL.md not found")
    return parsed
