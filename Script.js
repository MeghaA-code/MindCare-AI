/* ==========================================================================
   MindCare AI — script.js
   Sections: 1. Config  2. Nav toggle  3. Multi-step form  4. Validation
   5. Submit to FastAPI  6. Result / score ring  7. Retake
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  /* ---------- 0. Safe element getter ---------- */
  // If an id doesn't exist in the HTML, this logs a clear, specific error
  // instead of letting a bare `null.addEventListener(...)` crash the whole
  // script and silently kill every other button on the page.
  function get(id, required = true) {
    const el = document.getElementById(id);
    if (!el && required) {
      console.error(`[script.js] Missing element with id="${id}" — check your HTML.`);
    }
    return el;
  }

  /* ---------- 1. Config ---------- */
  const API_URL = 'https://mindcare-ai-g1ts.onrender.com';
  const SCORE_RING_CIRCUMFERENCE = 439.8; // 2 * PI * r(70), matches style.css

  /* ---------- 2. Mobile nav toggle ---------- */
  const navToggle = get('navToggle');
  const navLinks = get('navLinks');

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', String(isOpen));
    });

    // Close the mobile menu after a link is tapped
    navLinks.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ---------- 3. Multi-step form ---------- */
  const form = get('assessmentForm');
  const steps = Array.from(document.querySelectorAll('.form-step'));
  const stepperItems = Array.from(document.querySelectorAll('.stepper__item'));
  const totalSteps = steps.length;

  const prevBtn = get('prevBtn');
  const nextBtn = get('nextBtn');
  const submitBtn = get('submitBtn');
  const formError = get('formError');

  if (!form) {
    console.error('[script.js] #assessmentForm not found — form logic disabled.');
  }
  if (totalSteps === 0) {
    console.error('[script.js] No elements with class "form-step" found — check your HTML.');
  }

  let currentStep = 1;

  function showStep(step) {
    steps.forEach((section) => {
      section.classList.toggle('is-active', Number(section.dataset.step) === step);
    });
    stepperItems.forEach((item) => {
      const n = Number(item.dataset.step);
      item.classList.toggle('is-active', n === step);
      item.classList.toggle('is-complete', n < step);
    });

    if (prevBtn) prevBtn.hidden = step === 1;
    if (nextBtn) nextBtn.hidden = step === totalSteps;
    if (submitBtn) submitBtn.hidden = step !== totalSteps;

    hideFormError();
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (!validateStep(currentStep)) return;
      if (currentStep < totalSteps) {
        currentStep += 1;
        showStep(currentStep);
      }
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentStep > 1) {
        currentStep -= 1;
        showStep(currentStep);
      }
    });
  }

  /* ---------- 4. Validation ---------- */
  // Field labels used in friendly error messages, keyed by input id
  const FIELD_LABELS = {
    age: 'Age',
    gender: 'Gender',
    country: 'Country',
    academicLevel: 'Academic level',
    platform: 'Most used platform',
    purpose: 'Purpose of use',
    dailyUsage: 'Average daily usage hours',
    dailyUnlocks: 'Daily phone unlocks',
    studyHours: 'Study hours',
    activityHours: 'Physical activity hours',
    sleepHours: 'Sleep hours per night',
  };

  function messageForField(input) {
    const label = FIELD_LABELS[input.id] || 'This field';
    const value = input.value.trim();

    if (input.hasAttribute('required') && value === '') {
      return `${label} is required.`;
    }

    if (input.type === 'number' && value !== '') {
      const num = Number(value);
      const min = input.min !== '' ? Number(input.min) : null;
      const max = input.max !== '' ? Number(input.max) : null;

      if (Number.isNaN(num)) return `Enter a valid number for ${label.toLowerCase()}.`;
      if (min !== null && num < min) return `${label} must be at least ${min}.`;
      if (max !== null && num > max) return `${label} must be at most ${max}.`;
    }

    return '';
  }

  function setFieldError(input, message) {
    const errorEl = document.getElementById(`error-${input.id}`);
    if (errorEl) errorEl.textContent = message;
    input.classList.toggle('is-invalid', Boolean(message));
  }

  function validateStep(step) {
    const stepEl = steps.find((s) => Number(s.dataset.step) === step);
    if (!stepEl) return true; // nothing to validate if step markup is missing

    let isValid = true;
    let firstInvalidField = null;

    // Standard inputs and selects within this step
    const fields = stepEl.querySelectorAll('input:not([type="radio"]), select');
    fields.forEach((field) => {
      const message = messageForField(field);
      setFieldError(field, message);
      if (message && !firstInvalidField) firstInvalidField = field;
      if (message) isValid = false;
    });

    // Stress level radio group (step 4 only)
    if (step === 4) {
      const checked = stepEl.querySelector('input[name="stressLevel"]:checked');
      const errorEl = document.getElementById('error-stressLevel');
      if (!checked) {
        if (errorEl) errorEl.textContent = 'Please select a stress level.';
        isValid = false;
      } else if (errorEl) {
        errorEl.textContent = '';
      }
    }

    if (firstInvalidField) {
      firstInvalidField.focus();
    }

    return isValid;
  }

  // Clear a field's error as soon as the user starts fixing it
  if (form) {
    form.addEventListener('input', (e) => {
      if (e.target.matches('input, select')) {
        setFieldError(e.target, '');
      }
    });
  }

  /* ---------- 5. Submit to FastAPI backend ---------- */
  function hideFormError() {
    if (formError) formError.hidden = true;
  }

  function showFormError() {
    if (!formError) return;
    formError.hidden = false;
    formError.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function setLoading(isLoading) {
    if (!submitBtn) return;
    submitBtn.disabled = isLoading;
    submitBtn.classList.toggle('is-loading', isLoading);
  }

  // Reads a field value if the element exists; returns null otherwise so
  // collectFormData() can't itself throw and abort submission silently.
  function fieldValue(id) {
    const el = document.getElementById(id);
    return el ? el.value : null;
  }

  function collectFormData() {
    const stressChecked = document.querySelector('input[name="stressLevel"]:checked');

    return {
      age: Number(fieldValue('age')),
      gender: fieldValue('gender'),
      country: (fieldValue('country') || '').trim(),
      academic_level: fieldValue('academicLevel'),
      most_used_platform: fieldValue('platform'),
      purpose_of_use: fieldValue('purpose'),
      avg_daily_usage_hours: Number(fieldValue('dailyUsage')),
      daily_unlocks: Number(fieldValue('dailyUnlocks')),
      study_hours: Number(fieldValue('studyHours')),
      physical_activity_hours: Number(fieldValue('activityHours')),
      sleep_hours_per_night: Number(fieldValue('sleepHours')),
      stress_level: stressChecked ? stressChecked.value : null,
    };
  }

  async function handleSubmit() {
    hideFormError();
    setLoading(true);

    const submitted = collectFormData();

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitted),
      });

      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }

      const data = await response.json();
      showResult(data.predicted_mental_health_score, submitted);
    } catch (error) {
      console.error('Prediction error:', error);
      showFormError();
    } finally {
      setLoading(false);
    }
  }

  // Enter key inside an earlier step should advance, not submit early
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (currentStep !== totalSteps) {
        if (nextBtn) nextBtn.click();
        return;
      }
      if (!validateStep(totalSteps)) return;
      handleSubmit();
    });
  }

  /* ---------- 6. Result section / score ring ---------- */
  const resultSection = get('result');
  const scoreValueEl = get('scoreValue');
  const scoreRingProgress = get('scoreRingProgress');
  const scoreBadgeEl = get('scoreBadge');
  const resultMessageEl = get('resultMessage');
  const recommendationsEl = get('recommendations');
  const recommendationsListEl = get('recommendationsList');

  // Simple lifestyle-guideline checks — not medical advice, just general
  // wellness ranges to flag habits worth adjusting.
  function generateRecommendations(data) {
    const tips = [];

    if (data.sleep_hours_per_night < 7) {
      tips.push('You reported under 7 hours of sleep. Aim for 7–9 hours a night — sleep has one of the strongest links to mood and focus.');
    } else if (data.sleep_hours_per_night > 9.5) {
      tips.push('Your sleep is on the higher side. Very long sleep can sometimes signal fatigue or low activity — worth keeping an eye on.');
    }

    if (data.avg_daily_usage_hours > 6) {
      tips.push('Your social media usage is fairly high (' + data.avg_daily_usage_hours + ' hrs/day). Try setting app time limits or scheduled screen-free blocks.');
    }

    if (data.daily_unlocks > 150) {
      tips.push('You unlock your phone often (' + data.daily_unlocks + ' times/day). Turning off non-essential notifications can cut this down a lot.');
    }

    if (data.physical_activity_hours < 1) {
      tips.push('Physical activity is low. Even 20–30 minutes of walking or exercise a day can noticeably improve mood and sleep quality.');
    }

    if (data.study_hours > 7) {
      tips.push('You\'re studying long hours. Build in short breaks (e.g. the 50/10 rule) to avoid burnout and keep focus up.');
    }

    if (data.stress_level === 'High' || data.stress_level === 'Very High') {
      tips.push('Your stress level is high. Simple habits like short breathing exercises, journaling, or talking to a friend or counselor can help manage it.');
    }

    if (tips.length === 0) {
      tips.push('Your routine already looks balanced across sleep, activity, and screen time — keep maintaining these habits.');
    }

    return tips;
  }

  function renderRecommendations(data) {
    if (!recommendationsEl || !recommendationsListEl) return;
    if (!data) {
      recommendationsEl.hidden = true;
      return;
    }
    const tips = generateRecommendations(data);
    recommendationsListEl.innerHTML = '';
    tips.forEach((tip) => {
      const li = document.createElement('li');
      li.textContent = tip;
      recommendationsListEl.appendChild(li);
    });
    recommendationsEl.hidden = false;
  }

  // Score is on a 0–10 scale, higher = better well-being (dataset mean ~6.2)
  function getScoreCategory(score) {
    if (score >= 8) {
      return { label: 'Very Good', className: 'score-badge--excellent', message: 'Your habits look well balanced — keep it up!' };
    }
    if (score >= 6.5) {
      return { label: 'Good', className: 'score-badge--good', message: 'Your overall well-being looks good.' };
    }
    if (score >= 5) {
      return { label: 'Normal', className: 'score-badge--normal', message: 'Your well-being looks about average — small changes could help.' };
    }
    if (score >= 4) {
      return { label: 'Low', className: 'score-badge--low', message: 'A few areas may be affecting your well-being — worth a closer look.' };
    }
    return { label: 'Very Low', className: 'score-badge--very-low', message: 'Your well-being score is low. Consider talking to someone you trust or a professional.' };
  }

  function showResult(rawScore, submittedData) {
    if (!resultSection) {
      console.error('[script.js] #result not found — cannot display result.');
      return;
    }

    const score = Number(rawScore) || 0;

    resultSection.hidden = false;
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    if (scoreValueEl) scoreValueEl.textContent = score.toFixed(2);

    const category = getScoreCategory(score);
    if (scoreBadgeEl) {
      scoreBadgeEl.textContent = category.label;
      scoreBadgeEl.className = `score-badge ${category.className}`;
    }
    if (resultMessageEl) resultMessageEl.textContent = category.message;

    renderRecommendations(submittedData);

    if (scoreRingProgress) {
      // Assume a 0–10 scale for the ring fill; clamp defensively either way
      const percentage = Math.max(0, Math.min(score / 10, 1));
      const offset = SCORE_RING_CIRCUMFERENCE * (1 - percentage);

      // Reset instantly, then animate to the new offset on the next frame
      scoreRingProgress.style.transition = 'none';
      scoreRingProgress.style.strokeDashoffset = String(SCORE_RING_CIRCUMFERENCE);

      requestAnimationFrame(() => {
        scoreRingProgress.style.transition = '';
        scoreRingProgress.style.strokeDashoffset = String(offset);
      });
    }
  }

  /* ---------- 7. Retake assessment ---------- */
  const retakeBtn = get('retakeBtn');

  if (retakeBtn && form) {
    retakeBtn.addEventListener('click', () => {
      form.reset();

      // Clear every field error and invalid state
      form.querySelectorAll('.error-message').forEach((el) => { el.textContent = ''; });
      form.querySelectorAll('.is-invalid').forEach((el) => el.classList.remove('is-invalid'));

      if (resultSection) resultSection.hidden = true;
      currentStep = 1;
      showStep(currentStep);

      const assessmentSection = document.getElementById('assessment');
      if (assessmentSection) assessmentSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // Initialize first step on load
  if (steps.length > 0) {
    showStep(currentStep);
  }
});