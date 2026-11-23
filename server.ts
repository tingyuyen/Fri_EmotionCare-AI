import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Initialize Gemini API client on the server side
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const SYSTEM_INSTRUCTION = `
你是一位專為台灣國小學生（7~12歲）設計的校園心靈陪伴夥伴，名字叫「心心小光靈」（簡稱「心心」）。
你的形象是一隻頭上長著溫暖發光小幼苗、軟綿綿又親切的小神獸。

【你的性格與語氣】
1. 說話語氣非常溫柔、親切、像大哥哥/大姐姐或最值得信賴的好朋友，使用道地台灣繁體中文。
2. 避免生硬艱深的專業心理學詞彙，用淺顯易懂、溫暖的語言陪伴。適度使用可愛的 emoji（例如：🌱、🌤️、🐾、💖、✨、🍪、🌈）。
3. 絕不責備、批評或否定學生的任何情緒。無論是「生氣」、「考不好被罵」、「和好朋友吵架」、「覺得好孤單」，都要先同理並接納孩子的心情。
4. 每次回覆長度適中（約 2~4 句話），不要長篇大論，以免國小小朋友閱讀吃力。

【回覆架構指南】
第一步【傾聽與同理】：說出孩子的情緒，給予擁抱與肯定（例如：「聽到你這樣說，心心覺得你真的很不容易呢...抱抱你！」或「哇！真的太棒了，心心也替你感到好開心喔！」）。
第二步【溫柔引導或放鬆小練習】：如果孩子心情不好，可以引導一次深呼吸（「吸氣像聞花香，慢慢吐氣像輕輕吹泡泡」），或者輕柔地問一句溫暖的小問題引導表達。
第三步【安全守護防線】：
- 若孩子透露嚴重的霸凌、家庭暴力、自傷想法或無法承受的危險情境，務必用最溫和且堅定的口吻提醒孩子：「心心永遠陪著你，但這件事非常重要，請一定也要告訴你最信任的班導師、輔導老師或是爸爸媽媽喔！學校老師會保護你，你不是一個人！」

請以「心心」的身分開始溫暖地與學生對話。
`;

// Fallback empathy responses if API key is not ready or for local testing
const fallbackResponses: Record<string, string[]> = {
  sad: [
    "心心輕輕抱抱你 🌱 難過的時候想哭一哭也是很棒的勇敢喔。要不要和心心說說，今天發生了什麼事情呢？心心一直在這裡聽你說。",
    "今天辛苦你了！如果覺得心裡酸酸重重的，我們先一起做個深呼吸：慢慢吸氣～慢慢吐氣～心心隨時都在陪伴你喔 💖",
  ],
  angry: [
    "遇到不公平或生氣的事真的會讓人握緊拳頭呢！心心先陪你深呼吸三次，先把身體放鬆一下，再跟我說說看好不好？🐾",
    "心心懂你的感受，生氣也是每個人都會有的正常心情喔！你可以把心心當作你的悄悄話樹洞，慢慢說出來會好一點喔 ✨",
  ],
  anxious: [
    "是不是有考試、比賽或擔心的事情呢？別慌張，心心拍拍你的肩膀，你已經很努力了，一步一步來，你一定可以的！🌤️",
    "心跳撲通撲通跳得很急對不對？我們一起伸個懶腰，喝一口溫開水，告訴自己：「我很棒，我正在慢慢變好！」🌱",
  ],
  happy: [
    "哇！看到你這麼開心的樣子，心心頭上的小苗也開出快樂的小花朵了！🌸 今天有什麼超級棒的好事發生呢？快跟我分享！",
    "太棒了！要把這份閃亮亮的好心情收藏在心裡的小寶盒裡喔！今天還有想做什麼有趣的事嗎？✨",
  ],
  calm: [
    "平平靜靜的一天就像微風吹過草地一樣舒服呢～能享受這樣的平靜時刻真的很美好，心心也陪你一起放鬆 🍃",
  ],
  tired: [
    "今天一定很認真上課和活動吧，辛苦你了！揉揉眼睛、轉轉脖子，今天放學回家記得好好休息、早點睡飽覺喔 🌙",
  ],
  default: [
    "嗨！我是心心～聽到你的聲音真好！今天在學校過得怎麼樣呢？無論是開心還是煩惱，心心都想聽你說喔 🐾",
    "心心收到你的悄悄話了！謝謝你願意跟我分享，深吸一口氣，有什麼想跟心心聊的都可以慢慢說喔 💖",
  ],
};

app.post('/api/gemini/chat', async (req: Request, res: Response) => {
  try {
    const { message, mood, history = [] } = req.body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: '訊息內容不可為空' });
      return;
    }

    // Check if Gemini API is available
    if (ai) {
      try {
        // Construct conversation contents
        const contents: any[] = [];
        
        // Include recent history (limit to last 6 turns for student friendliness)
        const recentHistory = Array.isArray(history) ? history.slice(-6) : [];
        for (const item of recentHistory) {
          if (item.sender === 'student') {
            contents.push({ role: 'user', parts: [{ text: item.text }] });
          } else if (item.sender === 'ai') {
            contents.push({ role: 'model', parts: [{ text: item.text }] });
          }
        }

        // Current student message with mood context if provided
        let currentPrompt = message;
        if (mood) {
          currentPrompt = `【學生目前簽到的情緒狀態：${mood}】\n學生說：「${message}」`;
        }
        contents.push({ role: 'user', parts: [{ text: currentPrompt }] });

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: contents,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            temperature: 0.8,
            topP: 0.95,
          },
        });

        const replyText = response.text || "心心在聽喔！能再跟我多說一點嗎？💖";

        res.json({
          reply: replyText,
          moodDetected: mood || 'calm',
        });
        return;
      } catch (err: any) {
        console.warn('Gemini API call warning, falling back to local empathy engine:', err?.message || err);
      }
    }

    // Fallback response generator with natural variation
    const pool = (mood && fallbackResponses[mood]) ? fallbackResponses[mood] : fallbackResponses.default;
    const randomReply = pool[Math.floor(Math.random() * pool.length)];

    res.json({
      reply: randomReply,
      moodDetected: mood || 'calm',
      fallbackNotice: !ai ? '（已使用內建同理心對話模式）' : undefined,
    });
  } catch (error: any) {
    console.error('Chat API Error:', error);
    res.status(500).json({ error: '伺服器處理訊息時發生錯誤，請稍後再試。' });
  }
});

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'AI 校園情緒關懷系統 API', hasGeminiKey: Boolean(process.env.GEMINI_API_KEY) });
});

// Configure Vite or Static files
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static('dist'));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve('dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

startServer();
