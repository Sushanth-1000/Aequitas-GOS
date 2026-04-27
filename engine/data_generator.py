import pandas as pd
import numpy as np
import uuid
import os

def generate_data(num_records=1000, seed=42):
    np.random.seed(seed)
    
    # Generate random features
    incomes = np.random.normal(loc=70000, scale=30000, size=num_records)
    incomes = np.clip(incomes, 20000.0, 250000.0)
    
    credit_scores = np.random.normal(loc=650, scale=80, size=num_records)
    credit_scores = np.clip(credit_scores, 300, 850).astype(int)
    
    ages = np.random.randint(18, 81, size=num_records)
    
    employment_years = np.random.normal(loc=5, scale=5, size=num_records)
    employment_years = np.clip(employment_years, 0.0, 40.0)
    
    debt_to_incomes = np.random.normal(loc=0.3, scale=0.15, size=num_records)
    debt_to_incomes = np.clip(debt_to_incomes, 0.0, 1.0)
    
    genders = np.random.choice(['Male', 'Female', 'Other'], size=num_records, p=[0.48, 0.48, 0.04])
    
    zip_codes = [str(np.random.randint(10000, 99999)) for _ in range(num_records)]
    
    loan_amounts = np.random.normal(loc=25000, scale=15000, size=num_records)
    loan_amounts = np.clip(loan_amounts, 1000.0, 100000.0)
    
    # Create DataFrame
    df = pd.DataFrame({
        'Applicant_ID': [str(uuid.uuid4()) for _ in range(num_records)],
        'Income': incomes,
        'Credit_Score': credit_scores,
        'Age': ages,
        'Employment_Years': employment_years,
        'Debt_to_Income': debt_to_incomes,
        'Gender': genders,
        'Zip_Code': zip_codes,
        'Loan_Amount': loan_amounts
    })
    
    # Target variable generation (Default_History)
    # Higher prob of default if credit score is low, DTI is high, income is low.
    score_scaled = (df['Credit_Score'] - 300) / (850 - 300)
    income_scaled = (df['Income'] - 20000) / (250000 - 20000)
    
    # Hidden score for default probability
    # lower credit score, higher dti, lower income -> higher default prob
    risk_score = 0.5 * (1 - score_scaled) + 0.3 * df['Debt_to_Income'] + 0.2 * (1 - income_scaled)
    # add some noise
    risk_score += np.random.normal(0, 0.1, size=num_records)
    
    # Top 20% risk defaults
    threshold = np.percentile(risk_score, 80)
    df['Default_History'] = (risk_score >= threshold).astype(int)
    
    # Inject Historical Bias
    # For Female, subtract 50 points from Credit_Score and multiply Income by 0.85
    female_mask = df['Gender'] == 'Female'
    df.loc[female_mask, 'Credit_Score'] = df.loc[female_mask, 'Credit_Score'] - 50
    df.loc[female_mask, 'Credit_Score'] = df.loc[female_mask, 'Credit_Score'].clip(lower=300)
    
    df.loc[female_mask, 'Income'] = df.loc[female_mask, 'Income'] * 0.85
    
    # Force add the specific demonstration record A001
    demo_record = {
        'Applicant_ID': 'A001',
        'Income': 45000.0,
        'Credit_Score': 620,
        'Age': 28,
        'Employment_Years': 3.0,
        'Debt_to_Income': 0.45,
        'Gender': 'Female',
        'Zip_Code': '10001',
        'Loan_Amount': 15000.0,
        'Default_History': 0
    }
    df = pd.concat([pd.DataFrame([demo_record]), df], ignore_index=True)
    
    # Make sure data directory exists
    os.makedirs('data', exist_ok=True)
    df.to_csv('data/synthetic_applicants.csv', index=False)
    print("Generated synthetic dataset at data/synthetic_applicants.csv")

if __name__ == "__main__":
    generate_data(1000)
