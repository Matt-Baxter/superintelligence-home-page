import type { RootTopicId } from "./schemas";

// Unified Ontology Registry combining Build A's exact shared-spec key phrases with Build B's
// hierarchical sub-topics, frontier organizations, evaluation benchmarks, and watched researchers,
// hardened against every false positive and false negative identified in bakeoff/analysis.json
// and Matt's specs/001/research.md (§7, §14–17).

export type TopicDefinition = {
  id: string;
  label: string;
  parent?: string;
  // Exact shared-spec phrases (preserve canonical casing when displayed, e.g. "AGI timelines")
  canonicalPhrases: string[];
  // Extended domain terms (prefix wildcard `*` supported)
  extendedTerms?: string[];
};

export const ONTOLOGY_TOPICS: TopicDefinition[] = [
  // ================= 9 CANONICAL SHARED-SPEC ROOT TOPICS =================
  {
    id: "capabilities-agi",
    label: "Capabilities & AGI progress",
    canonicalPhrases: [
      "AGI",
      "artificial general intelligence",
      "superintelligence",
      "superintelligent",
      "frontier model",
      "frontier models",
      "human-level AI",
    ],
    extendedTerms: [
      "superintelligen*",
      "ASI",
      "general intelligence",
      "superhuman AI",
      "superhuman performance",
      "frontier AI capability",
      "frontier AI capabilities",
      "frontier reasoning",
      "jagged frontier",
      "frontier system*",
      "frontier language model*",
    ],
  },
  {
    id: "automating-ai-research",
    label: "Automating AI research",
    canonicalPhrases: [
      "automated AI research",
      "AI scientist",
      "AI scientists",
      "automating AI research",
      "AI research agent",
      "AI research agents",
    ],
    extendedTerms: [
      "AI R&D",
      "research automation",
      "automated alignment research",
      "RE-Bench",
      "MLE-bench",
      "PaperBench",
      "ML engineering agent*",
      "research acceleration",
      "automated ML research",
    ],
  },
  {
    id: "recursive-self-improvement",
    label: "Recursive self improvement",
    canonicalPhrases: [
      "recursive self-improvement",
      "self-improving AI",
      "intelligence explosion",
    ],
    extendedTerms: [
      "recursive self improvement",
      "recursively self-improv*",
      "seed AI",
      "software intelligence explosion",
      "AI improving AI",
      "self-improving agent*",
      "self-improving language model*",
      "self-improving frontier*",
      "continual recursive self-improvement",
      "self-improvement memory",
    ],
  },
  {
    id: "alignment",
    label: "Alignment",
    canonicalPhrases: [
      "alignment",
      "aligned AI",
      "misalignment",
      "reward hacking",
      "scalable oversight",
      "superalignment",
    ],
    extendedTerms: [
      "AI alignment",
      "value alignment",
      "intent alignment",
      "outer alignment",
      "inner alignment",
      "mesa-optimiz*",
      "mesa optimiz*",
      "deliberative alignment",
      "constitutional AI",
      "RLHF",
      "human preferences",
      "corrigib*",
      "sycophancy",
      "power-seeking",
      "goal misgeneralization",
      "misalignment generalization",
      "alignment faking",
      "weak-to-strong generalization",
      "specification gaming",
    ],
  },
  {
    id: "interpretability",
    label: "Interpretability",
    canonicalPhrases: [
      "interpretability",
      "mechanistic interpretability",
      "sparse autoencoder",
      "sparse autoencoders",
    ],
    extendedTerms: [
      "monosemantic*",
      "polysemantic*",
      "superposition",
      "extracting concepts",
      "dictionary learning",
      "activation patching",
      "circuit tracing",
      "attribution graph*",
      "representation engineering",
      "linear probe*",
      "persona directions",
      "decomposing language models",
    ],
  },
  {
    id: "safety-risk",
    label: "Safety & risk",
    canonicalPhrases: [
      "AI safety",
      "existential risk",
      "existential risks",
      "x-risk",
      "catastrophic risk",
      "catastrophic risks",
      "loss of control",
      "deceptive alignment",
    ],
    extendedTerms: [
      "concrete problems in AI safety",
      "frontier AI risk*",
      "dangerous capabilit*",
      "autonomous replication",
      "self-exfiltrat*",
      "rogue AI",
      "frontier safety",
      "joint safety evaluation*",
      "safety evaluation*",
      "red-teaming frontier",
      "existential safety",
    ],
  },
  {
    id: "forecasting-timelines",
    label: "Forecasting & timelines",
    canonicalPhrases: [
      "AGI timeline",
      "AGI timelines",
      "forecasting AI",
      "AI forecast",
      "AI forecasts",
      "transformative AI",
    ],
    extendedTerms: [
      "timelines to AGI",
      "AI 2027",
      "situational awareness: the decade ahead",
      "takeoff speed*",
      "fast takeoff",
      "slow takeoff",
      "hard takeoff",
      "soft takeoff",
      "short timelines",
      "superintelligence timeline*",
      "discontinuous progress",
    ],
  },
  {
    id: "compute-scaling",
    label: "Compute & scaling",
    canonicalPhrases: [
      "scaling law",
      "scaling laws",
      "compute scaling",
      "training compute",
      "scaling hypothesis",
    ],
    extendedTerms: [
      "compute-optimal",
      "Chinchilla scaling",
      "test-time compute",
      "inference-time compute",
      "inference scaling",
      "frontier training run*",
      "10^25 FLOP*",
      "10^26 FLOP*",
      "10^27 FLOP*",
      "exaflop*",
      "gigawatt cluster*",
      "AI supercomputer*",
    ],
  },
  {
    id: "governance-policy",
    label: "Governance & policy",
    canonicalPhrases: [
      "AI governance",
      "frontier AI regulation",
      "compute governance",
      "AI policy",
      "AI policies",
      "frontier AI safety",
    ],
    extendedTerms: [
      "governance of superintelligence",
      "EU AI Act",
      "AI executive order",
      "executive order for AI testing",
      "frontier model legislation",
      "export controls on AI chips",
      "international AI treaty",
      "AI Safety Institute",
      "AI Security Institute",
      "responsible scaling polic*",
      "frontier safety framework",
      "preparedness framework",
    ],
  },

  // ================= HIERARCHICAL SUB-TOPICS (ROLL UP TO ROOTS) =================
  {
    id: "self-improvement-memory",
    label: "Self-improvement memory & harness evolution",
    parent: "recursive-self-improvement",
    canonicalPhrases: [],
    extendedTerms: [
      "self-improvement memory",
      "continual recursive self-improvement",
      "CRSI",
      "harness optimization",
      "agentic outer loop",
      "candidate harnesses",
      "retained harness",
    ],
  },
  {
    id: "reasoning",
    label: "Reasoning & theorem proving",
    parent: "capabilities-agi",
    canonicalPhrases: [],
    extendedTerms: [
      "reasoning model*",
      "chain of thought",
      "chain-of-thought",
      "chains of thought",
      "theorem prov*",
      "formal proof*",
      "Lean 4",
      "autoformaliz*",
      "IMO gold",
      "International Mathematical Olympiad",
      "AI progress in mathematics",
      "FrontierMath",
      "ARC-AGI*",
      "Humanity's Last Exam",
    ],
  },
  {
    id: "long-horizon-agents",
    label: "Long-horizon autonomy",
    parent: "capabilities-agi",
    canonicalPhrases: [],
    extendedTerms: [
      "long-horizon agent*",
      "complete long tasks",
      "time horizon*",
      "time-horizon*",
      "computer-using agent*",
      "autonomous coding agent*",
      "SWE-bench Verified",
      "SWE-bench Pro",
      "Terminal-Bench*",
      "OSWorld*",
    ],
  },
  {
    id: "ai-scientists",
    label: "AI scientists & R&D agents",
    parent: "automating-ai-research",
    canonicalPhrases: [],
    extendedTerms: [
      "autonomous scientific discovery",
      "AI R&D-relevant",
      "AI-driven research",
      "kernel optimization agent*",
    ],
  },
  {
    id: "synthetic-self-play",
    label: "Self-play & recursive training",
    parent: "recursive-self-improvement",
    canonicalPhrases: [],
    extendedTerms: [
      "AlphaZero-style self-play",
      "recursive reward modeling",
      "self-play reinforcement learning",
      "bootstrapped reasoning",
    ],
  },
  {
    id: "scalable-oversight-sub",
    label: "Scalable oversight & debate",
    parent: "alignment",
    canonicalPhrases: [],
    extendedTerms: [
      "AI safety via debate",
      "AI debate",
      "debate protocol*",
      "weak-to-strong",
      "iterated amplification",
      "amplifying weak experts",
      "prover-verifier",
    ],
  },
  {
    id: "cot-monitoring",
    label: "Chain-of-thought monitoring",
    parent: "interpretability",
    canonicalPhrases: [],
    extendedTerms: [
      "chain-of-thought monitor*",
      "chain of thought monitor*",
      "CoT monitor*",
      "control their chains of thought",
      "faithful reasoning",
      "reasoning faithfulness",
      "monitorability",
      "unfaithful chain-of-thought",
    ],
  },
  {
    id: "deception-scheming",
    label: "Deception & scheming",
    parent: "safety-risk",
    canonicalPhrases: [],
    extendedTerms: [
      "scheming",
      "in-context scheming",
      "sandbagging",
      "situational awareness",
      "sleeper agent*",
      "deceptive LLM*",
      "detecting deception in large language models",
      "strategic deception",
      "covertly underperforming",
      "subversion",
    ],
  },
  {
    id: "ai-control",
    label: "AI control & dangerous evals",
    parent: "safety-risk",
    canonicalPhrases: [],
    extendedTerms: [
      "AI control",
      "intentional subversion",
      "control evaluation*",
      "untrusted model*",
      "trusted monitoring",
      "control protocol*",
      "CBRN",
      "biosecurity uplift",
      "cyber offense evaluation*",
      "Cybench",
    ],
  },
  {
    id: "frontier-hardware",
    label: "Frontier clusters & chips",
    parent: "compute-scaling",
    canonicalPhrases: [],
    extendedTerms: [
      "AI data center*",
      "frontier cluster*",
      "Blackwell cluster*",
      "GB200",
      "training run power",
    ],
  },
  {
    id: "lab-governance",
    label: "Safety frameworks & treaties",
    parent: "governance-policy",
    canonicalPhrases: [],
    extendedTerms: [
      "safety case*",
      "frontier model testing",
      "prior to frontier model releases",
      "compute threshold*",
      "model weights security",
      "pre-deployment evaluation*",
    ],
  },
];

