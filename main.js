/**
 * Writing Effective Learning Objectives
 * main.js — Course logic for scroll-based, section-by-section layout
 *
 * Architecture:
 *  - CourseState   single source of truth for current section and completion
 *  - SectionManager  shows/hides sections, updates sidebar, scrolls into view
 *  - Activity1     "Spot the weak objective" (2 sequential questions)
 *  - Activity2     "Pick the right Bloom's verb" (3 sequential verb questions)
 *  - RewriteActivity  open-text rewrite with verb heuristic check
 *  - KnowledgeCheck  3 multiple-choice questions, all on section 9
 *  - initNavigation  wires continue buttons, back buttons, sidebar clicks
 */

'use strict';

/* ============================================================
   CONSTANTS
============================================================ */

const TOTAL_SECTIONS = 10;

// Sections that need an activity completed before the Continue shows
const GATED = new Set([5, 6, 8, 9]);

/* ============================================================
   COURSE STATE
============================================================ */

const CourseState = {
  current: 1,        // 1-based section number
  highest: 1,        // furthest section ever unlocked

  completed: {
    q1: false, q2: false,
    vq1: false, vq2: false, vq3: false,
    rw1: false, rw2: false,
    kc1: false, kc2: false, kc3: false,
  },

  kcResults: { kc1: null, kc2: null, kc3: null },

  // Can we show the Continue / reveal-continue for a gated section?
  gateOpen(section) {
    switch (section) {
      case 5:  return this.completed.q1 && this.completed.q2;
      case 6:  return this.completed.vq1 && this.completed.vq2 && this.completed.vq3;
      case 8:  return this.completed.rw1 && this.completed.rw2;
      case 9:  return this.completed.kc1 && this.completed.kc2 && this.completed.kc3;
      default: return true;
    }
  },

  kcScore() {
    return Object.values(this.kcResults).filter(Boolean).length;
  },
};

/* ============================================================
   SECTION MANAGER
============================================================ */

