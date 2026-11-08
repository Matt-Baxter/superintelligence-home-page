// REQ-030: translate the product-idea registry into proposed tracker work, never approvals.
function validate(backlog) {
  if (!backlog || !Array.isArray(backlog.ideas) || backlog.ideas.length !== 200) throw new Error('Product backlog must contain exactly 200 ideas.');
  const ids=new Set(), numbers=new Set();
  const phases=new Map((backlog.phases||[]).map(p=>[p.id,p])),epics=new Set((backlog.epics||[]).map(e=>e.id));
  if(phases.size!==(backlog.phases||[]).length||epics.size!==(backlog.epics||[]).length)throw new Error('Duplicate product phase or epic.');
  if(!phases.size||!epics.size)throw new Error('Product backlog requires phases and epics.');
  const active=new Set(),finished=new Set();
  function phaseVisit(id){if(active.has(id))throw new Error('Cyclic delivery phases.');if(finished.has(id))return;if(!phases.has(id))throw new Error('Unknown delivery phase.');active.add(id);for(const dep of phases.get(id).depends_on||[])phaseVisit(dep);active.delete(id);finished.add(id);}
  for(const id of phases.keys())phaseVisit(id);
  for(const idea of backlog.ideas){
    if(!/^IDEA-\d{3}$/.test(idea.id)||!Number.isInteger(idea.number)||idea.number<1||idea.number>200||idea.id!==`IDEA-${String(idea.number).padStart(3,'0')}`||ids.has(idea.id)||numbers.has(idea.number))throw new Error('Invalid or duplicate product idea identity.');
    ids.add(idea.id);numbers.add(idea.number);
    for(const field of ['title','epic','phase','buyer','outcome','acceptance'])if(typeof idea[field]!=='string'||!idea[field].trim())throw new Error(`${idea.id}: missing ${field}.`);
    if(!['P0','P1','P2','P3'].includes(idea.priority)||!['existing-scope-refinement','proposed-needs-human'].includes(idea.scope_status)||!Array.isArray(idea.requirement_refs))throw new Error(`${idea.id}: invalid planning metadata.`);
    if(!phases.has(idea.phase)||!epics.has(idea.epic))throw new Error(`${idea.id}: unknown phase or epic.`);
    if(idea.phase.length>23||idea.epic.length>24)throw new Error(`${idea.id}: label exceeds tracker limit.`);
    for(const ref of idea.requirement_refs)if(!/^\d{3}$/.test(ref.spec)||!/^REQ-\d{3}$/.test(ref.req))throw new Error(`${idea.id}: invalid requirement pointer.`);
  }
  const byId=new Map(backlog.ideas.map(i=>[i.id,i])), visiting=new Set(),done=new Set();
  function visit(id){if(visiting.has(id))throw new Error('Cyclic product idea dependencies.');if(done.has(id))return;visiting.add(id);for(const dep of byId.get(id).depends_on||[]){if(!byId.has(dep)||dep===id)throw new Error(`${id}: invalid dependency.`);visit(dep);}visiting.delete(id);done.add(id);}
  for(const id of ids)visit(id);
  const sliceIds=new Set();
  for(const slice of backlog.delivery_slices||[]){if(!/^SLICE-\d{3}$/.test(slice.id)||sliceIds.has(slice.id)||!slice.name||!slice.scope||!['planned','in_progress','in_review','done'].includes(slice.status)||!phases.has(slice.phase)||!Array.isArray(slice.idea_ids)||slice.idea_ids.some(id=>!ids.has(id)))throw new Error('Invalid delivery slice.');sliceIds.add(slice.id);}
  return backlog;
}
function items(backlog){validate(backlog);return [...backlog.ideas.map(idea=>({
  key:`product-idea:${String(idea.number).padStart(3,'0')}`,title:`${idea.id}: ${idea.title}`,status:'backlog',follow:false,
  priority:({P0:2,P1:3,P2:4,P3:4})[idea.priority],
  labels:['product-backlog','proposed',`phase:${idea.phase}`,`epic:${idea.epic}`,idea.scope_status==='proposed-needs-human'?'needs-spec':'scope-review'],
  description:[`Source: docs/research/product-backlog.json · ${idea.id}`,`Delivery phase: ${idea.phase} · Planning priority: ${idea.priority}`,`Buyer: ${idea.buyer}`,`Outcome: ${idea.outcome}`,`Acceptance: ${idea.acceptance}`,`Dependencies: ${(idea.depends_on||[]).join(', ')||'See phase prerequisites in docs/PRODUCT_ROADMAP.md.'}`,`Requirement pointers: ${idea.requirement_refs.map(r=>`${r.spec}/${r.req} (${r.status||'review required'})`).join(', ')||'None yet; requires a scoped proposal before implementation.'}`,`Scope: ${idea.scope_status}. Backlog capture is not requirement approval or evidence of delivery.`,`Plan: docs/PRODUCT_ROADMAP.md`].join('\n\n')
})),...(backlog.delivery_slices||[]).map(slice=>({key:`product-slice:${slice.id}`,title:`${slice.id}: ${slice.name}`,status:slice.status==='planned'?'backlog':slice.status,follow:false,priority:2,labels:['product-backlog','delivery-slice',`phase:${slice.phase}`,'REQ-031'],description:`${slice.scope}\n\nPartial ideas: ${slice.idea_ids.join(', ')}. No whole idea is marked complete.\n\nAcceptance: ${slice.acceptance_source}\n\nVerification: ${slice.verification||'Pending implementation checks.'}`}))];}
module.exports={validate,items};
