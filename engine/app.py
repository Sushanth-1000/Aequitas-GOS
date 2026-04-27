import streamlit as st
import pandas as pd
import numpy as np
import pickle
import asyncio
import json
import time
import streamlit.components.v1 as components
import plotly.graph_objects as go

from core.audit import validate_features_for_inference
from core.policy import enforce_policy
from core.explainability import generate_explanation
from core.logger import log_to_firestore, generate_pdf_report
import shap

st.set_page_config(page_title="Aequitas-Gov", layout="wide", initial_sidebar_state="expanded")

# --- CUSTOM ZOOM INJECTION ---
components.html("""
    <script>
        let currentZoom = 1.0;
        document.addEventListener('keydown', function(event) {
            if (event.ctrlKey) {
                if (event.key === '=' || event.key === '+') {
                    event.preventDefault();
                    currentZoom += 0.1;
                    window.parent.document.body.style.zoom = currentZoom;
                } else if (event.key === '-') {
                    event.preventDefault();
                    currentZoom -= 0.1;
                    window.parent.document.body.style.zoom = currentZoom;
                } else if (event.key === '0') {
                    event.preventDefault();
                    currentZoom = 1.0;
                    window.parent.document.body.style.zoom = currentZoom;
                }
            }
        });
    </script>
""", height=0)

@st.cache_resource
def load_models():
    with open('models/model.pkl', 'rb') as f:
        model = pickle.load(f)
    with open('models/explainer.pkl', 'rb') as f:
        explainer = pickle.load(f)
    with open('models/features.pkl', 'rb') as f:
        features = pickle.load(f)
    return model, explainer, features

@st.cache_resource
def load_data():
    return pd.read_csv('data/synthetic_applicants.csv')