export type OrganizationDef = { id: string; label: string; terms: string[] };

export const ONTOLOGY_ORGS: OrganizationDef[] = [
  { id: "openai", label: "OpenAI", terms: ["OpenAI", "GPT-4*", "GPT-5*", "o1", "o3", "o4*"] },
  { id: "anthropic", label: "Anthropic", terms: ["Anthropic", "Claude"] },
  { id: "google-deepmind", label: "Google DeepMind", terms: ["DeepMind", "Gemini", "AlphaProof", "AlphaEvolve", "Chinchilla"] },
  { id: "meta-ai", label: "Meta AI", terms: ["Meta AI", "FAIR", "Llama"] },
  { id: "xai", label: "xAI", terms: ["xAI", "Grok"] },
  { id: "microsoft-ai", label: "Microsoft AI", terms: ["Microsoft AI"] },
  { id: "ssi", label: "Safe Superintelligence", terms: ["Safe Superintelligence", "SSI Inc"] },
  { id: "miri", label: "MIRI", terms: ["MIRI", "Machine Intelligence Research Institute"] },
  { id: "redwood", label: "Redwood Research", terms: ["Redwood Research"] },
  { id: "apollo", label: "Apollo Research", terms: ["Apollo Research"] },
  { id: "metr", label: "METR", terms: ["METR", "ARC Evals"] },
  { id: "epoch", label: "Epoch AI", terms: ["Epoch AI"] },
  { id: "arc", label: "ARC", terms: ["Alignment Research Center", "ARC Prize"] },
  { id: "cais", label: "Center for AI Safety", terms: ["Center for AI Safety", "CAIS"] },
  { id: "aisi", label: "AI Security Institute", terms: ["AI Security Institute", "AI Safety Institute", "UK AISI", "US AISI", "CAISI"] },
  { id: "deepseek", label: "DeepSeek", terms: ["DeepSeek"] },
  { id: "qwen", label: "Alibaba / Qwen", terms: ["Qwen*"] },
  { id: "mistral", label: "Mistral", terms: ["Mistral"] },
  { id: "thinking-machines", label: "Thinking Machines Lab", terms: ["Thinking Machines Lab"] },
  { id: "far-ai", label: "FAR.AI", terms: ["FAR.AI"] },
  { id: "ai-impacts", label: "AI Impacts", terms: ["AI Impacts"] },
  { id: "ai-futures", label: "AI Futures Project", terms: ["AI Futures Project", "AI 2027"] },
];

