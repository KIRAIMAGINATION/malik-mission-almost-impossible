const fs=require('fs'),vm=require('vm'),assert=require('assert');
const el=()=>({classList:{add(){},remove(){}},style:{},addEventListener(){},setPointerCapture(){},innerHTML:'',textContent:''});const elements=new Map();const get=s=>{if(!elements.has(s))elements.set(s,el());return elements.get(s);};get('#game').getBoundingClientRect=()=>({width:960,height:540});get('#game').getContext=()=>({});const sandbox={document:{querySelector:get,querySelectorAll:()=>[],addEventListener(){}},window:{addEventListener(){}},Image:class{set src(v){}},requestAnimationFrame(){},console,Math};vm.createContext(sandbox);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'game.js'),'utf8'),sandbox);
function run(s){return vm.runInContext(s,sandbox);}
run('reset()');let frames=0,dialogs=[],falls=0,prevSafe=0;while(frames++<60000){let state=run('({mode,x:p.x,y:p.y,g:p.ground,safe:p.safe,cracked,gag})');if(state.mode==='error')break;if(state.mode==='dialogue'){dialogs.push(get('#card').innerHTML);get('#continue').onclick();continue;}if(state.mode==='play'){run(`keys.add('ArrowRight'); if(p.ground!==null){const s=platforms[p.ground];if(p.x>s.x+s.w-23 && !(p.ground===GAG&&!cracked))jumpBuffer=.15;}`);}run('update(1/120)');if(run('p.x')<state.x-100)falls++;}console.log({frames,seconds:run('elapsed'),mode:run('mode'),dialogs:dialogs.length,falls,gag:run('gag'),gagMessage:run("spoken.has('gag')"),five:run('[...spoken].filter(x=>typeof x==="number").length')});assert.equal(run('mode'),'error');assert.equal(dialogs.length,9);assert.equal(run("spoken.has('gag')"),true);assert.equal(run('[...spoken].filter(x=>typeof x==="number").length'),5);run('reset();p.y=700;update(1/120)');assert.equal(run('p.safe'),0);assert(run('p.y')<400);console.log('Возврат после падения и повторный старт: OK');

assert.equal(run('END'),15130*.75);assert.equal(run('N'),65);
run('reset()');const gaps=run('platforms.slice(1).map((s,i)=>s.x-platforms[i].x-platforms[i].w).slice(1)');assert(Math.min(...gaps)>70);assert(Math.max(...gaps)<84);
// Ошибка теперь возможна: без прыжков Малик действительно падает и возвращается.
run('reset();spoken=new Set([0,1,2,3,4]);keys.add("ArrowRight")');let hadFall=false;for(let i=0;i<450;i++){const before=run('p.y');run('update(1/120)');if(before>600&&run('p.y')<400)hadFall=true;}assert(hadFall);
// Переходы палитр непрерывны на обеих границах каждого смешивания.
for(const edge of [.19,.40,.63,.83])for(const boundary of [edge-.035,edge+.035]){
 const colors=[-1e-7,1e-7].map(delta=>run(`(()=>{const b=sceneBlend(${boundary+delta});return mixColor(locations[b.a].sky[0],locations[b.b].sky[0],b.t)})()`));assert.equal(colors[0],colors[1]);
}
console.log('Длина −25%, увеличенные разрывы, падения без прыжка, непрерывность фона: OK');
