"use strict";
const $ = (id) => document.getElementById(id);
let exportsData = { valid: [], invalid: [], multiple: [] };
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normCode = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const norm = s => normCode(s).replace(/0/g,'o').replace(/ı/g,'i');
function parseAliases(text) {
  const aliases = new Map(), names = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.includes(':')) continue;
    const [head, ...rest] = line.split(':'); const name = head.trim();
    if (!name) continue;
    if (!names.includes(name)) names.push(name);
    for (const alias of [name, ...rest.join(':').split(',')]) if (alias.trim()) aliases.set(norm(alias.trim()), name);
  }
  if (!names.length) throw new Error('Agregá al menos un participante en la configuración.');
  return { aliases, names };
}
function detect(comment, aliases, strict) {
  const raw = String(comment ?? ''), code = normCode(raw);
  const matches = [...code.matchAll(/9\s*0\s*0\s*9/g)];
  if (!matches.length && !code.replace(/\s+/g,'').includes('9009')) return { votes: [], reason: 'No usa 9009 correctamente' };
  const zones = strict ? (matches.length ? matches.map(m => raw.slice(0,m.index)) : [raw.slice(0,code.replace(/\s+/g,'').indexOf('9009'))]) : [raw];
  const found = [];
  for (const zone of zones) {
    const n = norm(zone), compact = n.replace(/[^a-zñ0-9]/g,'');
    for (const [alias, candidate] of aliases) {
      const ac = alias.replace(/[^a-zñ0-9]/g,''); if (!ac) continue;
      const boundary = new RegExp('(^|[^a-zñ])' + alias.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '([^a-zñ]|$)');
      if (boundary.test(n) || compact.includes(ac)) if (!found.includes(candidate)) found.push(candidate);
    }
    for (const token of n.match(/[a-zñ]+/g) || []) {
      const candidate = aliases.get(token); if (candidate && !found.includes(candidate)) found.push(candidate);
    }
  }
  return { votes: found, reason: found.length ? '' : 'No contiene candidato reconocido junto a 9009' };
}
function csvRows(text, delimiter) {
  const rows = [], row = []; let cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i+1] === '"') {cell+='"';i++;} else quoted=!quoted; }
    else if (!quoted && c === delimiter) {row.push(cell);cell='';}
    else if (!quoted && (c === '\n' || c === '\r')) {if(c==='\r' && text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x!==''))rows.push([...row]);row.length=0;cell='';}
    else cell+=c;
  }
  if(quoted) throw new Error('El archivo contiene comillas CSV sin cerrar.');
  row.push(cell);if(row.some(x=>x!==''))rows.push(row);
  return rows;
}
function parseCsv(text) {
  text=text.replace(/^\uFEFF/,''); const head=text.split(/\r?\n/,1)[0];
  const choices=[',',';','\t']; const delimiter=choices.sort((a,b)=>((head.match(new RegExp(b==='\t'?'\\t':b===';'?';':',','g'))||[]).length)-((head.match(new RegExp(a==='\t'?'\\t':a===';'?';':',','g'))||[]).length))[0];
  const rows=csvRows(text,delimiter); if(rows.length<2) throw new Error('El archivo debe tener encabezados y al menos un comentario.');
  const headers=rows.shift().map(x=>x.trim()); return { headers, rows:rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??'']))) };
}
function col(headers, choices) { const lower=headers.map(x=>x.toLowerCase().trim());for(const c of choices){const i=lower.indexOf(c.toLowerCase());if(i>=0)return headers[i];}for(const c of choices){const i=lower.findIndex(x=>x.includes(c.toLowerCase()));if(i>=0)return headers[i];}return null; }
function compareRecent(a,b) {const x=Date.parse(a.date), y=Date.parse(b.date);if(Number.isFinite(x)&&Number.isFinite(y)&&x!==y)return y-x;if(Number.isFinite(x)!==Number.isFinite(y))return Number.isFinite(x)?-1:1;return b.line-a.line;}
function count(rows,headers,config,strict) {
  const {aliases,names}=parseAliases(config);
  const c=col(headers,['Comment','Text','Comentario','Comment Text','Content']); if(!c)throw new Error('No encontré una columna de comentarios (Comment, Text o Comentario).');
  const u=col(headers,['Username','Unique ID','User','Usuario','Author Unique ID','Author','User Name']);
  const nick=col(headers,['Nickname','Display Name','Nombre visible','Author Nickname','Name']);
  const date=col(headers,['Comment Date','Date','Created At','Fecha','Time']);
  const id=col(headers,['Comment ID','Comment Id','ID','comment_id','Cid']);
  const invalid=[], usable=[],seenIds=new Set();
  rows.forEach((r,i)=>{
    const item={line:i+1,user:u?String(r[u]??''):'row_'+i,nickname:nick?r[nick]:'',date:date?r[date]:'',comment:String(r[c]??''),id:id?String(r[id]??''):''};
    const {votes,reason}=detect(item.comment,aliases,strict); item.votes=votes;
    if(item.id && seenIds.has(item.id)){invalid.push({...item,reason:'Duplicado exacto en el CSV, mismo Comment ID',instead:'',keptVotes:''});return;}
    if(item.id)seenIds.add(item.id);
    if(!votes.length){invalid.push({...item,reason,instead:'',keptVotes:''});return;}
    usable.push(item);
  });
  const groups=new Map(); for(const item of usable){if(!groups.has(item.user))groups.set(item.user,[]);groups.get(item.user).push(item);}
  const valid=[],multiple=[];
  for(const [user,group] of groups){
    if(group.length>1) multiple.push({user,nickname:group[0].nickname,count:group.length,lines:group.map(x=>x.line).join(', '),comments:group.map(x=>x.comment).join(' || '),votes:group.map(x=>x.votes.join(', ')).join(' || ')});
    const max=Math.max(...group.map(x=>x.votes.length));
    if(max===1){const kept=new Map();for(const item of [...group].sort(compareRecent)){
      const name=item.votes[0];if(!kept.has(name)){kept.set(name,item);valid.push(item);}else invalid.push({...item,reason:'Voto repetido al mismo participante por el mismo usuario',instead:kept.get(name).line,keptVotes:name});
    }}else{
      const chosen=[...group].filter(x=>x.votes.length===max).sort(compareRecent)[0];valid.push(chosen);
      for(const item of group)if(item!==chosen)invalid.push({...item,reason:item.votes.length<max?`Reemplazado por comentario más completo del mismo usuario, de ${max} participantes`:'Mismo máximo de participantes; se conservó solo uno por desempate',instead:chosen.line,keptVotes:chosen.votes.join(', ')});
    }
  }
  const totals=new Map(names.map(n=>[n,0]));for(const item of valid)for(const vote of item.votes)totals.set(vote,totals.get(vote)+1);
  return {results:[...totals].map(([name,votes])=>({name,votes})).sort((a,b)=>b.votes-a.votes),valid:valid.sort((a,b)=>a.line-b.line),invalid:invalid.sort((a,b)=>a.line-b.line),multiple,duplicates:invalid.filter(x=>x.reason.startsWith('Duplicado exacto')).length};
}
function table(rows,fields) {if(!rows.length)return '<p class="tiktok-muted">No hay registros.</p>';return '<table class="tiktok-table"><thead><tr>'+fields.map(([_,label])=>`<th>${esc(label)}</th>`).join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+fields.map(([key])=>`<td>${esc(Array.isArray(r[key])?r[key].join(', '):r[key])}</td>`).join('')+'</tr>').join('')+'</tbody></table>';}
const detailFields=[['line','Fila'],['user','Usuario'],['nickname','Nombre visible'],['date','Fecha'],['comment','Comentario'],['id','Comment ID'],['votes','Votos detectados']];
const csvValue=x=>'"'+String(x??'').replace(/"/g,'""')+'"';
function download(rows,fields,name){const content='\uFEFF'+fields.map(([,label])=>csvValue(label)).join(',')+'\r\n'+rows.map(r=>fields.map(([key])=>csvValue(Array.isArray(r[key])?r[key].join(', '):r[key])).join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);}
const invalidFields=[...detailFields,['reason','Motivo'],['instead','Fila validada en su lugar'],['keptVotes','Votos validados en su lugar']];
async function run(){const msg=$('countMessage');msg.textContent='';msg.className='';$('report').hidden=true;try{
  const file=$('commentsFile').files[0];if(!file)throw new Error('Seleccioná un archivo CSV.');if(file.size>30*1024*1024)throw new Error('El archivo supera el límite de 30 MB.');
  $('countBtn').disabled=true;const {rows,headers}=parseCsv(await file.text());const result=count(rows,headers,$('candidates').value,$('strict').checked);
  exportsData=result;$('stats').innerHTML=[['Votos',result.results.reduce((s,x)=>s+x.votes,0)],['Comentarios validados',result.valid.length],['No validados',result.invalid.length],['Usuarios con varios comentarios',result.multiple.length],['Comment ID duplicados',result.duplicates]].map(([label,value])=>`<div class="tiktok-stat"><span>${esc(label)}</span><strong>${value}</strong></div>`).join('');
  $('resultsTable').innerHTML=table(result.results,[['name','Participante'],['votes','Votos']]);$('validTable').innerHTML=table(result.valid,[...detailFields,['votes','Votos contados']]);$('invalidTable').innerHTML=table(result.invalid,invalidFields);$('multipleTable').innerHTML=table(result.multiple,[['user','Usuario'],['nickname','Nombre visible'],['count','Comentarios con voto'],['lines','Filas'],['comments','Comentarios'],['votes','Votos detectados']]);$('report').hidden=false;msg.textContent=`Procesados ${rows.length} comentarios de ${file.name}.`;
}catch(e){msg.textContent=e.message;msg.className='tiktok-error';}finally{$('countBtn').disabled=false;}}
$('commentsFile').addEventListener('change',()=>{$('fileLabel').textContent=$('commentsFile').files[0]?.name||'No hay archivo seleccionado.';});
$('countBtn').addEventListener('click',run);
$('validCsv').addEventListener('click',()=>download(exportsData.valid,detailFields,'votos-validados.csv'));
$('invalidCsv').addEventListener('click',()=>download(exportsData.invalid,invalidFields,'votos-no-validados.csv'));
$('multipleCsv').addEventListener('click',()=>download(exportsData.multiple,[['user','Usuario'],['nickname','Nombre visible'],['count','Comentarios con voto'],['lines','Filas'],['comments','Comentarios'],['votes','Votos detectados']],'usuarios-multiples.csv'));
fetch('/api/me',{credentials:'include'}).then(r=>{if(!r.ok)throw new Error('Iniciá sesión para acceder.');return r.json();}).then(data=>{if(!data.user?.isAdmin)throw new Error('Acceso exclusivo para administradores.');$('accessMessage').hidden=true;$('tiktokApp').hidden=false;}).catch(e=>{$('accessMessage').textContent=e.message+' ';const a=document.createElement('a');a.href='/auth/login';a.textContent='Iniciar sesión';$('accessMessage').append(a);});