export type BenchmarkDef = {
  id: string;
  label: string;
  measures: RootTopicId | string;
  terms: string[];
  unit?: "percent" | "time";
  generic?: boolean;
};

export const ONTOLOGY_BENCHMARKS: BenchmarkDef[] = [
  { id: "swe-bench-verified", label: "SWE-bench Verified", measures: "capabilities-agi", terms: ["SWE-bench Verified"] },
  { id: "swe-bench-pro", label: "SWE-bench Pro", measures: "capabilities-agi", terms: ["SWE-bench Pro"] },
  { id: "swe-bench", label: "SWE-bench", measures: "capabilities-agi", terms: ["SWE-bench"], generic: true },
  { id: "arc-agi", label: "ARC-AGI", measures: "capabilities-agi", terms: ["ARC-AGI*"] },
  { id: "frontiermath", label: "FrontierMath", measures: "capabilities-agi", terms: ["FrontierMath", "Frontier Math"] },
  { id: "hle", label: "Humanity's Last Exam", measures: "capabilities-agi", terms: ["Humanity's Last Exam", "HLE"] },
  { id: "gpqa", label: "GPQA Diamond", measures: "capabilities-agi", terms: ["GPQA*"] },
  { id: "aime", label: "AIME", measures: "capabilities-agi", terms: ["AIME"] },
  { id: "imo", label: "IMO", measures: "capabilities-agi", terms: ["IMO gold", "IMO 20*", "International Mathematical Olympiad"] },
  { id: "metr-horizon", label: "METR Time Horizon", measures: "capabilities-agi", terms: ["time horizon*", "time-horizon*"], unit: "time" },
  { id: "re-bench", label: "RE-Bench", measures: "automating-ai-research", terms: ["RE-Bench"] },
  { id: "mle-bench", label: "MLE-bench", measures: "automating-ai-research", terms: ["MLE-bench"] },
  { id: "paperbench", label: "PaperBench", measures: "automating-ai-research", terms: ["PaperBench"] },
  { id: "terminal-bench", label: "Terminal-Bench", measures: "capabilities-agi", terms: ["Terminal-Bench*"] },
  { id: "osworld", label: "OSWorld", measures: "capabilities-agi", terms: ["OSWorld*"] },
  { id: "cybench", label: "Cybench", measures: "safety-risk", terms: ["Cybench"] },
  { id: "mmlu", label: "MMLU", measures: "capabilities-agi", terms: ["MMLU*"] },
];

