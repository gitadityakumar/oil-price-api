function esc(value: string | number): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function ppacPriceRow(input: {
  fuel: string;
  price: number;
  date: string;
  state: string;
  stateCode: string;
  city: string;
  pin: string;
  basePrice: number;
  excise: number;
  vat: number;
  dealerCommission: number;
}): string {
  return `<tr data-row="price">
        <td data-col="fuel">${esc(input.fuel)}</td>
        <td data-col="price">${input.price.toFixed(2)}</td>
        <td data-col="date">${esc(input.date)}</td>
        <td data-col="state">${esc(input.state)}</td>
        <td data-col="state_code">${esc(input.stateCode)}</td>
        <td data-col="city">${esc(input.city)}</td>
        <td data-col="pin">${esc(input.pin)}</td>
        <td data-col="base_price">${input.basePrice.toFixed(2)}</td>
        <td data-col="excise">${input.excise.toFixed(2)}</td>
        <td data-col="vat">${input.vat.toFixed(2)}</td>
        <td data-col="dealer_commission">${input.dealerCommission.toFixed(2)}</td>
      </tr>`;
}

export function cgdPriceRow(input: {
  fuel: string;
  price: number;
  date: string;
  state: string;
  city: string;
  pin: string;
}): string {
  return `<tr data-row="price">
        <td data-col="fuel">${esc(input.fuel)}</td>
        <td data-col="price">${input.price.toFixed(2)}</td>
        <td data-col="date">${esc(input.date)}</td>
        <td data-col="state">${esc(input.state)}</td>
        <td data-col="city">${esc(input.city)}</td>
        <td data-col="pin">${esc(input.pin)}</td>
      </tr>`;
}

export function wrapFixtureTable(rows: string[]): string {
  return `<html>
  <body>
    <table>
${rows.join('\n')}
    </table>
  </body>
</html>
`;
}

export function derivePpacComponents(price: number): {
  basePrice: number;
  excise: number;
  vat: number;
  dealerCommission: number;
} {
  const dealerCommission = 3.6;
  const excise = price * 0.21;
  const vat = price * 0.16;
  const basePrice = price - excise - vat - dealerCommission;
  return { basePrice, excise, vat, dealerCommission };
}