"""
Bias Calculator — Multi-Dimensional Hypothesis Testing for Fairness
Tests fairness across Gender, Zip Code, Age, Income, and Intersectional groups.
"""
import numpy as np
import pandas as pd
from scipy import stats

FLAGGED_ZIP_PREFIXES = ["303", "850", "900", "100", "606"]


def compute_selection_rates(scores: list[float], groups: list[str], threshold: float) -> dict:
    """Compute approval rates per group."""
    group_data = {}
    for score, group in zip(scores, groups):
        if group not in group_data:
            group_data[group] = {"approved": 0, "total": 0}
        group_data[group]["total"] += 1
        if score >= threshold:
            group_data[group]["approved"] += 1
    for g in group_data:
        t = group_data[g]["total"]
        a = group_data[g]["approved"]
        group_data[g]["rate"] = a / t if t > 0 else 0.0
    return group_data


def two_proportion_ztest(n1: int, p1: float, n2: int, p2: float) -> tuple[float, float]:
    """Two-proportion z-test. Returns (z_statistic, p_value)."""
    if n1 == 0 or n2 == 0:
        return 0.0, 1.0
    p_pool = (p1 * n1 + p2 * n2) / (n1 + n2)
    if p_pool == 0 or p_pool == 1:
        return 0.0, 1.0
    se = np.sqrt(p_pool * (1 - p_pool) * (1/n1 + 1/n2))
    if se == 0:
        return 0.0, 1.0
    z = (p1 - p2) / se
    p_value = 2 * (1 - stats.norm.cdf(abs(z)))
    return float(z), float(p_value)


def _wilson_ci(successes: int, n: int, z: float = 1.96) -> tuple[float, float]:
    if n == 0:
        return 0.0, 0.0
    p = successes / n
    denom = 1 + z**2 / n
    centre = p + z**2 / (2 * n)
    margin = z * np.sqrt((p * (1 - p) + z**2 / (4 * n)) / n)
    return float((centre - margin) / denom), float((centre + margin) / denom)


def _test_dimension(scores, groups, reference_group):
    """Run hypothesis test for one dimension. Returns group_metrics dict."""
    rates = compute_selection_rates(scores, groups, threshold=0.65)
    if reference_group not in rates:
        # Pick the group with highest rate as reference
        reference_group = max(rates, key=lambda g: rates[g]["rate"])

    ref_rate = rates[reference_group]["rate"]
    ref_n = rates[reference_group]["total"]
    results = {}

    for group, data in rates.items():
        if group == reference_group:
            results[group] = {
                "rate": data["rate"], "n": data["total"],
                "dir": 1.0, "z_stat": 0.0, "p_value": 1.0,
                "is_significant": False, "verdict": "Reference Group"
            }
            continue

        dir_val = data["rate"] / ref_rate if ref_rate > 0 else 0.0
        z_stat, p_val = two_proportion_ztest(data["total"], data["rate"], ref_n, ref_rate)
        ci_low, ci_high = _wilson_ci(data["approved"], data["total"])

        is_sig = p_val < 0.05 and dir_val < 0.8
        if is_sig:
            verdict = "Significant Disparity"
        elif dir_val < 0.8:
            verdict = "Disparity (not significant)"
        else:
            verdict = "Fair"

        results[group] = {
            "rate": data["rate"], "n": data["total"],
            "dir": round(dir_val, 4), "z_stat": round(z_stat, 4),
            "p_value": round(p_val, 6), "ci": [round(ci_low, 4), round(ci_high, 4)],
            "is_significant": is_sig, "verdict": verdict
        }

    all_dirs = [r["dir"] for r in results.values()]
    return {
        "reference_group": reference_group,
        "group_metrics": results,
        "min_dir": round(min(all_dirs), 4),
        "has_significant": any(r["is_significant"] for r in results.values())
    }


# ---------- Group Assignment Functions ----------

def _assign_zip_groups(df: pd.DataFrame) -> list[str]:
    """Classify zip codes as Flagged or Unflagged."""
    def classify(z):
        z = str(z)
        return "Flagged Zip" if any(z.startswith(p) for p in FLAGGED_ZIP_PREFIXES) else "Unflagged Zip"
    return df["Zip_Code"].apply(classify).tolist()


def _assign_age_groups(df: pd.DataFrame) -> list[str]:
    return pd.cut(df["Age"], bins=[0, 30, 50, 100], labels=["18-30", "31-50", "51+"]).astype(str).tolist()


