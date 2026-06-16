/**
 * Writing Effective Learning Objectives
 * main.js — Course logic, interactivity, and state management
 *
 * Architecture:
 *  - CourseState: single source of truth for slide position and scores
 *  - SlideManager: handles transitions and progress rendering
 *  - ActivityManager: activity-specific logic (spot-the-weak, verb selection, rewrite)
 *  - KnowledgeCheck: final quiz logic
 *  - init(): wires everything together on DOMContentLoaded
 */

'use strict';

/* ============================================================
   COURSE CONFIGURATION
============================================================ */

const TOTAL_SLIDES = 12;

/** Milestone labels shown in the progress track tooltip */
const MILESTONE_LABELS = [
  'Intro',
  'What Is Effective?',
  'Bloom\'s Taxonomy',
  'Examples',
  'Activity 1',
  'Activity 2',
  'Prep: Rewrite',
  'Rewrite Activity',
  'Check 1',
  'Check 2',
  'Check 3',
  'Complete',
];

/** Slides that require an activity to be completed before advancing */
const GATED_SLIDES = new Set([5, 6, 8, 9, 10, 11]);

/* ============================================================
   COURSE STATE
============================================================ */

const CourseState = {
  currentSlide: 1,

  /** Which activity stages have been completed */
  completed: {
    q1: false,   // Activity 1, question 1
    q2: false,   // Activity 1, question 2
    vq1: false,  // Activity 2, verb question 1
    vq2: false,  // Activity 2, verb question 2
    vq3: false,  // Activity 2, verb question 3
    rw1: false,  // Rewrite 1
    rw2: false,  // Rewrite 2
    kc1: false,  // Knowledge check 1
    kc2: false,  // Knowledge check 2
    kc3: false,  // Knowledge check 3
  },

  /** Knowledge check results for scoring */
  kcResults: {
    kc1: null,
    kc2: null,
    kc3: null,
  },

  /** Track which activity sub-stage we're on */
  activity1Stage: 1,   // 1 or 2
  activity2Stage: 1,   // 1, 2, or 3

  /** Whether slides 5/6/8 can be advanced past */
  canAdvance(slideNum) {
    switch (slideNum) {
      case 5:  return this.completed.q1 && this.completed.q2;
      case 6:  return this.completed.vq1 && this.completed.vq2 && this.completed.vq3;
      case 8:  return this.completed.rw1 && this.completed.rw2;
      case 9:  return this.completed.kc1;
      case 10: return this.completed.kc2;
      case 11: return this.completed.kc3;
      default: return true;
    }
  },

  /** Count how many knowledge check questions were answered correctly */
  getKCScore() {
    return Object.values(this.kcResults).filter(r => r === true).length;
  },
};

/* ============================================================
   SLIDE MANAGER
============================================================ */

