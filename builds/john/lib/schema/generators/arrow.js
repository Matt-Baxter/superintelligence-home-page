// Apache Arrow schemas (pyarrow) for columnar storage and analysis (Parquet files, DuckDB, Polars).
module.exports = {
  id: "arrow", file: "arrow_schema.py", about: "pyarrow schemas (one per type, nested structs and lists)",
  generate(m, { ordered, header }) {
    const scalar = { string: "pa.string()", int: "pa.int64()", float: "pa.float64()", bool: "pa.bool_()", datetime: 'pa.timestamp("us", tz="UTC")', json: "pa.string()  # JSON text" };
    const typeOf = (f) => { let s = f.scalar ? scalar[f.base].split("  #")[0] : m.isEnum(f.base) ? "pa.dictionary(pa.int8(), pa.string())" : `${f.base}_STRUCT`; if (f.list) s = `pa.list_(${s})`; return s; };
    const L = [header("#"), "import pyarrow as pa", ""];
    for (const t of ordered) {
      L.push(`# ${t.about}`, `${t.name}_FIELDS = [`, ...t.fields.map((f) => `    pa.field(${JSON.stringify(f.name)}, ${typeOf(f)}, nullable=${f.optional ? "True" : "False"}),`), "]", `${t.name}_STRUCT = pa.struct(${t.name}_FIELDS)`, `${t.name} = pa.schema(${t.name}_FIELDS, metadata={"about": ${JSON.stringify(t.about)}})`, "");
    }
    L.push(`SCHEMAS = {${ordered.map((t) => `${JSON.stringify(t.name)}: ${t.name}`).join(", ")}}`, "");
    return L.join("\n");
  },
};