export type ResearcherDef = { id: string; label: string; terms: string[] };

// Watchlist only (AGENTS.md + Goodhart rule: catalogued as entity metadata only, 0 significance points).
export const ONTOLOGY_PEOPLE: ResearcherDef[] = [
  { id: "nick-bostrom", label: "Nick Bostrom", terms: ["Nick Bostrom"] },
  { id: "eliezer-yudkowsky", label: "Eliezer Yudkowsky", terms: ["Eliezer Yudkowsky"] },
  { id: "ilya-sutskever", label: "Ilya Sutskever", terms: ["Ilya Sutskever"] },
  { id: "dario-amodei", label: "Dario Amodei", terms: ["Dario Amodei"] },
  { id: "demis-hassabis", label: "Demis Hassabis", terms: ["Demis Hassabis"] },
  { id: "sam-altman", label: "Sam Altman", terms: ["Sam Altman"] },
  { id: "jan-leike", label: "Jan Leike", terms: ["Jan Leike"] },
  { id: "paul-christiano", label: "Paul Christiano", terms: ["Paul Christiano"] },
  { id: "evan-hubinger", label: "Evan Hubinger", terms: ["Evan Hubinger"] },
  { id: "buck-shlegeris", label: "Buck Shlegeris", terms: ["Buck Shlegeris"] },
  { id: "ryan-greenblatt", label: "Ryan Greenblatt", terms: ["Ryan Greenblatt"] },
  { id: "chris-olah", label: "Chris Olah", terms: ["Chris Olah"] },
  { id: "yoshua-bengio", label: "Yoshua Bengio", terms: ["Yoshua Bengio"] },
  { id: "geoffrey-hinton", label: "Geoffrey Hinton", terms: ["Geoffrey Hinton"] },
  { id: "stuart-russell", label: "Stuart Russell", terms: ["Stuart Russell"] },
  { id: "shane-legg", label: "Shane Legg", terms: ["Shane Legg"] },
  { id: "ajeya-cotra", label: "Ajeya Cotra", terms: ["Ajeya Cotra"] },
  { id: "daniel-kokotajlo", label: "Daniel Kokotajlo", terms: ["Daniel Kokotajlo"] },
  { id: "leopold-aschenbrenner", label: "Leopold Aschenbrenner", terms: ["Leopold Aschenbrenner"] },
  { id: "joe-carlsmith", label: "Joe Carlsmith", terms: ["Joe Carlsmith"] },
  { id: "jacob-steinhardt", label: "Jacob Steinhardt", terms: ["Jacob Steinhardt"] },
  { id: "jared-kaplan", label: "Jared Kaplan", terms: ["Jared Kaplan"] },
  { id: "francois-chollet", label: "François Chollet", terms: ["François Chollet", "Francois Chollet"] },
  { id: "noam-brown", label: "Noam Brown", terms: ["Noam Brown"] },
  { id: "jack-clark", label: "Jack Clark", terms: ["Jack Clark"] },
  { id: "zvi-mowshowitz", label: "Zvi Mowshowitz", terms: ["Zvi Mowshowitz"] },
  { id: "jaime-sevilla", label: "Jaime Sevilla", terms: ["Jaime Sevilla"] },
  { id: "tamay-besiroglu", label: "Tamay Besiroglu", terms: ["Tamay Besiroglu"] },
  { id: "helen-toner", label: "Helen Toner", terms: ["Helen Toner"] },
  { id: "dean-ball", label: "Dean Ball", terms: ["Dean Ball"] },
];

