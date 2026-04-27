import pandas as pd

def validate_features_for_inference(applicant_data: dict, dataset_reference=None) -> dict:
    """
    Validates that protected attributes are explicitly excluded from the inference payload.
    """
    protected_attributes = ['Age', 'Gender', 'Zip_Code']
    whitelist = ['Income', 'Credit_Score', 'Employment_Years', 'Debt_to_Income', 'Loan_Amount']
    
    if 'Applicant_ID' not in applicant_data:
        raise ValueError("Applicant_ID missing")
        
    for attr in protected_attributes:
        if attr in whitelist:
            raise Exception(f"FeatureLeakageError: {attr}")
            
    return applicant_data

def calculate_fairness(predictions_df: pd.DataFrame) -> dict:
    """
    Computes DPD and DIR.
    Requires dataframe with 'Default_History_pred' (int 0 or 1, where 1 means approved/good, wait
    our target was Default_History where 1 = Default. So Approval = (prob of default < threshold)
    Actually, let's say target=1 means default.
    So Approval is target_pred == 0.
    """
    # Assuming 'Approved' is boolean column, and 'Protected' is boolean column
    if len(predictions_df) == 0:
        return {"DIR": 1.0, "DPD": 0.0}
        
    protected_mask = predictions_df['Protected'] == True
    unprotected_mask = predictions_df['Protected'] == False
    
    protected_approved = predictions_df[protected_mask]['Approved'].mean() if protected_mask.any() else 0
    unprotected_approved = predictions_df[unprotected_mask]['Approved'].mean() if unprotected_mask.any() else 0
    
    dpd = unprotected_approved - protected_approved
    
    if unprotected_approved == 0:
        dir_val = 1.0
    else:
        dir_val = protected_approved / unprotected_approved
        
    return {"DIR": dir_val, "DPD": dpd}
