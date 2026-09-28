import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
const $ = id => document.getElementById(id);
const config = await fetch('/api/config').then(r => r.json());
const supabase = createClient(config.url, config.key);
let me, follows = new Set(), page = 0, signup = false;
function notice(message) { $('notice').textContent = message || ''; if (message) setTimeout(() => { if ($('notice').textContent === message) $('notice').textContent = ''; }, 6500); }
async function api(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const response = await fetch('/api' + path, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}`, ...options.headers } });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Request failed');
  return result;
}
function element(tag, cls, text) { const el = document.createElement(tag); if (cls) el.className = cls; if (text !== undefined) el.textContent = text; return el; }
function initials(name) { return (name || '?').slice(0, 1).toUpperCase(); }
function format(date) { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date)); }
function button(text, cls, onClick) { const b = element('button', cls, text); b.type = 'button'; b.addEventListener('click', async () => { b.disabled = true; try { await onClick(); } catch (e) { notice(e.message); } finally { b.disabled = false; } }); return b; }
async function start() {
  const { data: { session } } = await supabase.auth.getSession();
  $('auth').classList.toggle('hidden', !!session); $('app').classList.toggle('hidden', !session); $('logout').classList.toggle('hidden', !session);
  if (!session) return;
  try { await loadMe(); await loadFollows(); await Promise.all([loadProfiles(), loadFeed(true)]); } catch (e) { notice(e.message); }
}
async function loadMe() { me = await api('/me'); $('my-name').textContent = '@' + me.username; $('my-avatar').textContent = initials(me.username); $('my-bio').textContent = me.bio || 'Say a little about yourself.'; }
async function loadFollows() { follows = new Set((await api('/follows')).map(f => f.following_id)); }
async function loadProfiles() {
  const people = await api('/profiles?q=' + encodeURIComponent($('search').value)); $('profiles').replaceChildren();
  for (const user of people) {
    if (user.id === me?.id) continue;
    const row = element('div', 'person'); row.append(element('div', 'small-avatar', initials(user.username)));
    const info = element('div', 'info'); info.append(element('strong', '', '@' + user.username), element('p', 'muted', user.bio || 'Circle member')); row.append(info);
    const following = follows.has(user.id);
    row.append(button(following ? 'Following ✓' : 'Follow +', following ? 'outline' : 'primary', async () => {
      await api('/profiles/' + user.id + '/follow', { method: following ? 'DELETE' : 'PUT' });
      await loadFollows(); await loadProfiles();
    })); $('profiles').append(row);
  }
  if (!$('profiles').children.length) $('profiles').append(element('p', 'muted', 'No other people found.'));
}
async function loadFeed(reset = false) {
  if (reset) { page = 0; $('posts').replaceChildren(); }
  const posts = await api('/feed?page=' + page);
  for (const post of posts) $('posts').append(renderPost(post));
  $('more').classList.toggle('hidden', posts.length < 20); page++;
  if (reset && !posts.length) $('posts').append(element('div', 'panel post', 'No posts yet. Be the first to share something.'));
}
function renderPost(post) {
  const card = element('article', 'panel post');
  const top = element('div', 'post-top'); top.append(element('div', 'small-avatar', initials(post.social_profiles?.username)));
  const byline = element('div'); byline.append(element('h3', '', '@' + (post.social_profiles?.username || 'member')), element('div', 'meta', format(post.created_at))); top.append(byline); card.append(top);
  card.append(element('p', 'post-body', post.body));
  const actions = element('div', 'actions'); const liked = post.social_likes?.some(l => l.user_id === me.id);
  actions.append(button(`${liked ? '♥' : '♡'} ${post.social_likes?.length || 0} likes`, liked ? 'active' : '', async () => { await api(`/posts/${post.id}/like`, { method: liked ? 'DELETE' : 'PUT' }); await loadFeed(true); }));
  actions.append(element('span', 'meta', `${post.social_comments?.length || 0} comments`));
  if (post.user_id === me.id) actions.append(button('Delete post', 'delete', async () => { if (!confirm('Delete this post and its comments?')) return; await api(`/posts/${post.id}`, { method: 'DELETE' }); await loadFeed(true); }));
  card.append(actions);
  const comments = element('div', 'comments');
  for (const comment of (post.social_comments || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at))) {
    const line = element('div', 'comment'); line.append(element('strong', '', '@' + (comment.social_profiles?.username || 'member') + '  '), document.createTextNode(comment.body));
    if (comment.user_id === me.id) line.append(button('Delete', '', async () => { await api('/comments/' + comment.id, { method: 'DELETE' }); await loadFeed(true); }));
    comments.append(line);
  }
  const form = element('form', 'comment-form'); const input = element('input'); input.placeholder = 'Write a comment…'; input.maxLength = 500; input.required = true;
  const submit = element('button', 'primary', 'Reply'); form.append(input, submit);
  form.addEventListener('submit', async e => { e.preventDefault(); submit.disabled = true; try { await api(`/posts/${post.id}/comments`, { method: 'POST', body: JSON.stringify({ body: input.value }) }); await loadFeed(true); } catch (err) { notice(err.message); } finally { submit.disabled = false; } });
  comments.append(form); card.append(comments); return card;
}
$('mode').onclick = () => { signup = !signup; $('auth-submit').textContent = signup ? 'Create account' : 'Sign in'; $('mode').textContent = signup ? 'Already have an account? Sign in' : 'New here? Create an account'; };
$('auth-form').onsubmit = async e => { e.preventDefault(); $('auth-submit').disabled = true; try {
  const email = $('email').value.trim(), password = $('password').value;
  const { data, error } = signup ? await supabase.auth.signUp({ email, password }) : await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (signup && !data.session) notice('Account created. Check your email to confirm it, then sign in.');
  else await start();
} catch (err) { notice(err.message); } finally { $('auth-submit').disabled = false; } };
$('logout').onclick = async () => { await supabase.auth.signOut(); me = null; await start(); };
$('post-body').oninput = () => $('post-count').textContent = `${$('post-body').value.length} / 1000`;
$('post-form').onsubmit = async e => { e.preventDefault(); const b = e.submitter; b.disabled = true; try { await api('/posts', { method: 'POST', body: JSON.stringify({ body: $('post-body').value }) }); $('post-body').value = ''; $('post-count').textContent = '0 / 1000'; await loadFeed(true); } catch (err) { notice(err.message); } finally { b.disabled = false; } };
$('refresh').onclick = () => loadFeed(true).catch(e => notice(e.message)); $('more').onclick = () => loadFeed().catch(e => notice(e.message));
let searchTimer; $('search').oninput = () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => loadProfiles().catch(e => notice(e.message)), 250); };
$('edit-profile').onclick = () => { $('username').value = me.username; $('bio').value = me.bio; $('profile-dialog').showModal(); };
$('cancel-profile').onclick = () => $('profile-dialog').close();
$('profile-form').onsubmit = async e => { e.preventDefault(); try { await api('/me', { method: 'PATCH', body: JSON.stringify({ username: $('username').value, bio: $('bio').value }) }); $('profile-dialog').close(); await Promise.all([loadMe(), loadProfiles(), loadFeed(true)]); } catch (err) { notice(err.message); } };
await start();
