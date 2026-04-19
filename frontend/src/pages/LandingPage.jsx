import { useState } from "react";
import { Link } from "react-router-dom";
import Header from "../components/Header";
import {
  Palette,
  Camera,
  Image,
  Bot,
  GitCompare,
  Users,
  ScrollText,
  Lock,
  Globe,
  Zap,
  ClipboardList,
  RefreshCw,
  Rocket,
  Check,
  Heart,
  Sparkles,
} from "lucide-react";

// ─── Data ────────────────────────────────────────────────────────────────────

const NAV_LINKS = ["Product", "Solutions", "Open Source", "Pricing"];

const FEATURES = [
  {
    Icon: Bot,
    title: "AI Analysis",
    desc: "Automatically detect what changed between versions with our built-in AI engine. Get plain-English summaries of every visual update, instantly.",
  },
  {
    Icon: GitCompare,
    title: "Visual Diff",
    desc: "Side-by-side and overlay comparison of any two versions. Pixel-level precision so nothing slips through the cracks on your next review.",
  },
  {
    Icon: Users,
    title: "Team Collaboration",
    desc: "Invite teammates, assign reviewers, and leave inline comments — all the collaboration features your design team actually needs to ship.",
  },
  {
    Icon: ScrollText,
    title: "Version History",
    desc: "Every upload is a commit. Browse the full timeline of your project and restore any previous version with a single click.",
  },
  {
    Icon: Lock,
    title: "Access Control",
    desc: "Granular per-project permissions. Keep sensitive brand assets private while sharing public work with the rest of the world.",
  },
  {
    Icon: Zap,
    title: "Fast & Reliable",
    desc: "99.9% uptime SLA, global CDN delivery, and instant diffs even for high-resolution files up to 100 MB.",
  },
];

const DIFF_BULLETS = [
  "Side-by-side image comparison",
  "AI-generated change descriptions",
  "Pixel-level difference detection",
  "One-click rollback to any version",
];

const STATS = [
  { value: "70%", label: "Faster visual review cycles" },
  { value: "100K+", label: "Commits tracked" },
  { value: "50K+", label: "Media files versioned" },
  { value: "99.9%", label: "Uptime reliability" },
];

const COLLAB_PROJECTS = [
  { name: "Brand Identity v2", commits: 12, Icon: Lock },
  { name: "Mobile App Icons", commits: 8, Icon: Globe },
  { name: "Marketing Assets", commits: 24, Icon: Lock },
];

const COLLAB_FEATURES = [
  {
    Icon: ClipboardList,
    title: "Plan with clarity",
    desc: "Organise every project, track milestones, and keep your creative pipeline moving without switching tools.",
  },
  {
    Icon: RefreshCw,
    title: "Keep track of your team",
    desc: "See who changed what and when. Activity feeds and audit logs give managers complete visibility across every asset.",
  },
  {
    Icon: Rocket,
    title: "Ship faster",
    desc: "Automated review assignments, one-click approvals, and direct developer handoff shave days off every release cycle.",
  },
];

const PRICING = [
  {
    name: "Free",
    price: "$0",
    period: "/month",
    highlight: false,
    badge: null,
    features: [
      "5 projects",
      "Unlimited commits",
      "Visual diff",
      "AI analysis (limited)",
    ],
    cta: "Start for free",
    ctaTo: "/signup",
    ctaClass:
      "border border-[#30363d] text-white hover:border-[#8b949e] transition-colors",
  },
  {
    name: "Team",
    price: "$12",
    period: "/user/month",
    highlight: true,
    badge: "Most Popular",
    features: [
      "Unlimited projects",
      "Unlimited commits",
      "Unlimited AI analysis",
      "Team collaboration",
      "Priority support",
    ],
    cta: "Try Team free",
    ctaTo: "/signup",
    ctaClass:
      "bg-[#58a6ff] text-[#0d1117] font-semibold hover:bg-[#79beff] transition-colors",
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    highlight: false,
    badge: null,
    features: [
      "Everything in Team",
      "SSO",
      "Advanced security",
      "Dedicated support",
      "Custom storage",
    ],
    cta: "Contact sales",
    ctaTo: "/signup",
    ctaClass:
      "border border-[#30363d] text-white hover:border-[#8b949e] transition-colors",
  },
];

