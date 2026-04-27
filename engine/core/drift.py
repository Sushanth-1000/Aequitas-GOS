import numpy as np
import pandas as pd

def calculate_psi(expected, actual, buckets=10):
    """Calculate the PSI for a single variable."""
    if len(expected) == 0 or len(actual) == 0:
        return 0.0
        
    breakpoints = np.arange(0, buckets + 1) / (buckets) * 100
    breakpoints = np.stack([np.percentile(expected, b) for b in breakpoints])
    
    # ensure unique breakpoints
    breakpoints = np.unique(breakpoints)
    if len(breakpoints) < 2:
        return 0.0

    expected_percents, _ = np.histogram(expected, bins=breakpoints)
    actual_percents, _ = np.histogram(actual, bins=breakpoints)
    
    expected_percents = expected_percents / len(expected)
    actual_percents = actual_percents / len(actual)
    
    expected_percents = np.where(expected_percents == 0, 0.0001, expected_percents)
    actual_percents = np.where(actual_percents == 0, 0.0001, actual_percents)
    
    psi_value = np.sum((expected_percents - actual_percents) * np.log(expected_percents / actual_percents))
    return float(psi_value)

def track_drift(current_batch: pd.DataFrame, reference_batch: pd.DataFrame) -> dict:
    """
    Tracks drift between a reference batch and a current batch.
    Trigger condition: PSI > 0.2
    """
    if len(current_batch) < 100:
        return {"PSI_Income": 0.0, "PSI_Credit_Score": 0.0, "Alert": False}
        
    psi_income = calculate_psi(reference_batch['Income'].values, current_batch['Income'].values)
    psi_credit = calculate_psi(reference_batch['Credit_Score'].values, current_batch['Credit_Score'].values)
    
    alert = psi_income > 0.2 or psi_credit > 0.2
    
    return {"PSI_Income": psi_income, "PSI_Credit_Score": psi_credit, "Alert": alert}