const SlideManager = {
  slides: null,
  progressFill: null,
  milestones: null,
  navDots: null,
  slideCounter: null,
  prevBtn: null,
  nextBtn: null,

  init() {
    this.slides = document.querySelectorAll('.slide');
    this.progressFill = document.getElementById('progressFill');
    this.milestones = document.getElementById('milestones');
    this.navDots = document.getElementById('navDots');
    this.slideCounter = document.getElementById('slideCounter');
    this.prevBtn = document.getElementById('prevBtn');
    this.nextBtn = document.getElementById('nextBtn');

    this.buildMilestones();
    this.buildNavDots();
    this.updateUI();
  },

  /**
   * Build milestone nodes in the progress track
   */
  buildMilestones() {
    this.milestones.innerHTML = '';
    for (let i = 1; i <= TOTAL_SLIDES; i++) {
      const node = document.createElement('div');
      node.className = 'milestone-node';
      node.setAttribute('role', 'listitem');

      const tooltip = document.createElement('span');
      tooltip.className = 'milestone-tooltip';
      tooltip.textContent = MILESTONE_LABELS[i - 1];
      node.appendChild(tooltip);

      this.milestones.appendChild(node);
    }
  },

  /**
   * Build navigation dots in the footer
   */
  buildNavDots() {
    this.navDots.innerHTML = '';
    for (let i = 1; i <= TOTAL_SLIDES; i++) {
      const dot = document.createElement('div');
      dot.className = 'nav-dot';
      dot.setAttribute('aria-hidden', 'true');
      this.navDots.appendChild(dot);
    }
  },

  /**
   * Go to a specific slide index (1-based)
   * @param {number} targetSlide
   * @param {string} direction - 'forward' | 'backward'
   */
  goTo(targetSlide, direction = 'forward') {
    if (targetSlide < 1 || targetSlide > TOTAL_SLIDES) return;

    const fromSlide = CourseState.currentSlide;
    CourseState.currentSlide = targetSlide;

    // Animate out the current slide
    const fromEl = document.querySelector(`.slide[data-slide="${fromSlide}"]`);
    if (fromEl) {
      fromEl.classList.remove('active');
      fromEl.classList.add(direction === 'forward' ? 'exit-left' : 'exit-right');
      setTimeout(() => fromEl.classList.remove('exit-left', 'exit-right'), 450);
    }

    // Animate in the target slide
    const toEl = document.querySelector(`.slide[data-slide="${targetSlide}"]`);
    if (toEl) {
      // Scroll to top when entering a slide
      toEl.scrollTop = 0;
      toEl.classList.add('active');
    }

    this.updateUI();

    // If we just landed on the completion slide, populate the score
    if (targetSlide === TOTAL_SLIDES) {
      this.renderCompletion();
    }
  },

  /**
   * Update all dynamic UI elements (progress, buttons, dots, counter)
   */
  updateUI() {
    const current = CourseState.currentSlide;

    // Slide counter
    this.slideCounter.textContent = `${current} / ${TOTAL_SLIDES}`;

    // Progress fill width
    const pct = ((current - 1) / (TOTAL_SLIDES - 1)) * 100;
    this.progressFill.style.width = `${pct}%`;

    // Milestone nodes
    const nodes = this.milestones.querySelectorAll('.milestone-node');
    nodes.forEach((node, i) => {
      const slideNum = i + 1;
      node.classList.remove('completed', 'current');
      if (slideNum < current) {
        node.classList.add('completed');
      } else if (slideNum === current) {
        node.classList.add('current');
      }
    });

    // Nav dots
    const dots = this.navDots.querySelectorAll('.nav-dot');
    dots.forEach((dot, i) => {
      const slideNum = i + 1;
      dot.classList.remove('active', 'completed');
      if (slideNum === current) {
        dot.classList.add('active');
      } else if (slideNum < current) {
        dot.classList.add('completed');
      }
    });

    // Prev / Next buttons
    this.prevBtn.disabled = current === 1;
    this.nextBtn.disabled = GATED_SLIDES.has(current) && !CourseState.canAdvance(current);

    // On the last slide, hide Next
    if (current === TOTAL_SLIDES) {
      this.nextBtn.style.visibility = 'hidden';
    } else {
      this.nextBtn.style.visibility = 'visible';
    }
  },

  /**
   * Render the completion screen with score
   */
  renderCompletion() {
    const score = CourseState.getKCScore();
    const scoreEl = document.getElementById('scoreDisplay');
    if (scoreEl) {
      const messages = [
        'Keep reviewing — you can always come back.',
        'Good start — review Bloom\'s and try again.',
        'Solid work — you\'ve got the core concepts.',
        'Perfect score! You\'re ready to write objectives.',
      ];
      scoreEl.innerHTML = `
        <strong>${score}/3 on the knowledge check</strong>
        ${messages[score]}
      `;
    }
  },
};

/* ============================================================
   ACTIVITY MANAGER — Activity 1: Spot the Weak Objective
============================================================ */

