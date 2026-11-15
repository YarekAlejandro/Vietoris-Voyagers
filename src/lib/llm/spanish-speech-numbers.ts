const small = "cero uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce quince dieciséis diecisiete dieciocho diecinueve veinte veintiuno veintidós veintitrés veinticuatro veinticinco veintiséis veintisiete veintiocho veintinueve".split(" ");
const tens = "cero diez veinte treinta cuarenta cincuenta sesenta setenta ochenta noventa".split(" ");
const hundreds = "cero ciento doscientos trescientos cuatrocientos quinientos seiscientos setecientos ochocientos novecientos".split(" ");
const months = "enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre".split(" ");

function count(n: number): string {
  if (n < 30) return small[n];
  if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ` y ${count(n % 10)}` : "");
  if (n === 100) return "cien";
  if (n < 1000) return hundreds[Math.floor(n / 100)] + (n % 100 ? ` ${count(n % 100)}` : "");
  const group = n >= 1_000_000 ? 1_000_000 : 1000;
  const leading = Math.floor(n / group);
  const prefix = leading === 1 ? (group === 1000 ? "mil" : "un millón") :
    `${count(leading).replace(/veintiuno$/, "veintiún").replace(/uno$/, "un")} ${group === 1000 ? "mil" : "millones"}`;
  return prefix + (n % group ? ` ${count(n % group)}` : "");
}

export function speakSpanishNumbers(text: string) {
  const date = (fallback: string, year: string, month: string, day: string) =>
    months[Number(month) - 1] && Number(day) >= 1 && Number(day) <= 31 ?
      `${count(Number(day))} de ${months[Number(month) - 1]} de ${count(Number(year))}` : fallback;
  return text
    .replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, date)
    .replace(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, (match, day, month, year) => date(match, year, month, day))
    .replace(/(?<=\d)-(?=\d)/g, " a ")
    .replace(/\b\d+(?:[.,]\d+)?\b/g, (value: string, offset: number, source: string) => {
      const [whole, fraction] = value.split(/[.,]/);
      const digits = (s: string) => [...s].map((digit) => small[Number(digit)]).join(" ");
      const noun = source.slice(offset + value.length).match(/^\s+(?:dólares|pesos|euros|centímetros|milímetros|kilojulios|kilopascales|puntos|días|años)\b/iu);
      const integer = /^0\d|^\d{10}/.test(whole) ? digits(whole) : count(Number(whole));
      if (fraction) return `${integer} ${value.includes(",") ? "coma" : "punto"} ${digits(fraction)}`;
      return noun ? integer.replace(/veintiuno$/, "veintiún").replace(/uno$/, "un") : integer;
    });
}
