(() => {
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const targets=document.querySelectorAll('.project-strip,.home-reveal');
  let frame=0;
  let observer;
  function paint(){frame=0;if(reduced.matches)return;document.querySelectorAll('[data-home-spin]').forEach(el=>el.style.setProperty('--spin',`${scrollY*Number(el.dataset.homeSpin)*.16}deg`));const hero=document.querySelector('.home-stage');if(hero){const bounds=hero.getBoundingClientRect();if(bounds.bottom>0&&bounds.top<innerHeight)hero.style.setProperty('--photo-y',`${Math.max(-20,Math.min(20,scrollY*.035))}px`);}}
  function schedule(){if(!frame&&!reduced.matches)frame=requestAnimationFrame(paint);}
  function start(){if(reduced.matches||!('IntersectionObserver' in window))return;observer?.disconnect();observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target)}}),{threshold:.12,rootMargin:'0px 0px 25px 0px'});targets.forEach(el=>observer.observe(el));document.documentElement.classList.add('home-motion');schedule();}
  reduced.addEventListener('change',()=>{if(reduced.matches){observer?.disconnect();cancelAnimationFrame(frame);frame=0;document.documentElement.classList.remove('home-motion');document.querySelectorAll('[data-home-spin]').forEach(el=>el.style.removeProperty('--spin'));document.querySelector('.home-stage')?.style.removeProperty('--photo-y');}else start();});
  addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule,{passive:true});start();
})();
