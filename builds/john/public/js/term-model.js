// Shared literal matching and bounded numerical examples; no eval and no remote execution.
(function(root, factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.SITerms=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const word = c => !!c && /[\p{L}\p{N}_]/u.test(c);
  const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  function mentions(text,entries,max=40){
    max=Number.isFinite(max)?Math.max(1,Math.min(200,Math.trunc(max))):40;text=String(text||'').slice(0,100000);const candidates=[];
    for(const entry of entries)for(const alias of entry.aliases){const re=new RegExp(escape(alias),/[\u0370-\u03ff]/u.test(alias)?'gu':'giu');let matches=0;for(const m of text.matchAll(re)){const before=Array.from(text.slice(Math.max(0,m.index-2),m.index)).at(-1),after=Array.from(text.slice(m.index+m[0].length,m.index+m[0].length+2))[0];const tail=text.slice(m.index+m[0].length,m.index+m[0].length+2),head=text.slice(Math.max(0,m.index-2),m.index);if((after==='.'&&word(tail[1]))||(before==='.'&&word(head[0]))||before==='/'||after==='/')continue;if((word(Array.from(alias)[0])&&word(before))||(word(Array.from(alias).at(-1))&&word(after)))continue;candidates.push({id:entry.id,start:m.index,end:m.index+m[0].length,text:m[0]});if(++matches>=max*4)break;}}
    candidates.sort((a,b)=>a.start-b.start||(b.end-b.start)-(a.end-a.start)||a.id.localeCompare(b.id));const found=[];let end=-1;for(const c of candidates){if(c.start<end)continue;found.push(c);end=c.end;if(found.length>=max)break;}return found;
  }
  function vector(values){if(!Array.isArray(values)||!values.length||values.length>32||values.some(v=>typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>1000))throw new Error('Use 1–32 finite numbers between −1000 and 1000.');return values;}
  function calculate(id,values){const xs=vector(values);if(id==='softmax'){const max=Math.max(...xs),weights=xs.map(x=>Math.exp(x-max)),sum=weights.reduce((a,b)=>a+b,0);return weights.map(x=>x/sum);}if(id==='sigmoid')return xs.map(x=>x>=0?1/(1+Math.exp(-x)):Math.exp(x)/(1+Math.exp(x)));throw new Error('Unknown teaching function.');}
  const searchKey=value=>Array.from(String(value||'')).map(c=>/[\u0370-\u03ff]/u.test(c)?c:c.toLowerCase()).join('');
  return {mentions,calculate,searchKey};
});
