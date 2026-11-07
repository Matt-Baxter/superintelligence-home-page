// Human-readable vocabulary: what each type and field means. It's also the target of the JSON-LD "si:" terms.
module.exports = {
  id: "vocab", file: "vocab.md", about: "Markdown vocabulary (the page JSON-LD si: terms point to)",
  generate(m, { ordered, header }) {
    const L = [`<!-- ${header("").trim()} -->`, `# ${m.pkg} vocabulary`, "", m.about, ""];
    for (const e of m.enums) L.push(`## ${e.name}`, "", e.about, "", e.values.map((v) => `\`${v}\``).join(" · "), "");
    for (const t of ordered) {
      L.push(`## ${t.name}`, "", `${t.about}${t.ld ? ` JSON-LD type: \`${t.ld}\`.` : ""}`, "", "| Field | Type | Meaning |", "| --- | --- | --- |");
      for (const f of t.fields) L.push(`| <a id="${f.name}"></a>\`${f.name}\` | \`${f.base}${f.list ? "[]" : ""}${f.optional ? "?" : ""}\` | ${f.about || ""}${f.ld ? ` (\`${f.ld}\`)` : ""} |`);
      L.push("");
    }
    return L.join("\n");
  },
};
