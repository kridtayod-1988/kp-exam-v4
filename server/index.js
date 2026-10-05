import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const OPENAI_KEY = process.env.OPENAI_API_KEY;

app.post('/api/ai-explain', async (req, res) => {
  try {
    const { questionText, userAnswer, correctAnswer, explanation } = req.body;

    if (!OPENAI_KEY) {
      return res.json({
        ok: true,
        text: `❌ AI service not configured yet.\n\nคำถาม: ${questionText}\nผู้ใช้เลือก: ${userAnswer}\nเฉลยที่ถูกต้อง: ${correctAnswer}\n\nคำอธิบายพื้นฐาน: ${explanation || ''}`
      });
    }

    const prompt = `
You are an AI tutor in Thai. Explain why the correct answer is correct, show common trap, and give 1 short study tip.
Question: ${questionText}
User answer: ${userAnswer}
Correct answer: ${correctAnswer}
Base explanation: ${explanation || ''}
Return in Thai, concise but clear, with sections:
1. สรุป
2. ทำไมคำตอบนี้ถูก
3. ข้อผิดพลาดที่พบบ่อย
4. เคล็ดลับสั้น
`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a helpful Thai tutor.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 400,
        temperature: 0.2
      })
    });

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content || 'AI unable to generate explanation';

    res.json({ ok: true, text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message || 'server error' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`AI server listening on ${PORT}`));