// Observe completed application requests in isolated browser tests. No production hooks.
// The next task runs after the caller's await continuation, so stale-response checks
// wait for the real request/JSON handling instead of assuming a fixed network delay.
async function observeApi(page) {
  await page.evaluate(()=>{
    if(window.__testApiSettled)return;
    const original=window.api;
    if(typeof original!=='function')throw new Error('Load a page with api.js before observing requests.');
    window.__testApiSettled={};
    window.api=async(...args)=>{
      try{return await original(...args);}
      finally{const path=String(args[0]).split('?')[0];setTimeout(()=>{window.__testApiSettled[path]=(window.__testApiSettled[path]||0)+1;},0);}
    };
  });
}
async function waitForApi(page,path,count=1){await page.waitForFunction(({path,count})=>(window.__testApiSettled?.[path]||0)>=count,{path,count});}
module.exports={observeApi,waitForApi};
