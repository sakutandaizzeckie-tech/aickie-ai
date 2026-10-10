
import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'dist')));

// Single-owner prototype storage.
// Tokens are lost whenever the server restarts.
let facebookPages = [];
let facebookConnected = false;
let lastGenerationFailure = null;
const pendingOAuthStates = new Map();

function graphVersion() {
  return process.env.META_GRAPH_VERSION;
}

function metaConfigured() {
  return Boolean(
    process.env.META_APP_ID &&
    process.env.META_APP_SECRET &&
    process.env.META_REDIRECT_URI &&
    graphVersion()
  );
}

async function graphGet(endpoint, params = {}) {
  const url = new URL(
    `https://graph.facebook.com/${graphVersion()}/${endpoint}`
  );

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok || data.error) {
    throw new Error(
      data.error?.message || 'Meta Graph API request failed.'
    );
  }

  return data;
}

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    lastGenerationFailure,
    metaConfigured: metaConfigured(),
    facebookConnected,
    facebookPagesAvailable: facebookPages.length
  });
});

// Real AI content generation
app.post('/api/generate', async (req, res) => {
  const {
    topic,
    contentType = 'Facebook post',
    brand = {}
  } = req.body || {};

  if (!topic || !String(topic).trim()) {
    return res.status(400).json({
      error: 'Please enter a topic.'
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    lastGenerationFailure = 'missing_api_key';

    return res.status(503).json({
      error: 'AI is not configured. Add OPENAI_API_KEY in Render Environment.'
    });
  }

  try {
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      input: [
        {
          role: 'system',
          content:
            'You are AICKIE AI, the content manager for Aickie Jr Sakutanda. ' +
            'Create engaging, concise social media content. ' +
            'Never invent prices, stock, links, or delivery promises. ' +
            'Return a JSON object with title, caption, and hashtags. ' +
            'Brand information: ' + JSON.stringify(brand)
        },
        {
          role: 'user',
          content:
            'Create a ' + String(contentType).slice(0, 80) +
            ' about: ' + String(topic).trim().slice(0, 2000)
        }
      ],
      text: {
        format: { type: 'json_object' }
      }
    });

    const generated = JSON.parse(response.output_text);

    if (
      typeof generated.title !== 'string' ||
      typeof generated.caption !== 'string' ||
      typeof generated.hashtags !== 'string'
    ) {
      throw new Error('AI returned an unexpected response format.');
    }

    lastGenerationFailure = null;
    return res.json(generated);

  } catch (error) {
    const status = Number(error?.status) || null;

    lastGenerationFailure =
      status === 401 ? 'invalid_api_key' :
      status === 429 ? 'quota_or_rate_limit' :
      status === 403 ? 'permission_or_model_access' :
      'request_failed';

    console.error('AI generation failed:', {
      status,
      code: error?.code,
      message: error?.message
    });

    return res.status(502).json({
      error: 'AI generation failed (' + lastGenerationFailure +
        '). Check your API key, billing, and model access.'
    });
  }
});

// Begin Facebook login
app.get('/auth/facebook', (req, res) => {
  if (!metaConfigured()) {
    return res.status(503).send(
      'Facebook is not configured. Set META_APP_ID, META_APP_SECRET, ' +
      'META_REDIRECT_URI and META_GRAPH_VERSION in Render.'
    );
  }

  const state = crypto.randomBytes(32).toString('hex');
  pendingOAuthStates.set(state, Date.now());

  const permissions = [
    'public_profile',
    'pages_show_list',
    'pages_read_engagement',
    'pages_manage_posts'
  ].join(',');

  const url = new URL('https://www.facebook.com/v' +
    graphVersion() + '/dialog/oauth');

  url.searchParams.set('client_id', process.env.META_APP_ID);
  url.searchParams.set('redirect_uri', process.env.META_REDIRECT_URI);
  url.searchParams.set('state', state);
  url.searchParams.set('scope', permissions);
  url.searchParams.set('response_type', 'code');

  res.redirect(url.toString());
});

