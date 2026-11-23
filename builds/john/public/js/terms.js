// Optional reading pointers. Never modifies editable text, links, code, navigation or controls.
(async()=>{
  if(document.documentElement.hasAttribute('data-term-pointers'))return;
  document.documentElement.setAttribute('data-term-pointers','loading');
  try {
    if(!window.SITerms)await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='/js/term-model.js';s.onload=resolve;s.onerror=reject;document.head.append(s);});
    const response=await fetch('/api/learn/glossary');if(!response.ok)throw new Error('Glossary unavailable');
    const {entries}=await response.json(), byId=new Map(entries.map(e=>[e.id,e]));
    const main=document.querySelector('main')||document.body,pending=new Set([main]);let scheduled=false;
    const excluded='a,button,input,textarea,select,option,script,style,pre,code,nav,header,h1,h2,h3,h4,summary,label,[contenteditable],[data-no-terms],#postRevisions,#adapters';
    function scan(root){
      if(!root.isConnected)return;let remaining=60-main.querySelectorAll('a.term-pointer').length;if(remaining<=0)return;
      const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const nodes=[];if(root.nodeType===Node.TEXT_NODE)nodes.push(root);let node,visited=0;while((node=walker.nextNode())&&visited++<2000)nodes.push(node);
      for(const node of nodes){if(remaining<=0)break;const parent=node.parentElement;if(!parent||parent.closest(excluded)||!node.textContent.trim())continue;const block=parent.closest('p,li,td,dd,.summary,.chunk,.note');if(!block)continue;
        const used=new Set([...block.querySelectorAll('a.term-pointer')].map(a=>a.dataset.term));
        const matches=SITerms.mentions(node.textContent,entries,20).filter(m=>{if(used.has(m.id))return false;used.add(m.id);return true;}).slice(0,remaining);if(!matches.length)continue;
        const fragment=document.createDocumentFragment();let at=0;for(const match of matches){fragment.append(document.createTextNode(node.textContent.slice(at,match.start)));const a=document.createElement('a'),entry=byId.get(match.id);a.className='term-pointer';a.dataset.term=entry.id;a.href='/m/glossary#'+encodeURIComponent(entry.id);a.title=entry.label+': '+entry.plain+' '+entry.caveat;a.textContent=match.text;fragment.append(a);at=match.end;remaining--;}
        fragment.append(document.createTextNode(node.textContent.slice(at)));node.replaceWith(fragment);
      }
    }
    const observer=new MutationObserver(records=>{for(const r of records){if(r.type==='characterData')pending.add(r.target);else for(const n of r.addedNodes)if(n.nodeType===1||n.nodeType===3)pending.add(n);if(pending.size>100)break;}schedule();});
    const options={childList:true,subtree:true,characterData:true};
    function flush(){scheduled=false;observer.disconnect();const roots=[...pending].slice(0,100);pending.clear();for(const root of roots)scan(root);observer.observe(main,options);}
    function schedule(){if(scheduled)return;scheduled=true;if(window.requestIdleCallback)requestIdleCallback(flush,{timeout:500});else setTimeout(flush,50);}
    observer.observe(main,options);schedule();document.documentElement.setAttribute('data-term-pointers','ready');
  } catch { document.documentElement.setAttribute('data-term-pointers','unavailable'); }
})();
