"""
md_to_pdf.py — 마크다운 파일을 PDF로 변환
사용법: python3 theory/md_to_pdf.py <입력.md> [출력.pdf]
예시:  python3 theory/md_to_pdf.py abuse_scenarios.md
       python3 theory/md_to_pdf.py implementation_basics.md implementation_basics.pdf
출력 경로 생략 시 입력 파일과 같은 위치에 같은 이름으로 저장됨
"""

import sys
import re
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

# ── 한글 폰트 등록 ───────────────────────────────────────────────
FONT_VARIABLE = "/Users/paohree/Library/Fonts/PretendardVariable.ttf"

def register_korean_font():
    """Pretendard Variable TTF 등록 (Regular·Bold 공용)"""
    try:
        pdfmetrics.registerFont(TTFont("Korean",     FONT_VARIABLE))
        pdfmetrics.registerFont(TTFont("KoreanBold", FONT_VARIABLE))
        registerFontFamily("Korean", normal="Korean", bold="KoreanBold",
                           italic="Korean", boldItalic="KoreanBold")
        return True
    except Exception as e:
        print(f"[경고] 한글 폰트 등록 실패: {e}\n → 기본 폰트로 대체됩니다.")
        return False

# ── 스타일 정의 ──────────────────────────────────────────────────
def make_styles(has_korean: bool):
    base = "Korean" if has_korean else "Helvetica"
    bold = "KoreanBold" if has_korean else "Helvetica-Bold"

    return {
        "h1": ParagraphStyle("h1", fontName=bold,   fontSize=16, spaceAfter=6,  spaceBefore=14, textColor=colors.HexColor("#1a1a2e")),
        "h2": ParagraphStyle("h2", fontName=bold,   fontSize=13, spaceAfter=4,  spaceBefore=10, textColor=colors.HexColor("#16213e")),
        "h3": ParagraphStyle("h3", fontName=bold,   fontSize=11, spaceAfter=3,  spaceBefore=8,  textColor=colors.HexColor("#0f3460")),
        "body": ParagraphStyle("body", fontName=base, fontSize=10, spaceAfter=3, leading=16),
        "bold_body": ParagraphStyle("bold_body", fontName=bold, fontSize=10, spaceAfter=3, leading=16),
        "choice": ParagraphStyle("choice", fontName=base, fontSize=10, spaceAfter=1, leading=15, leftIndent=10),
        "code": ParagraphStyle("code", fontName="Courier", fontSize=9, spaceAfter=3, leading=14,
                               backColor=colors.HexColor("#f4f4f4"), leftIndent=8, rightIndent=8),
        "hr": ParagraphStyle("hr", fontName=base, fontSize=1),
        "table_header": ParagraphStyle("table_header", fontName=bold, fontSize=9, leading=13, alignment=1),
        "table_cell":   ParagraphStyle("table_cell",   fontName=base, fontSize=9, leading=13),
    }

# ── 인라인 마크다운 처리 ─────────────────────────────────────────
def inline_md(text: str, styles: dict, bold_style: bool = False) -> str:
    """**bold**, `code` 인라인 변환 (ReportLab XML)"""
    # & < > 이스케이프
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    # **bold**
    text = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text)
    # `code`
    text = re.sub(r'`(.+?)`', r'<font name="Courier" size="9">\1</font>', text)
    return text

