// Protocol Buffers (proto3) with a gRPC service: compile with protoc / grpcio-tools / buf.
module.exports = {
  id: "protobuf", file: "si.proto", about: "proto3 messages and a gRPC service",
  generate(m, { header }) {
    const scalar = { string: "string", int: "int64", float: "double", bool: "bool", datetime: "string", json: "google.protobuf.Value" };
    const L = [header("//"), 'syntax = "proto3";', "", `package ${m.pkg};`, "", 'import "google/protobuf/struct.proto";', ""];
    for (const e of m.enums) { L.push(`// ${e.about}`, `enum ${e.name} {`, `  ${snake(e.name).toUpperCase()}_UNSPECIFIED = 0;`, ...e.values.map((v, i) => `  ${snake(e.name).toUpperCase()}_${v.toUpperCase().replace(/-/g, "_")} = ${i + 1};`), "}", ""); }
    for (const t of m.types) {
      L.push(`// ${t.about}`, `message ${t.name} {`);
      t.fields.forEach((f, i) => { const base = f.scalar ? scalar[f.base] : f.base; L.push(`  ${f.list ? "repeated " : f.optional && f.scalar && f.base !== "json" ? "optional " : ""}${base} ${f.name} = ${i + 1};${f.about ? ` // ${f.about}` : ""}`); });
      L.push("}", "");
    }
    for (const [s, d] of Object.entries(m.services)) { L.push(`// ${d.about}`, `service ${s} {`, ...Object.entries(d.methods).map(([mn, x]) => `  rpc ${mn[0].toUpperCase() + mn.slice(1)}(${x.input}) returns (${x.output}); // ${x.about}`), "}", ""); }
    return L.join("\n");
    function snake(s) { return s.replace(/([a-z])([A-Z])/g, "$1_$2"); }
  },
};
