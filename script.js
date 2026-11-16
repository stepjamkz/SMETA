"use strict";

const items = document.querySelector("#items");
const template = document.querySelector("#item-template");
const addButton = document.querySelector("#add-item");
const grandTotal = document.querySelector("#grand-total");
const discountRate = document.querySelector("#discount-rate");
const vatRate = document.querySelector("#vat-rate");
const currency = document.querySelector("#currency");
const numberFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const priceFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 20 });
const draftKey = "smeta-draft-v1";
const fieldIds = ["sender", "recipient", "estimate-number", "estimate-date", "discount-rate", "vat-rate", "currency", "comment"];
const itemFields = ["name", "quantity", "unit", "price"];
let draftReady = false;
let copyTimer;
let copyRequest = 0;

function parseNumber(value) {
  const normalized = String(value).trim().replace(/[₸₽$€]$/, "").replace(/\s/g, "").replace(",", ".");
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return 0;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function roundMoney(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value) || 0;
}

function formatMoney(value) {
  return `${numberFormat.format(roundMoney(value)).replace(/\u00a0|\u202f/g, " ")} ${currency.value}`;
}

function formatPrice(value) {
  return `${priceFormat.format(value).replace(/\u00a0|\u202f/g, " ")} ${currency.value}`;
}

function showSummary(outputId, rowId, value) {
  document.querySelector(outputId).textContent = formatMoney(value);
  document.querySelector(rowId).hidden = value === 0;
}

function recalculate() {
  let total = 0;
  for (const row of items.querySelectorAll(".item-row")) {
    const quantity = parseNumber(row.querySelector(".item-quantity").value);
    const price = parseNumber(row.querySelector(".item-price").value);
    const amount = roundMoney(quantity * price);
    row.querySelector(".item-total").textContent = formatMoney(amount);
    row.querySelector(".price-label").textContent = `Цена, ${currency.value}`;
    total = roundMoney(total + amount);
  }
  const discount = roundMoney(total * (parseNumber(discountRate.value) / 100));
  const discounted = roundMoney(total - discount);
  const vat = roundMoney(discounted * (parseNumber(vatRate.value) / 100));
  document.querySelector("#subtotal").textContent = formatMoney(total);
  showSummary("#discount-amount", "#discount-row", discount);
  showSummary("#discounted-total", "#discounted-row", discounted);
  showSummary("#vat-amount", "#vat-row", vat);
  grandTotal.textContent = formatMoney(discounted + vat);
  document.querySelector("#currency-note").textContent = currency.value;
  document.querySelector("#price-heading").textContent = `Цена, ${currency.value}`;
}

function addItem(focus = true) {
  const row = template.content.firstElementChild.cloneNode(true);
  items.append(row);
  recalculate();
  saveDraft();
  if (focus) row.querySelector(".item-name").focus();
  return row;
}

items.addEventListener("input", recalculate);
items.addEventListener("focusout", (event) => {
  if (event.target.matches(".item-price") && event.target.value.trim()) {
    event.target.value = formatPrice(parseNumber(event.target.value));
    recalculate();
    saveDraft();
  }
});

items.addEventListener("click", (event) => {
  const button = event.target.closest(".delete-button");
  if (!button) return;
  const row = button.closest(".item-row");
  const nextRow = row.nextElementSibling || row.previousElementSibling;
  row.remove();
  recalculate();
  saveDraft();
  if (nextRow) nextRow.querySelector(".item-name").focus();
  else addButton.focus();
});

items.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.isComposing || !event.target.matches("input")) return;
  if (event.target.closest(".item-row") === items.lastElementChild) {
    event.preventDefault();
    addItem();
  }
});

addButton.addEventListener("click", () => addItem());
discountRate.addEventListener("input", recalculate);
vatRate.addEventListener("input", recalculate);
currency.addEventListener("change", () => {
  for (const price of items.querySelectorAll(".item-price")) {
    if (price.value.trim()) price.value = formatPrice(parseNumber(price.value));
  }
  recalculate();
});

function estimateHeading() {
  const number = document.querySelector("#estimate-number").value.trim() || "____";
  const date = document.querySelector("#estimate-date").value;
  const formattedDate = /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? date.split("-").reverse().join(".") : "____";
  return `Смета № ${number} от ${formattedDate}`;
}

function preparePrint() {
  recalculate();
  document.querySelector("#print-heading").textContent = estimateHeading();

  // Обычный текст в печати не обрезается по ширине поля и сохраняет переносы.
  for (const control of document.querySelectorAll(".details-grid input, #items input, #items select, #comment")) {
    let value = control.nextElementSibling;
    if (!value || !value.classList.contains("print-value")) {
      value = document.createElement("span");
      value.className = "print-value";
      value.setAttribute("aria-hidden", "true");
      control.insertAdjacentElement("afterend", value);
    }
    value.textContent = control.value;
  }
}

window.addEventListener("beforeprint", preparePrint);
document.querySelector("#save-pdf").addEventListener("click", () => {
  preparePrint();
  window.print();
});

