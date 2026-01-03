"""
PDF Report Generator for FPA Med Document AI
Creates professional PDF exports of forensic analysis results
"""

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from datetime import datetime


def generate_forensic_pdf(analysis, case_info, output_path, original_analysis=None, comments=None):
    """
    Generate professional PDF report from forensic analysis with track changes

    Args:
        analysis: Analysis results dict (edited version)
        case_info: Dict with customer_name, domain, records_analyzed, etc.
        output_path: Where to save the PDF
        original_analysis: Original AI-generated analysis (for track changes)
        comments: Expert comments dict (optional)

    Returns:
        Path to generated PDF
    """
    # Create PDF document
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        rightMargin=72,
        leftMargin=72,
        topMargin=72,
        bottomMargin=18,
    )

    # Container for PDF elements
    story = []

    # Define styles
    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#059669'),  # Emerald
        spaceAfter=30,
        alignment=TA_CENTER
    )

    subtitle_style = ParagraphStyle(
        'CustomSubtitle',
        parent=styles['Normal'],
        fontSize=12,
        textColor=colors.HexColor('#64748b'),  # Slate
        spaceAfter=20,
        alignment=TA_CENTER
    )

    section_header_style = ParagraphStyle(
        'SectionHeader',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.HexColor('#1e293b'),  # Dark slate
        spaceAfter=12,
        spaceBefore=20,
        borderWidth=1,
        borderColor=colors.HexColor('#e2e8f0'),
        borderPadding=8,
        backColor=colors.HexColor('#f8fafc')
    )

    body_style = ParagraphStyle(
        'CustomBody',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#334155'),
        leading=14,
        spaceAfter=8
    )

    alert_style = ParagraphStyle(
        'AlertStyle',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#dc2626'),  # Red
        leading=14,
        spaceAfter=8
    )

    warning_style = ParagraphStyle(
        'WarningStyle',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#d97706'),  # Amber
        leading=14,
        spaceAfter=8
    )

    # Track changes styles
    edited_style = ParagraphStyle(
        'EditedStyle',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#2563eb'),  # Blue
        leading=14,
        spaceAfter=8
    )

    added_style = ParagraphStyle(
        'AddedStyle',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#059669'),  # Green
        leading=14,
        spaceAfter=8
    )

    comment_style = ParagraphStyle(
        'CommentStyle',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.HexColor('#7c3aed'),  # Purple
        leading=12,
        spaceAfter=4,
        leftIndent=20,
        fontName='Helvetica-Oblique'
    )

    # ===== HEADER =====
    story.append(Paragraph("Document Analysis ~ Powered by FPA Med AI", title_style))

    domain_name = case_info.get('domain_name', 'Forensic Analysis')
    story.append(Paragraph(domain_name, subtitle_style))

    # Case metadata table
    metadata = [
        ["Case:", case_info.get('customer_name', 'N/A')],
        ["Date:", datetime.now().strftime("%B %d, %Y")],
        ["Documents Analyzed:", str(case_info.get('records_analyzed', 0))],
    ]

    metadata_table = Table(metadata, colWidths=[2*inch, 4*inch])
    metadata_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#64748b')),
        ('TEXTCOLOR', (1, 0), (1, -1), colors.HexColor('#1e293b')),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))

    story.append(metadata_table)
    story.append(Spacer(1, 0.3*inch))

    # ===== TRACK CHANGES LEGEND (if original analysis provided) =====
    if original_analysis:
        legend_style = ParagraphStyle(
            'LegendStyle',
            parent=styles['Normal'],
            fontSize=9,
            textColor=colors.HexColor('#64748b'),
            leading=12,
            spaceAfter=4
        )

        story.append(Paragraph("<b>Track Changes Legend:</b>", legend_style))
        story.append(Paragraph("✓ AI-Generated (Validated by Expert)", body_style))
        story.append(Paragraph("✏ Edited by Expert", edited_style))
        story.append(Paragraph("✚ Added by Expert", added_style))
        story.append(Paragraph("💬 Expert Comment/Rationale", comment_style))
        story.append(Spacer(1, 0.2*inch))

    # ===== HELPER FUNCTION FOR TRACK CHANGES =====
    def get_change_status(section, index):
        """Determine if an item was unchanged, edited, or added"""
        if not original_analysis or section not in original_analysis:
            return 'added'

        original_items = original_analysis.get(section, [])
        if not isinstance(original_items, list):
            return 'unchanged'

        if index >= len(original_items):
            return 'added'

        if index < len(analysis.get(section, [])):
            if original_items[index] != analysis[section][index]:
                return 'edited'

        return 'unchanged'

    def get_icon_and_style(section, index, default_style, default_icon):
        """Get appropriate icon and style based on change status"""
        if not original_analysis:
            return default_icon, default_style

        status = get_change_status(section, index)
        if status == 'added':
            return '✚', added_style
        elif status == 'edited':
            return '✏', edited_style
        else:
            return '✓', default_style

    # ===== CRITICAL FINDINGS SECTIONS =====
    # Determine which sections to show based on analysis keys
    analysis_keys = list(analysis.keys())

    # Map common analysis keys to sections
    critical_sections = {
        # Medical Chronology pipeline outputs
        'chronology': ('MEDICAL CHRONOLOGY', body_style, '●'),
        'missing_records': ('MISSING RECORDS / GAPS IN CARE', alert_style, '⚠'),
        'red_flags': ('RED FLAGS', alert_style, '⚠'),

        # Common sections across all tiers
        'timeline': ('TIMELINE', body_style, '●'),
        'treatment_gaps': ('TREATMENT GAPS', alert_style, '⚠'),

        # Compliance tier
        'medication_adherence': ('MEDICATION ADHERENCE', body_style, '●'),
        'safety_documentation': ('SAFETY DOCUMENTATION', alert_style, '⚠'),
        'consent_issues': ('CONSENT ISSUES', warning_style, '⚠'),

        # Expert witness tier
        'contradictions': ('CONTRADICTIONS', warning_style, '⚠'),
        'standard_of_care_deviations': ('STANDARD OF CARE DEVIATIONS', alert_style, '⚠'),
        'competency_timeline': ('COMPETENCY TIMELINE', body_style, '●'),
        'expert_opinions_needed': ('EXPERT OPINIONS NEEDED', body_style, '●'),

        # Full discovery tier
        'functional_capacity_timeline': ('FUNCTIONAL CAPACITY TIMELINE', body_style, '●'),
        'suicide_violence_risk_assessment': ('SUICIDE/VIOLENCE RISK ASSESSMENT', alert_style, '⚠'),
        'substance_use_impact': ('SUBSTANCE USE IMPACT', body_style, '●'),
        'legal_psychiatric_interface': ('LEGAL-PSYCHIATRIC INTERFACE', body_style, '●'),
        'causation_analysis': ('CAUSATION ANALYSIS', body_style, '●'),
        'damages_assessment': ('DAMAGES ASSESSMENT', body_style, '●'),
    }

    for key, (title, style, icon) in critical_sections.items():
        if key in analysis and analysis[key]:
            story.append(Paragraph(title, section_header_style))
            story.append(Spacer(1, 0.1*inch))

            for i, item in enumerate(analysis[key]):
                # Get appropriate icon and style based on change status
                change_icon, change_style = get_icon_and_style(key, i, style, icon)

                # Add the finding with change indicator
                story.append(Paragraph(f"{change_icon} {i+1}. {item}", change_style))

                # Add expert comment if exists
                if comments and key in comments and i in comments[key]:
                    comment_text = comments[key][i]
                    story.append(Paragraph(f"💬 <i>Expert Note: {comment_text}</i>", comment_style))

            story.append(Spacer(1, 0.2*inch))

    # Note: Timeline is now handled in critical_sections above

    # ===== FOOTER =====
    story.append(Spacer(1, 0.5*inch))

    footer_text = """
    <para align=center>
    <font size=8 color="#94a3b8">
    This report was generated by FPA Med Discovery Engine<br/>
    Powered by DocETL • Legal-Grade Document Analysis
    </font>
    </para>
    """
    story.append(Paragraph(footer_text, styles['Normal']))

    # Build PDF
    doc.build(story)

    return output_path


def generate_medical_chronology_pdf(analysis, case_info, output_path):
    """
    Specialized medical chronology PDF (backward compatibility)
    """
    return generate_forensic_pdf(analysis, case_info, output_path)
