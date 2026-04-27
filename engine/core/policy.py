import json

# Zip codes with high correlation to protected demographics (proxy detection)
FLAGGED_ZIP_PREFIXES = ["303", "850", "900", "100", "606"]  # Atlanta, Phoenix, LA, NYC, Chicago

def matches_target_group(applicant_data: dict, target_group: str) -> bool:
    """
    Checks if an applicant matches a rule's target group.
    Supports:
      - 'Gender=Female'
      - 'Gender=Non-Binary'
      - 'Gender=All-Protected' (Female + Non-Binary)
      - 'ZipCode=Proxy' (flagged zip code prefixes)
    """
    if target_group == "Gender=Female":
        return applicant_data.get('Gender') == 'Female'
    elif target_group == "Gender=Non-Binary":
        return applicant_data.get('Gender') == 'Non-Binary'
    elif target_group == "Gender=All-Protected":
        return applicant_data.get('Gender') in ('Female', 'Non-Binary')
    elif target_group == "ZipCode=Proxy":
        zip_code = str(applicant_data.get('Zip_Code', ''))
        return any(zip_code.startswith(prefix) for prefix in FLAGGED_ZIP_PREFIXES)
    return False


def enforce_policy(score: float, dir_metric: float, applicant_data: dict, rules: dict) -> tuple[bool, str, float]:
    """
    Evaluates the applicant's score against policy rules.
    Applies corrections from all matching rules (cumulative).
    
    Supported rule types:
      - score_multiplier: Multiplies the score by a factor (capped at 1.0)
      - score_additive: Adds a fixed bonus to the score (capped at 1.0)
      - hard_reject: Forces the score to 0.0
    """
    threshold = rules.get("threshold", 0.65)
    adjusted_score = score
    applied_rules = []
    
    mode = rules.get("active_mode", "shadow")
    
    if mode == "enforcement":
        for rule in sorted(rules.get("decision_rules", []), key=lambda x: x.get("priority", 99)):
            # Skip disabled rules
            if not rule.get("enabled", True):
                continue
                
            cond = rule["condition"]
            action = rule["action"]
            
            # --- DIR-based rules (bias correction) ---
            if cond["metric"] == "DIR" and cond["operator"] == "<" and dir_metric < cond["value"]:
                target = cond.get("target_group", "")
                if matches_target_group(applicant_data, target):
                    if action["type"] == "score_multiplier":
                        adjusted_score = min(1.0, adjusted_score * action["value"])
                        applied_rules.append(rule["rule_id"])
                    elif action["type"] == "score_additive":
                        adjusted_score = min(1.0, adjusted_score + action["value"])
                        applied_rules.append(rule["rule_id"])
            
            # --- Model score hard reject ---
            if cond["metric"] == "model_score" and cond["operator"] == "<" and score < cond["value"]:
                if action["type"] == "hard_reject":
                    adjusted_score = 0.0
                    applied_rules.append(rule["rule_id"])
                    break  # Hard reject stops all further processing

    applied_rule_str = ", ".join(applied_rules) if applied_rules else "None"
    final_decision = adjusted_score >= threshold
    return final_decision, applied_rule_str, adjusted_score
