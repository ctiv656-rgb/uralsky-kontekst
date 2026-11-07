(() => {
const dialog=document.querySelector('#topic-dialog'),form=document.querySelector('#topic-form'),send=form.querySelector('[type=submit]'),feedback=document.querySelector('#topic-feedback');
const endpoint=window.TOPIC_API_BASE?.replace(/\/$/,'');let opener=null,busy=false,requestId=null,retryAt=0;
const storageKey='liga-topic-cooldown';
try{retryAt=Number(localStorage.getItem(storageKey))||0;}catch{}
const when=t=>new Intl.DateTimeFormat('ru-RU',{dateStyle:'medium',timeStyle:'short'}).format(t);
function showCooldown(t){retryAt=t;try{localStorage.setItem(storageKey,String(t));}catch{}send.disabled=t>Date.now();if(send.disabled)feedback.textContent='Следующую тему можно предложить '+when(t)+'.';}
async function open(button){opener=button||document.activeElement;const url=new URL(location.href);url.searchParams.set('propose','1');history.replaceState(null,'',url);if(!dialog.open)dialog.showModal();document.body.classList.add('topic-open');
  if(!endpoint){send.disabled=true;feedback.textContent='Приём тем скоро откроется. Сейчас можно поделиться ссылкой на форму.';return;}
  if(retryAt>Date.now())showCooldown(retryAt);else{send.disabled=false;feedback.textContent='';}
  try{const response=await fetch(endpoint+'/status',{signal:AbortSignal.timeout(10000)});const data=await response.json();if(!response.ok)throw Error();if(data.retryAt)showCooldown(data.retryAt);else if(!busy){retryAt=0;send.disabled=false;feedback.textContent='';try{localStorage.removeItem(storageKey);}catch{}}}catch{feedback.textContent='Проверим доступность отправки, когда ты отправишь тему.';}
}
document.querySelectorAll('[data-propose]').forEach(b=>b.addEventListener('click',()=>open(b)));
dialog.querySelector('.topic-close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{document.body.classList.remove('topic-open');const url=new URL(location.href);url.searchParams.delete('propose');history.replaceState(null,'',url);opener?.focus();});
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
form.addEventListener('input',()=>{if(!busy)requestId=null;});
form.addEventListener('submit',async e=>{e.preventDefault();if(busy||!form.reportValidity())return;if(!endpoint){feedback.textContent='Приём тем ещё не подключён.';return;}if(retryAt>Date.now()){showCooldown(retryAt);return;}busy=true;send.disabled=true;feedback.textContent='Отправляем тему…';requestId ||= crypto.randomUUID();
  // Keep the id and immutable payload after network uncertainty; retry must be idempotent.
  const payload={...Object.fromEntries(new FormData(form)),requestId};form.querySelectorAll('input,textarea').forEach(el=>el.disabled=true);
  try{const response=await fetch(endpoint+'/topics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(25000)});const data=await response.json();if(response.status===429){showCooldown(data.retryAt);return;}if(!response.ok||!data.ok)throw Error(data.error||'Не удалось отправить тему. Попробуй ещё раз.');showCooldown(data.retryAt);document.querySelector('#topic-form-view').hidden=true;document.querySelector('#topic-success').hidden=false;document.querySelector('#topic-success-copy').textContent=(data.synced?'Передали твою идею организаторам.':'Тема сохранена и будет передана организаторам.')+' Следующую можно предложить '+when(data.retryAt)+'.';form.reset();requestId=null;
  }catch(error){feedback.textContent=error.name==='TimeoutError'?'Ответ задержался. Нажми отправить ещё раз: повтор не создаст вторую тему.':error.message||'Проверь соединение и попробуй ещё раз.';}finally{busy=false;form.querySelectorAll('input,textarea').forEach(el=>el.disabled=false);send.disabled=retryAt>Date.now();}
});
document.querySelector('#share-topic').onclick=async()=>{const url=new URL(location.href);url.search='';url.hash='';url.searchParams.set('propose','1');const status=document.querySelector('#topic-share-feedback');try{await navigator.clipboard.writeText(url.href);status.textContent='Ссылка скопирована';}catch{status.textContent='Скопируй ссылку: '+url.href;}};
if(new URLSearchParams(location.search).get('propose')==='1')open();
})();