# ── 마크다운 파싱 ────────────────────────────────────────────────
def parse_markdown(md_text: str, styles: dict):
    """마크다운을 ReportLab flowable 리스트로 변환"""
    story = []
    lines = md_text.splitlines()
    i = 0

    while i < len(lines):
        line = lines[i]

        # 빈줄
        if not line.strip():
            story.append(Spacer(1, 3))
            i += 1
            continue

        # 수평선
        if re.match(r'^-{3,}$', line.strip()) or re.match(r'^={3,}$', line.strip()):
            story.append(Spacer(1, 2))
            story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cccccc")))
            story.append(Spacer(1, 4))
            i += 1
            continue

        # 제목
        m = re.match(r'^(#{1,3})\s+(.*)', line)
        if m:
            level = len(m.group(1))
            text  = inline_md(m.group(2), styles)
            key   = f"h{level}" if level <= 3 else "h3"
            story.append(Paragraph(text, styles[key]))
            i += 1
            continue

        # 테이블 (|로 시작하는 줄 연속)
        if line.strip().startswith("|"):
            table_lines = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                table_lines.append(lines[i])
                i += 1
            story += build_table(table_lines, styles)
            continue

        # 블록쿼트 (> ...)
        if line.startswith(">"):
            text = inline_md(line.lstrip("> ").strip(), styles)
            bq_style = ParagraphStyle("bq", parent=styles["body"],
                                      leftIndent=12, textColor=colors.HexColor("#555555"),
                                      borderPad=4)
            story.append(Paragraph(f"<i>{text}</i>", bq_style))
            i += 1
            continue

        # 목록 (- / * / 숫자.)
        m_ul = re.match(r'^(\s*)[-*]\s+(.*)', line)
        m_ol = re.match(r'^(\s*)\d+\.\s+(.*)', line)
        if m_ul or m_ol:
            indent = len((m_ul or m_ol).group(1))
            text   = inline_md((m_ul or m_ol).group(2), styles)
            bullet = "•" if m_ul else ""
            li_style = ParagraphStyle("li", parent=styles["body"], leftIndent=12 + indent * 4,
                                      firstLineIndent=-8)
            story.append(Paragraph(f"{bullet} {text}" if bullet else text, li_style))
            i += 1
            continue

        # 일반 텍스트
        text = inline_md(line.strip(), styles)
        # 보기 선지 (①②③④ 로 시작)
        if re.match(r'^[①②③④⑤]', line.strip()):
            story.append(Paragraph(text, styles["choice"]))
        else:
            story.append(Paragraph(text, styles["body"]))
        i += 1

    return story

# ── 테이블 빌더 ──────────────────────────────────────────────────
def build_table(table_lines: list, styles: dict):
    rows = []
    is_header_row = True
    for line in table_lines:
        # 구분선 행 skip
        if re.match(r'^\|[-| :]+\|$', line.strip()):
            is_header_row = False
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        style = styles["table_header"] if is_header_row else styles["table_cell"]
        rows.append([Paragraph(inline_md(c, styles), style) for c in cells])
        if is_header_row:
            is_header_row = False

    if not rows:
        return []

    col_count = len(rows[0])
    avail_w = A4[0] - 40 * mm
    col_w = [avail_w / col_count] * col_count

    t = Table(rows, colWidths=col_w, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND",  (0, 0), (-1, 0),  colors.HexColor("#e8eaf6")),
        ("TEXTCOLOR",   (0, 0), (-1, 0),  colors.HexColor("#1a1a2e")),
        ("GRID",        (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f9f9f9")]),
        ("VALIGN",      (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",  (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING",(0, 0), (-1, -1), 6),
    ]))
    return [Spacer(1, 4), t, Spacer(1, 4)]

# ── 메인 ─────────────────────────────────────────────────────────
def convert(md_path: str, pdf_path: str = None):
    md_file = Path(md_path)
    if not md_file.exists():
        print(f"[오류] 파일 없음: {md_path}")
        sys.exit(1)

    if pdf_path is None:
        pdf_path = str(md_file.with_suffix(".pdf"))

    print(f"변환 중: {md_file.name} → {Path(pdf_path).name}")

    has_korean = register_korean_font()
    styles = make_styles(has_korean)

    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=A4,
        rightMargin=20 * mm, leftMargin=20 * mm,
        topMargin=20 * mm,   bottomMargin=20 * mm,
    )

    md_text = md_file.read_text(encoding="utf-8")
    story   = parse_markdown(md_text, styles)

    doc.build(story)
    print(f"완료: {pdf_path}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(0)
    md_in  = sys.argv[1]
    pdf_out = sys.argv[2] if len(sys.argv) >= 3 else None
    convert(md_in, pdf_out)
