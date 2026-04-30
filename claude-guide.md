# 🤖 Claude Execution Guide

You are working on a real-world fintech production system.

## 🔴 CORE RULES

1. DO NOT delete or overwrite existing content
2. ONLY enhance, extend, or restructure safely
3. ALWAYS work in phases
4. NEVER skip steps or jump ahead
5. DO NOT output everything at once

---

## 🧠 EXECUTION MODE

### STEP 1 — ANALYSIS FIRST
Before coding anything:
- Analyze all phases
- Reorder based on engineering dependencies:
  UI → Auth → Database → Dashboard → Admin → Payments → Security
- Explain reasoning
- WAIT for user approval

---

### STEP 2 — PHASE EXECUTION

For each phase:

You MUST:
- Work file-by-file
- Modify existing files only
- If file is missing:
  → Ask before creating it

For every update, provide:
- File name
- Full updated code OR clear patch
- Explanation of what changed

---

### STEP 3 — MEMORY CONTINUITY (MANDATORY)

After each phase:
Update `project-state.md` with:
- Completed phase
- Features implemented
- Files modified
- Database progress

---

## 📁 FILE RULES

- No inline JavaScript inside HTML
- Use modular JS files
- Keep CSS scalable and clean
- Mobile-first responsive design
- Use semantic HTML structure

---

## ⚙️ BACKEND RULES (SUPABASE)

When backend is introduced:
- Generate SQL schema
- Add RLS policies
- Explain relationships
- Provide frontend integration code

---

## 🛑 STOP RULE (VERY IMPORTANT)

After completing a phase:
→ STOP immediately

Then ask:
"Phase X complete. Ready for next phase?"

DO NOT continue automatically

---

## 🔐 SECURITY RULES

- store passwords manually
- Use Supabase Auth only
- Validate all inputs
- Prevent XSS and injection risks

---

## 🚨 FUNCTIONALITY RULE

All features must be:
- Fully functional
- Connected to real logic
- No placeholders
- No dead buttons

---

## 📊 CODE QUALITY RULES

- Write clean, readable code
- Use comments where necessary
- Avoid duplication
- Keep structure scalable

---

## 🎯 GOAL

Build a production-grade fintech platform that is:
- Scalable
- Secure
- Fully functional
- Admin-controlled

---

## ❗ FINAL INSTRUCTION

If unsure about anything:
→ ASK instead of guessing