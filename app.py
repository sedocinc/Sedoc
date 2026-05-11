from flask import Flask, request, jsonify
from flask_cors import CORS
import requests

app = Flask(__name__)
CORS(app) # Yeh HTML ko Python se baat karne ki ijazat deta hai

# APNI NVIDIA KEY YAHAN LAGAYEIN
NVIDIA_API_KEY = "YOUR_NVIDIA_API_KEY_HERE"

@app.route('/api/summarize', methods=['POST'])
def summarize():
    data = request.json
    user_text = data.get('text', '')

    if not user_text:
        return jsonify({"error": "No text provided"}), 400

    invoke_url = "https://integrate.api.nvidia.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {NVIDIA_API_KEY}",
        "Accept": "application/json"
    }
    
    # Mistral AI ko command de rahe hain ke text ko summarize kare
    payload = {
        "model": "mistralai/mistral-medium-3.5-128b",
        "messages": [
            {"role": "system", "content": "You are a professional document summarizer. Provide a clean, concise, and highly accurate summary of the text provided by the user. Do not include introductory phrases like 'Here is the summary'."},
            {"role": "user", "content": user_text}
        ],
        "max_tokens": 1024,
        "temperature": 0.5,
        "top_p": 1.0,
        "stream": False # Web connection ke liye filhal False rakha hai
    }

    try:
        response = requests.post(invoke_url, headers=headers, json=payload)
        response_data = response.json()
        
        # AI ka jawab nikal rahe hain
        summary = response_data['choices'][0]['message']['content']
        return jsonify({"summary": summary})
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
