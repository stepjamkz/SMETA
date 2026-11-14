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
  if (focus) row.querySelector(".item-name").focus();
  return row;
}

items.addEventListener("input", recalculate);
items.addEventListener("focusout", (event) => {
  if (event.target.matches(".item-price") && event.target.value.trim()) {
    event.target.value = formatPrice(parseNumber(event.target.value));
    recalculate();
  }
});

items.addEventListener("click", (event) => {
  const button = event.target.closest(".delete-button");
  if (!button) return;
  const row = button.closest(".item-row");
  const nextRow = row.nextElementSibling || row.previousElementSibling;
  row.remove();
  recalculate();
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

function preparePrint() {
  recalculate();
  const number = document.querySelector("#estimate-number").value.trim() || "____";
  const date = document.querySelector("#estimate-date").value;
  const formattedDate = /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? date.split("-").reverse().join(".") : "____";
  document.querySelector("#print-heading").textContent = `Смета № ${number} от ${formattedDate}`;

  // Обычный текст в печати не обрезается по ширине поля и сохраняет переносы.
  for (const control of document.querySelectorAll("input, select, textarea")) {
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

const today = new Date();
document.querySelector("#estimate-date").value = [
  today.getFullYear(),
  String(today.getMonth() + 1).padStart(2, "0"),
  String(today.getDate()).padStart(2, "0")
].join("-");

addItem(false);
