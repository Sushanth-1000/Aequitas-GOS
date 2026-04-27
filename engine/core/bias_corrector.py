"""
Bias Corrector — CAFP (Counterfactual Averaging for Fair Predictions)
Corrects predictions by averaging factual and counterfactual scores.
"""


def cafp_correct(original_score: float, counterfactual_score: float) -> float:
    """
    CAFP: final_score = (f(x) + f(x_cf)) / 2
    
    This removes dependence on the protected attribute by averaging
    the prediction across the factual and counterfactual worlds.
    Works as a black-box post-processing method.
    """
    return (original_score + counterfactual_score) / 2.0


def cafp_correct_weighted(original_score: float, counterfactual_score: float,
                          weight: float = 0.5) -> float:
    """
    Weighted CAFP variant: allows tuning the correction strength.
    weight=0.5 is standard CAFP, weight=1.0 is full counterfactual, weight=0.0 is no correction.
    """
    return (1 - weight) * original_score + weight * counterfactual_score
