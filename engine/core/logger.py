import firebase_admin
from firebase_admin import credentials, firestore
import json
import os
import io
import base64
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors

db = None
try:
    if not firebase_admin._apps:
        sa_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        sa_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")

        if sa_json:
            cred = credentials.Certificate(json.loads(sa_json))
        elif sa_path:
            cred = credentials.Certificate(sa_path)
        else:
            cred = credentials.ApplicationDefault()

        firebase_admin.initialize_app(cred)
    db = firestore.client()
except Exception as e:
    print(f"Firestore init skipped/failed. Using fallback logging.")

async def log_to_firestore(record: dict) -> str:
    """Async write to Firestore or local fallback."""
    if db is not None:
        try:
            doc_ref = db.collection("loan_audits").document()
            doc_ref.set(record)
            return "Firestore Success"
        except Exception as e:
            print(f"Firestore write error: {e}")
            pass
            
    # Local fallback
    fallback_file = "fallback_log.json"
    logs = []
    if os.path.exists(fallback_file):
        with open(fallback_file, "r") as f:
            try:
                logs = json.load(f)
            except:
                pass
    logs.append(record)
    with open(fallback_file, "w") as f:
        json.dump(logs, f, indent=2)
    return "Local Fallback Success"

def generate_pdf_report(applicant_state: dict) -> str:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()
    elements = []
    
    # 1. Header
    elements.append(Paragraph(f"Aequitas-Gov Compliance Audit", styles['Heading1']))
    elements.append(Paragraph(f"Applicant ID: {applicant_state.get('Applicant_ID', 'N/A')}", styles['Heading2']))
    elements.append(Spacer(1, 12))
    
    # 2. Applicant Profile Table
    data = [["Feature", "Value"]]
    features = ['Income', 'Credit_Score', 'Age', 'Employment_Years', 'Debt_to_Income', 'Gender', 'Zip_Code', 'Loan_Amount']
    for f in features:
        data.append([f, str(applicant_state.get(f, 'N/A'))])
        
    t = Table(data, colWidths=[200, 200])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.grey),
        ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0,0), (-1,0), 12),
        ('BACKGROUND', (0,1), (-1,-1), colors.beige),
        ('GRID', (0,0), (-1,-1), 1, colors.black)
    ]))
    elements.append(t)
    elements.append(Spacer(1, 12))
    
    # 3. Model Analysis
    elements.append(Paragraph("Model & Fairness Analysis", styles['Heading2']))
    elements.append(Paragraph(f"Original Score: {applicant_state.get('original_score', 'N/A')}", styles['Normal']))
    elements.append(Paragraph(f"Adjusted Score: {applicant_state.get('adjusted_score', 'N/A')}", styles['Normal']))
    elements.append(Paragraph(f"Final Decision: {'Approved' if applicant_state.get('final_decision') else 'Rejected'}", styles['Normal']))
    elements.append(Spacer(1, 12))
    
    # 4. Rationale
    elements.append(Paragraph("Explanation", styles['Heading2']))
    gemini_exp = applicant_state.get('gemini_explanation', '{}')
    try:
        exp_text = json.loads(gemini_exp).get("explanation", gemini_exp)
    except:
        exp_text = gemini_exp
    elements.append(Paragraph(exp_text, styles['Normal']))
    
    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    
    b64 = base64.b64encode(pdf_bytes).decode()
    return b64