const Activity1 = {
  init() {
    // Wire up all choice buttons in the activity
    document.querySelectorAll('[data-question]').forEach(btn => {
      btn.addEventListener('click', (e) => this.handleChoice(e.currentTarget));
    });
  },

  handleChoice(btn) {
    const questionId = btn.dataset.question;       // 'q1' or 'q2'
    const isCorrect = btn.dataset.correct === 'true';
    const feedbackEl = document.getElementById(`${questionId}-feedback`);
    const container = btn.closest('[role="radiogroup"]');

    // Disable all buttons in this group
    container.querySelectorAll('.choice-btn').forEach(b => {
      b.disabled = true;
      if (b.dataset.correct === 'true') b.classList.add('correct');
    });

    if (!isCorrect) {
      btn.classList.add('incorrect');
    }

    // Show feedback
    if (isCorrect) {
      feedbackEl.className = 'feedback-box correct-fb show';
      feedbackEl.innerHTML = this.getCorrectFeedback(questionId, btn.textContent.trim());
    } else {
      feedbackEl.className = 'feedback-box incorrect-fb show';
      feedbackEl.innerHTML = this.getIncorrectFeedback(questionId);
    }

    // Mark this question as complete
    CourseState.completed[questionId] = true;

    // Advance to next sub-question or unlock the Next button
    if (questionId === 'q1' && CourseState.activity1Stage === 1) {
      setTimeout(() => {
        CourseState.activity1Stage = 2;
        document.getElementById('q1-block').style.display = 'none';
        document.getElementById('q2-block').style.display = '';
      }, 1800);
    } else if (questionId === 'q2') {
      // Both done — unlock Next
      setTimeout(() => SlideManager.updateUI(), 1800);
    }
  },

  getCorrectFeedback(qId, text) {
    return `✓ That's right. <strong>${text.slice(0, 50)}…</strong> uses the verb "appreciate" (q1) or "understand" (q2) — both are cognitive states, not observable behaviors. You can't watch someone "appreciate" something in a measurable way.`;
  },

  getIncorrectFeedback(qId) {
    return `Not quite. Look for the objective that uses a verb describing an internal state — something you can't directly observe or measure. Verbs like "calculate," "demonstrate," and "compare" all produce evidence you can assess.`;
  },
};

/* ============================================================
   ACTIVITY MANAGER — Activity 2: Pick the Right Bloom's Verb
============================================================ */

const Activity2 = {
  stages: ['vq1', 'vq2', 'vq3'],

  init() {
    document.querySelectorAll('[data-vq]').forEach(btn => {
      btn.addEventListener('click', (e) => this.handleVerb(e.currentTarget));
    });
  },

  handleVerb(btn) {
    const vqId = btn.dataset.vq;
    const isCorrect = btn.dataset.correct === 'true';
    const feedbackEl = document.getElementById(`${vqId}-feedback`);
    const container = btn.closest('[role="radiogroup"]');

    // Disable buttons
    container.querySelectorAll('.verb-btn').forEach(b => {
      b.disabled = true;
      if (b.dataset.correct === 'true') b.classList.add('correct');
    });

    if (!isCorrect) btn.classList.add('incorrect');

    // Feedback
    if (isCorrect) {
      feedbackEl.className = 'feedback-box correct-fb show';
      feedbackEl.textContent = this.getCorrectFeedback(vqId);
    } else {
      feedbackEl.className = 'feedback-box incorrect-fb show';
      feedbackEl.textContent = this.getIncorrectFeedback(vqId);
    }

    CourseState.completed[vqId] = true;

    // Advance to next verb question
    const stageIdx = this.stages.indexOf(vqId);
    const nextId = this.stages[stageIdx + 1];

    if (nextId) {
      setTimeout(() => {
        document.getElementById(vqId).style.display = 'none';
        const nextEl = document.getElementById(nextId);
        nextEl.style.display = '';
        nextEl.classList.add('active-q');
      }, 1800);
    } else {
      // All three done
      setTimeout(() => SlideManager.updateUI(), 1800);
    }
  },

  getCorrectFeedback(vqId) {
    const msgs = {
      vq1: '"Distinguish" is an Analyze-level verb — perfect for asking learners to identify differences or spot something in context. "Recall" and "Know" are far too low (Remember-level) for this task, and "Understand" is too vague to be measurable.',
      vq2: '"Demonstrate" is an Apply-level verb — it signals that the learner should perform a process, not just describe it. "Define" is Remember-level, and "Appreciate" and "Be aware of" are not Bloom\'s verbs at all.',
      vq3: '"Justify" is Evaluate-level, which matches the task of weighing evidence and making a judgment call. "List" and "Describe" are much lower on the taxonomy, and "Apply" means executing a skill, not evaluating competing options.',
    };
    return msgs[vqId];
  },

  getIncorrectFeedback(vqId) {
    const msgs = {
      vq1: 'Not quite. "Recall" and "Know" are Remember-level — too low for recognizing something in context. "Understand" isn\'t measurable. The right answer is "Distinguish," which lives at Analyze (Level 4).',
      vq2: 'Not quite. The scenario calls for performing a skill, which points to Apply (Level 3). "Define" is Remember-level. "Appreciate" and "Be aware of" aren\'t Bloom\'s verbs. The answer is "Demonstrate."',
      vq3: 'Not quite. "List" and "Describe" are low-level verbs. "Apply" means executing a skill. This scenario is about making a judgment call — that\'s Evaluate (Level 5), and "Justify" is the right verb.',
    };
    return msgs[vqId];
  },
};