const FOOTER_COLS = [
  {
    heading: "Product",
    links: ["Features", "Visual Diff", "AI Analysis", "Pricing"],
  },
  {
    heading: "Resources",
    links: ["Documentation", "API Reference", "Changelog", "Status"],
  },
  {
    heading: "Company",
    links: ["About", "Blog", "Careers", "Contact"],
  },
  {
    heading: "Legal",
    links: ["Privacy", "Terms", "Security", "Cookies"],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [email, setEmail] = useState("");

  return (
    <div className="bg-[#0d1117] text-white min-h-screen">
      {/* ══════════════════════════════════════════════════════════════════════
          1. FIXED NAVBAR
      ══════════════════════════════════════════════════════════════════════ */}
      <Header />

      {/* ══════════════════════════════════════════════════════════════════════
          2. HERO SECTION
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="pt-12 pb-32 relative overflow-hidden text-center">
        {/* Background gradient blobs */}
        <div
          className="absolute top-10 left-1/4 w-[600px] h-[600px] bg-purple-600 rounded-full blur-[120px] opacity-20 pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute top-20 right-1/4 w-[500px] h-[500px] bg-blue-500 rounded-full blur-[120px] opacity-20 pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-indigo-700 rounded-full blur-[120px] opacity-30 pointer-events-none"
          aria-hidden="true"
        />

        {/* Floating icons */}
        <div
          className="absolute left-[8%] top-36 animate-bounce pointer-events-none"
          style={{ animationDuration: "3s", animationDelay: "0s" }}
          aria-hidden="true"
        >
          <div className="w-14 h-14 bg-[#58a6ff]/10 border border-[#58a6ff]/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
            <Palette className="w-7 h-7 text-[#58a6ff]" />
          </div>
        </div>
        <div
          className="absolute right-[10%] top-44 animate-bounce pointer-events-none"
          style={{ animationDuration: "2.5s", animationDelay: "0.4s" }}
          aria-hidden="true"
        >
          <div className="w-12 h-12 bg-purple-500/10 border border-purple-500/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
            <Camera className="w-6 h-6 text-purple-400" />
          </div>
        </div>
        <div
          className="absolute left-[14%] bottom-28 animate-bounce pointer-events-none"
          style={{ animationDuration: "3.5s", animationDelay: "0.8s" }}
          aria-hidden="true"
        >
          <div className="w-12 h-12 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
            <Image className="w-6 h-6 text-green-400" />
          </div>
        </div>

        {/* Content */}
        <div className="relative max-w-4xl mx-auto px-4">
          <h1 className="text-6xl md:text-7xl font-bold leading-tight mb-6 tracking-tight">
            The future of
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#58a6ff] to-[#a78bfa]">
              managing media
            </span>
            <br />
            happens together
          </h1>

          <p className="text-lg text-[#8b949e] max-w-2xl mx-auto mb-10 leading-relaxed">
            MediaGit provides AI-powered visual diff tools, version control for
            your design assets, and seamless team collaboration — all in one
            place.
          </p>

          {/* Email + CTA row */}
          <div className="flex flex-col sm:flex-row items-stretch gap-3 max-w-xl mx-auto mb-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your username or email"
              className="flex-1 bg-[#161b22] border border-[#30363d] text-white placeholder-[#8b949e] rounded-md px-4 py-2.5 text-sm focus:outline-none focus:border-[#58a6ff] transition-colors"
            />
            <Link
              to="/signup"
              className="shrink-0 bg-[#238636] hover:bg-[#2ea043] text-white text-sm font-medium px-5 py-2.5 rounded-md transition-colors no-underline text-center"
            >
              Sign up for free →
            </Link>
          </div>

          {/* Sub-link */}
          <p className="text-sm text-[#8b949e]">
            Already use MediaGit?{" "}
            <Link
              to="/login"
              className="text-[#58a6ff] hover:underline no-underline"
            >
              Sign in →
            </Link>
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          3. TRUSTED BAR
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="border-y border-[#30363d] py-8">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <p className="text-xs text-[#8b949e] uppercase tracking-widest mb-6">
            Trusted by design teams worldwide
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12">
            {[
              "Figma Teams",
              "Adobe",
              "Canva Pro",
              "Sketch",
              "InVision",
              "Zeplin",
            ].map((brand) => (
              <span
                key={brand}
                className="text-[#8b949e] opacity-60 text-sm font-semibold tracking-wide"
              >
                {brand}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          4. FEATURES SECTION
      ══════════════════════════════════════════════════════════════════════ */}
      <section id="features" className="py-24">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">
              Accelerate your entire workflow
            </h2>
            <p className="text-[#8b949e] max-w-xl mx-auto leading-relaxed">
              From your first upload to final delivery, MediaGit provides
              AI-powered tools to track every visual change.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 hover:border-[#58a6ff]/50 transition-colors"
              >
                <f.Icon className="w-8 h-8 text-[#58a6ff] mb-3" />
                <h3 className="font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-[#8b949e] leading-relaxed">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          5. VISUAL DIFF HIGHLIGHT
      ══════════════════════════════════════════════════════════════════════ */}
      <section id="diff" className="py-20">
        <div className="max-w-6xl mx-auto px-4 grid md:grid-cols-2 gap-16 items-center">
          {/* Left — copy */}
          <div>
            <p className="text-xs font-semibold text-[#58a6ff] uppercase tracking-widest mb-3">
              Visual Diff
            </p>
            <h2 className="text-3xl font-bold mb-4 leading-snug">
              Built-in visual comparison where found means fixed
            </h2>
            <p className="text-[#8b949e] mb-6 leading-relaxed">
              MediaGit's AI-powered diff engine automatically highlights every
              change — from a single shifted pixel to a full redesign. Review,
              approve, and rollback without ever leaving the browser.
            </p>
            <ul className="space-y-3 mb-8">
              {DIFF_BULLETS.map((bullet) => (
                <li key={bullet} className="flex items-start gap-3 text-sm">
                  <Check size={14} className="text-[#238636] shrink-0 mt-0.5" />
                  <span className="text-[#c9d1d9]">{bullet}</span>
                </li>
              ))}
            </ul>
            <a href="#" className="text-[#58a6ff] text-sm hover:underline">
              Start exploring visual diffs →
            </a>
          </div>

          {/* Right — App mockup */}
          <div className="relative">
            {/* Glow behind card */}
            <div
              className="absolute inset-0 bg-blue-600 blur-[80px] opacity-10 rounded-xl pointer-events-none"
              aria-hidden="true"
            />
            <div className="relative bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden shadow-2xl">
              {/* Fake browser chrome */}
              <div className="bg-[#21262d] px-4 py-3 flex items-center gap-3 border-b border-[#30363d]">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                  <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                  <div className="w-3 h-3 rounded-full bg-[#28c840]" />
                </div>
                <div className="flex-1 bg-[#0d1117] rounded px-3 py-1 text-xs text-[#8b949e] font-mono truncate">
                  mediagit.app/project/123/diff
                </div>
              </div>

              {/* Mockup content */}
              <div className="p-5">
                <p className="text-xs text-[#8b949e] mb-3 font-medium">
                  Comparing <span className="text-white font-semibold">v3</span>
                  {" → "}
                  <span className="text-[#58a6ff] font-semibold">v4</span>
                </p>

                {/* Before / After */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {[
                    { label: "Before (v3)", gradient: "from-red-900/20" },
                    { label: "After (v4)", gradient: "from-green-900/20" },
                  ].map((col) => (
                    <div
                      key={col.label}
                      className={`aspect-video bg-gradient-to-br ${col.gradient} to-[#0d1117] border border-[#30363d] rounded-lg flex flex-col items-center justify-center gap-2`}
                    >
                      <Image className="w-8 h-8 text-[#8b949e]" />
                      <span className="text-xs text-[#8b949e]">
                        {col.label}
                      </span>
                    </div>
                  ))}
                </div>

                {/* AI Analysis panel */}
                <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-3">
                  <p className="text-xs font-semibold text-[#58a6ff] mb-1.5 flex items-center gap-1">
                    <Bot size={12} /> AI Analysis
                  </p>
                  <p className="text-xs text-[#8b949e] leading-relaxed">
                    Background colour changed from{" "}
                    <span className="text-white">#1a1a2e</span> to{" "}
                    <span className="text-white">#0d1117</span>. Logo
                    repositioned 12 px right. Button radius increased from 4 px
                    to 8 px.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          6. STATS BAR
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="border-y border-[#30363d] py-20">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 text-center">
            {STATS.map((s) => (
              <div key={s.label}>
                <p className="text-5xl font-bold text-white mb-2">{s.value}</p>
                <p className="text-sm text-[#8b949e]">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          7. COLLABORATION SECTION
      ══════════════════════════════════════════════════════════════════════ */}
      <section id="solutions" className="py-24">
        <div className="max-w-6xl mx-auto px-4">
          {/* Centered header */}
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 bg-[#161b22] border border-[#30363d] rounded-full px-4 py-1.5 text-sm text-[#8b949e] mb-6">
              <Users size={14} /> Team Collaboration
            </span>
            <h2 className="text-4xl font-bold mb-4">
              Work together; achieve more
            </h2>
            <p className="text-[#8b949e] max-w-xl mx-auto leading-relaxed">
              Bring your entire creative team into one workspace. Review
              designs, leave feedback, and ship with confidence — no more lost
              files or version confusion.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left — Dashboard mockup */}
            <div className="relative">
              <div
                className="absolute inset-0 bg-purple-600 blur-[80px] opacity-10 rounded-xl pointer-events-none"
                aria-hidden="true"
              />
              <div className="relative bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden shadow-2xl">
                {/* Fake browser chrome */}
                <div className="bg-[#21262d] px-4 py-3 flex items-center gap-3 border-b border-[#30363d]">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                    <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                    <div className="w-3 h-3 rounded-full bg-[#28c840]" />
                  </div>
                  <div className="flex-1 bg-[#0d1117] rounded px-3 py-1 text-xs text-[#8b949e] font-mono truncate">
                    mediagit.app/dashboard
                  </div>
                </div>

                {/* Dashboard content */}
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-semibold text-white">
                      Your Projects
                    </p>
                    <button className="text-xs bg-[#238636] hover:bg-[#2ea043] text-white px-3 py-1 rounded-md transition-colors">
                      + New Project
                    </button>
                  </div>
                  <div className="space-y-3">
                    {COLLAB_PROJECTS.map((proj) => (
                      <div
                        key={proj.name}
                        className="bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-3 flex items-center justify-between"
                      >
                        <div>
                          <p className="text-sm text-[#58a6ff] font-medium">
                            {proj.name}
                          </p>
                          <p className="text-xs text-[#8b949e] mt-0.5">
                            {proj.commits} commits
                          </p>
                        </div>
                        <span className="text-lg">
                          <proj.Icon size={14} />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right — Feature list */}
            <div className="space-y-8">
              {COLLAB_FEATURES.map((f) => (
                <div key={f.title} className="flex gap-5">
                  <div className="w-10 h-10 bg-[#58a6ff]/10 rounded-lg flex items-center justify-center shrink-0">
                    <f.Icon className="w-5 h-5 text-[#58a6ff]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-1.5">
                      {f.title}
                    </h3>
                    <p className="text-sm text-[#8b949e] leading-relaxed mb-2">
                      {f.desc}
                    </p>
                    <a
                      href="#"
                      className="text-xs text-[#58a6ff] hover:underline"
                    >
                      Explore →
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          8. PRICING SECTION
      ══════════════════════════════════════════════════════════════════════ */}
      <section id="pricing" className="py-24">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 max-w-2xl mx-auto leading-snug">
              From personal to enterprise, MediaGit scales with any workflow
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {PRICING.map((plan) => (
              <div
                key={plan.name}
                className={`bg-[#161b22] rounded-xl p-6 flex flex-col border ${
                  plan.highlight ? "border-[#58a6ff]" : "border-[#30363d]"
                }`}
              >
                {/* Plan header */}
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold text-white text-lg">
                    {plan.name}
                  </p>
                  {plan.badge && (
                    <span className="text-xs bg-[#388bfd1a] text-[#58a6ff] border border-[#1f6feb] px-2 py-0.5 rounded-full">
                      {plan.badge}
                    </span>
                  )}
                </div>

                {/* Price */}
                <div className="mb-6 mt-1">
                  <span className="text-4xl font-bold text-white">
                    {plan.price}
                  </span>
                  <span className="text-[#8b949e] text-sm">{plan.period}</span>
                </div>

                {/* Features */}
                <ul className="space-y-2.5 mb-8 flex-1">
                  {plan.features.map((feat) => (
                    <li
                      key={feat}
                      className="flex items-start gap-2.5 text-sm text-[#c9d1d9]"
                    >
                      <Check
                        size={14}
                        className="text-[#238636] shrink-0 mt-0.5"
                      />
                      {feat}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Link
                  to={plan.ctaTo}
                  className={`w-full text-center py-2.5 rounded-md text-sm no-underline ${plan.ctaClass}`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          9. FINAL CTA SECTION
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-24 text-center relative overflow-hidden">
        {/* Glow */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-blue-600 blur-[120px] opacity-15 pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[200px] bg-purple-600 blur-[100px] opacity-10 pointer-events-none"
          aria-hidden="true"
        />

        <div className="relative max-w-2xl mx-auto px-4">
          <div className="mb-6 flex justify-center">
            <img
              src="/icon_white.png"
              className="w-16 h-16 object-contain"
              alt="MediaGit"
            />
          </div>
          <h2 className="text-4xl font-bold mb-5 leading-snug">
            Millions of creators and teams call MediaGit home
          </h2>
          <p className="text-[#8b949e] mb-10 leading-relaxed">
            Join the growing community of designers, photographers, and creative
            teams who version-control their work with MediaGit — and ship better
            work, faster.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/signup"
              className="bg-[#238636] hover:bg-[#2ea043] text-white font-medium px-6 py-3 rounded-md transition-colors no-underline"
            >
              Create your free account
            </Link>
            <Link
              to="/login"
              className="border border-[#30363d] hover:border-[#8b949e] text-white px-6 py-3 rounded-md transition-colors no-underline"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          10. FOOTER
      ══════════════════════════════════════════════════════════════════════ */}
      <footer className="border-t border-[#30363d] py-12">
        <div className="max-w-6xl mx-auto px-4">
          {/* Logo */}
          <div className="flex items-center gap-2 mb-10 text-lg font-bold">
            <img
              src="/icon_white.png"
              className="w-7 h-7 object-contain"
              alt="MediaGit"
            />
            <span>
              Media<span className="text-[#58a6ff]">Git</span>
            </span>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-12">
            {FOOTER_COLS.map((col) => (
              <div key={col.heading}>
                <p className="text-sm font-semibold text-white mb-4">
                  {col.heading}
                </p>
                <ul className="space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link}>
                      <a
                        href="#"
                        className="text-sm text-[#8b949e] hover:text-white transition-colors no-underline"
                      >
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Copyright */}
          <div className="border-t border-[#30363d] pt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-xs text-[#8b949e]">
              © 2025 MediaGit, Inc. Built with{" "}
              <Heart size={12} className="inline text-red-400 mx-0.5" /> for
              creative teams.
            </p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#238636]" />
              <span className="text-xs text-[#8b949e]">
                All systems operational
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
