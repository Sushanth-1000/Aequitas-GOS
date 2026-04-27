# Comparison: Aequitas-OS vs Aequitas-Gov

This document compares the first plan (**Aequitas-OS**, an invasive fairness runtime) and the second plan (**Aequitas-Gov**, a non-invasive governance wrapper layer).

## 1. Overview and Core Philosophy
- **Aequitas-OS (Plan 1):** Focuses on being a foundational runtime and compiler. It takes an *invasive* approach to fairness by modifying the underlying model during training via custom loss functions (PyTorch) and performing data remediation (SMOTE) before training.
- **Aequitas-Gov (Plan 2):** Acts as a non-invasive wrapper or *governance layer*. It assumes the presence of an existing bank model (or simple classifier) and applies policy-based corrections *after* the model outputs a score, backed by human-in-the-loop approvals and GenAI explanations.

## 2. Architectural Differences
- **Model Intervention:** 
  - **OS** intervenes during backpropagation (The Engine Room) to force a compromise between accuracy and fairness mathematically.
  - **Gov** intercepts the final decision, auditing and optionally overriding it via policy rules without touching the model weights.
- **Explanation & Transparency:** 
  - **OS** relies on an M&A Forensic Scanner to visualize counterfactuals and prove robustness.
  - **Gov** integrates the Gemini API to generate plain-English summaries explaining *why* a decision changed or why a drift alert was raised.
- **Human Oversight:**
  - **OS** utilizes a "Dynamic Policy Toggle" (via a FastAPI interceptor) that automatically enforces rules based on a JSON config.
  - **Gov** explicitly includes a **Human Review Gate** that requires human operators to approve, reject, or modify major policy changes triggered by drift.

## 3. Technology Stack
- **Common Elements:** Both use Streamlit for the main UI dashboard, JSON for policy definition, and SQLite for an immutable audit ledger.
- **Aequitas-OS Specifics:** PyTorch (for custom loss functions), FastAPI (for the Zero-Latency Interceptor).
- **Aequitas-Gov Specifics:** Cloud Run (for deployment), Gemini API (for explainability), standard ML libraries like scikit-learn for simple baseline models (Logistic Regression / Random Forest).

## 4. Strengths for Hackathon Demo
- **Aequitas-OS:** Demonstrates strong technical depth. Building a custom PyTorch loss function shows advanced AI engineering and solves the problem at the root.
- **Aequitas-Gov:** Extremely practical, business-ready, and highly relevant. The addition of Gemini for clear explanations and a human review gate aligns perfectly with current enterprise AI governance needs and regulatory frameworks. It is also likely easier to deploy cleanly on Cloud Run without the heavy dependency footprint of PyTorch.
