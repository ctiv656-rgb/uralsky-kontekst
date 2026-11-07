(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const season = document.querySelector('#season-dialog');
  let frame = 0;
  function paint() {
    frame = 0;
    document.querySelectorAll('[data-spin]').forEach(el => {
      const y = el.closest('dialog') ? season.scrollTop : window.scrollY;
      el.style.setProperty('--rotation', `${y * Number(el.dataset.spin) * .18}deg`);
    });
    document.querySelectorAll('.league-photo,.season-photo').forEach(el => {
      const bounds = el.getBoundingClientRect();
      const viewport = el.closest('dialog') ? season.getBoundingClientRect() : {top:0,height:innerHeight};
      const distance = Math.max(-1, Math.min(1, (bounds.top + bounds.height/2 - viewport.top - viewport.height/2) / viewport.height));
      el.style.setProperty('--photo-shift', `${distance * 18}px`);
    });
  }
  function schedule() { if (!reduce.matches && !frame) frame = requestAnimationFrame(paint); }
  addEventListener('scroll', schedule, {passive:true});
  season.addEventListener('scroll', schedule, {passive:true});
  addEventListener('resize', schedule, {passive:true});
  const observers = new Map();
  function register() {
    if (reduce.matches) return;
    document.querySelectorAll('.season-card,.season-photo,.season-photo-section h3,.season-dossiers,.bracket-heading').forEach(el => {
      if (el.dataset.reveal) return;
      const root = el.closest('dialog');
      if (!observers.has(root)) observers.set(root, new IntersectionObserver(entries => {
        entries.forEach(entry => {if(entry.isIntersecting){entry.target.classList.add('is-visible');observers.get(root).unobserve(entry.target);}});
      }, {root, threshold:.08}));
      el.dataset.reveal='true';
      observers.get(root).observe(el);
    });
    schedule();
  }
  new MutationObserver(register).observe(document.querySelector('#tabs'),{childList:true});
  new MutationObserver(register).observe(document.querySelector('#season-photos'),{childList:true});
  new MutationObserver(schedule).observe(season,{attributes:true,attributeFilter:['open']});
  reduce.addEventListener('change', () => {
    if(reduce.matches){cancelAnimationFrame(frame);frame=0;document.querySelectorAll('[data-reveal]').forEach(el=>el.classList.add('is-visible'));document.querySelectorAll('[data-spin]').forEach(el=>el.style.removeProperty('--rotation'));document.querySelectorAll('.season-photo,.league-photo').forEach(el=>el.style.removeProperty('--photo-shift'));}
    else register();
  });
  register();
})();
