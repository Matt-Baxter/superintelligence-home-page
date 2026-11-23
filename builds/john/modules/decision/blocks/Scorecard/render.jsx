import React from "react";

export default ({ props }) => (
  <div className="jr-table jr-scorecard">
    <table>
      {props.caption && <caption>{props.caption}</caption>}
      <thead><tr><th>Entry</th>{props.criteria.map((c, i) => <th key={i}>{c.label}<span className="w">{c.weight}%</span></th>)}<th>Total</th></tr></thead>
      <tbody>
        {props.entries.map((e, i) => (
          <tr key={i} className={e.leader ? "leader" : ""}>
            <td>{e.label}</td>
            {e.scores.map((s, j) => <td key={j}>{s == null ? "—" : s}</td>)}
            <td><b>{e.total}</b><span className="bar"><i style={{ width: `${Math.max(0, Math.min(100, e.total))}%` }} /></span></td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
