from google import genai
import json

def generate_explanation(context: dict, api_key: str = "YOUR API KEY") -> str:
    """
    Calls Gemini API to get a plain-English explanation.
    """
    if api_key == "YOUR API KEY" or not api_key:
        return json.dumps({"explanation": "System adjustment applied based on fairness compliance thresholds."})
        
    try:
        client = genai.Client(api_key=api_key)
        
        prompt = f"""You are a risk compliance officer. Analyze this loan decision for Applicant {context.get('applicant_id')}: 
Original Model Score: {context.get('original_score')}, 
Policy Rule Triggered: {context.get('policy_rule')}, 
Final Decision: {context.get('final_decision')}, 
Key Factor (SHAP max): {context.get('top_feature')}. 
Provide exactly a 3-sentence explanation of why the final decision was reached, avoiding technical ML jargon. Do not hallucinate data. Return strictly as JSON.
Format: {{"explanation": "<text>"}}
"""
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=genai.types.GenerateContentConfig(
                temperature=0.2,
                max_output_tokens=150,
                response_mime_type="application/json",
            ),
        )
        return response.text
    except Exception as e:
        print(f"Gemini API Error: {e}")
        return json.dumps({"explanation": "Automated explanation generation timed out. The decision was processed via standard policy enforcement."})