/* ============================================================
   ACTIVITY MANAGER — Activity 3: Rewrite Objectives
============================================================ */

const RewriteActivity = {
  /** Minimum character count before we'll evaluate a rewrite */
  MIN_LENGTH: 20,

  /** Sample strong rewrites to show after submission */
  EXAMPLES: {
    rw1: 'Example strong rewrites: "Complete the five-step onboarding checklist independently within the first week." Or: "Describe the three phases of the onboarding process in your own words."',
    rw2: 'Example strong rewrites: "Demonstrate the SBI (Situation–Behavior–Impact) feedback model in a mock peer review scenario." Or: "Apply three feedback best practices when responding to a case study conversation."',
  },

  /**
   * Basic heuristic to check whether a rewrite looks measurable.
   * Checks for the presence of a Bloom's action verb.
   */
  BLOOM_VERBS: new Set([
    'list','recall','name','identify','define','state','recognize','label','match','reproduce',
    'explain','describe','summarize','classify','paraphrase','interpret','discuss','report','review','restate',
    'use','demonstrate','execute','implement','calculate','solve','apply','practice','illustrate','operate',
    'compare','differentiate','examine','distinguish','analyze','contrast','separate','test','question','experiment',
    'assess','justify','critique','defend','judge','evaluate','argue','support','recommend','select','appraise',
    'design','develop','construct','produce','formulate','create','build','compose','plan','generate','invent','assemble',
  ]),

  init() {
    document.getElementById('rw1-submit').addEventListener('click', () => this.evaluate('rw1'));
    document.getElementById('rw2-submit').addEventListener('click', () => this.evaluate('rw2'));
  },

  evaluate(rwId) {
    const input = document.getElementById(`${rwId}-input`);
    const feedbackEl = document.getElementById(`${rwId}-feedback`);
    const text = input.value.trim();

    // Too short
    if (text.length < this.MIN_LENGTH) {
      feedbackEl.className = 'feedback-box incorrect-fb show';
      feedbackEl.textContent = 'Your rewrite looks a bit short. Try adding more detail — what should the learner be able to do, and in what context?';
      return;
    }

    // Check for a measurable verb
    const words = text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
    const hasBloomsVerb = words.some(w => this.BLOOM_VERBS.has(w));

    // Check they're not just copying the weak objective
    const weakObjectives = {
      rw1: 'learn about the company',
      rw2: 'be aware of best practices',
    };
    const isCopy = text.toLowerCase().includes(weakObjectives[rwId]);

    if (isCopy) {
      feedbackEl.className = 'feedback-box incorrect-fb show';
      feedbackEl.textContent = 'It looks like you may have kept the original wording. Try replacing the verb with something measurable, like "describe," "demonstrate," or "complete."';
      return;
    }

    if (hasBloomsVerb) {
      feedbackEl.className = 'feedback-box correct-fb show';
      feedbackEl.innerHTML = `
        ✓ Nice work — your rewrite uses a measurable verb. 
        <br><br>
        <em>${this.EXAMPLES[rwId]}</em>
      `;
      this.markComplete(rwId, input);
    } else {
      feedbackEl.className = 'feedback-box info-fb show';
      feedbackEl.innerHTML = `
        You've written something, but check your verb. Verbs like "understand," "know," or "learn" are hard to measure. 
        Try starting with something like: <strong>Describe, Demonstrate, Identify, Apply, Compare,</strong> or <strong>Complete.</strong>
        <br><br>
        <em>${this.EXAMPLES[rwId]}</em>
      `;
    }
  },

  markComplete(rwId, inputEl) {
    CourseState.completed[rwId] = true;
    inputEl.disabled = true;
    document.getElementById(`${rwId}-submit`).disabled = true;
    document.getElementById(`${rwId}-submit`).textContent = '✓ Submitted';

    // If rw1 just completed, show rw2 after a beat
    if (rwId === 'rw1' && !CourseState.completed.rw2) {
      setTimeout(() => {
        document.getElementById('rw1-block').style.display = 'none';
        document.getElementById('rw2-block').style.display = '';
      }, 1600);
    }

    // If both are done, unlock Next
    if (CourseState.completed.rw1 && CourseState.completed.rw2) {
      setTimeout(() => SlideManager.updateUI(), 400);
    }
  },
};

