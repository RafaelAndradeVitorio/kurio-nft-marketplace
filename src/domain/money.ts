import Decimal from "decimal.js";
Decimal.set({ precision: 40 });
export const decimal = (value: string | number) => new Decimal(value);
export const eth = (value: string) =>
  `${decimal(value).toFixed(Math.max(2, decimal(value).decimalPlaces()))} ETH`;
