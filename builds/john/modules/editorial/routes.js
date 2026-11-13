const crypto=require('node:crypto');
module.exports=function mountEditorial(app,{db,auth,admin,wrap,bad,notFound}) {
  const A=[auth,admin], now=()=>db.now();
  function fields(b,old={}){const out={};for(const [key,max]of [['title',160],['summary',300],['body',20000]]){const value=b[key]===undefined?(old[key]||''):b[key];if(typeof value!=='string'||value.length>max)bad(`${key} must be text of at most ${max} characters.`);out[key]=value.trim();}if(!out.title)bad('Give the post a title.');return out;}
  function expected(b){if(!Number.isInteger(b.expected_revision)||b.expected_revision<1)bad('Reload the post to get its current revision.');return b.expected_revision;}
  async function receipt(t,user,id,action,revision){await t.run('INSERT INTO admin_audit (admin_id,action,target,detail,at) VALUES (?,?,?,?,?)',user,`editorial.${action}`,`post:${id}`,`revision ${revision}`,now());}
  async function snapshot(t,p,user,action){await t.run('INSERT INTO editorial_revisions (post_id,revision,title,summary,body,status,actor_id,action,at) VALUES (?,?,?,?,?,?,?,?,?)',p.id,p.revision,p.title,p.summary,p.body,p.status,user,action,now());await t.run('DELETE FROM editorial_revisions WHERE post_id=? AND revision<?',p.id,Math.max(1,p.revision-19));}
  const publicFields='id,slug,published_title AS title,published_summary AS summary,published_body AS body,published_at';
  app.get('/api/editorial/posts',wrap(async()=>({posts:await db.all("SELECT id,slug,published_title AS title,published_summary AS summary,published_at FROM editorial_posts WHERE published_revision IS NOT NULL ORDER BY published_at DESC,id DESC LIMIT 200")})));
  app.get('/api/editorial/posts/:slug',wrap(async req=>{const post=await db.get(`SELECT ${publicFields} FROM editorial_posts WHERE slug=? AND published_revision IS NOT NULL`,String(req.params.slug));if(!post)notFound('That published post');return {post};}));
  app.get('/api/admin/editorial/posts',...A,wrap(async()=>({posts:await db.all('SELECT id,slug,title,summary,status,revision,published_revision,published_at,updated_at FROM editorial_posts ORDER BY id DESC LIMIT 200')})));
  app.get('/api/admin/editorial/posts/:id',...A,wrap(async req=>{const post=await db.get('SELECT * FROM editorial_posts WHERE id=?',Number(req.params.id));if(!post)notFound('That post');const revisions=await db.all('SELECT r.revision,r.title,r.summary,r.body,r.status,r.action,r.at,u.username FROM editorial_revisions r LEFT JOIN users u ON u.id=r.actor_id WHERE r.post_id=? ORDER BY r.revision DESC LIMIT 20',post.id);return {post,revisions};}));
  app.post('/api/admin/editorial/posts',...A,wrap(async req=>{
    const f=fields(req.body),slug=req.body.slug===undefined?(f.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,85)||'post')+'-'+crypto.randomBytes(3).toString('hex'):req.body.slug;
    if(typeof slug!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length>100)bad('Use a URL name with lowercase letters, numbers and single hyphens.');
    const id=await db.tx(async t=>{
      // One database-local quota lock across server instances; SQLite serializes write transactions.
      if(db.engine==='pg')await t.get('SELECT pg_advisory_xact_lock(193628, 200)');
      if((await t.get('SELECT COUNT(*) AS n FROM editorial_posts')).n>=200)bad('The content limit is 200 posts. Export and review the archive before adding more.');if(await t.get('SELECT id FROM editorial_posts WHERE slug=?',slug))bad('That URL name is already in use.');const id=await t.insert("INSERT INTO editorial_posts (slug,title,summary,body,status,revision,created_by,updated_by,updated_at) VALUES (?,?,?,?,'draft',1,?,?,?)",slug,f.title,f.summary,f.body,req.user.id,req.user.id,now());await snapshot(t,{id,...f,status:'draft',revision:1},req.user.id,'create');await receipt(t,req.user.id,id,'create',1);return id;});return {id,revision:1};
  }));
  async function update(req,restore){
    const revision=expected(req.body),id=Number(req.params.id),action=restore?'restore':(req.body.action||'save');
    if(!['save','publish','unpublish','restore'].includes(action)||(!restore&&action==='restore'))bad('Choose save, publish or unpublish.');
    return db.tx(async t=>{
      const old=await t.get('SELECT * FROM editorial_posts WHERE id=?',id);if(!old)notFound('That post');
      if(old.revision!==revision)bad('This post changed elsewhere. Reload before saving; your local text has not been saved.');
      let f;
      if(restore){if(!Number.isInteger(req.body.revision))bad('Choose a revision to restore.');const saved=await t.get('SELECT title,summary,body FROM editorial_revisions WHERE post_id=? AND revision=?',id,req.body.revision);if(!saved)notFound('That retained revision');f=fields(saved);}
      else f=fields(req.body,old);
      if(action==='publish'&&(!f.summary||f.body.length<20||req.body.original!==true))bad('Publishing requires a summary, at least 20 characters of original text and confirmation that you may publish it.');
      // Draft edits and restores preserve the last published snapshot; only explicit publication replaces it.
      const status=action==='publish'?'published':'draft',next=revision+1,published=action==='publish'?(old.published_at||now()):old.published_at;
      const liveRevision=action==='publish'?next:action==='unpublish'?null:old.published_revision;
      const live=action==='publish'?f:{title:old.published_title,summary:old.published_summary,body:old.published_body};
      const changed=await t.run('UPDATE editorial_posts SET title=?,summary=?,body=?,status=?,revision=?,published_revision=?,published_title=?,published_summary=?,published_body=?,published_at=?,updated_at=?,updated_by=? WHERE id=? AND revision=?',f.title,f.summary,f.body,status,next,liveRevision,live.title,live.summary,live.body,published,now(),req.user.id,id,revision);
      if(!changed.changes)bad('This post changed elsewhere. Reload before saving.');
      await snapshot(t,{id,...f,status,revision:next},req.user.id,action);await receipt(t,req.user.id,id,action,next);return {id,revision:next,status};
    });
  }
  app.put('/api/admin/editorial/posts/:id',...A,wrap(req=>update(req,false)));
  app.post('/api/admin/editorial/posts/:id/restore',...A,wrap(req=>update(req,true)));
};