const SectionManager = {

  init() {
    this.updateSidebar();
    this.updateProgress();
  },

  /**
   * Navigate to a section by number.
   * unlocking = true means we're advancing forward (unlocks the next section).
   */
  goTo(num, scrollBehavior = 'smooth') {
    if (num < 1 || num > TOTAL_SECTIONS) return;

    const target = document.getElementById(`section-${num}`);
    if (!target) return;

    // Unlock section if not already visible
    target.classList.remove('locked');
    target.style.display = '';

    CourseState.current = num;
    if (num > CourseState.highest) CourseState.highest = num;

    // Scroll the section into view
    target.scrollIntoView({ behavior: scrollBehavior, block: 'start' });

    this.updateSidebar();
    this.updateProgress();
    this.updateMobileCounter();
  },

  /** Mark a section complete and go to the next */
  advance(fromSection, toSection) {
    // Mark from-section nav item as completed
    const navItem = document.querySelector(`.nav-item[data-section="${fromSection}"]`);
    if (navItem) navItem.classList.add('completed');

    this.goTo(toSection);
  },

  /** Go back to a previous section (already visible, just scroll) */
  goBack(toSection) {
    CourseState.current = toSection;
    const target = document.getElementById(`section-${toSection}`);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    this.updateSidebar();
    this.updateMobileCounter();
  },

  updateSidebar() {
    const items = document.querySelectorAll('.nav-item');
    items.forEach(item => {
      const n = parseInt(item.dataset.section, 10);
      item.classList.remove('active', 'locked-nav');

      if (n === CourseState.current) {
        item.classList.add('active');
      }

      // Lock nav items beyond the furthest unlocked section
      if (n > CourseState.highest) {
        item.classList.add('locked-nav');
      }
    });
  },

  updateProgress() {
    const fill = document.getElementById('progressFill');
    const label = document.getElementById('progressLabel');
    const pct = Math.round(((CourseState.highest - 1) / (TOTAL_SECTIONS - 1)) * 100);
    if (fill) fill.style.width = `${pct}%`;
    if (label) label.textContent = `${pct}% complete`;
  },

  updateMobileCounter() {
    const el = document.getElementById('mobileCounter');
    if (el) el.textContent = `${CourseState.current}/${TOTAL_SECTIONS}`;
  },

  /** Reveal the continue row for a gated section once the activity is done */
  revealContinue(sectionNum) {
    const row = document.getElementById(`continue-${sectionNum}`);
    if (row) {
      row.style.display = '';
      // Smooth scroll to bring the button into view
      setTimeout(() => row.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
    }
  },

  renderCompletion() {
    const score = CourseState.kcScore();
    const el = document.getElementById('scoreDisplay');
    if (!el) return;
    const msgs = [
      'Keep reviewing — the concepts will click.',
      'Good start. Review Bloom\'s and try again.',
      'Solid work — you\'ve got the core concepts.',
      'Perfect score. You\'re ready to write objectives.',
    ];
    el.innerHTML = `<strong>${score}/3</strong>${msgs[score]}`;
  },
};

/* ============================================================
   ACTIVITY 1 — Spot the Weak Objective
============================================================ */

const Activity1 = {

  init() {
    document.querySelectorAll('[data-question]').forEach(btn => {
      btn.addEventListener('click', () => this.handle(btn));
    });
  },

  handle(btn) {
    const qId = btn.dataset.question;
    const correct = btn.dataset.correct === 'true';
    const group = btn.closest('[role="radiogroup"]');
    const feedback = document.getElementById(`${qId}-feedback`);

    // Disable all in group, highlight correct
    group.querySelectorAll('.choice-btn').forEach(b => {
      b.disabled = true;
      if (b.dataset.correct === 'true') b.classList.add('correct');
    });
    if (!correct) btn.classList.add('incorrect');

    feedback.className = `feedback-box ${correct ? 'correct-fb' : 'incorrect-fb'} show`;
    feedback.textContent = correct ? this.correctMsg(qId) : this.incorrectMsg(qId);

    CourseState.completed[qId] = true;

    if (qId === 'q1') {
      // Show Q2 after a pause
      setTimeout(() => {
        document.getElementById('q1-block').style.display = 'none';
        const q2 = document.getElementById('q2-block');
        q2.style.display = '';
        q2.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 1800);
    } else if (qId === 'q2' && CourseState.gateOpen(5)) {
      setTimeout(() => SectionManager.revealContinue(5), 1800);
    }
  },

  correctMsg(q) {
    return q === 'q1'
      ? '✓ Correct. "Appreciate" describes an internal feeling — you can\'t observe it or design an assessment around it.'
      : '✓ Correct. "Understand" is the classic unmeasurable verb. It names a state, not a behavior you can see or test.';
  },

  incorrectMsg(q) {
    return q === 'q1'
      ? 'Not quite. Look for a verb that describes a mental state rather than an action. "Calculate," "demonstrate," and "compare" all produce observable evidence. One doesn\'t.'
      : 'Not quite. "Classify," "construct," and "identify" are all measurable — learners produce something you can evaluate. One verb in this list describes an internal state with no observable finish line.';
  },
};

/* ============================================================
   ACTIVITY 2 — Pick the Right Bloom's Verb
============================================================ */

const Activity2 = {

  stages: ['vq1', 'vq2', 'vq3'],

  init() {
    document.querySelectorAll('[data-vq]').forEach(btn => {
      btn.addEventListener('click', () => this.handle(btn));
    });
  },

  handle(btn) {
    const vqId = btn.dataset.vq;
    const correct = btn.dataset.correct === 'true';
    const group = btn.closest('[role="radiogroup"]');
    const feedback = document.getElementById(`${vqId}-feedback`);

    group.querySelectorAll('.verb-btn').forEach(b => {
      b.disabled = true;
      if (b.dataset.correct === 'true') b.classList.add('correct');
    });
    if (!correct) btn.classList.add('incorrect');

    feedback.className = `feedback-box ${correct ? 'correct-fb' : 'incorrect-fb'} show`;
    feedback.textContent = correct ? this.correctMsg(vqId) : this.incorrectMsg(vqId);

    CourseState.completed[vqId] = true;

    const idx = this.stages.indexOf(vqId);
    const next = this.stages[idx + 1];

    if (next) {
      setTimeout(() => {
        document.getElementById(vqId).style.display = 'none';
        const nextEl = document.getElementById(next);
        nextEl.style.display = '';
        nextEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 1800);
    } else if (CourseState.gateOpen(6)) {
      setTimeout(() => SectionManager.revealContinue(6), 1800);
    }
  },

  correctMsg(vqId) {
    const m = {
      vq1: '✓ Right. "Distinguish" is an Analyze-level verb — it asks learners to identify differences in context, not just recall a list.',
      vq2: '✓ Right. "Demonstrate" is Apply-level — the learner performs the process, not just describes it.',
      vq3: '✓ Right. "Justify" is Evaluate-level — it requires weighing evidence and defending a position, not just recalling or applying.',
    };
    return m[vqId];
  },

  incorrectMsg(vqId) {
    const m = {
      vq1: '"Recall" and "Know" sit at Remember — far too low for spotting hazards in context. "Understand" isn\'t measurable. The answer is "Distinguish" (Analyze, Level 4).',
      vq2: '"Define" is Remember-level. "Appreciate" and "Be aware of" aren\'t Bloom\'s verbs at all. The answer is "Demonstrate" (Apply, Level 3).',
      vq3: '"List" and "Describe" are low-level. "Apply" means executing a known process. Making a judgment call about competing options is Evaluate — the answer is "Justify" (Level 5).',
    };
    return m[vqId];
  },
};

/* ============================================================
   REWRITE ACTIVITY
============================================================ */

const RewriteActivity = {

  MIN_LEN: 20,

  BLOOM_VERBS: new Set([
    'list','recall','name','identify','define','state','recognize','label','match',
    'explain','describe','summarize','classify','paraphrase','interpret','discuss','report','review',
    'use','demonstrate','execute','implement','calculate','solve','apply','practice','illustrate','operate','show',
    'compare','differentiate','examine','distinguish','analyze','contrast','separate','test','question','break down',
    'assess','justify','critique','defend','judge','evaluate','argue','support','recommend','select','appraise',
    'design','develop','construct','produce','formulate','create','build','compose','plan','generate','invent','assemble',
    'complete','draft','write','present','perform',
  ]),

  WEAK_PHRASES: {
    rw1: ['learn about', 'learn the'],
    rw2: ['be aware of', 'aware of'],
  },

  EXAMPLES: {
    rw1: 'Example rewrites: "Complete the five steps of the onboarding checklist independently within the first week." Or: "Describe the three phases of the onboarding process in your own words."',
    rw2: 'Example rewrites: "Demonstrate the SBI feedback model in a mock peer review scenario." Or: "Apply three feedback best practices when responding to a case study conversation."',
  },

  init() {
    document.getElementById('rw1-submit').addEventListener('click', () => this.evaluate('rw1'));
    document.getElementById('rw2-submit').addEventListener('click', () => this.evaluate('rw2'));
  },

  evaluate(rwId) {
    const input = document.getElementById(`${rwId}-input`);
    const feedback = document.getElementById(`${rwId}-feedback`);
    const text = input.value.trim();

    if (text.length < this.MIN_LEN) {
      feedback.className = 'feedback-box incorrect-fb show';
      feedback.textContent = 'That\'s a bit short. Add more detail — what should the learner be able to do, and in what context?';
      return;
    }

    // Check for kept weak phrasing
    const lower = text.toLowerCase();
    const isCopy = (this.WEAK_PHRASES[rwId] || []).some(p => lower.includes(p));
    if (isCopy) {
      feedback.className = 'feedback-box incorrect-fb show';
      feedback.textContent = 'It looks like you kept the original wording. Try replacing the verb with something measurable, like "describe," "demonstrate," or "complete."';
      return;
    }

    // Check for a Bloom's verb
    const words = lower.replace(/[^a-z\s]/g, '').split(/\s+/);
    const hasVerb = words.some(w => this.BLOOM_VERBS.has(w));

    if (hasVerb) {
      feedback.className = 'feedback-box correct-fb show';
      feedback.innerHTML = `✓ Nice — your rewrite uses a measurable verb.<br><br><em>${this.EXAMPLES[rwId]}</em>`;
      this.markDone(rwId, input);
    } else {
      feedback.className = 'feedback-box info-fb show';
      feedback.innerHTML = `Check your verb. Words like "understand," "know," or "learn" are hard to measure. Try starting with: <strong>Describe, Demonstrate, Identify, Apply, Complete,</strong> or <strong>Compare.</strong><br><br><em>${this.EXAMPLES[rwId]}</em>`;
    }
  },

  markDone(rwId, input) {
    CourseState.completed[rwId] = true;
    input.disabled = true;
    const btn = document.getElementById(`${rwId}-submit`);
    btn.disabled = true;
    btn.textContent = '✓ Submitted';

    if (rwId === 'rw1') {
      setTimeout(() => {
        document.getElementById('rw1-block').style.display = 'none';
        const rw2 = document.getElementById('rw2-block');
        rw2.style.display = '';
        rw2.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 1500);
    }

    if (CourseState.gateOpen(8)) {
      setTimeout(() => SectionManager.revealContinue(8), rwId === 'rw1' ? 3000 : 1500);
    }
  },
};

/* ============================================================
   KNOWLEDGE CHECK
============================================================ */

const KnowledgeCheck = {

  init() {
    document.querySelectorAll('[data-kc]').forEach(btn => {
      btn.addEventListener('click', () => this.handle(btn));
    });
  },

  handle(btn) {
    const kcId = btn.dataset.kc;
    const correct = btn.dataset.correct === 'true';
    const group = btn.closest('[role="radiogroup"]');
    const feedback = document.getElementById(`${kcId}-feedback`);

    group.querySelectorAll('.choice-btn').forEach(b => {
      b.disabled = true;
      if (b.dataset.correct === 'true') b.classList.add('correct');
    });
    if (!correct) btn.classList.add('incorrect');

    feedback.className = `feedback-box ${correct ? 'correct-fb' : 'incorrect-fb'} show`;
    feedback.textContent = correct ? this.correctMsg(kcId) : this.incorrectMsg(kcId);

    CourseState.completed[kcId] = true;
    CourseState.kcResults[kcId] = correct;

    if (CourseState.gateOpen(9)) {
      setTimeout(() => SectionManager.revealContinue(9), 1200);
    }
  },

  correctMsg(id) {
    const m = {
      kc1: 'Correct. An observable, measurable behavior is the non-negotiable. Length, formal language, and Bloom\'s level labels are all secondary.',
      kc2: 'Correct. Building something new from scratch is Bloom\'s Level 6: Create. Explaining it would be Understand; using a template would be Apply.',
      kc3: 'Correct. "Gain familiarity" is unobservable and unassessable. Replacing it with a specific verb — like "complete" or "describe" — fixes it immediately.',
    };
    return m[id];
  },

  incorrectMsg(id) {
    const m = {
      kc1: 'Not quite. The correct answer is that an effective objective must describe an observable, measurable behavior. Without that, you can\'t design a valid assessment.',
      kc2: 'Not quite. "Building from scratch" means producing something new — that\'s Create (Level 6), not Apply or Understand.',
      kc3: 'Not quite. The core problem is the verb. "Gain familiarity" can\'t be observed or assessed — the other issues described aren\'t actually problems with the objective.',
    };
    return m[id];
  },
};

/* ============================================================
   NAVIGATION — Continue buttons, Back buttons, Sidebar
============================================================ */

function initNavigation() {

  // Continue buttons (data-next)
  document.addEventListener('click', e => {
    const btn = e.target.closest('.btn-continue');
    if (!btn) return;
    const next = parseInt(btn.dataset.next, 10);
    const from = next - 1;
    SectionManager.advance(from, next);

    // If going to completion, populate score
    if (next === 10) {
      setTimeout(() => SectionManager.renderCompletion(), 300);
    }
  });

  // Back buttons (data-back)
  document.addEventListener('click', e => {
    const btn = e.target.closest('.back-btn');
    if (!btn || btn.classList.contains('hidden')) return;
    const to = parseInt(btn.dataset.back, 10);
    SectionManager.goBack(to);
  });

  // Sidebar nav items
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      if (item.classList.contains('locked-nav')) return;
      const n = parseInt(item.dataset.section, 10);
      CourseState.current = n;
      SectionManager.goBack(n); // scrolls, doesn't re-unlock
      SectionManager.updateSidebar();

      // Close mobile sidebar if open
      const sidebar = document.getElementById('sidebar');
      const overlay = document.getElementById('sidebarOverlay');
      sidebar.classList.remove('open');
      overlay.classList.remove('visible');
    });
  });

  // Restart button
  const restartBtn = document.getElementById('restartBtn');
  if (restartBtn) {
    restartBtn.addEventListener('click', () => restart());
  }

  // Mobile menu toggle
  const menuToggle = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');

  if (menuToggle) {
    menuToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('visible');
      menuToggle.setAttribute('aria-expanded', sidebar.classList.contains('open'));
    });
  }

  if (overlay) {
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('visible');
    });
  }
}

