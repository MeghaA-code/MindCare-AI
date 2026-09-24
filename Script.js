/* ==========================================================================
   MindCare AI — script.js
   Sections: 1. Config  2. Nav toggle  3. Multi-step form  4. Validation
   5. Submit to FastAPI  6. Result / score ring  7. Retake
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  /* ---------- 1. Config ---------- */
  const API_URL = 'https://mindcare-ai-rs2g.onrender.com';
  const SCORE_RING_CIRCUMFERENCE = 439.8; // 2 * PI * r(70), matches style.css

  /* ---------- 2. Mobile nav toggle ---------- */
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');

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

  /* ---------- 3. Multi-step form ---------- */
  const form = document.getElementById('assessmentForm');
  const steps = Array.from(document.querySelectorAll('.form-step'));
  const stepperItems = Array.from(document.querySelectorAll('.stepper__item'));
  const totalSteps = steps.length;

  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const submitBtn = document.getElementById('submitBtn');
  const formError = document.getElementById('formError');

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

    prevBtn.hidden = step === 1;
    nextBtn.hidden = step === totalSteps;
    submitBtn.hidden = step !== totalSteps;

    hideFormError();
  }

  nextBtn.addEventListener('click', () => {
    if (!validateStep(currentStep)) return;
    if (currentStep < totalSteps) {
      currentStep += 1;
      showStep(currentStep);
    }
  });

  prevBtn.addEventListener('click', () => {
    if (currentStep > 1) {
      currentStep -= 1;
      showStep(currentStep);
    }
  });

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
  form.addEventListener('input', (e) => {
    if (e.target.matches('input, select')) {
      setFieldError(e.target, '');
    }
  });

  /* ---------- 5. Submit to FastAPI backend ---------- */
  function hideFormError() {
    formError.hidden = true;
  }

  function showFormError() {
    formError.hidden = false;
    formError.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    submitBtn.classList.toggle('is-loading', isLoading);
  }

  function collectFormData() {
    return {
      age: Number(document.getElementById('age').value),
      gender: document.getElementById('gender').value,
      country: document.getElementById('country').value.trim(),
      academic_level: document.getElementById('academicLevel').value,
      most_used_platform: document.getElementById('platform').value,
      purpose_of_use: document.getElementById('purpose').value,
      avg_daily_usage_hours: Number(document.getElementById('dailyUsage').value),
      daily_unlocks: Number(document.getElementById('dailyUnlocks').value),
      study_hours: Number(document.getElementById('studyHours').value),
      physical_activity_hours: Number(document.getElementById('activityHours').value),
      sleep_hours_per_night: Number(document.getElementById('sleepHours').value),
      stress_level: document.querySelector('input[name="stressLevel"]:checked').value,
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
      console.error("Prediction error:", error);
      showFormError();
    } finally {
      setLoading(false);
    }
  }

  // Enter key inside an earlier step should advance, not submit early
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (currentStep !== totalSteps) {
      nextBtn.click();
      return;
    }
    if (!validateStep(totalSteps)) return;
    handleSubmit();
  });

  /* ---------- 6. Result section / score ring ---------- */
  const resultSection = document.getElementById('result');
  const scoreValueEl = document.getElementById('scoreValue');
  const scoreRingProgress = document.getElementById('scoreRingProgress');
  const scoreBadgeEl = document.getElementById('scoreBadge');
  const resultMessageEl = document.getElementById('resultMessage');
  const recommendationsEl = document.getElementById('recommendations');
  const recommendationsListEl = document.getElementById('recommendationsList');

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
    const score = Number(rawScore) || 0;

    resultSection.hidden = false;
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    scoreValueEl.textContent = score.toFixed(2);

    const category = getScoreCategory(score);
    scoreBadgeEl.textContent = category.label;
    scoreBadgeEl.className = `score-badge ${category.className}`;
    resultMessageEl.textContent = category.message;

    renderRecommendations(submittedData);

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

  /* ---------- 7. Retake assessment ---------- */
  const retakeBtn = document.getElementById('retakeBtn');

  retakeBtn.addEventListener('click', () => {
    form.reset();

    // Clear every field error and invalid state
    form.querySelectorAll('.error-message').forEach((el) => { el.textContent = ''; });
    form.querySelectorAll('.is-invalid').forEach((el) => el.classList.remove('is-invalid'));

    resultSection.hidden = true;
    currentStep = 1;
    showStep(currentStep);

    document.getElementById('assessment').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // Initialize first step on load
  showStep(currentStep);
});