// Collocations where "alignment" refers to geometry, vision, modality fusion, bioinformatics, or enterprise stakeholder process
// rather than AI intent/value/safety alignment (closes bake-off AT-13 dilution from Build B analysis.json).
export const NON_SAFETY_ALIGNMENT_COLLOCATIONS = [
  /\b(?:cross-modal|multimodal|visual|shared\s+visual\s+space|image-text|vision-language|video-audio|audio-visual|spatial|temporal|pixel|pose|camera|face|facial|mesh|3d|token|sequence|dna|genome|protein|ontology|schema|optical|feature|embedding|representation|stakeholder|organizational|corporate|business|strategic)\s+alignment\b/gi,
  /\balignment\s+(?:of\s+|between\s+|across\s+)?(?:images|pixels|frames|modalities|embeddings|features|representations|sequences|cameras|meshes|point\s+clouds|stakeholders|visual\s+space)\b/gi,
  /\bmethod\s+align\b/gi,
];

// Context required when ONLY bare "alignment" (not "AI alignment", "misalignment", "scalable oversight", etc.) matched.
export const AI_ALIGNMENT_CONTEXT_RE =
  /\b(?:ai|artificial\s+intelligence|superintelligen\w*|agi|asi|llm\w*|language\s+model\w*|frontier\s+model\w*|reasoning\s+model\w*|safety|oversight|rlhf|human\s+feedback|human\s+preferences|value\w*|corrigib\w*|decepti\w*|scheming|reward|power[- ]seeking|catastrophic|existential|autonomous\s+agent\w*)\b/i;

// Stock ticker / finance false positives for "AGI" (Alamos Gold Inc., NYSE/TSX: AGI — identified in Matt's sources.ts §31).
export const STOCK_TICKER_NOISE_RE =
  /\b(?:alamos\s+gold|(?:nyse|tsx|nasdaq)\s*:\s*agi|gold\s+(?:production|mine\w*|ounces|reserves)|ounces\s+of\s+gold|quarterly\s+(?:dividend|earnings)|earnings\s+per\s+share|share\s+repurchase|stock\s+ticker)\b/i;

// Narrow vertical/applied AI domains that are out-of-scope unless anchored by an explicit superintelligence/x-risk term
// (covers every Build B false positive recorded in bakeoff/runs/2026-11-23T03-48-51/analysis.json).
export const NARROW_APPLIED_AI_RE =
  /\b(?:photo[- ]editing|image[- ]editing\s+app|retail\s+inventory|e-commerce\s+checkout|medical\s+image\s+(?:models?|segmentation|classification)|clinical\s+reasoning\s+optimization|medical\s+llms?|materials\s+language\s+models?|computational\s+chemistry|utterance-level\s+sentiment|sentiment\s+classification\s+in\s+scripted\s+dialogues|scripted\s+dialogues|audio-driven\s+streaming\s+avatar|streaming\s+avatar|video\s+generation\s+with\s+code2video|shared\s+visual\s+space|water\s+governance|climate\s+resilience|crop\s+yield|dental\s+radiograph|hiring\s+announcement|we['’]?re\s+hiring)\b/i;

// Unambiguous core superintelligence anchors that override narrow-domain ambiguity.
export const CORE_SI_ANCHOR_RE =
  /\b(?:superintelligen\w*|artificial\s+general\s+intelligence|agi\s+timelines?|human-level\s+ai|intelligence\s+explosion|recursive\s+self-improvement|deceptive\s+alignment|alignment\s+faking|scalable\s+oversight|superalignment|mesa-optimiz\w*|existential\s+risks?|x-risk|loss\s+of\s+control|frontier\s+ai\s+(?:regulation|safety|governance)|compute\s+governance|transformative\s+ai)\b/i;
