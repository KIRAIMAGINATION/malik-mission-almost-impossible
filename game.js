'use strict';
const canvas=document.querySelector('#game'),ctx=canvas.getContext('2d');
const $=s=>document.querySelector(s),keys=new Set();
function resize(){const box=canvas.getBoundingClientRect();canvas.width=Math.max(360,Math.round(540*box.width/box.height));}window.addEventListener('resize',resize);resize();
// Игровой атлас: 6 столбцов × 4 строки, прозрачный фон.
const atlas=new Image(),spriteFrames=[];
atlas.src='assets/characters-v2.png';
atlas.onload=()=>{
  const sheet=document.createElement('canvas');sheet.width=atlas.naturalWidth;sheet.height=atlas.naturalHeight;
  const sc=sheet.getContext('2d',{willReadFrequently:true});sc.drawImage(atlas,0,0);
  const cw=sheet.width/6,rows=[0,280,526,777,1024].map(y=>y*sheet.height/1024);
  for(let i=0;i<24;i++){
    const row=Math.floor(i/6),ox=Math.round(i%6*cw),oy=Math.round(i===21?770*sheet.height/1024:rows[row]),w=Math.floor(cw),h=Math.round((i===15?770*sheet.height/1024:rows[row+1])-oy);
    const pixels=sc.getImageData(ox,oy,w,h).data;let left=w,top=h,right=0,bottom=0;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(pixels[(y*w+x)*4+3]>100){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
    spriteFrames.push({x:ox+left,y:oy+top,w:right-left+1,h:bottom-top+1});
  }
};
const messages=[
'Малик, ты там выехал? Или твоя жопа всё ещё не пролезает в дверной проём? 🍑',
'Ты главное не упади. Я на эту задницу ещё планы имею.',
'Надеюсь, ты купил два места. Одно себе, второе — ну ты понял.',
'Если ты сейчас опять упадёшь, я начну брать деньги за просмотр этого цирка.',
'Последние 20 метров. Надеюсь, выносливости у тебя хватит не только на прыжки.'
];
const kindness=['Ничего страшного, Малик. Мы все иногда ошибаемся.','Ты молодец, Малик. Просто попробуй ещё раз.','Всё хорошо. Облако уже ждёт тебя.','Можно не спешить. У тебя всё получится.','Один неудачный прыжок ничего не меняет.'];
const N=65,END=15130*.75,STEP=END/(N-1),GAG=30,GRAVITY=1100,SPEED=112,JUMP=480;
let platforms=[],p,cam=0,mode='title',last=0,elapsed=0,maxX=0,spoken=new Set(),gag=false,cracked=false,gagTimer=0,toastTimer=0,ending=0,turn=false,muted=true,audio,musicTime=0,note=0,previousMode='play',jumpBuffer=0,coyote=0,landTimer=0;
function reset(){platforms=Array.from({length:N},(_,i)=>({x:i*STEP-50,y:392+Math.round(Math.sin(i*.71)*32),w:100+Math.round(Math.sin(i*1.37)*6),id:i}));platforms[0].w=155;platforms[GAG].y=375;platforms[GAG+1].y=438;p={x:0,y:platforms[0].y-64,vx:0,vy:0,ground:0,safe:0,face:1};cam=Math.max(-180,-Math.min(240,canvas.width*.38));elapsed=0;maxX=0;spoken.clear();gag=false;cracked=false;gagTimer=0;ending=0;turn=false;jumpBuffer=0;coyote=0;landTimer=0;keys.clear();mode='play';hide();}
function show(html,action,label='Продолжить'){keys.clear();$('#card').className='';$('#card').innerHTML=html+(action?`<button id="continue">${label}</button>`:'');$('#overlay').classList.remove('hidden');if(action)$('#continue').onclick=action;}
function hide(){$('#overlay').classList.add('hidden');}
function dialogue(text,action,speaker='КИРИЛЛ'){mode='dialogue';show(`<canvas class="portrait" width="120" height="120" aria-label="${speaker}"></canvas><div class="eyebrow">${speaker} · НА СВЯЗИ</div><p style="font-size:18px">${text}</p>`,()=>{hide();mode='play';action?.();});drawPortrait(speaker);}
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('visible');toastTimer=4;}
function tone(freq,duration=.12,type='triangle',volume=.045){if(muted)return;try{audio??=new (window.AudioContext||window.webkitAudioContext)();audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(volume,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+duration);}catch{}}
$('#sound').onclick=()=>{muted=!muted;$('#sound').textContent='Звук: '+(muted?'выкл.':'вкл.');tone(523);};
function pause(){if(mode==='play'){mode='pause';show('<div class="eyebrow">МОЖНО ВЫДОХНУТЬ</div><h1>Облака подождут.</h1>',()=>{mode='play';hide();});}else if(mode==='pause'){mode='play';hide();}}
$('#pause').onclick=pause;document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='play')pause();});
window.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','Space'].includes(e.code)){e.preventDefault();if(!keys.has(e.code)&&['ArrowUp','Space'].includes(e.code))jumpBuffer=.15;keys.add(e.code);}if(e.code==='Escape')pause();});
window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();if(mode==='play')pause();});
for(const b of document.querySelectorAll('[data-key]')){b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys.add(b.dataset.key);if(b.dataset.key==='Space')jumpBuffer=.18;};for(const ev of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,()=>keys.delete(b.dataset.key));}
function respawn(){const s=platforms[p.safe];p.x=s.x+s.w/2;p.y=s.y-64;p.vy=0;p.vx=0;p.ground=s.id;toast(kindness[Math.floor(Math.random()*kindness.length)]);tone(330,.2);}
function finale(){mode='dialogue';dialogue('Ну что, Малик, готов?',()=>dialogue('Я ради этого полмира прошёл.',()=>dialogue('Тогда поворачивайся…',()=>{mode='ending';ending=0;turn=true;},'КИРИЛЛ'),'МАЛИК'));}
function finish(){mode='error';tone(130,.5,'sawtooth',.06);show('<div class="eyebrow">ОБЛАЧНЫЙ ЭКСПРЕСС · СИСТЕМНОЕ СООБЩЕНИЕ</div><h1>ERROR 413 — ФАЙЛ СЛИШКОМ ОГРОМНЫЙ</h1><p>Не удалось загрузить объект</p><p>Превышен максимально допустимый размер файла</p><p>Для продолжения требуется премиум-версия</p><p style="font-size:11px">Разработчик не несёт ответственности за размеры загружаемых объектов</p><p style="font-size:11px;color:#ffd990">Это шутка. Платить ничего не нужно.</p>',reset,'Сыграть снова');$('#card').className='error';}
function update(dt){if(toastTimer>0&&(toastTimer-=dt)<=0)$('#toast').classList.remove('visible');if(mode==='ending'){ending+=dt;if(ending>3.8)finish();return;}if(mode!=='play')return;landTimer=Math.max(0,landTimer-dt);const oldGround=p.ground;elapsed+=dt;musicTime+=dt;if(musicTime>.42){musicTime=0;const melody=[261.63,329.63,392,523.25,440,392,329.63,293.66];tone(melody[note++%8],.28,'sine',.018);}
const scriptedFall=gag&&!spoken.has('gag');const dir=scriptedFall?0:(keys.has('ArrowRight')?1:0)-(keys.has('ArrowLeft')?1:0);p.vx+=(dir*SPEED-p.vx)*Math.min(1,dt*16);if(dir)p.face=dir;jumpBuffer-=dt;coyote=p.ground!==null?.1:coyote-dt;if(jumpBuffer>0&&coyote>0&&!scriptedFall){p.vy=-JUMP;p.ground=null;coyote=0;jumpBuffer=0;tone(620,.09);}
const oldY=p.y;p.x=Math.max(-25,Math.min(END+30,p.x+p.vx*dt));p.vy+=GRAVITY*dt;p.y+=p.vy*dt;p.ground=null;
if(p.vy>=0)for(const s of platforms){if(cracked&&s.id===GAG)continue;if(p.x+17>s.x&&p.x-17<s.x+s.w&&oldY+64<=s.y+2&&p.y+64>=s.y){p.y=s.y-64;p.vy=0;p.ground=s.id;if(s.id!==GAG)p.safe=s.id;break;}}
if(oldGround===null&&p.ground!==null)landTimer=.14;
if(p.ground===GAG&&!gag){gag=true;gagTimer=.65;}if(gagTimer>0){gagTimer-=dt;if(gagTimer<=0){cracked=true;p.ground=null;platforms[GAG+1].x=platforms[GAG].x-10;platforms[GAG+1].w=STEP*2-50;}}
if(cracked&&p.ground===GAG+1&&!spoken.has('gag')){spoken.add('gag');dialogue('Малик, если облако не выдержало, то что будет с моим лицом?! 💀');}
if(p.y>650)respawn();maxX=Math.max(maxX,p.x);const triggers=[.06,.25,.47,.7,.965];for(let i=0;i<5;i++)if(maxX>=END*triggers[i]&&!spoken.has(i)){spoken.add(i);dialogue(messages[i]);break;}
if(p.x>=END-10&&p.ground===N-1&&mode==='play')finale();const cameraTarget=Math.max(-180,p.x-Math.min(240,canvas.width*.38));cam+=(cameraTarget-cam)*(1-Math.exp(-6*dt));$('#progress').style.width=Math.min(100,maxX/END*100)+'%';$('#distance').textContent=maxX/END>.965?'До Кирилла — последние 20 метров':Math.round(maxX/END*100)+'% пути · без спешки';$('#city').textContent=locationAt(maxX/END).name;}
function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),w,h);}
function cloud(x,y,w=142,shade='#c7d8f0'){rect(x+12,y+8,w-24,18,shade);rect(x,y,w,12,'#f7f5e9');rect(x+16,y-10,w-34,16,'#fffbea');rect(x+35,y-20,38,20,'#fffbea');rect(x+73,y-13,35,13,'#fffbea');rect(x+22,y+4,w-44,3,'#e3e9ee');}
function fallbackPerson(x,y,k=false,walk=0,back=false){ctx.save();ctx.translate(Math.round(x),Math.round(y));const skin=k?'#eac0a0':'#d8aa8a',hair=k?'#e4bb72':'#171a25';const leg=walk?Math.round(Math.sin(walk)*5):0;rect(-16,58+leg,14,6,'#111a30');rect(5,58-leg,15,6,'#111a30');rect(-12,42+leg,10,17,'#334361');rect(3,42-leg,10,17,'#293750');rect(-18,22,35,24,'#151b2a');rect(-15,25,7,18,'#242b39');rect(10,26,9,21,skin);rect(-20,26,8,18,skin);rect(-11,1,24,24,skin);rect(-15,6,5,12,skin);rect(-11,-1,25,8,hair);rect(-14,3,6,8,hair);rect(9,2,7,8,hair);rect(-5,-4,15,5,hair);if(k){rect(-10,-3,7,5,'#f4d89c');rect(-13,10,29,7,'#151c2b');if(!back){rect(-10,11,8,4,'#586879');rect(4,11,8,4,'#586879');}}else if(!back){rect(-9,11,6,2,'#342c2c');rect(5,11,6,2,'#342c2c');rect(-7,21,17,3,'#8e756a');for(let i=0;i<6;i++)rect(-9+i*4,18+(i%2)*2,1,2,'#75645c');}if(!back){rect(1,14,4,4,'#bd8e76');rect(-3,21,8,1,'#9b615b');}else{rect(-9,6,20,12,hair);}rect(-3,25,2,10,k?'#757a89':'#8e9297');rect(5,25,2,9,k?'#757a89':'#8e9297');ctx.restore();}
function playerFrame(){
  if(turn)return 11;
  if(p.ground===null)return p.vy< -60?8:p.vy>100?9:21;
  if(landTimer>0)return landTimer>.07?10:22;
  if(Math.abs(p.vx)>10)return p.face<0?6+Math.floor(elapsed*9)%2:2+Math.floor(elapsed*10)%4;
  return Math.floor(elapsed*2)%8===7?1:0;
}
function person(x,y,k=false,walk=0,back=false){
  if(spriteFrames.length!==24){fallbackPerson(x,y,k,walk,back);return;}
  const index=k?(mode==='dialogue'?14:Math.floor(elapsed*2)%8===7?13:12):playerFrame();
  const f=spriteFrames[index],base=spriteFrames[k?12:0],scale=82/base.h;
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(atlas,f.x,f.y,f.w,f.h,Math.round(x-f.w*scale/2),Math.round(y+64-f.h*scale),Math.round(f.w*scale),Math.round(f.h*scale));
}
function drawPortrait(speaker){
  const face=document.querySelector('.portrait');if(!face)return;
  if(spriteFrames.length!==24){face.hidden=true;return;}
  const c=face.getContext('2d'),f=spriteFrames[speaker==='МАЛИК'?0:14];
  c.imageSmoothingEnabled=false;const scale=112/f.w;
  c.clearRect(0,0,120,120);c.drawImage(atlas,f.x,f.y,f.w,f.h,4,5,112,f.h*scale);
}
const locations=[
 {name:'МОСКВА',kind:'moscow',sky:['#4279cc','#f392af','#ffe2a1'],far:'#a477b2',near:'#67518a',accent:'#ffd28c'},
 {name:'ЛЕСА И ОЗЁРА',kind:'forest',sky:['#328fbb','#88d6cc','#fae4ab'],far:'#68a8b2',near:'#377e83',accent:'#b9ead2'},
 {name:'ЕВРОПА · ЗАКАТ',kind:'town',sky:['#7963bc','#ee88ab','#ffcc88'],far:'#ad6f9a',near:'#705889',accent:'#ffda9d'},
 {name:'ЧЕШСКИЕ ХОЛМЫ',kind:'hills',sky:['#6657ae','#dc86b7','#ffc6a0'],far:'#9877ad',near:'#5e678f',accent:'#eec28d'},
 {name:'ПРАГА',kind:'prague',sky:['#4e4b9c','#c47fc0','#ffb99d'],far:'#9d72a9',near:'#594975',accent:'#ffd4a0'}
];
const locationEdges=[0,.19,.40,.63,.83];
function locationAt(r){let i=0;while(i<4&&r>=locationEdges[i+1])i++;return locations[i];}
function sceneBlend(r){let i=0;while(i<4&&r>=locationEdges[i+1]+.035)i++;const edge=locationEdges[i+1];if(i===4||r<edge-.035)return {a:i,b:i,t:0};let t=(r-edge+.035)/.07;t=t*t*(3-2*t);return {a:i,b:i+1,t};}
function mixColor(a,b,t){const n=parseInt(a.slice(1),16),m=parseInt(b.slice(1),16);return '#'+[16,8,0].map(shift=>Math.round(((n>>shift)&255)*(1-t)+((m>>shift)&255)*t).toString(16).padStart(2,'0')).join('');}
function hill(x,y,w,h,color){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+w*.2,y-h*.45);ctx.lineTo(x+w*.45,y-h);ctx.lineTo(x+w*.68,y-h*.65);ctx.lineTo(x+w,y);ctx.closePath();ctx.fill();}
function skyline(scene,offset,layer){
 const base=layer?505:465,speed=layer?.18:.075,col=layer?scene.near:scene.far,scroll=offset*speed;
 // Координаты привязаны к миру: объект сохраняет форму при выходе за край экрана.
 if(scene.kind==='forest'||scene.kind==='hills'){
  const stride=160,start=Math.floor(scroll/stride)-2;
  for(let i=start;i<start+Math.ceil(canvas.width/stride)+5;i++){
   const x=i*stride-scroll,h=65+Math.abs((i*31)%58);hill(x,base,230,h,col);
   if(scene.kind==='forest'){rect(x+70,base-65,8,65,col);hill(x+43,base-30,62,85,col);hill(x+48,base-63,52,65,col);}
   else if(i%3===0){rect(x+77,base-h-17,23,31,col);rect(x+83,base-h-33,11,17,col);}
  }
 }else{
  const stride=94,start=Math.floor(scroll/stride)-2;
  for(let i=start;i<start+Math.ceil(canvas.width/stride)+5;i++){
   const x=i*stride-scroll,h=40+Math.abs((i*37)%69);rect(x,base-h,72,h,col);
   if(scene.kind==='moscow'&&i%3===0){rect(x+22,base-h-40,24,40,col);rect(x+17,base-h-49,34,12,scene.accent);rect(x+22,base-h-59,24,13,scene.accent);rect(x+29,base-h-68,10,13,scene.accent);rect(x+33,base-h-77,3,10,col);}
   else {hill(x-4,base-h+1,80,scene.kind==='prague'?38:23,col);if(scene.kind==='prague'&&i%3===0){rect(x+24,base-h-45,20,45,col);hill(x+17,base-h-44,34,43,col);rect(x+31,base-h-99,4,20,col);}}
   for(let j=0;j<3;j++)for(let r=0;r<3;r++)rect(x+12+j*17,base-h+12+r*16,5,7,scene.accent);
  }
 }
 rect(0,base,canvas.width,540-base,col);
 if(layer){const stride=85,start=Math.floor(scroll/stride)-1;for(let i=start;i<start+Math.ceil(canvas.width/stride)+3;i++)rect(i*stride-scroll,522,43,2,scene.far);}
}
function drawBackground(){
 const {a,b,t}=sceneBlend(maxX/END),left=locations[a],right=locations[b];
 const gradient=ctx.createLinearGradient(0,0,0,540);[0,.58,1].forEach((stop,i)=>gradient.addColorStop(stop,mixColor(left.sky[i],right.sky[i],t)));ctx.fillStyle=gradient;ctx.fillRect(0,0,canvas.width,540);
 const sunX=canvas.width*.76;rect(sunX-26,95,52,62,'#ffe7ac');rect(sunX-36,106,72,40,'#ffe7ac');
 const scroll=cam*.1,stride=215,start=Math.floor(scroll/stride)-2;
 for(let i=start;i<start+Math.ceil(canvas.width/stride)+5;i++)cloud(i*stride-scroll,120+((i%3+3)%3)*48,92,mixColor('#cbaacb','#ecafd0',maxX/END));
 for(const layer of [0,1]){ctx.globalAlpha=1;skyline(left,cam,layer);if(a!==b){ctx.globalAlpha=t;skyline(right,cam,layer);}}ctx.globalAlpha=1;
 // Короткая подпись делает смену места заметной, не прерывая игру.
 if(a!==b&&t>.05&&t<.95){ctx.save();ctx.globalAlpha=Math.sin(t*Math.PI)*.9;const w=Math.min(300,canvas.width-36);rect((canvas.width-w)/2,77,w,30,'#263355');ctx.fillStyle='#ffe3ad';ctx.font='12px monospace';ctx.textAlign='center';ctx.fillText('ДАЛЬШЕ — '+right.name,canvas.width/2,97);ctx.restore();}
}
function render(){drawBackground();
ctx.save();if(mode==='ending'){const z=1-Math.min(ending/2.4,.4);ctx.translate(canvas.width/2,280);ctx.scale(z,z);ctx.translate(-canvas.width/2,-280);}for(const s of platforms){const x=s.x-cam;if(x< -350||x>1100)continue;if(cracked&&s.id===GAG)continue;cloud(x,s.y,s.w);if(s.id===GAG&&gag){rect(x+65,s.y-12,3,9,'#8395b9');rect(x+68,s.y-3,9,3,'#8395b9');rect(x+74,s.y,3,9,'#8395b9');}}
if(END-cam<1100){person(END+45-cam,platforms[N-1].y-64,true);rect(END-25-cam,platforms[N-1].y+27,150,24,'#1e2c49');ctx.fillStyle='#ffdf9a';ctx.font='12px monospace';ctx.fillText('ПРАГА · ПРИЕХАЛИ',END-18-cam,platforms[N-1].y+44);}if(p)person(p.x-cam,p.y,false,p.ground!==null&&Math.abs(p.vx)>10?elapsed*12:0,turn);ctx.restore();if(mode==='ending'&&ending>2.5){rect(0,0,960,540,'#19223c22');ctx.font='14px monospace';ctx.fillStyle='#fff';ctx.textAlign='center';ctx.fillText('Загрузка объекта…',canvas.width/2,490);ctx.textAlign='start';}}
function frame(t){const dt=Math.min((t-last)/1000||0,.033);last=t;update(dt);render();requestAnimationFrame(frame);}
reset();mode='title';show('<div class="eyebrow">МОСКВА → ПРАГА · 2–4 МИНУТЫ</div><h1>МАЛИК<br>Миссия невыполнима<br><small>(почти)</small></h1><p>Полмира по облакам. Кирилл уже ждёт.<br>И, кажется, приготовил пару комментариев.</p><p>← → — двигаться · ↑ или пробел — прыгать.<br>На телефоне — кнопки внизу. Упадёшь — облако вернёт тебя обратно.</p>',reset,'Ну всё, я выехал');requestAnimationFrame(frame);