/* ============================================================
   KNOWLEDGE CHECK
============================================================ */

const KnowledgeCheck = {
  init() {
    document.querySelectorAll('[data-kc]').forEach(btn => {
      btn.addEventListener('click', (e) => this.handleAnswer(e.currentTarget));
    });
  },

  handleAnswer(btn) {
    const kcId = btn.dataset.kc;
    const isCorrect = btn.dataset.correct === 'true';
    const feedbackEl = document.getElementById(`${kcId}-feedback`);
    const container = btn.closest('[role="radiogroup"]');

    // Disable all answers and reveal correct one
    container.querySelectorAll('.choice-btn').forEach(b => {
      b.disabled = true;
      if (b.dataset.correct === 'true') b.classList.add('correct');
    });

    if (!isCorrect) btn.classList.add('incorrect');

    // Record result
    CourseState.kcResults[kcId] = isCorrect;
    CourseState.completed[kcId] = true;

    // Feedback
    if (isCorrect) {
      feedbackEl.className = 'feedback-box correct-fb show';
      feedbackEl.textContent = this.getCorrectFeedback(kcId);
    } else {
      feedbackEl.className = 'feedback-box incorrect-fb show';
      feedbackEl.textContent = this.getIncorrectFeedback(kcId);
    }

    // Unlock Next after a moment
    setTimeout(() => SlideManager.updateUI(), 1200);
  },

  getCorrectFeedback(kcId) {
    const msgs = {
      kc1: 'Correct. An effective objective must describe something you can see, hear, or assess directly. Length, formal language, and Bloom\'s level labels are all secondary to that core requirement.',
      kc2: 'Correct. Building something from scratch — a full project schedule — is a Create-level task (Level 6). If the objective were to explain how the software works, that\'d be Understand. If it were to use an existing template, that\'d be Apply.',
      kc3: 'Correct. "Gain familiarity" can\'t be observed or assessed — it\'s an internal state. The fix is straightforward: replace it with a specific, observable verb. "Complete the performance review for one direct report" is a much stronger version.',
    };
    return msgs[kcId];
  },

  getIncorrectFeedback(kcId) {
    const msgs = {
      kc1: 'Not quite. The correct answer is that an effective objective describes an observable and measurable behavior. Without that, there\'s no way to assess whether learning occurred — regardless of length or level labels.',
      kc2: 'Not quite. Think about what "build from scratch" implies. It\'s not recalling, explaining, or applying an existing process — it\'s producing something new. That\'s Bloom\'s Level 6: Create.',
      kc3: 'Not quite. The primary issue is the verb "gain familiarity" — it\'s unobservable and can\'t be assessed. The other answer choices describe issues that aren\'t actually problems with the objective.',
    };
    return msgs[kcId];
  },
};

