import pandas as pd
import numpy as np
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
import shap
import pickle
import os

def train():
    df = pd.read_csv('data/synthetic_applicants.csv')
    
    # Feature whitelist
    features = ['Income', 'Credit_Score', 'Employment_Years', 'Debt_to_Income', 'Loan_Amount']
    target = 'Default_History'
    
    X = df[features]
    y = df[target]
    
    # Preprocessing
    preprocessor = Pipeline([
        ('imputer', SimpleImputer(strategy='median')),
        ('scaler', StandardScaler())
    ])
    
    # Fit preprocessor
    X_transformed = preprocessor.fit_transform(X)
    
    # Train Logistic Regression
    clf = LogisticRegression(class_weight='balanced', max_iter=500, random_state=42)
    clf.fit(X_transformed, y)
    
    # Full model pipeline
    model_pipeline = Pipeline([
        ('preprocessor', preprocessor),
        ('classifier', clf)
    ])
    
    # SHAP Explainer
    explainer = shap.LinearExplainer(clf, X_transformed)
    
    # Ensure models directory exists
    os.makedirs('models', exist_ok=True)
    
    with open('models/model.pkl', 'wb') as f:
        pickle.dump(model_pipeline, f)
        
    with open('models/explainer.pkl', 'wb') as f:
        pickle.dump(explainer, f)
        
    # We might also need the feature names and background data for inference
    with open('models/features.pkl', 'wb') as f:
        pickle.dump(features, f)
        
    print("Model and explainer saved to models/ directory.")

if __name__ == "__main__":
    train()
