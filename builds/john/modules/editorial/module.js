// Original editorial content is separate from harvested source records. Extended profile only.
module.exports = {
  id:'editorial', version:'0.1.0', description:'Original posts with admin drafts, revision history, preview and explicit publishing.',
  setup(ctx) {
    ctx.point('db.schema').addSql(`
CREATE TABLE IF NOT EXISTS editorial_posts (id \${ID}, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, summary TEXT DEFAULT '', body TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft', revision INTEGER NOT NULL DEFAULT 1, published_revision INTEGER, published_title TEXT DEFAULT '', published_summary TEXT DEFAULT '', published_body TEXT DEFAULT '', published_at TEXT, updated_at TEXT DEFAULT \${T},
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL, updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL);
CREATE INDEX IF NOT EXISTS idx_editorial_status ON editorial_posts(status, id);
CREATE TABLE IF NOT EXISTS editorial_revisions (post_id INTEGER NOT NULL REFERENCES editorial_posts(id) ON DELETE CASCADE, revision INTEGER NOT NULL,
  title TEXT NOT NULL, summary TEXT DEFAULT '', body TEXT DEFAULT '', status TEXT NOT NULL, actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL, at TEXT DEFAULT \${T}, PRIMARY KEY(post_id, revision));`);
    ctx.point('http.routes').add((app,deps)=>require('./routes')(app,deps));
    ctx.point('ui.nav').add({href:'/m/journal',label:'Journal',order:22});
    ctx.point('ui.nav').add({href:'/m/editorial',label:'Editorial CMS',admin:true,order:88});
  }
};
