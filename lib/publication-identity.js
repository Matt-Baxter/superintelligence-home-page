// REQ-004/007: resolve identifiers from trusted URL structure, never from title mentions.
// Recognition is syntactic: it does not verify that a publication exists or is credible.
function webUrl(value){try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u:null;}catch{return null;}}
function arxivId(value){
  const u=webUrl(value);if(!u||u.port)return null;
  const host=u.hostname.toLowerCase(),paths={'arxiv.org':'(?:abs|pdf|html)','www.arxiv.org':'(?:abs|pdf|html)','export.arxiv.org':'(?:abs|pdf|html)','huggingface.co':'papers','www.huggingface.co':'papers','alphaxiv.org':'abs','www.alphaxiv.org':'abs'};
  if(!Object.hasOwn(paths,host))return null;
  if(/%2f|%5c/i.test(u.pathname))return null;
  let path;try{path=decodeURIComponent(u.pathname);}catch{return null;}
  if(/\.pdf\/?$/.test(path)&&(!host.endsWith('arxiv.org')||!path.startsWith('/pdf/')))return null;
  const modern='[0-9]{2}(?:0[1-9]|1[0-2])\\.[0-9]{4,5}',legacy='[a-zA-Z][a-zA-Z0-9.-]*/[0-9]{2}(?:0[1-9]|1[0-2])[0-9]{3}';
  const match=new RegExp('^/'+paths[host]+'/('+modern+'|'+legacy+')(?:v[1-9][0-9]*)?(?:\\.pdf)?/?$').exec(path);
  if(!match)return null;
  const id=match[1];
  if(!id.includes('/')){const [period,sequence]=id.split('.'),ym=Number(period);if(ym<704||sequence.length!==(ym<1501?4:5))return null;return id;}
  const [archive,number]=id.split('/'),yy=Number(number.slice(0,2)),month=Number(number.slice(2,4)),period=(yy>=91?1900+yy:2000+yy)*100+month;
  if(period<199107||period>200703)return null;
  // Normalize only class-qualified forms explicitly covered by the reviewed references.
  // Unknown archive qualifiers must not collapse onto an existing archive identity.
  if(archive.includes('.')&&!['math.CA','math.GT'].includes(archive))return null;
  return archive.split('.')[0].toLowerCase()+'/'+number;
}
function doiId(value){const u=webUrl(value);if(!u||u.port||!['doi.org','www.doi.org','dx.doi.org'].includes(u.hostname.toLowerCase()))return null;let id;try{id=decodeURIComponent(u.pathname.slice(1));}catch{return null;}return /^10\.[0-9]{4,9}\/\S+$/i.test(id)&&!/[\x00-\x20\x7f]/.test(id)?id.toLowerCase():null;}
function normUrl(value){
  const u=webUrl(value);if(!u)return null;
  const parts=(u.search?u.search.slice(1).split('&'):[]).filter(part=>{let key;try{key=decodeURIComponent(part.split('=')[0].replace(/\+/g,' '));}catch{return true;}return !/^(?:utm_.*|fbclid|gclid)$/i.test(key);});
  // Preserve query ordering/encoding and fragments; these may identify different resources.
  return u.protocol+'//'+u.host+u.pathname+(parts.length?'?'+parts.join('&'):'')+u.hash;
}
function resolve(value){const ax=arxivId(value);if(ax)return {kind:'arxiv',key:'arxiv:'+ax,canonical_url:'https://arxiv.org/abs/'+ax,basis:['trusted-host','complete-arxiv-path','version-family']};const doi=doiId(value);if(doi)return {kind:'doi',key:'doi:'+doi,canonical_url:'https://doi.org/'+doi.split('/').map(encodeURIComponent).join('/'),basis:['doi-resolver-host','complete-doi-path','case-insensitive-identifier']};const url=normUrl(value);return url?{kind:'url',key:'url:'+url,canonical_url:String(value),basis:['normalized-url-structure']}:{kind:'unresolved',key:null,canonical_url:null,basis:[]};}
module.exports={resolve,arxivId,doiId,normUrl};
