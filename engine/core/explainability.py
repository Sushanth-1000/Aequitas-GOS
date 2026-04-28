from google import genai
import json
import os

def generate_explanation(context: dict, api_key: str | None = None) -> str:
    """
    Calls Gemini API to get a plain-English explanation.
    """
    resolved_api_key = api_key or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    use_vertex = os.getenv("USE_VERTEX_AI", "true").lower() in {"1", "true", "yes", "on"}
    vertex_project = os.getenv("VERTEX_PROJECT_ID") or os.getenv("GOOGLE_CLOUD_PROJECT")
    vertex_location = os.getenv("VERTEX_LOCATION", "asia-south1")

    try:
        if use_vertex and vertex_project:
            print(f"Initializing Vertex AI client with project: {vertex_project}, location: {vertex_location}")
            print(f"Environment check - USE_VERTEX_AI: {use_vertex}, VERTEX_PROJECT_ID: {vertex_project}")
            client = genai.Client(vertexai=True, project=vertex_project, location=vertex_location)
        elif resolved_api_key:
            print("Initializing Gemini client with API key")
            client = genai.Client(api_key=resolved_api_key)
        else:
            print("No AI credentials found, using fallback explanation")
            return json.dumps({"explanation": "System adjustment applied based on fairness compliance thresholds."})
        
        prompt = f"""You are a risk compliance officer. Analyze this loan decision for Applicant {context.get('applicant_id')}: 
Original Model Score: {context.get('original_score')}, 
Policy Rule Triggered: {context.get('policy_rule')}, 
Final Decision: {context.get('final_decision')}, 
Key Factor (SHAP max): {context.get('top_feature')}. 
Provide exactly a 3-sentence explanation of why the final decision was reached, avoiding technical ML jargon. Do not hallucinate data. Return strictly as JSON.
Format: {{"explanation": "<text>"}}

Keep the explanation concise and complete exactly 3 sentences.
"""
        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config=genai.types.GenerateContentConfig(
                temperature=0.1,
                max_output_tokens=1000,
                response_mime_type="application/json",
            ),
        )
        
        print(f"Vertex AI response object: {response}")
        print(f"Response type: {type(response)}")
        if hasattr(response, 'text'):
            print(f"Response.text: {response.text}")
        if hasattr(response, 'candidates'):
            print(f"Response.candidates: {response.candidates}")
        
        # Handle case where response.text might be None
        if response and hasattr(response, 'text') and response.text:
            return response.text
        elif response and hasattr(response, 'candidates') and response.candidates:
            # Try to get content from candidates
            candidate = response.candidates[0]
            if hasattr(candidate, 'content') and hasattr(candidate.content, 'parts') and candidate.content.parts:
                parts_text = "".join([part.text for part in candidate.content.parts if hasattr(part, 'text')])
                if parts_text:
                    print(f"Extracted content from candidates: {parts_text}")
                    return parts_text
            elif hasattr(candidate, 'content') and hasattr(candidate.content, 'text'):
                print(f"Extracted content from candidate.content: {candidate.content.text}")
                return candidate.content.text
        
        print(f"Vertex AI response was empty or invalid: {response}")
        return json.dumps({"explanation": "AI service returned empty response. Using fallback explanation."})
    except Exception as e:
        print(f"Gemini API Error: {e}")
        return json.dumps({"explanation": "Automated explanation generation timed out. The decision was processed via standard policy enforcement."})
