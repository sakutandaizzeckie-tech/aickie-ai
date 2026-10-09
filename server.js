import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

const port = process.env.PORT || 3000;

app.post('/api/generate', async (req, res) => {
const { topic, contentType = 'Facebook post', brand = {} } = req.body || {};

if (!topic || !String(topic).trim()) {
return res.status(400).json({ error: 'Topic is required.' });
}

const safeTopic = String(topic).trim();

if (!process.env.OPENAI_API_KEY) {
return res.json({
demo: true,
title: "AICKIE AI — ${safeTopic}",
caption: "Here is a demo Aickie Jr post about ${safeTopic}.",
hashtags: '#AickieJr #AickieAI #SouthAfrica'
});
}

try {
const client = new OpenAI({
apiKey: process.env.OPENAI_API_KEY
});

const response = await client.responses.create({
  model: process.env.OPENAI_MODEL || 'gpt-5.6',
  input: [
    {
      role: 'system',
      content: `You are AICKIE AI, the content manager for Aickie Jr Sakutanda.

Brand style: confident, premium, creative, classy, mysterious, human, African-inspired.
Never invent prices, stock, delivery promises, links, or facts.
Create concise social content. Return JSON with title, caption, hashtags.
Brand information: ${JSON.stringify(brand)}"}, { role: 'user', content:"Create a ${contentType} about: ${safeTopic}`
}
],
text: { format: { type: 'json_object' } }
});

return res.json(JSON.parse(response.output_text));

} catch (err) {
console.error('AICKIE AI generation error:', err);

return res.json({
  demo: true,
  title: `AICKIE AI — ${safeTopic}`,
  caption: `🔥 ${safeTopic}\n\nCreated with AICKIE AI Music Hub. Stay tuned for more music, creativity, and updates from Aickie Jr!`,
  hashtags: '#AickieAI #AickieJr #MusicPromotion #Afrobeats'
});

}
});

app.get('/api/facebook/status', (req, res) => {
res.json({
connected: false,
message: 'Facebook OAuth/Meta Graph API is not configured in this starter.'
});
});

app.get('/{*splat}', (req, res) => {
res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
console.log("AICKIE AI running on port ${port}");
});