/* ============================================================
   NAVIGATION WIRING
============================================================ */

function initNavigation() {
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const restartBtn = document.getElementById('restartBtn');

  prevBtn.addEventListener('click', () => {
    if (CourseState.currentSlide > 1) {
      SlideManager.goTo(CourseState.currentSlide - 1, 'backward');
    }
  });

  nextBtn.addEventListener('click', () => {
    const current = CourseState.currentSlide;
    if (current < TOTAL_SLIDES && CourseState.canAdvance(current)) {
      SlideManager.goTo(current + 1, 'forward');
    }
  });

  restartBtn.addEventListener('click', () => {
    // Reset state
    CourseState.currentSlide = 1;
    Object.keys(CourseState.completed).forEach(k => (CourseState.completed[k] = false));
    Object.keys(CourseState.kcResults).forEach(k => (CourseState.kcResults[k] = null));
    CourseState.activity1Stage = 1;
    CourseState.activity2Stage = 1;

    // Reset activity UI
    resetActivities();

    // Go back to slide 1
    // Remove 'active' from current slide
    document.querySelectorAll('.slide.active').forEach(s => s.classList.remove('active'));
    const firstSlide = document.querySelector('.slide[data-slide="1"]');
    if (firstSlide) {
      firstSlide.scrollTop = 0;
      firstSlide.classList.add('active');
    }
    CourseState.currentSlide = 1;
    SlideManager.updateUI();
  });

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      if (!nextBtn.disabled) nextBtn.click();
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      if (!prevBtn.disabled) prevBtn.click();
    }
  });
}

/* ============================================================
   RESET UTILITY — restores all activity UI to initial state
============================================================ */

function resetActivities() {
  // Activity 1
  document.querySelectorAll('[data-question]').forEach(btn => {
    btn.disabled = false;
    btn.classList.remove('correct', 'incorrect');
  });
  document.querySelectorAll('[data-vq]').forEach(btn => {
    btn.disabled = false;
    btn.classList.remove('correct', 'incorrect');
  });
  document.querySelectorAll('.feedback-box').forEach(el => {
    el.className = 'feedback-box';
    el.textContent = '';
  });

  // Rewrite feedback
  document.querySelectorAll('.rewrite-feedback').forEach(el => {
    el.className = 'feedback-box rewrite-feedback';
    el.textContent = '';
  });

  // Restore activity 1 questions
  document.getElementById('q1-block').style.display = '';
  document.getElementById('q2-block').style.display = 'none';

  // Restore activity 2 verb questions
  document.getElementById('vq1').style.display = '';
  document.getElementById('vq1').classList.add('active-q');
  document.getElementById('vq2').style.display = 'none';
  document.getElementById('vq3').style.display = 'none';

  // Restore rewrite blocks
  document.getElementById('rw1-block').style.display = '';
  document.getElementById('rw2-block').style.display = 'none';
  ['rw1-input', 'rw2-input'].forEach(id => {
    const el = document.getElementById(id);
    el.value = '';
    el.disabled = false;
  });
  ['rw1-submit', 'rw2-submit'].forEach(id => {
    const el = document.getElementById(id);
    el.disabled = false;
    el.textContent = 'Check My Rewrite';
  });

  // KC buttons
  document.querySelectorAll('[data-kc]').forEach(btn => {
    btn.disabled = false;
    btn.classList.remove('correct', 'incorrect');
  });

  // Score display
  const scoreEl = document.getElementById('scoreDisplay');
  if (scoreEl) scoreEl.innerHTML = '';
}

/* ============================================================
   INIT
============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  SlideManager.init();
  Activity1.init();
  Activity2.init();
  RewriteActivity.init();
  KnowledgeCheck.init();
  initNavigation();

  // Update Next button state on load
  SlideManager.updateUI();
});
