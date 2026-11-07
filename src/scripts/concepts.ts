type Work={title:string;artist:string;year:string;src:string;source:string;rights:string;note:string;original:string;license:string};
const works:Work[]=JSON.parse(document.querySelector('#works')!.textContent!);
const mode=document.body.dataset.mode!;
const q=<T extends HTMLElement=HTMLElement>(s:string)=>document.querySelector<T>(s)!;
const images=[...document.querySelectorAll<HTMLImageElement>('.painting')];
let current=0;
const stage=q('#stage'), range=q<HTMLInputElement>('#distance'), lens=q('#lens');
const details=q<HTMLDialogElement>('#details');
function detail(){const p=works[current]; for(const k of ['title','artist','year','note','source','rights'] as const)q('#detail-'+k).textContent=p[k];q<HTMLAnchorElement>('#original').href=p.original;q<HTMLAnchorElement>('#detail-rights').href=p.license;}
function select(n:number){current=(n+works.length)%works.length;const p=works[current];images.forEach((img,i)=>img.classList.toggle('active',i===current));q('#title').textContent=p.title;q('#byline').textContent=p.artist+' · '+p.year;q('#count').textContent=`0${current+1} — 03`;lens.style.backgroundImage=`url('${p.src}')`;detail();if(mode==='filmstrip')images[current].scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'nearest',inline:'center'});if(mode==='contact'||mode==='shutters')document.body.classList.add('expanded');}
q('#prev').onclick=()=>select(current-1);q('#next').onclick=()=>select(current+1);
q('#action').onclick=()=>{if(['reveal','aperture','spotlight','horizon'].includes(mode)){const on=document.body.classList.toggle('expanded');q('#action').textContent=on?'Reset':({reveal:'Reveal',aperture:'Open',spotlight:'Illuminate',horizon:'Unfold'} as Record<string,string>)[mode];}else if(['contact','shutters'].includes(mode)){document.body.classList.remove('expanded');}else select(current+1);};
document.querySelectorAll<HTMLButtonElement>('[data-select]').forEach(b=>{b.onclick=()=>select(Number(b.dataset.select));if(mode==='index'){b.onmouseenter=()=>select(Number(b.dataset.select));b.onfocus=()=>select(Number(b.dataset.select));}});
q('#info').onclick=()=>{detail();details.showModal();};q('#close').onclick=()=>details.close();details.addEventListener('click',e=>{if(e.target===details && (e as MouseEvent).clientX<details.getBoundingClientRect().left)details.close();});
function distance(){document.body.style.setProperty('--zoom',String(1+Number(range.value)/35));document.body.style.setProperty('--split',range.value+'%');}range.oninput=distance;
stage.addEventListener('wheel',e=>{if(mode==='descent'){e.preventDefault();range.value=String(Math.max(0,Math.min(100,Number(range.value)+e.deltaY/18)));distance();}},{passive:false});
let dragging=false;stage.onpointerdown=e=>{if(mode==='diptych'){dragging=true;stage.setPointerCapture(e.pointerId);move(e);}};stage.onpointerup=()=>dragging=false;
function move(e:PointerEvent){const r=stage.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*100,y=(e.clientY-r.top)/r.height*100;document.body.style.setProperty('--x',x+'%');document.body.style.setProperty('--y',y+'%');if(mode==='loupe')lens.style.backgroundPosition=`${x}% ${y}%`;if(mode==='diptych'&&dragging){range.value=String(x);distance();}}stage.onpointermove=move;
document.addEventListener('keydown',e=>{if(details.open||e.target instanceof HTMLInputElement)return;if(e.key==='ArrowRight')select(current+1);if(e.key==='ArrowLeft')select(current-1);});
if(mode==='filmstrip'){let timer:ReturnType<typeof setTimeout>;q('.pictures').addEventListener('scroll',()=>{clearTimeout(timer);timer=setTimeout(()=>{const box=q('.pictures');const center=box.scrollLeft+box.clientWidth/2;const closest=images.reduce((best,img,i)=>Math.abs(img.offsetLeft+img.offsetWidth/2-center)<Math.abs(images[best].offsetLeft+images[best].offsetWidth/2-center)?i:best,0);if(closest!==current){current=closest;const p=works[current];q('#title').textContent=p.title;q('#byline').textContent=p.artist+' · '+p.year;detail();}},180);});}
detail();
