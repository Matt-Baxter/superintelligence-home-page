import React from "react";
import { cx } from "../_shared.jsx";

export default ({ props }) => (
      <div className="jr-table">
        <table>
          {props.caption && <caption>{props.caption}</caption>}
          <thead><tr>{props.columns.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
          <tbody>{props.rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j}>{v}</td>)}</tr>)}</tbody>
        </table>
      </div>
    );
