# 🏛️ Aequitas-Gov: AI Fairness & Governance Layer

A modern, enterprise-grade dashboard for auditing AI loan approval decisions, ensuring transparency, and monitoring model drift.

## 🚀 Getting Started

To run the dashboard locally on your machine:

1. **Navigate to the directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

The app will be available at `http://localhost:5173`.

## 🛠️ Key Features

- **Applicant Queue:** Actionable inbox with biased/unbiased filtering.
- **What-If Simulator:** Real-time human-in-the-loop overrides for loan metrics.
- **SHAP Interpretability:** Visualizing feature importance for AI transparency.
- **MLOps Monitoring:** Live tracking of Population Stability Index (PSI) and data drift.
- **Dual-Theme:** "Feels like home" Light and Dark modes for comfortable auditing.

## 🔗 Backend Integration

This frontend is designed to communicate with a FastAPI backend. To integrate:
1. Update the API base URL in `src/api/config.ts`.
2. Ensure your Python backend is running the fairness engine.

---
Built with React, Vite, Tailwind CSS, and Recharts.
