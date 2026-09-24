(() => {
  'use strict';
  if (!document.getElementById('journal-app')) return;
  const $ = id => document.getElementById(id);
  const repo = 'mulberry63/mulberry63.github.io';
  const branch = 'journal-data';
  const endpoint = `https://api.github.com/repos/${repo}/contents/entries.json`;
  const draftKey = '363-journal-draft-v1';
  let token = '', entries = [], sha = '', editing = null, busy = false;
  const fields = ['title', 'date', 'tags', 'body'];
  const status = text => { $('journal-status').textContent = text; };
  const today = () => new Date(Date.now() - new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
  const node = (tag, text, cls) => { const el = document.createElement(tag); el.textContent = text; if (cls) el.className = cls; return el; };
  function validate(data) {
    if (!data || data.version !== 1 || !Array.isArray(data.entries)) throw new Error('随笔数据格式不正确，已停止写入。');
    const ids = new Set();
    for (const e of data.entries) {
      if (!e || typeof e.id !== 'string' || ids.has(e.id) || typeof e.title !== 'string' || typeof e.body !== 'string' || typeof e.date !== 'string' || !Array.isArray(e.tags) || e.tags.some(t => typeof t !== 'string')) throw new Error('随笔数据异常，已停止写入。');
      ids.add(e.id);
    }
    return data.entries;
  }
  async function api(method = 'GET', body) {
    const response = await fetch(endpoint + (method === 'GET' ? `?ref=${branch}` : ''), {
      method, headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, ...(body ? {'Content-Type':'application/json'} : {}) },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) {
      if (response.status === 409 || response.status === 422) throw new Error('另一台设备可能刚更新了随笔。草稿已保留，请刷新页面后重试。');
      if (response.status === 401 || response.status === 403) throw new Error('凭据无效、已过期或没有仓库 Contents 写权限，请重新连接。');
      throw new Error(`GitHub 暂时无法完成请求（${response.status}）。请稍后重试，草稿仍在。`);
    }
    return response.json();
  }
  async function load() {
    if (token) {
      const data = await api();
      const bytes = Uint8Array.from(atob(data.content.replace(/\s/g,'')), c => c.charCodeAt(0));
      entries = validate(JSON.parse(new TextDecoder().decode(bytes))); sha = data.sha;
    } else {
      const response = await fetch(`https://raw.githubusercontent.com/${repo}/${branch}/entries.json?t=${Date.now()}`, {signal:AbortSignal.timeout(15000)});
      if (!response.ok) throw new Error('暂时无法读取随笔，请刷新重试。');
      entries = validate(await response.json());
    }
    render(); status(entries.length ? `共 ${entries.length} 篇 · 慢慢写，不着急。` : '第一张纸，留给下一次想说的话。');
  }
  function render() {
    const query = $('journal-search').value.trim().toLocaleLowerCase();
    const list = $('journal-list'); list.replaceChildren();
    const shown = [...entries].sort((a,b) => b.date.localeCompare(a.date)).filter(e => [e.title,e.body,...e.tags].join(' ').toLocaleLowerCase().includes(query));
    if (!shown.length) list.append(node('div',query ? '没有找到这段文字，换个词试试。' : '这里还没有随笔。点击「写一篇」，从一句话开始。','empty-notebook'));
    for (const entry of shown) {
      const article = node('article','','journal-entry'); article.id = `note-${entry.id}`;
      article.append(node('div',`${entry.date}  /  ${entry.tags.join(' · ') || '日常碎片'}`,'entry-meta'),node('h2',entry.title),node('div',entry.body,'entry-body'));
      if (token) {
        const controls = node('div','','entry-controls');
        const edit = node('button','编辑','quiet-button'); edit.disabled = busy; edit.onclick = () => openEditor(entry);
        const del = node('button','删除','quiet-button'); del.disabled = busy; del.onclick = () => remove(entry);
        controls.append(edit,del); article.append(controls);
      }
      list.append(article);
    }
  }
  function draft() { return { id:editing?.id || null, base:editing?.base || null, ...Object.fromEntries(fields.map(f => [f,$(`entry-${f}`).value])) }; }
  function saveDraft() {
    try { localStorage.setItem(draftKey,JSON.stringify(draft())); $('draft-status').textContent='已自动保存到此浏览器'; }
    catch { $('draft-status').textContent='浏览器无法保存草稿，请先下载备份。'; }
  }
  function openEditor(entry) {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(draftKey) || 'null'); } catch { /* broken local draft must not stop writing */ }
    if (entry && saved && (saved.title || saved.body) && !confirm('打开这篇文章会替换当前本地草稿。继续吗？')) return;
    editing = entry ? {id:entry.id,base:JSON.stringify(entry)} : saved?.id ? {id:saved.id,base:saved.base} : null;
    const values = entry ? {...entry,tags:entry.tags.join('，')} : saved || {title:'',date:today(),tags:'',body:''};
    for (const f of fields) $(`entry-${f}`).value = typeof values[f] === 'string' ? values[f] : '';
    $('entry-body').hidden=false; $('entry-preview').hidden=true; $('entry-toggle').textContent='预览';
    $('entry-status').textContent='发布后所有人可见；草稿仅在本机保存。';
    $('entry-publish').textContent=editing?'保存修改':'公开发布';
    $('journal-editor').showModal(); $('entry-title').focus();
  }
  async function write(next) {
    const bytes = new TextEncoder().encode(JSON.stringify({version:1,entries:next},null,2));
    let raw=''; for (const byte of bytes) raw += String.fromCharCode(byte);
    const result = await api('PUT',{message:'更新随笔',branch,sha,content:btoa(raw)});
    sha=result.content.sha; entries=next; render();
  }
  function setBusy(value) {
    busy=value;
    for (const id of ['entry-publish','entry-discard','entry-toggle','journal-write','journal-connect']) $(id).disabled=value;
    for (const f of fields) $(`entry-${f}`).disabled=value;
    render();
  }
  async function publish() {
    saveDraft();
    if (!token) { $('journal-auth').showModal(); return; }
    const d=draft();
    if (!d.title.trim() || !d.body.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) { $('entry-status').textContent='请填写标题、正文和日期。'; return; }
    setBusy(true); $('entry-status').textContent='正在保存到你的笔记本……';
    try {
      await load();
      if (editing && JSON.stringify(entries.find(e=>e.id===editing.id)) !== editing.base) throw new Error('原文已在其他设备修改或删除。当前草稿已保留，请下载备份后重新打开最新原文。');
      const entry={id:editing?.id || crypto.randomUUID(), title:d.title.trim(),body:d.body.trim(),date:d.date,tags:d.tags.split(/[,，]/).map(t=>t.trim()).filter(Boolean),updatedAt:new Date().toISOString()};
      const next=editing?entries.map(e=>e.id===entry.id?entry:e):[entry,...entries];
      await write(next);
      try {localStorage.removeItem(draftKey);} catch { /* remote save succeeded */ }
      $('journal-editor').close(); status('已发布。访客页面可能需要稍等片刻刷新。'); editing=null;
    } catch(e) { $('entry-status').textContent=e.message; } finally {setBusy(false);}
  }
  async function remove(entry) {
    if (!confirm(`确定删除「${entry.title}」？公开页面将移除这篇随笔。`)) return;
    setBusy(true);
    try {
      await load();
      if (JSON.stringify(entries.find(e=>e.id===entry.id)) !== JSON.stringify(entry)) throw new Error('这篇随笔刚被更新，请查看最新内容后再决定是否删除。');
      await write(entries.filter(e=>e.id!==entry.id)); status('已删除。GitHub 版本历史仍保留之前的记录。');
    } catch(e) {status(e.message);} finally {setBusy(false);}
  }
  $('journal-auth-submit').onclick=async()=>{
    token=$('journal-token').value.trim(); $('journal-token').value='';
    if (!token) { $('journal-auth-status').textContent='请先填写凭据。'; return; }
    $('journal-auth-submit').disabled=true;
    try {await load(); $('journal-auth').close(); $('journal-connect').textContent='退出写作';}
    catch(e){token=''; $('journal-auth-status').textContent=e.message; render();}
    finally {$('journal-auth-submit').disabled=false;}
  };
  $('journal-connect').onclick=()=>{if(token){token='';$('journal-connect').textContent='作者登录';render();status('已退出写作。');}else $('journal-auth').showModal();};
  $('journal-write').onclick=()=>openEditor(); $('journal-search').oninput=render;
  fields.forEach(f=>$(`entry-${f}`).addEventListener('input',saveDraft));
  $('entry-publish').onclick=publish;
  $('journal-editor').addEventListener('cancel',e=>{if(busy)e.preventDefault();});
  $('journal-editor').querySelector('form').addEventListener('submit',e=>{if(busy)e.preventDefault();});
  $('entry-toggle').onclick=()=>{const preview=$('entry-preview');preview.textContent=$('entry-body').value;preview.hidden=!preview.hidden;$('entry-body').hidden=!preview.hidden;$('entry-toggle').textContent=preview.hidden?'预览':'继续写';};
  $('entry-discard').onclick=()=>{if(confirm('确定丢弃这份本地草稿？')){try{localStorage.removeItem(draftKey);}catch{}$('journal-editor').close();editing=null;}};
  $('entry-export').onclick=()=>{const d=draft();const url=URL.createObjectURL(new Blob([`# ${d.title}\n\n${d.date}\n\n${d.body}\n`],{type:'text/plain;charset=utf-8'}));const a=node('a','');a.href=url;a.download='随笔备份.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  load().catch(e=>status(e.message));
})();
