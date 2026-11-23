// OpenRPC description of the JSON-RPC 2.0 endpoint (POST /api/rpc); method params/results reference the JSON Schema.
module.exports = {
  id: "openrpc", file: "openrpc.json", about: "OpenRPC 1.3 for the JSON-RPC endpoint",
  generate(m) {
    const methods = [];
    for (const [svc, d] of Object.entries(m.services)) for (const [name, x] of Object.entries(d.methods)) methods.push({ name: `${svc.toLowerCase()}.${name}`, summary: x.about, paramStructure: "by-name", params: [{ name: "params", required: true, schema: { $ref: `si.schema.json#/$defs/${x.input}` } }], result: { name: "result", schema: { $ref: `si.schema.json#/$defs/${x.output}` } } });
    const url = Object.values(m.services)[0]?.endpoint || "/api/knowledge/rpc";
    return JSON.stringify({ openrpc: "1.3.2", info: { title: `${m.pkg} knowledge API`, version: m.version, description: `JSON-RPC 2.0 at POST ${url} (signed-in users). Generated from schema/types.json.` }, servers: [{ name: "site", url }], methods }, null, 2) + "\n";
  },
};
