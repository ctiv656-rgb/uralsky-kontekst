(() => {
  const modal=document.querySelector('#new-season-dialog');
  if(!modal)return;
  let opener;
  const tabs=[...modal.querySelectorAll('[data-season-format]')];
  function activate(tab){tabs.forEach(t=>{const active=t===tab;t.setAttribute('aria-selected',String(active));t.tabIndex=active?0:-1;document.querySelector('#'+t.dataset.seasonFormat+'-panel').hidden=!active;});}
  tabs.forEach((t,i)=>{t.addEventListener('click',()=>activate(t));t.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;activate(tabs[next]);tabs[next].focus();}});});
  function open(b){opener=b;modal.showModal();document.body.classList.add('new-season-active');modal.scrollTop=0;const u=new URL(location.href);u.searchParams.set('new-season','1');history.replaceState(null,'',u);}
  document.querySelectorAll('[data-new-season]').forEach(b=>b.onclick=()=>open(b));
  modal.querySelector('.new-inline-propose').onclick=()=>{modal.close();document.querySelector('.propose-hero').click();};
  modal.querySelector('[data-close-new]').onclick=()=>modal.close();
  modal.addEventListener('close',()=>{document.body.classList.remove('new-season-active');const u=new URL(location.href);u.searchParams.delete('new-season');history.replaceState(null,'',u);opener?.focus();});
  modal.addEventListener('click',e=>{if(e.target!==modal)return;const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)modal.close();});
  document.querySelector('#new-team-slots').innerHTML=Array.from({length:12},(_,i)=>`<div class="new-team-slot"><span>${String(i+1).padStart(2,'0')}</span><b>Команда не объявлена</b><small>Ожидаем состав</small></div>`).join('');
  document.querySelector('#future-standings').innerHTML=Array.from({length:12},(_,i)=>`<tr><td>Место ${String(i+1).padStart(2,'0')} <small>команда не объявлена</small></td><td>—</td><td>—</td><td>—</td><td>—</td></tr>`).join('');
  const match=(label,a,b,bye=false)=>`<div class="future-match ${bye?'bye':''}"><small>${label}</small><p>${a}</p><p>${b}</p></div>`;
  let team=1;
  const first=Array.from({length:8},(_,i)=>{if(i%2===0){const n=i/2+1;const a=team++,b=team++;return match('МАТЧ '+n,'Место команды '+a,'Место команды '+b);}const n=team++;return match('ПРОХОД БЕЗ ИГРЫ','Место команды '+n,'Прямой проход в ¼',true);}).join('');
  const quarter=Array.from({length:4},(_,i)=>match('ЧЕТВЕРТЬФИНАЛ '+(i+1),'Победитель матча '+(i+1),'Место команды '+(3*(i+1))+' · проход')).join('');
  const semi=Array.from({length:2},(_,i)=>match('ПОЛУФИНАЛ '+(i+1),'Победитель ¼ '+(2*i+1),'Победитель ¼ '+(2*i+2))).join('');
  const round=(cls,title,note,cards)=>`<section class="future-round ${cls}"><div class="future-round-title">${title}<span>${note}</span></div><div class="future-round-grid">${cards}</div></section>`;
  document.querySelector('#future-bracket').innerHTML='<div class="future-bracket">'+round('first','01 / ПЕРВЫЙ РАУНД','8 команд играют / 4 проходят напрямую',first)+round('quarter','02 / ЧЕТВЕРТЬФИНАЛЫ','8 команд',quarter)+round('semi','03 / ПОЛУФИНАЛЫ','4 команды',semi)+round('final','04 / ФИНАЛ','2 команды',match('★ ФИНАЛ КУБКА','Победитель ½ 1','Победитель ½ 2'))+'<div class="future-champion">★ Обладателя Кубка узнаем в финале</div></div>';
  const tree=modal.querySelector('.future-bracket');
  function routes(){
    if(!modal.open||document.querySelector('#cup-panel').hidden)return;
    tree.querySelector('.future-routes')?.remove();
    const base=tree.getBoundingClientRect(),rows=[...tree.querySelectorAll('.future-round')];
    let paths='';
    for(let r=0;r<rows.length-1;r++){
      const from=[...rows[r].querySelectorAll('.future-match')],to=[...rows[r+1].querySelectorAll('.future-match')];
      from.forEach((card,i)=>{const a=card.getBoundingClientRect(),b=to[Math.floor(i/2)].getBoundingClientRect();const x=a.x+a.width/2-base.x,y=a.bottom-base.y,xx=b.x+b.width/2-base.x,yy=b.y-base.y,mid=(y+yy)/2;paths+=`<path d="M${x} ${y} V${mid} H${xx} V${yy}" stroke="${r===2?'#d57591':'#7696da'}"/><circle cx="${xx}" cy="${yy}" r="3" fill="${r===2?'#d57591':'#7696da'}"/>`;});
    }
    tree.insertAdjacentHTML('afterbegin',`<svg class="future-routes" width="${tree.scrollWidth}" height="${tree.scrollHeight}" aria-hidden="true" fill="none" stroke-width="1.5">${paths}</svg>`);
  }
  new ResizeObserver(routes).observe(tree);
  new MutationObserver(()=>requestAnimationFrame(routes)).observe(modal,{attributes:true,attributeFilter:['open']});
  tabs.forEach(t=>t.addEventListener('click',()=>requestAnimationFrame(routes)));
  if(new URLSearchParams(location.search).has('new-season'))open(document.querySelector('[data-new-season]'));
})();