// Facebook sends the user back here
app.get('/auth/facebook/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.status(400).send(
      'Facebook login was cancelled or denied. Return to AICKIE AI and try again.'
    );
  }

  const createdAt = pendingOAuthStates.get(state);
  pendingOAuthStates.delete(state);

  if (
    typeof state !== 'string' ||
    !createdAt ||
    Date.now() - createdAt > 10 * 60 * 1000
  ) {
    return res.status(400).send(
      'Login verification expired. Please start Facebook login again.'
    );
  }

  if (typeof code !== 'string' || !metaConfigured()) {
    return res.status(400).send(
      'Missing login code or Meta configuration.'
    );
  }

  try {
    const tokenUrl = new URL(
      'https://graph.facebook.com/' + graphVersion() +
      '/oauth/access_token'
    );

    tokenUrl.searchParams.set('client_id', process.env.META_APP_ID);
    tokenUrl.searchParams.set('client_secret', process.env.META_APP_SECRET);
    tokenUrl.searchParams.set('redirect_uri', process.env.META_REDIRECT_URI);
    tokenUrl.searchParams.set('code', code);

    const tokenResponse = await fetch(tokenUrl);
    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      throw new Error(
        tokenData.error?.message || 'Could not exchange Facebook login code.'
      );
    }

    // Request Pages that this account is allowed to manage.
    const pagesData = await graphGet('me/accounts', {
      fields: 'id,name,access_token',
      access_token: tokenData.access_token
    });

    facebookPages = (pagesData.data || [])
      .filter(page => page.id && page.access_token)
      .map(page => ({
        id: page.id,
        name: page.name,
        accessToken: page.access_token
      }));

    facebookConnected = true;
    console.log('Facebook login completed. Pages found:', facebookPages.length);

    return res.redirect('/?facebook=connected');

  } catch (error) {
    facebookConnected = false;
    facebookPages = [];

    console.error('Facebook login failed:', error.message);

    return res.status(502).send(
      'Facebook login could not finish. Check your Meta app settings and permissions, then try again.'
    );
  }
});

// Check Facebook connection status
app.get('/api/facebook/status', (req, res) => {
  res.json({
    configured: metaConfigured(),
    connected: facebookConnected,
    pages: facebookPages.map(page => ({
      id: page.id,
      name: page.name
    })),
    message: !metaConfigured()
      ? 'Meta credentials are not configured.'
      : facebookConnected
        ? 'Facebook login completed.'
        : 'Facebook login has not been completed.'
  });
});

// List connected Pages without exposing their access tokens
app.get('/api/facebook/pages', (req, res) => {
  if (!facebookConnected) {
    return res.status(401).json({
      error: 'Connect Facebook first.'
    });
  }

  res.json({
    pages: facebookPages.map(page => ({
      id: page.id,
      name: page.name
    }))
  });
});

// Publish an approved text post to a selected Page
app.post('/api/facebook/publish', async (req, res) => {
  if (!facebookConnected) {
    return res.status(401).json({
      error: 'Connect Facebook before publishing.'
    });
  }

  const { pageId, message, approved } = req.body || {};

  if (approved !== true) {
    return res.status(400).json({
      error: 'Approve the post before publishing.'
    });
  }

  if (
    typeof pageId !== 'string' ||
    typeof message !== 'string' ||
    !message.trim() ||
    message.length > 60000
  ) {
    return res.status(400).json({
      error: 'Choose a Page and provide a valid post message.'
    });
  }

  const page = facebookPages.find(item => item.id === pageId);

  if (!page) {
    return res.status(404).json({
      error: 'That Page is not available in the connected account.'
    });
  }

  try {
    const url = new URL(
      'https://graph.facebook.com/' + graphVersion() +
      '/' + encodeURIComponent(page.id) + '/feed'
    );

    url.searchParams.set('message', message.trim());
    url.searchParams.set('access_token', page.accessToken);

    const response = await fetch(url, { method: 'POST' });
    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(
        data.error?.message || 'Facebook did not publish the post.'
      );
    }

    return res.json({
      success: true,
      postId: data.id,
      message: 'Facebook accepted the post.'
    });

  } catch (error) {
    console.error('Facebook publishing failed:', error.message);

    return res.status(502).json({
      error: 'Publishing failed. Check Page permissions and Meta app access.'
    });
  }
});

// Website fallback
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log('AICKIE AI server running on port ' + port);
});
