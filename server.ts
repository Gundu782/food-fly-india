import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-initialized Gemini AI SDK Instance
let aiInstance: GoogleGenAI | null = null;

function getGemini(): GoogleGenAI | null {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'MY_GEMINI_API_KEY' && apiKey.trim() !== '') {
      try {
        aiInstance = new GoogleGenAI({ apiKey });
      } catch (e) {
        console.error('Failed to initialize GoogleGenAI SDK', e);
      }
    }
  }
  return aiInstance;
}

// API Route 1: Smart AI Customer Support Chatbot
app.post('/api/gemini/chat', async (req, res) => {
  const { message, history } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const ai = getGemini();
  if (!ai) {
    // Return early to fallback to front-end witty local cached engine
    return res.status(503).json({ error: 'Gemini API not configured' });
  }

  try {
    // Generate simple chatbot response using gemini-3.5-flash
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: [
        {
          role: 'user',
          parts: [{ text: `You are FoodFly India's virtual conversational host, a helpful, polite customer support assistant for a premium food delivery platform servicing Indian cities. Resolve order issues, suggest menu items, or explain loyalty rules concisely. User asks: "${message}"` }]
        }
      ]
    });

    res.json({ reply: response.text || "I'm processing your order requests right away!" });
  } catch (error: any) {
    console.error('Gemini Chat API Error:', error);
    res.status(500).json({ error: 'Failed to process AI chat response', details: error.message });
  }
});

// API Route 2: Smart Personalized AI Food Recommendations
app.post('/api/gemini/recommend', async (req, res) => {
  const { userPreferences } = req.body;

  const ai = getGemini();
  if (!ai) {
    return res.status(503).json({ error: 'Gemini API not configured' });
  }

  try {
    const prompt = `Based on a food enthusiast's taste preferences: ${JSON.stringify(userPreferences || ['spicy', 'traditional'])}, recommend 4 unique popular Indian dishes with short catchy descriptions. Output the response strictly as a JSON array of objects with keys: "id", "name", "price", "category", "description", "imageUrl", "isVeg", "isBestSeller". Keep imageUrls valid (e.g. from unsplash with appropriate keywords) or mock ones. Return ONLY valid JSON, no markdown syntax.`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const parsedData = JSON.parse(response.text || '[]');
    res.json({ recommendations: parsedData });
  } catch (error: any) {
    console.error('Gemini Recommendation API Error:', error);
    res.status(500).json({ error: 'Failed to fetch AI suggestions' });
  }
});

// Setup Vite Dev Middleware / Production Static serving
async function bootstrapServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FoodFly terminal running at http://localhost:${PORT}`);
  });
}

bootstrapServer();
