/**
 * Converts a numeric amount to Indian currency words
 * Matches Excel '=SpellNumber(J44)'
 * e.g. 14570 -> "Rupees Fourteen Thousand Five Hundred Seventy Only"
 */
export function numberToWordsIndian(num: number): string {
  if (isNaN(num) || num <= 0) return 'Rupees Zero Only';

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convert(n: number): string {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) {
      const t = tens[Math.floor(n / 10)];
      const o = ones[n % 10];
      return o ? `${t} ${o}` : t;
    }
    if (n < 1000) {
      const h = Math.floor(n / 100);
      const r = n % 100;
      return r ? `${ones[h]} Hundred ${convert(r)}` : `${ones[h]} Hundred`;
    }
    if (n < 100000) {
      const th = Math.floor(n / 1000);
      const r = n % 1000;
      return r ? `${convert(th)} Thousand ${convert(r)}` : `${convert(th)} Thousand`;
    }
    if (n < 10000000) {
      const lk = Math.floor(n / 100000);
      const r = n % 100000;
      return r ? `${convert(lk)} Lakh ${convert(r)}` : `${convert(lk)} Lakh`;
    }
    const cr = Math.floor(n / 10000000);
    const r = n % 10000000;
    return r ? `${convert(cr)} Crore ${convert(r)}` : `${convert(cr)} Crore`;
  }

  const rounded = Math.round(num * 100) / 100;
  const intPart = Math.floor(rounded);
  const paise = Math.round((rounded - intPart) * 100);

  const mainWords = convert(intPart).trim() || 'Zero';
  let result = `Rupees ${mainWords}`;

  if (paise > 0) {
    result += ` and ${convert(paise).trim()} Paise`;
  }
  result += ' Only';

  return result;
}
