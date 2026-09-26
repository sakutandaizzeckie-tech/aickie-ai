import './style.css';

const state = {
  connected: false,
  mode: 'approval',
  posts: JSON.parse(localStorage.getItem('aickie_posts') || '[]'),
  products: JSON.parse(localStorage.getItem('aickie_products') || '[]'),
  brand: JSON.parse(localStorage.getItem('aickie_brand') || JSON.stringify({
    name: 'Aickie Jr Sakutanda',
    tone: 'Luxury, confident, mysterious, classy, creative',
    niche: 'Fashion, boutique, music and lifestyle'
  }))
};

const app = document.querySelector('#app');

function save() {
  localStorage.setItem('aickie_posts', JSON.stringify(state.posts));
  localStorage.setItem('aickie_products', JSON.stringify(state.products));
  localStorage.setItem('aickie_brand', JSON.stringify(state.brand));
}

function esc(s='') {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

function render() {
  app.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="logo">AICKIE<span>AI</span></div>
        <p class="tag">Your AI brand manager</p>
        <button data-page="dashboard">Dashboard</button>
        <button data-page="create">Create Content</button>
        <button data-page="calendar">Content Calendar</button>
        <button data-page="products">Products</button>
        <button data-page="settings">Brand Settings</button>
        <div class="side-bottom">
          <div class="status"><i></i> ${state.mode === 'auto' ? 'AUTO MODE' : 'APPROVAL MODE'}</div>
          <button id="stop" class="danger">STOP AICKIE</button>
        </div>
      </aside>
      <main class="main">
        <header>
          <div><small>AICKIE AI</small><h1>Control Center</h1></div>
          <div class="fb ${state.connected ? 'on':''}">
            <span>●</span> Facebook ${state.connected ? 'Connected':'Not connected'}
            <button id="connect">Connect</button>
          </div>
        </header>
        <section id="content"></section>
      </main>
    </div>`;

  document.querySelectorAll('[data-page]').forEach(b => b.onclick = () => page(b.dataset.page));
  document.querySelector('#connect').onclick = connectFacebook;
  document.querySelector('#stop').onclick = () => { state.mode='approval'; alert('AICKIE is now in approval mode.'); render(); };
  page('dashboard');
}

function page(name) {
  const c = document.querySelector('#content');
  if (name === 'dashboard') c.innerHTML = dashboard();
  if (name === 'create') c.innerHTML = createPage();
  if (name === 'calendar') c.innerHTML = calendar();
  if (name === 'products') c.innerHTML = products();
  if (name === 'settings') c.innerHTML = settings();
  wirePage(name);
}

function dashboard() {
  const pending = state.posts.filter(p=>p.status==='pending').length;
  return `
  <div class="hero">
    <div><span class="eyebrow">GOOD DAY, BOSS</span><h2>AICKIE is ready to build your brand.</h2><p>Create, approve and organize content from one place.</p></div>
    <button class="primary" data-go="create">+ Create content</button>
  </div>
  <div class="stats">
    <div><b>${state.posts.length}</b><span>Total drafts</span></div>
    <div><b>${pending}</b><span>Pending approval</span></div>
    <div><b>${state.products.length}</b><span>Products</span></div>
    <div><b>${state.connected ? 'ON':'OFF'}</b><span>Facebook</span></div>
  </div>
  <div class="panel"><div class="panel-head"><h3>Recent content</h3><button data-go="create">Create</button></div>
  ${state.posts.length ? state.posts.slice(-5).reverse().map(postCard).join('') : '<div class="empty">No content yet. Let AICKIE create your first post.</div>'}</div>`;
}

function createPage() {
  return `<div class="panel">
    <h2>Create content</h2>
    <p class="muted">Tell AICKIE what you want. It will create a Facebook-ready draft.</p>
    <label>Topic / idea</label><textarea id="topic" placeholder="Example: Promote my new song COMPOSURE with an emotional night-drive post"></textarea>
    <label>Content type</label><select id="type"><option>Facebook post</option><option>Product promotion</option><option>Music promotion</option><option>Reel script</option><option>Motivational post</option></select>
    <button id="generate" class="primary wide">Generate with AICKIE</button>
    <div id="result"></div>
  </div>`;
}

function calendar() {
  return `<div class="panel"><div class="panel-head"><h2>Content calendar</h2><span class="pill">${state.posts.length} items</span></div>
  ${state.posts.length ? state.posts.map(postCard).join('') : '<div class="empty">Your approved and draft content will appear here.</div>'}</div>`;
}

function products() {
  return `<div class="panel">
    <div class="panel-head"><h2>Product database</h2></div>
    <p class="muted">Keep product facts here so AICKIE does not invent prices or stock.</p>
    <form id="productForm" class="grid2">
      <input id="pname" placeholder="Product name" required>
      <input id="pprice" placeholder="Price">
      <input id="psizes" placeholder="Sizes">
      <input id="pstock" placeholder="Stock">
      <button class="primary wide" type="submit">Add product</button>
    </form>
    <div>${state.products.map((p,i)=>`<div class="product"><b>${esc(p.name)}</b><span>${esc(p.price||'Price not set')} · ${esc(p.stock||'Stock not set')}</span><button onclick="deleteProduct(${i})">Delete</button></div>`).join('')}</div>
  </div>`;
}

function settings() {
  return `<div class="panel"><h2>Brand settings</h2>
    <label>Brand name</label><input id="brandName" value="${esc(state.brand.name)}">
    <label>Brand tone</label><textarea id="brandTone">${esc(state.brand.tone)}</textarea>
    <label>What you sell / create</label><textarea id="brandNiche">${esc(state.brand.niche)}</textarea>
    <button id="saveBrand" class="primary">Save brand brain</button>
    <hr><h3>Publishing mode</h3>
    <select id="mode"><option value="approval" ${state.mode==='approval'?'selected':''}>Approval required</option><option value="auto" ${state.mode==='auto'?'selected':''}>Auto mode</option></select>
    <p class="warning">Keep approval mode until Facebook publishing and your content rules have been thoroughly tested.</p>
  </div>`;
}

function postCard(p) {
  return `<article class="post">
    <div><span class="pill">${esc(p.type)}</span><span class="pill">${esc(p.status)}</span></div>
    <h3>${esc(p.title)}</h3><p>${esc(p.caption)}</p><small>${esc(p.hashtags||'')}</small>
    ${p.status==='pending'?`<div class="actions"><button onclick="approvePost('${p.id}')">Approve</button><button onclick="deletePost('${p.id}')">Delete</button></div>`:''}
  </article>`;
}

function wirePage(name) {
  document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>page(b.dataset.go));
  if(name==='create') document.querySelector('#generate').onclick=generate;
  if(name==='products') document.querySelector('#productForm').onsubmit=e=>{
    e.preventDefault();
    state.products.push({name:document.querySelector('#pname').value,price:document.querySelector('#pprice').value,sizes:document.querySelector('#psizes').value,stock:document.querySelector('#pstock').value});
    save(); page('products');
  };
  if(name==='settings') {
    document.querySelector('#saveBrand').onclick=()=>{
      state.brand.name=document.querySelector('#brandName').value;
      state.brand.tone=document.querySelector('#brandTone').value;
      state.brand.niche=document.querySelector('#brandNiche').value;
      state.mode=document.querySelector('#mode').value;
      save(); alert('Brand brain saved.'); render();
    };
  }
}

async function generate() {
  const topic=document.querySelector('#topic').value.trim();
  const type=document.querySelector('#type').value;
  const result=document.querySelector('#result');
  if(!topic) return alert('Enter a topic first.');
  result.innerHTML='<div class="loading">AICKIE is thinking…</div>';
  const r=await fetch('/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({topic,contentType:type,brand:state.brand})});
  const data=await r.json();
  if(data.error){result.innerHTML=`<p class="error">${esc(data.error)}</p>`;return;}
  const p={id:crypto.randomUUID(),...data,type,status:'pending'};
  state.posts.push(p); save();
  result.innerHTML=`<div class="generated">${postCard(p)}<button class="primary" onclick="page('dashboard')">View dashboard</button></div>`;
}

async function connectFacebook() {
  alert('Facebook connection is not activated in this starter. The production version needs a Meta developer app, OAuth login and Page permissions. Never enter your Facebook password into AICKIE AI.');
}

window.approvePost=(id)=>{const p=state.posts.find(x=>x.id===id); if(p){p.status='approved';save();render();}};
window.deletePost=(id)=>{state.posts=state.posts.filter(x=>x.id!==id);save();render();};
window.deleteProduct=(i)=>{state.products.splice(i,1);save();page('products');};

render();
