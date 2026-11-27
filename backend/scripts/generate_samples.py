"""Generate demo resume files (DOCX + PDF) from app/sample_data.py into data/sample_resumes/."""
import sys, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from app.sample_data import SAMPLE_RESUMES

HEADERS = {"summary", "profile", "objective", "skills", "technical skills", "experience", "work experience",
           "education", "projects", "certifications", "achievements"}

def make_docx(name, text, out):
    import docx
    from docx.shared import Pt
    d = docx.Document()
    d.styles["Normal"].font.name = "Calibri"; d.styles["Normal"].font.size = Pt(10.5)
    for i, line in enumerate(text.strip().split("\n")):
        if i == 0:
            p = d.add_paragraph(); r = p.add_run(line); r.bold = True; r.font.size = Pt(18); continue
        if line.strip().lower() in HEADERS:
            p = d.add_paragraph(); r = p.add_run(line.strip().upper()); r.bold = True; r.font.size = Pt(12); continue
        d.add_paragraph(line)
    d.save(out)

def make_pdf(name, text, out):
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas
    c = canvas.Canvas(str(out), pagesize=A4); w, h = A4; y = h - 50
    for i, line in enumerate(text.strip().split("\n")):
        is_h = line.strip().lower() in HEADERS
        c.setFont("Helvetica-Bold" if (i == 0 or is_h) else "Helvetica", 16 if i == 0 else 11 if is_h else 10)
        c.drawString(50, y, (line.strip().upper() if is_h else line)[:110]); y -= 22 if i == 0 else 14
        if y < 50: c.showPage(); y = h - 50
    c.save()

if __name__ == "__main__":
    out = ROOT / "data" / "sample_resumes"; out.mkdir(parents=True, exist_ok=True)
    for i, (k, t) in enumerate(SAMPLE_RESUMES.items()):
        make_docx(k, t, out / f"{k}.docx")
        if i % 2 == 0: make_pdf(k, t, out / f"{k}.pdf")
    print("wrote", len(list(out.iterdir())), "files to", out)