function todayDate() {
  const today = new Date();
  return [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")].join("-");
}

function saveDraft() {
  if (!draftReady) return;
  const draft = {
    version: 1,
    fields: Object.fromEntries(fieldIds.map(id => [id, document.getElementById(id).value])),
    items: Array.from(items.querySelectorAll(".item-row"), row =>
      Object.fromEntries(itemFields.map(name => [name, row.querySelector(`.item-${name}`).value])))
  };
  try {
    localStorage.setItem(draftKey, JSON.stringify(draft));
    document.querySelector("#draft-status").textContent = "";
  } catch {
    document.querySelector("#draft-status").textContent = "Не удалось сохранить черновик в этом браузере. Сохраните смету в PDF или скопируйте текст.";
  }
}

function restoreDraft() {
  try {
    const stored = localStorage.getItem(draftKey);
    if (!stored) return false;
    const draft = JSON.parse(stored);
    if (!draft || draft.version !== 1 || !draft.fields || !Array.isArray(draft.items)
      || !fieldIds.every(id => typeof draft.fields[id] === "string")
      || !["₸", "₽", "$", "€"].includes(draft.fields.currency)
      || !draft.items.every(row => row && itemFields.every(name => typeof row[name] === "string") && ["шт", "час", "услуга"].includes(row.unit))) {
      throw new Error("Invalid draft");
    }
    for (const id of fieldIds) document.getElementById(id).value = draft.fields[id];
    for (const saved of draft.items) {
      const row = addItem(false);
      for (const name of itemFields) row.querySelector(`.item-${name}`).value = saved[name];
    }
    recalculate();
    return true;
  } catch {
    document.querySelector("#draft-status").textContent = "Не удалось восстановить черновик. Проверьте доступ к хранилищу браузера.";
    return false;
  }
}

function nextEstimateNumber(value) {
  const match = value.trim().match(/^(.*?)(\d+)$/);
  return match ? match[1] + (BigInt(match[2]) + 1n).toString().padStart(match[2].length, "0") : "1";
}

document.querySelector("#new-estimate").addEventListener("click", () => {
  if (!window.confirm("Создать новую смету? Текущий черновик будет очищен.")) return;
  const nextNumber = nextEstimateNumber(document.querySelector("#estimate-number").value);
  draftReady = false;
  for (const id of fieldIds) document.getElementById(id).value = "";
  discountRate.value = "0";
  vatRate.value = "0";
  currency.value = "₸";
  document.querySelector("#estimate-number").value = nextNumber;
  document.querySelector("#estimate-date").value = todayDate();
  items.replaceChildren();
  addItem(false);
  copyRequest++;
  clearTimeout(copyTimer);
  document.querySelector("#copy-status").textContent = "";
  document.querySelector("#copy-fallback").hidden = true;
  document.querySelector("#copy-text").value = "";
  draftReady = true;
  saveDraft();
  document.querySelector("#sender").focus();
});

function whatsappText() {
  recalculate();
  const lines = [estimateHeading()];
  for (const [id, label] of [["sender", "От кого"], ["recipient", "Для кого"]]) {
    const value = document.getElementById(id).value.trim();
    if (value) lines.push(`${label}: ${value}`);
  }
  lines.push("");
  for (const row of items.querySelectorAll(".item-row")) {
    const name = row.querySelector(".item-name").value.trim() || "Без наименования";
    const quantity = priceFormat.format(parseNumber(row.querySelector(".item-quantity").value)).replace(/\u00a0|\u202f/g, " ");
    const unit = row.querySelector(".item-unit").value;
    const price = formatPrice(parseNumber(row.querySelector(".item-price").value));
    lines.push(`• ${name} — ${quantity} ${unit} × ${price} = ${row.querySelector(".item-total").textContent}`);
  }
  lines.push("", `Сумма: ${document.querySelector("#subtotal").textContent}`);
  if (!document.querySelector("#discount-row").hidden) {
    lines.push(`Скидка (${parseNumber(discountRate.value)} %): ${document.querySelector("#discount-amount").textContent}`);
    lines.push(`Сумма со скидкой: ${document.querySelector("#discounted-total").textContent}`);
  }
  if (!document.querySelector("#vat-row").hidden) {
    lines.push(`НДС (${parseNumber(vatRate.value)} %): ${document.querySelector("#vat-amount").textContent}`);
  }
  lines.push(`Итого к оплате: ${grandTotal.textContent}`);
  const comment = document.querySelector("#comment").value.trim();
  if (comment) lines.push("", `Комментарий: ${comment}`);
  return lines.join("\n");
}

document.querySelector("#copy-whatsapp").addEventListener("click", async () => {
  const request = ++copyRequest;
  const text = whatsappText();
  const status = document.querySelector("#copy-status");
  clearTimeout(copyTimer);
  status.textContent = "";
  try {
    await navigator.clipboard.writeText(text);
    if (request !== copyRequest) return;
    document.querySelector("#copy-fallback").hidden = true;
    status.textContent = "Скопировано ✓";
    copyTimer = setTimeout(() => { status.textContent = ""; }, 2000);
  } catch {
    if (request !== copyRequest) return;
    document.querySelector("#copy-fallback").hidden = false;
    const field = document.querySelector("#copy-text");
    field.value = text;
    field.focus();
    field.select();
    status.textContent = "Автоматическое копирование недоступно. Скопируйте выделенный текст вручную.";
  }
});

const page = document.querySelector(".page");
for (const eventName of ["input", "change"]) {
  page.addEventListener(eventName, event => {
    if (event.target.matches("input, select, textarea") && event.target.id !== "copy-text") saveDraft();
  });
}

document.querySelector("#estimate-date").value = todayDate();
if (!restoreDraft()) addItem(false);
draftReady = true;
