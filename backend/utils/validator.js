// ============================================
// utils/validator.js
// PRO — Central Input Validation System
// ============================================

class Validator {
  constructor() {
    this.errors = [];
  }

  // ── Chainable Rules ──
  field(value, name) {
    this._current      = value;
    this._currentName  = name;
    return this;
  }

  required() {
    if (
      this._current === undefined ||
      this._current === null ||
      this._current === ''
    ) {
      this.errors.push(`${this._currentName} is required.`);
    }
    return this;
  }

  string() {
    if (this._current && typeof this._current !== 'string') {
      this.errors.push(`${this._currentName} must be a string.`);
    }
    return this;
  }

  number() {
    if (this._current !== undefined && isNaN(Number(this._current))) {
      this.errors.push(`${this._currentName} must be a number.`);
    }
    return this;
  }

  min(n) {
    if (this._current !== undefined) {
      const val = typeof this._current === 'string'
        ? this._current.length
        : Number(this._current);
      if (val < n) {
        this.errors.push(
          typeof this._current === 'string'
            ? `${this._currentName} must be at least ${n} characters.`
            : `${this._currentName} must be at least ${n}.`
        );
      }
    }
    return this;
  }

  max(n) {
    if (this._current !== undefined) {
      const val = typeof this._current === 'string'
        ? this._current.length
        : Number(this._current);
      if (val > n) {
        this.errors.push(
          typeof this._current === 'string'
            ? `${this._currentName} must be under ${n} characters.`
            : `${this._currentName} must be under ${n}.`
        );
      }
    }
    return this;
  }

  email() {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (this._current && !emailRegex.test(this._current)) {
      this.errors.push(`${this._currentName} must be a valid email.`);
    }
    return this;
  }

  url() {
    try {
      if (this._current) new URL(this._current);
    } catch {
      this.errors.push(`${this._currentName} must be a valid URL.`);
    }
    return this;
  }

  youtube() {
    const ytRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    if (this._current && !ytRegex.test(this._current)) {
      this.errors.push(`${this._currentName} must be a valid YouTube URL.`);
    }
    return this;
  }

  oneOf(allowed) {
    if (this._current && !allowed.includes(this._current)) {
      this.errors.push(
        `${this._currentName} must be one of: ${allowed.join(', ')}.`
      );
    }
    return this;
  }

  phone() {
    const phoneRegex = /^[0-9]{10,15}$/;
    if (this._current && !phoneRegex.test(this._current.replace(/\s/g, ''))) {
      this.errors.push(`${this._currentName} must be a valid phone number.`);
    }
    return this;
  }

  // ── Result ──
  isValid() {
    return this.errors.length === 0;
  }

  getErrors() {
    return this.errors;
  }
}

// ── Factory function ──
const validate = () => new Validator();

// ── Pre-built validators ──
const validateWithdrawal = (body) => {
  const v = validate();
  v.field(body.amount,         'Amount').required().number().min(100).max(100000);
  v.field(body.method,         'Method').required().oneOf(['easypaisa','jazzcash','bank']);
  v.field(body.account_number, 'Account number').required().string().min(10).max(20);
  v.field(body.account_name,   'Account name').required().string().min(3).max(50);
  return v;
};

const validateCampaign = (body) => {
  const v = validate();
  v.field(body.title,                'Title').required().string().min(3).max(100);
  v.field(body.video_url,            'Video URL').required().youtube();
  v.field(body.budget,               'Budget').required().number().min(500);
  v.field(body.per_view_rate,        'Per view rate').required().number().min(0.01).max(10);
  v.field(body.required_watch_time,  'Watch time').required().number().min(10).max(300);
  v.field(body.max_views,            'Max views').required().number().min(100).max(100000);
  return v;
};

const validateProfile = (body) => {
  const v = validate();
  if (body.username) v.field(body.username, 'Username').string().min(3).max(30);
  if (body.avatar_url) v.field(body.avatar_url, 'Avatar URL').url();
  return v;
};

module.exports = {
  validate,
  validateWithdrawal,
  validateCampaign,
  validateProfile,
};
