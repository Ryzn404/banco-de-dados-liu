// Máscaras e formatação (funções puras, sem DOM).
import { TIMEZONE } from "./config.js";

export const digits = (v) => String(v ?? "").replace(/\D/g, "");
export const alnum = (v) => String(v ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");

// CPF 111.111.111-11 · CNPJ 11.222.333/0001-81 · CNPJ alfanumérico 12.ABC.345/01DE-35
export function maskDoc(v) {
  let d = alnum(v);
  if (!/[A-Z]/.test(d) && d.length <= 11) {
    return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  // CNPJ: 12 posições alfanuméricas + 2 dígitos verificadores numéricos
  d = d.slice(0, 12) + d.slice(12).replace(/\D/g, "").slice(0, 2);
  return d.replace(/^(\w{2})(\w)/, "$1.$2").replace(/^(\w{2})\.(\w{3})(\w)/, "$1.$2.$3")
    .replace(/^(\w{2})\.(\w{3})\.(\w{3})(\w)/, "$1.$2.$3/$4").replace(/\/(\w{4})(\w)/, "/$1-$2");
}

// (71)9 2222-2222 (celular, 11 dígitos) ou (71)2222-2222 (fixo, 10 dígitos)
export function maskPhone(v) {
  const d = digits(v).slice(0, 11);
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  const ddd = d.slice(0, 2), r = d.slice(2);
  if (d.length === 11) return `(${ddd})${r[0]} ${r.slice(1, 5)}-${r.slice(5)}`;
  return r.length > 4 ? `(${ddd})${r.slice(0, 4)}-${r.slice(4)}` : `(${ddd})${r}`;
}

// R$1.900,00 — os dígitos entram pelos centavos; máx. 14 dígitos (coluna numeric(14,2))
export function maskMoney(v) {
  const d = digits(v).replace(/^0+/, "").slice(0, 14);
  if (!d) return "";
  const cents = d.padStart(3, "0");
  const int = cents.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$${int},${cents.slice(-2)}`;
}
export const moneyToNumber = (v) => Number(digits(v) || 0) / 100;
export const numberToMoney = (n) => (n == null || n === "" ? "" : maskMoney(String(Math.round(Number(n) * 100))));

// Data de hoje (AAAA-MM-DD) no fuso da empresa, e não em UTC
export function today(timeZone = TIMEZONE, agora = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(agora).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}`;
}

export const fmtDate = (d) => (d ? d.split("-").reverse().join("/") : "—");
export const fmtBRL = (n) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
