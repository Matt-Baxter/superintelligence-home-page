import type { Metadata } from "next";
import Link from "next/link";
import { BUILDS, COMPARISON, tallyProvenance, type ComparisonRow } from "@/lib/build-comparison";

export const metadata: Metadata = {
  title: "What Each Build Taught Us",
  description: "Side-by-side comparison of Build A and Build B, and what the combined build added.",
};

const PICK_LABEL: Record<ComparisonRow["pickedFrom"], string> = {
  matt: "From Build A",
  john: "From Build B",
  both: "From both",
};

export default function ComparePage() {
  const tally = tallyProvenance();

  return (
    <>
      <div className="feed-banner">
        <div>
          <p className="eyebrow-label">Learning report</p>
          <h1 className="feed-heading">What each build taught us</h1>
          <p className="feed-subtitle">
            Two builds of the same spec, compared area by area. Each row shows what each build did, which one we kept,
            and what the combined build added that neither had.
          </p>
        </div>
      </div>

      <section className="panel-grid" aria-label="Where the combined build came from">
        <div className="stat-card">
          <div className="stat-value">{tally.matt}</div>
          <div className="stat-label">Areas taken from Build A</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{tally.john}</div>
          <div className="stat-label">Areas taken from Build B</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{tally.both}</div>
          <div className="stat-label">Areas merged from both</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{COMPARISON.length}</div>
          <div className="stat-label">New additions in combined</div>
        </div>
      </section>

      <section aria-labelledby="builds-heading">
        <h2 id="builds-heading" className="section-heading">The builds</h2>
        <div className="panel-grid">
          {(Object.keys(BUILDS) as (keyof typeof BUILDS)[]).map((id) => (
            <div key={id} className="panel-card">
              <p className="eyebrow-label">{BUILDS[id].name}</p>
              <p className="compare-build-author">{BUILDS[id].author}</p>
              <p className="field-hint">{BUILDS[id].tool}</p>
              <p className="field-hint">{BUILDS[id].stack}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="areas-heading">
        <h2 id="areas-heading" className="section-heading">Area by area</h2>
        <p className="section-lede">
          The highlighted line in each row is the addition: something the combined build does that neither original did.
        </p>
        <ol className="compare-list">
          {COMPARISON.map((row) => (
            <li key={row.id} id={row.id} className="compare-row">
              <div className="compare-row-head">
                <h3 className="compare-area">{row.area}</h3>
                <span className="compare-pick">{PICK_LABEL[row.pickedFrom]}</span>
              </div>
              <dl className="compare-cols">
                <div className={row.pickedFrom === "john" ? "compare-col" : "compare-col kept"}>
                  <dt>Build A</dt>
                  <dd>{row.matt}</dd>
                </div>
                <div className={row.pickedFrom === "matt" ? "compare-col" : "compare-col kept"}>
                  <dt>Build B</dt>
                  <dd>{row.john}</dd>
                </div>
              </dl>
              <p className="compare-addition">
                <span className="label">Added</span>
                {row.combinedAddition}
              </p>
              <p className="compare-lesson">
                <span className="label">Lesson</span>
                {row.lesson}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <p className="form-note">
        See the additions in action: <Link href="/queue">review queue</Link>, <Link href="/limits">usage limits</Link>,{" "}
        <Link href="/review">method ledger</Link>, <Link href="/analysis">scoring lab</Link>.
      </p>
    </>
  );
}