def main():
    # Inject Custom CSS for Professional UI
    st.markdown("""
        <style>
        .main { background-color: #f8f9fa; }
        .stMetric { background-color: #ffffff; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); border-left: 4px solid #1e3d59; }
        h1, h2, h3 { color: #1e3d59; font-weight: 600; }
        .stButton>button { background-color: #1e3d59; color: white; border-radius: 6px; font-weight: 500; padding: 0.5rem 1rem; border: none; }
        .stButton>button:hover { background-color: #ff6e40; color: white; border: none; }
        
        /* Thinner, neutral sliders */
        div[data-baseweb="slider"] > div { background-color: #e0e0e0; height: 4px; }
        div[data-baseweb="slider"] > div > div { background-color: #1e3d59; height: 4px; }
        
        /* Governance top banner padding */
        .gov-banner { padding: 12px; text-align: center; font-weight: bold; font-size: 18px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .gov-on { background-color: #4CAF50; color: white; border: 2px solid #388E3C; }
        .gov-off { background-color: #F44336; color: white; border: 2px solid #D32F2F; }
        </style>
    """, unsafe_allow_html=True)

    try:
        model, explainer, features = load_models()
        df = load_data()
    except Exception as e:
        st.error(f"Failed to load models/data: {e}. Please run data_generator.py and train_model.py first.")
        return

    # Initialize Session State
    if 'active_applicant' not in st.session_state:
        st.session_state.active_applicant = 'A001'
    if 'policy_mode' not in st.session_state:
        st.session_state.policy_mode = 'enforcement'
    if 'drift_batch' not in st.session_state:
        st.session_state.drift_batch = 1
    if 'is_simulating' not in st.session_state:
        st.session_state.is_simulating = False
    if 'gov_toggle' not in st.session_state:
        st.session_state.gov_toggle = True

    # Governance Top Banner & Toggle
    colA, colB = st.columns([3, 1])
    with colA:
        st.title("🏛️ Aequitas-Gov: Fairness Layer")
    with colB:
        st.markdown("<br>", unsafe_allow_html=True)
        gov_mode = st.toggle("🛡️ Governance Mode", value=st.session_state.gov_toggle)
        st.session_state.gov_toggle = gov_mode

    if st.session_state.gov_toggle:
        st.markdown("<div class='gov-banner gov-on'>✅ Governance Mode: ON (Active Bias Correction & Protection)</div>", unsafe_allow_html=True)
    else:
        st.markdown("<div class='gov-banner gov-off'>⚠️ Governance Mode: OFF (Exposing Raw ML Model Outputs)</div>", unsafe_allow_html=True)

    tab1, tab2, tab3 = st.tabs(["📋 Applicant Queue", "🔍 Audit & Override", "📊 System Metrics & MLOps"])
    
    # Active Rules parsing
    default_rules = {
      "active_mode": st.session_state.policy_mode,
      "decision_rules": [
        {
          "rule_id": "R001",
          "priority": 1,
          "condition": {"metric": "DIR", "operator": "<", "value": 0.8, "target_group": "Gender=Female"},
          "action": {"type": "score_multiplier", "value": 1.15}
        }
      ]
    }
    active_rules = default_rules # Fallback/global access

    with tab3:
        st.header("📊 System Metrics & MLOps")
        col1, col2 = st.columns(2)
        
        with col1:
            st.subheader("⚖️ Policy Engine Rules")
            policy_json = st.text_area("Rules JSON", json.dumps(default_rules, indent=2), height=250)
            try:
                active_rules = json.loads(policy_json)
                st.session_state.policy_mode = active_rules.get('active_mode', 'enforcement')
            except:
                st.error("Invalid JSON format.")
        
        with col2:
            st.subheader("📈 Continuous Drift Monitoring")
            sim_col1, sim_col2 = st.columns([1, 1])
            with sim_col1:
                batch_sel = st.selectbox("Time Progression (Batch)", [1, 2, 3], index=st.session_state.drift_batch-1)
                st.session_state.drift_batch = batch_sel
            with sim_col2:
                st.markdown("<br>", unsafe_allow_html=True)
                if st.button("🚀 Start Live Simulation"):
                    st.session_state.is_simulating = True
                    st.session_state.drift_batch = 1
                    st.rerun()
            
            st.markdown("---")
            metric_placeholder = st.empty()
            alert_placeholder = st.empty()
            
            def render_metrics(b_val):
                if b_val == 1:
                    psi, p_dir = 0.05, 0.85
                    status, color = "Stable", "green"
                elif b_val == 2:
                    psi, p_dir = 0.12, 0.78
                    status, color = "Warning", "orange"
                else:
                    psi, p_dir = 0.25, 0.72
                    status, color = "Alert", "red"
                
                with metric_placeholder.container():
                    mc1, mc2 = st.columns(2)
                    mc1.metric("Population Stability Index (PSI)", f"{psi:.2f}", delta=status, delta_color="inverse" if status=="Alert" else "normal")
                    mc2.metric("Global DIR", f"{p_dir:.2f}", delta="Warning" if p_dir < 0.8 else "Healthy", delta_color="normal")
                
                if psi > 0.2:
                    alert_placeholder.error("🚨 **DATA DRIFT DETECTED**: PSI exceeds 0.20 threshold.")
                    if alert_placeholder.button("Trigger Retraining Pipeline"):
                        alert_placeholder.success("✅ MLOps pipeline triggered. Retraining initiated.")
                else:
                    alert_placeholder.empty()

            render_metrics(st.session_state.drift_batch)

    with tab1:
        st.header("📋 Applicant Queue")
        
        # Categorical Filters
        with st.expander("🔍 Filter Applicant Queue", expanded=False):
            f_col1, f_col2 = st.columns(2)
            with f_col1:
                f_gender = st.multiselect("Gender", df['Gender'].unique())
            with f_col2:
                f_zip = st.multiselect("Zip Code", df['Zip_Code'].unique())
            apply_btn = st.button("Apply Filters")
            
            if 'queue_filters' not in st.session_state:
                st.session_state.queue_filters = {'gender': [], 'zip': []}
                
            if apply_btn:
                st.session_state.queue_filters = {'gender': f_gender, 'zip': f_zip}
                
        filtered_df = df.copy()
        if st.session_state.queue_filters['gender']:
            filtered_df = filtered_df[filtered_df['Gender'].isin(st.session_state.queue_filters['gender'])]
        if st.session_state.queue_filters['zip']:
            filtered_df = filtered_df[filtered_df['Zip_Code'].isin(st.session_state.queue_filters['zip'])]
            
        num_records = st.session_state.drift_batch * 8
        display_df = filtered_df.head(num_records)
        
        st.markdown("### Actionable Inbox")
        
        # Render clean Action Column layout instead of raw HTML
        header_cols = st.columns([1, 1, 1, 2, 1])
        header_cols[0].write("**ID**")
        header_cols[1].write("**Gender**")
        header_cols[2].write("**Income**")
        header_cols[3].write("**System Status / Bias Tags**")
        header_cols[4].write("**Action**")
        st.markdown("---")
        
        for idx, row in display_df.iterrows():
            cols = st.columns([1, 1, 1, 2, 1])
            cols[0].write(f"`{row['Applicant_ID']}`")
            cols[1].write(row['Gender'])
            cols[2].write(f"${row['Income']:,.0f}")
            
            # Real-time tagging
            infer_payload = pd.DataFrame([row])
            infer_payload = infer_payload[['Income', 'Credit_Score', 'Employment_Years', 'Debt_to_Income', 'Loan_Amount']]
            prob = float(model.predict_proba(infer_payload)[0][0])
            dir_metric = 0.72 if st.session_state.drift_batch == 3 else 0.85
            
            # We enforce policy just to see what the governance layer *would* do
            final_dec, applied_rule, adj_score = enforce_policy(prob, dir_metric, row.to_dict(), active_rules)
            
            tags = []
            if prob < 0.5 and final_dec:
                tags.append('<span style="background-color:#FFC107; color:black; padding:3px 6px; border-radius:4px; font-size:12px; margin-right:5px;">🟡 Auto-Corrected</span>')
                tags.append('<span style="background-color:#F44336; color:white; padding:3px 6px; border-radius:4px; font-size:12px;">🔴 Biased</span>')
            elif prob >= 0.5:
                tags.append('<span style="background-color:#4CAF50; color:white; padding:3px 6px; border-radius:4px; font-size:12px;">🟢 Unbiased & Approved</span>')
            else:
                tags.append('<span style="background-color:#F44336; color:white; padding:3px 6px; border-radius:4px; font-size:12px; margin-right:5px;">🔴 Needs Review</span>')
                tags.append('<span style="background-color:#F44336; color:white; padding:3px 6px; border-radius:4px; font-size:12px;">🔴 Biased</span>')
                
            cols[3].markdown(" ".join(tags), unsafe_allow_html=True)
            
            if cols[4].button("🔍 Audit", key=f"btn_{row['Applicant_ID']}"):
                st.session_state.active_applicant = row['Applicant_ID']
                st.rerun()

    with tab2:
        st.header("🔍 Audit & Override")
        try:
            applicant_row = df[df['Applicant_ID'] == st.session_state.active_applicant].iloc[0].to_dict()
        except:
            st.error("Applicant ID not found in current dataset. Please select a valid applicant from Tab 1.")
            applicant_row = None
            
        if applicant_row:
            st.markdown(f"**Analyzing Applicant:** `{applicant_row['Applicant_ID']}`")
            
            try:
                validate_features_for_inference(applicant_row)
            except Exception as e:
                st.error(str(e))
                st.stop()
                
            col1, col2 = st.columns([1, 1.5])
            
            with col1:
                with st.container(border=True):
                    st.subheader("🎛️ What-If Simulator", help="Test hypothetical scenarios by adjusting features to see how the model and fairness layer react.")
                    new_income = st.slider("Income", 20000.0, 250000.0, float(applicant_row['Income']))
                    new_credit = st.slider("Credit Score", 300, 850, int(applicant_row['Credit_Score']))
                    new_age = st.slider("Age", 18, 80, int(applicant_row['Age']))
                    new_dti = st.slider("Debt to Income", 0.0, 1.0, float(applicant_row['Debt_to_Income']))
                    new_loan = st.slider("Loan Amount", 1000.0, 100000.0, float(applicant_row['Loan_Amount']))
                
                infer_payload = pd.DataFrame([{
                    'Income': new_income,
                    'Credit_Score': new_credit,
                    'Employment_Years': applicant_row['Employment_Years'],
                    'Debt_to_Income': new_dti,
                    'Loan_Amount': new_loan
                }])
                
                prob = model.predict_proba(infer_payload)[0][1]
                prob_approve = model.predict_proba(infer_payload)[0][0]
                score = float(prob_approve)
                dir_metric = 0.72 if st.session_state.drift_batch == 3 else 0.85
                
                if st.session_state.gov_toggle:
                    final_decision, applied_rule, adjusted_score = enforce_policy(score, dir_metric, applicant_row, active_rules)
                else:
                    final_decision = score >= 0.5
                    applied_rule = "None (Governance Off)"
                    adjusted_score = score
                
                with st.container(border=True):
                    st.subheader("📊 Decision Metrics", help="Displays the raw AI score vs. the policy-adjusted score and the final outcome.")
                    st.metric("Original Model Score", f"{score:.2f}")
                    if st.session_state.gov_toggle and adjusted_score != score:
                        st.metric("Adjusted Score (Policy)", f"{adjusted_score:.2f}", delta=f"+{(adjusted_score-score):.2f}")
                    elif not st.session_state.gov_toggle:
                        st.caption("⚠️ Policy adjustments are disabled. Showing raw model outcome.")
                        
                    dec_color = "normal" if final_decision else "inverse"
                    st.metric("Final Decision", "Approved" if final_decision else "Rejected", 
                              delta="Approved" if final_decision else "Rejected", delta_color=dec_color)

            with col2:
                with st.container(border=True):
                    st.subheader("🧠 SHAP Feature Importance", help="Visualizes which applicant attributes pushed the decision toward approval or rejection.")
                    X_trans = model.named_steps['preprocessor'].transform(infer_payload)
                    shap_values = explainer.shap_values(X_trans)
                    val = shap_values[0] if isinstance(shap_values, list) else shap_values[0]
                    
                    # Convert to Plotly for interactiveness & tooltips
                    impacts = list(val)
                    sorted_idx = np.argsort(np.abs(impacts))
                    sorted_features = [features[i] for i in sorted_idx]
                    sorted_impacts = [impacts[i] for i in sorted_idx]
                    
                    # Color standardization: Red for neg, Green for pos
                    bar_colors = ['#F44336' if x < 0 else '#4CAF50' for x in sorted_impacts]
                    
                    # Highlight top 2 contributing features (most absolute impact)
                    if len(bar_colors) >= 1: bar_colors[-1] = '#1e3d59' # Top 1 Dark Blue
                    if len(bar_colors) >= 2: bar_colors[-2] = '#2196F3' # Top 2 Light Blue
                    
                    fig = go.Figure(go.Bar(
                        x=sorted_impacts,
                        y=sorted_features,
                        orientation='h',
                        marker_color=bar_colors,
                        text=[f"{x:+.2f}" for x in sorted_impacts],
                        textposition='outside',
                        hoverinfo="text",
                        hovertext=[f"<b>{f}</b><br>Impact on Prediction: {x:+.2f}" for f, x in zip(sorted_features, sorted_impacts)]
                    ))
                    fig.update_layout(
                        margin=dict(l=0, r=0, t=10, b=0),
                        height=350,
                        xaxis_title="Impact on Prediction",
                        plot_bgcolor='rgba(0,0,0,0)'
                    )
                    st.plotly_chart(fig, use_container_width=True)
                
                with st.container(border=True):
                    st.subheader("🤖 AI Explanation", help="A plain-English summary of the decision rationale generated by Gemini.")
                    top_feature_idx = np.argmax(np.abs(val))
                    top_feature = features[top_feature_idx]
                    
                    ctx = {
                        "applicant_id": applicant_row['Applicant_ID'],
                        "original_score": round(score, 2),
                        "policy_rule": applied_rule,
                        "final_decision": "Approved" if final_decision else "Rejected",
                        "top_feature": top_feature
                    }
                    
                    if st.button("✨ Generate Explanation"):
                        with st.spinner("Calling Gemini..."):
                            exp_json = generate_explanation(ctx)
                            try:
                                exp_dict = json.loads(exp_json)
                                st.info(f"**Explanation:** {exp_dict.get('explanation', exp_json)}")
                            except:
                                st.info(f"**Explanation:** {exp_json}")
                
                with st.container(border=True):
                    st.subheader("📝 Action & Audit", help="Finalize the human-in-the-loop review by saving the decision to the immutable audit log.")
                    if st.button("✅ Approve Override & Log to Trace"):
                        with st.spinner("Logging to secure audit trail..."):
                            record = {
                                "applicant_id": applicant_row['Applicant_ID'],
                                "original_score": score,
                                "adjusted_score": adjusted_score,
                                "final_decision": bool(final_decision),
                                "policy_applied": applied_rule,
                                "timestamp": pd.Timestamp.now().isoformat()
                            }
                            asyncio.run(log_to_firestore(record))
                            
                            b64_pdf = generate_pdf_report(record)
                            href = f'<a href="data:application/pdf;base64,{b64_pdf}" download="audit_report.pdf"><button style="background-color:#4CAF50;color:white;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;">📄 Download PDF Audit Trail</button></a>'
                            st.markdown(href, unsafe_allow_html=True)
                            st.success("Successfully logged to trace system. PDF is ready for download.")

    # Execute simulation loop at the end so the entire UI has been rendered
    if st.session_state.is_simulating:
        time.sleep(1.5)
        if st.session_state.drift_batch < 3:
            st.session_state.drift_batch += 1
            st.rerun()
        else:
            st.session_state.is_simulating = False
            st.rerun()

if __name__ == "__main__":
    main()
