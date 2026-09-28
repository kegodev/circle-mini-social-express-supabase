import 'dotenv/config';
import express from 'express';
import { createClient } from '@supabase/supabase-js';

const app = express();
const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) throw new Error('Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in .env');
const anonymous = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const clientFor = token => createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  global: { headers: { Authorization: `Bearer ${token}` } },
  auth: { persistSession: false, autoRefreshToken: false }
});
app.use(express.json({ limit: '100kb' }));
app.use(express.static('public'));
const send = (res, error, data, status = 200) => error ? res.status(400).json({ error: error.message }) : res.status(status).json(data);
const validId = value => /^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(value || '');
async function requireUser(req, res, next) {
  const token = /^Bearer (.+)$/i.exec(req.headers.authorization || '')?.[1];
  if (!token) return res.status(401).json({ error: 'Sign in required' });
  const { data, error } = await anonymous.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ error: 'Session expired. Sign in again.' });
  req.user = data.user;
  req.db = clientFor(token);
  next();
}
app.get('/api/config', (_, res) => res.json({ url: SUPABASE_URL, key: SUPABASE_PUBLISHABLE_KEY }));
app.use('/api', requireUser);
app.get('/api/me', async (req, res) => {
  let { data, error } = await req.db.from('social_profiles').select('*').eq('id', req.user.id).maybeSingle();
  if (!error && !data) {
    const username = 'user_' + req.user.id.replace(/-/g, '').slice(0, 20);
    ({ data, error } = await req.db.from('social_profiles').upsert({ id: req.user.id, username }, { onConflict: 'id', ignoreDuplicates: true }).select().maybeSingle());
    if (!error && !data) ({ data, error } = await req.db.from('social_profiles').select('*').eq('id', req.user.id).single());
  }
  send(res, error, data);
});
app.patch('/api/me', async (req, res) => {
  const username = String(req.body.username || '').trim();
  const bio = String(req.body.bio || '').trim();
  if (!/^[a-zA-Z0-9_]{3,24}$/.test(username) || bio.length > 280) return res.status(422).json({ error: 'Username must be 3–24 letters, numbers or underscores; bio at most 280 characters.' });
  const { data, error } = await req.db.from('social_profiles').update({ username, bio }).eq('id', req.user.id).select().single();
  send(res, error, data);
});
app.get('/api/profiles', async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 40).replace(/[%_,]/g, '');
  let query = req.db.from('social_profiles').select('id,username,bio,created_at').order('username').limit(30);
  if (q) query = query.ilike('username', `%${q}%`);
  const { data, error } = await query;
  send(res, error, data);
});
app.get('/api/feed', async (req, res) => {
  const page = Math.max(0, Math.min(100, Number.parseInt(req.query.page, 10) || 0));
  const { data, error } = await req.db.from('social_posts').select('id,user_id,body,created_at,social_profiles!social_posts_user_id_fkey(username),social_likes(user_id),social_comments(id,user_id,body,created_at,social_profiles!social_comments_user_id_fkey(username))')
    .order('created_at', { ascending: false }).range(page * 20, page * 20 + 19);
  send(res, error, data);
});
app.post('/api/posts', async (req, res) => {
  const body = String(req.body.body || '').trim();
  if (!body || body.length > 1000) return res.status(422).json({ error: 'Post must be 1–1000 characters.' });
  const { data, error } = await req.db.from('social_posts').insert({ user_id: req.user.id, body }).select().single();
  send(res, error, data, 201);
});
app.delete('/api/posts/:id', async (req, res) => {
  if (!validId(req.params.id)) return res.status(422).json({ error: 'Invalid post ID' });
  const { error } = await req.db.from('social_posts').delete().eq('id', req.params.id).eq('user_id', req.user.id);
  send(res, error, { ok: true });
});
app.post('/api/posts/:id/comments', async (req, res) => {
  const body = String(req.body.body || '').trim();
  if (!validId(req.params.id) || !body || body.length > 500) return res.status(422).json({ error: 'Comment must be 1–500 characters and the post ID must be valid.' });
  const { data, error } = await req.db.from('social_comments').insert({ post_id: req.params.id, user_id: req.user.id, body }).select().single();
  send(res, error, data, 201);
});
app.delete('/api/comments/:id', async (req, res) => {
  if (!validId(req.params.id)) return res.status(422).json({ error: 'Invalid comment ID' });
  const { error } = await req.db.from('social_comments').delete().eq('id', req.params.id).eq('user_id', req.user.id);
  send(res, error, { ok: true });
});
app.put('/api/posts/:id/like', async (req, res) => {
  if (!validId(req.params.id)) return res.status(422).json({ error: 'Invalid post ID' });
  const { error } = await req.db.from('social_likes').insert({ post_id: req.params.id, user_id: req.user.id });
  send(res, error, { ok: true });
});
app.delete('/api/posts/:id/like', async (req, res) => {
  if (!validId(req.params.id)) return res.status(422).json({ error: 'Invalid post ID' });
  const { error } = await req.db.from('social_likes').delete().eq('post_id', req.params.id).eq('user_id', req.user.id);
  send(res, error, { ok: true });
});
app.get('/api/follows', async (req, res) => {
  const { data, error } = await req.db.from('social_follows').select('following_id').eq('follower_id', req.user.id);
  send(res, error, data);
});
app.put('/api/profiles/:id/follow', async (req, res) => {
  if (!validId(req.params.id) || req.params.id === req.user.id) return res.status(422).json({ error: 'Choose another valid user.' });
  const { error } = await req.db.from('social_follows').insert({ follower_id: req.user.id, following_id: req.params.id });
  send(res, error, { ok: true });
});
app.delete('/api/profiles/:id/follow', async (req, res) => {
  if (!validId(req.params.id)) return res.status(422).json({ error: 'Invalid user ID' });
  const { error } = await req.db.from('social_follows').delete().eq('follower_id', req.user.id).eq('following_id', req.params.id);
  send(res, error, { ok: true });
});
app.use((error, _req, res, _next) => res.status(500).json({ error: error.message || 'Server error' }));
app.listen(process.env.PORT || 3000, () => console.log(`Mini Social running at http://localhost:${process.env.PORT || 3000}`));