/* ============================================================
   RESTART
============================================================ */

function restart() {
  // Reset state
  CourseState.current = 1;
  CourseState.highest = 1;
  Object.keys(CourseState.completed).forEach(k => (CourseState.completed[k] = false));
  Object.keys(CourseState.kcResults).forEach(k => (CourseState.kcResults[k] = null));

  // Hide all sections except first
  for (let i = 2; i <= TOTAL_SECTIONS; i++) {
    const s = document.getElementById(`section-${i}`);
    if (s) {
      s.classList.add('locked');
      s.style.display = '';
    }
  }

  // Reset sidebar
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active', 'completed');
    const n = parseInt(item.dataset.section, 10);
    if (n > 1) item.classList.add('locked-nav');
  });

  // Reset activity UI
  resetAllActivities();

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'instant' });
  SectionManager.init();
}

function resetAllActivities() {
  // Choice / verb / kc buttons
  document.querySelectorAll('.choice-btn, .verb-btn').forEach(b => {
    b.disabled = false;
    b.classList.remove('correct', 'incorrect');
  });

  // All feedback boxes
  document.querySelectorAll('.feedback-box').forEach(el => {
    el.className = 'feedback-box';
    el.textContent = '';
  });

  // Activity 1 questions
  document.getElementById('q1-block').style.display = '';
  document.getElementById('q2-block').style.display = 'none';

  // Activity 2 verb questions
  ['vq1','vq2','vq3'].forEach((id, i) => {
    const el = document.getElementById(id);
    el.style.display = i === 0 ? '' : 'none';
  });

  // Rewrite blocks
  document.getElementById('rw1-block').style.display = '';
  document.getElementById('rw2-block').style.display = 'none';
  ['rw1-input', 'rw2-input'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = ''; el.disabled = false; }
  });
  ['rw1-submit', 'rw2-submit'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.disabled = false; el.textContent = 'Check My Rewrite'; }
  });

  // Gated continue rows
  ['continue-5','continue-6','continue-8','continue-9'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  // Score display
  const score = document.getElementById('scoreDisplay');
  if (score) score.innerHTML = '';
}

/* ============================================================
   INIT
============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  // Mark section 1 active in sidebar
  const firstNav = document.querySelector('.nav-item[data-section="1"]');
  if (firstNav) firstNav.classList.add('active');

  SectionManager.init();
  Activity1.init();
  Activity2.init();
  RewriteActivity.init();
  KnowledgeCheck.init();
  initNavigation();
});
