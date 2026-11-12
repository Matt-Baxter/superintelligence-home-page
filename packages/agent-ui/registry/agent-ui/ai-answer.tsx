// AIAnswer: a streamed answer with sources. Citation chips ([1], [2]) show a preview of their source on hover AND on
// keyboard focus; source cards sit under the answer; copy, regenerate, thumbs up/down and follow-up questions.
// Improvements: accepts either a finished string or an async iterable of chunks (pass your stream straight in); a
// citation whose number has no source is shown as unresolved instead of a broken chip; "copy" copies the text with its
// sources as a numbered list; while streaming, screen readers get the finished answer once rather than every token;
// feedback asks for an optional note on thumbs down.
import * as React from "react";
import { cx, useAnnouncer } from "./lib";

export type Source = { id: number; title: string; url: string; site?: string; snippet?: string };
export type AIAnswerProps = {
  question?: string;
  answer?: string;
  stream?: AsyncIterable<string>;
  sources?: Source[];
  followUps?: string[];
  onRegenerate?: () => void;
  onFeedback?: (f: { value: "up" | "down"; note?: string }) => void;
  onFollowUp?: (q: string) => void;
  className?: string;
};

function useStreamed(answer?: string, stream?: AsyncIterable<string>) {
  const [text, setText] = React.useState(answer || "");
  const [done, setDone] = React.useState(!stream);
  React.useEffect(() => { if (!stream) { setText(answer || ""); setDone(true); return; } let live = true; setText(""); setDone(false);
    (async () => { for await (const c of stream) { if (!live) return; setText((t) => t + c); } if (live) setDone(true); })().catch(() => live && setDone(true));
    return () => { live = false; }; }, [answer, stream]);
  return { text, done };
}

function Cite({ n, src }: { n: number; src?: Source }) {
  const [show, setShow] = React.useState(false);
  const id = React.useId();
  if (!src) return <span className="aui-cite is-missing" title="No source with this number">[{n}]</span>;
  return (
    <span className="aui-cite-wrap" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <a className="aui-cite" href={src.url} target="_blank" rel="noopener noreferrer" aria-describedby={id}
        onFocus={() => setShow(true)} onBlur={() => setShow(false)} onKeyDown={(e) => e.key === "Escape" && setShow(false)}>{n}</a>
      <span role="tooltip" id={id} className={cx("aui-cite-pop", show && "is-on")}>
        <b>{src.title}</b><span className="aui-xs aui-muted">{src.site || new URL(src.url).hostname}</span>{src.snippet ? <span className="aui-sm">{src.snippet}</span> : null}
      </span>
    </span>
  );
}

/** Paragraphs, with [n] turned into citation chips. Plain text only: no HTML from the model is ever rendered. */
function Rendered({ text, sources }: { text: string; sources: Source[] }) {
  const by = new Map(sources.map((s) => [s.id, s]));
  return <>{text.split(/\n{2,}/).map((p, i) => (
    <p key={i}>{p.split(/(\[\d+\])/g).map((part, j) => { const m = /^\[(\d+)\]$/.exec(part); return m ? <Cite key={j} n={+m[1]} src={by.get(+m[1])} /> : <React.Fragment key={j}>{part}</React.Fragment>; })}</p>
  ))}</>;
}

export function AIAnswer({ question, answer, stream, sources = [], followUps = [], onRegenerate, onFeedback, onFollowUp, className }: AIAnswerProps) {
  const { text, done } = useStreamed(answer, stream);
  const [region, announce] = useAnnouncer();
  const [copied, setCopied] = React.useState(false);
  const [fb, setFb] = React.useState<null | "up" | "down">(null);
  const [note, setNote] = React.useState("");
  React.useEffect(() => { if (done && stream) announce(text); }, [done]); // eslint-disable-line react-hooks/exhaustive-deps
  const copy = async () => {
    const out = text + (sources.length ? "\n\nSources:\n" + sources.map((s) => `[${s.id}] ${s.title} ${s.url}`).join("\n") : "");
    try { await navigator.clipboard.writeText(out); setCopied(true); setTimeout(() => setCopied(false), 1500); announce("Copied with sources"); } catch { announce("Copy failed"); }
  };
  return (
    <section className={cx("aui aui-card aui-answer", className)} aria-label={question ? `Answer: ${question}` : "Answer"} aria-busy={!done}>
      {question ? <h3 className="aui-answer-q">{question}</h3> : null}
      <div className="aui-answer-body" aria-live="off"><Rendered text={text} sources={sources} />{!done ? <span className="aui-caret" aria-hidden="true" /> : null}</div>
      {sources.length ? (
        <ol className="aui-sources" aria-label="Sources">{sources.map((s) => (
          <li key={s.id}><a className="aui-source" href={s.url} target="_blank" rel="noopener noreferrer"><span className="aui-mono aui-xs aui-muted">{s.id}</span>
            <span className="aui-grow"><span className="aui-trunc" style={{ display: "block" }}>{s.title}</span><span className="aui-xs aui-muted">{s.site || new URL(s.url).hostname}</span></span></a></li>))}</ol>
      ) : null}
      {done ? (
        <div className="aui-row aui-answer-tools">
          <button type="button" className="aui-btn ghost aui-xs" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
          {onRegenerate ? <button type="button" className="aui-btn ghost aui-xs" onClick={onRegenerate}>Regenerate</button> : null}
          {onFeedback ? <span className="aui-row" role="group" aria-label="Was this helpful?" style={{ marginLeft: "auto" }}>
            <button type="button" className={cx("aui-btn ghost aui-xs", fb === "up" && "is-on")} aria-pressed={fb === "up"} onClick={() => { setFb("up"); onFeedback({ value: "up" }); announce("Thanks for the feedback"); }}>Helpful</button>
            <button type="button" className={cx("aui-btn ghost aui-xs", fb === "down" && "is-on")} aria-pressed={fb === "down"} onClick={() => setFb("down")}>Not helpful</button></span> : null}
        </div>
      ) : null}
      {fb === "down" && onFeedback ? (
        <form className="aui-row" onSubmit={(e) => { e.preventDefault(); onFeedback({ value: "down", note: note.trim() || undefined }); setFb(null); setNote(""); announce("Thanks for the feedback"); }}>
          <input className="aui-input aui-grow" autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was wrong? (optional)" aria-label="What was wrong" />
          <button className="aui-btn" type="submit">Send</button></form>
      ) : null}
      {done && followUps.length && onFollowUp ? (
        <div className="aui-followups" aria-label="Follow-up questions">{followUps.map((f) => <button key={f} type="button" className="aui-btn aui-sm" onClick={() => onFollowUp(f)}>{f}</button>)}</div>
      ) : null}
      {region}
    </section>
  );
}
