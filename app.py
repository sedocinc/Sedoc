
from flask import Flask, request, jsonify
from flask_cors import CORS
from openai import OpenAI

app = Flask(__name__)
CORS(app) # Security guard ko pass karne ki ijazat

client = OpenAI(
  base_url = "https://integrate.api.nvidia.com/v1",
  api_key = "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"
)

@app.route('/api/summarize', methods=['POST'])
def summarize():
    data = request.json
    user_text = data.get('text', '')

    if not user_text:
        return jsonify({"error": "No text provided"}), 400

    try:
        completion = client.chat.completions.create(
            model="minimaxai/minimax-m2.7",
            messages=[
                {"role": "system", "content": "You are a professional document summarizer. Extract the key points and provide a clear summary."},
                {"role": "user", "content": f"Summarize this text: {user_text}"}
            ],
            temperature=1,
            top_p=0.95,
            max_tokens=8192,
            stream=False 
        )
        return jsonify({"summary": completion.choices[0].message.content})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
