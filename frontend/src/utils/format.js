/**
 * Formats integer paise into Indian Rupee (INR) string.
 * @param {number} paise Amount in paise (1 INR = 100 paise)
 * @param {boolean} showDecimals Whether to show two decimal places
 * @returns {string} Formatted currency e.g. "₹12,400"
 */
export function formatPaise(paise, showDecimals = false) {
  if (paise === null || paise === undefined || isNaN(paise)) return '₹0';
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(rupees);
}

/**
 * Formats large paise amounts in compact Indian lakhs/crores or standard units.
 * As seen in the design sheet hero stat: "₹ 12.4L"
 * @param {number} paise 
 * @returns {string} e.g. "₹ 12.4L"
 */
export function formatPaiseCompact(paise) {
  if (paise === null || paise === undefined || isNaN(paise)) return '₹ 0';
  const rupees = Math.abs(paise) / 100;
  const sign = paise < 0 ? '-' : '';

  if (rupees >= 10000000) {
    return `${sign}₹ ${(rupees / 10000000).toFixed(1)}Cr`;
  }
  if (rupees >= 100000) {
    return `${sign}₹ ${(rupees / 100000).toFixed(1)}L`;
  }
  if (rupees >= 1000) {
    return `${sign}₹ ${(rupees / 1000).toFixed(1)}k`;
  }
  return `${sign}₹ ${rupees.toFixed(0)}`;
}

/**
 * Formats a calendar date YYYY-MM-DD into "28 Oct 2026".
 * @param {string|Date} dateVal 
 * @returns {string}
 */
export function formatDate(dateVal) {
  if (!dateVal) return '—';
  const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
  if (isNaN(d.getTime())) return String(dateVal);
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

/**
 * Extracts error details from API response.
 * @param {any} error 
 * @returns {{ message: string, code?: string, fields?: Record<string, string> }}
 */
export function parseApiError(error) {
  if (!error) return { message: 'An unexpected error occurred.' };

  const data = error.response || error;
  const message = data.detail || error.message || 'An unexpected error occurred.';
  const code = data.code;
  const fields = {};

  if (Array.isArray(data.fields)) {
    data.fields.forEach((f) => {
      if (f.field && f.message) {
        fields[f.field] = f.message;
      }
    });
  }

  return { message, code, fields };
}