def _assign_income_groups(df: pd.DataFrame) -> list[str]:
    return pd.cut(df["Income"], bins=[0, 50000, 80000, float("inf")],
                  labels=["Low (<50k)", "Mid (50-80k)", "High (80k+)"]).astype(str).tolist()


def _assign_intersectional_groups(df: pd.DataFrame) -> list[str]:
    """Gender × Income bracket intersections."""
    income_labels = pd.cut(df["Income"], bins=[0, 50000, 80000, float("inf")],
                           labels=["LowInc", "MidInc", "HighInc"]).astype(str)
    return (df["Gender"] + " + " + income_labels).tolist()


# ---------- Main Multi-Dimensional Function ----------

def calculate_fairness_metrics(scores: list[float], groups: list[str],
                                threshold: float, reference_group: str = "Male") -> dict:
    """Single-dimension fairness (backwards compatible). Used for global DIR."""
    rates = compute_selection_rates(scores, groups, threshold)
    if reference_group not in rates:
        return {"error": "Reference group not found", "rates": rates}

    ref_rate = rates[reference_group]["rate"]
    ref_n = rates[reference_group]["total"]
    results = {}

    for group, data in rates.items():
        if group == reference_group:
            results[group] = {"rate": data["rate"], "n": data["total"], "dir": 1.0,
                              "z_stat": 0.0, "p_value": 1.0, "is_significant": False, "verdict": "Reference Group"}
            continue
        dir_val = data["rate"] / ref_rate if ref_rate > 0 else 0.0
        z_stat, p_val = two_proportion_ztest(data["total"], data["rate"], ref_n, ref_rate)
        ci_low, ci_high = _wilson_ci(data["approved"], data["total"])
        is_sig = p_val < 0.05 and dir_val < 0.8
        verdict = "Significant Disparity" if is_sig else ("Disparity (not significant)" if dir_val < 0.8 else "Fair")
        results[group] = {"rate": data["rate"], "n": data["total"], "dir": round(dir_val, 4),
                          "z_stat": round(z_stat, 4), "p_value": round(p_val, 6),
                          "ci": [round(ci_low, 4), round(ci_high, 4)], "is_significant": is_sig, "verdict": verdict}

    all_dirs = [r["dir"] for r in results.values()]
    global_dir = min(all_dirs) if all_dirs else 1.0
    return {
        "reference_group": reference_group, "global_dir": round(global_dir, 4),
        "threshold": threshold, "group_metrics": results,
        "overall_verdict": "Bias Detected" if any(r["is_significant"] for r in results.values()) else "Fair"
    }


def calculate_multidimensional_fairness(df: pd.DataFrame, model, threshold: float) -> dict:
    """
    Run hypothesis testing across all fairness dimensions:
    Gender, Zip Code, Age Bracket, Income Bracket, and Intersectional.
    """
    model_features = ['Income', 'Credit_Score', 'Employment_Years', 'Debt_to_Income', 'Loan_Amount']
    X = df[model_features]
    scores = model.predict_proba(X)[:, 0].tolist()

    dimensions = {}

    # 1. Gender
    dimensions["Gender"] = _test_dimension(scores, df["Gender"].tolist(), "Male")

    # 2. Zip Code
    dimensions["Zip Code"] = _test_dimension(scores, _assign_zip_groups(df), "Unflagged Zip")

    # 3. Age Bracket
    dimensions["Age Bracket"] = _test_dimension(scores, _assign_age_groups(df), "31-50")

    # 4. Income Bracket
    dimensions["Income Bracket"] = _test_dimension(scores, _assign_income_groups(df), "High (80k+)")

    # 5. Intersectional (Gender × Income)
    dimensions["Intersectional"] = _test_dimension(scores, _assign_intersectional_groups(df), "Male + HighInc")

    # Overall summary
    any_significant = any(d["has_significant"] for d in dimensions.values())
    worst_dir = min(d["min_dir"] for d in dimensions.values())
    flagged_dims = [name for name, d in dimensions.items() if d["has_significant"]]

    return {
        "threshold": threshold,
        "dimensions": dimensions,
        "overall_verdict": "Bias Detected" if any_significant else "Fair",
        "worst_dir": round(worst_dir, 4),
        "flagged_dimensions": flagged_dims,
        "total_samples": len(df)
    }
