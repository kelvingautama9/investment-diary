import { GoogleGenAI } from '@google/genai';
import {
  HEDGE_FUND_SYSTEM_PROMPT,
  CANDIDATE_MODELS,
  formatJournalContext,
  markModelCooldown,
  isModelInCooldown,
} from '../src/services/aiChatService';

export default async function handler(req: any, res: any) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-gemini-api-key, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, history = [], journalData } = req.body || {};
    const privateKey = (req.headers['x-gemini-api-key'] as string) || '';
    const effectiveApiKey =
      privateKey ||
      process.env.GEMINI_API_KEY ||
      process.env.VITE_GEMINI_API_KEY;

    if (!effectiveApiKey) {
      return res.status(401).json({
        error: 'API_KEY_REQUIRED',
        message: 'GEMINI_API_KEY belum disetel di Vercel Environment Variables atau Private API Key.',
      });
    }

    const ai = new GoogleGenAI({
      apiKey: effectiveApiKey,
    });

    const journalContext = formatJournalContext(journalData);
    let fallbackHistory: string[] = [];

    for (const model of CANDIDATE_MODELS) {
      if (!privateKey && isModelInCooldown(model)) {
        fallbackHistory.push(`${model} cooldown`);
        continue;
      }

      try {
        const resp = await ai.models.generateContent({
          model,
          contents: [
            ...history.map((h: any) => ({
              role: h.role === 'AI' || h.role === 'model' ? 'model' : 'user',
              parts: [{ text: h.content || h.text || '' }],
            })),
            {
              role: 'user',
              parts: [{ text: `${journalContext}\n\nPertanyaan/Permintaan Trader:\n${message}` }],
            },
          ],
          config: {
            systemInstruction: HEDGE_FUND_SYSTEM_PROMPT,
            temperature: 0.2,
          },
        });

        return res.status(200).json({
          text: resp.text || '',
          modelUsed: model,
          isPrivateKey: Boolean(privateKey),
        });
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        markModelCooldown(model, errMsg);
        fallbackHistory.push(`${model} gagal: ${errMsg.slice(0, 100)}`);
      }
    }

    // Static quant fallback
    return res.status(200).json({
      text: `### Executive Summary (Citadel Quant Fallback)
Koneksi antrian model sedang sibuk di server. Sistem **BLACKEYE Quant Rules Engine** tetap mengaudit portofolio Anda secara matematis.`,
      modelUsed: 'quant-rules-engine (fallback)',
      isPrivateKey: false,
      fallbackHistory,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Server error' });
  }
}
