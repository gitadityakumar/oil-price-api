export type CgdSource = 'igl_prices' | 'mgl_prices' | 'mngl_prices' | 'gujarat_gas_prices';

export type CityAnchor = {
  key: string;
  city: string;
  state: string;
  stateCode: string;
  anchorPin: string;
  pinPrefix: string;
  pinsPerCity: number;
  petrol: number;
  diesel: number;
  cng?: number;
  png?: number;
  cgdSource?: CgdSource;
};

/** 50 cities × 21 PINs = 1,050 PINs for Plan 1 VM coverage. */
export const COVERAGE_CITIES: CityAnchor[] = [
  { key: 'delhi', city: 'Delhi', state: 'Delhi', stateCode: 'DL', anchorPin: '110001', pinPrefix: '110', pinsPerCity: 21, petrol: 96.72, diesel: 89.54, cng: 74.09, png: 49.15, cgdSource: 'igl_prices' },
  { key: 'mumbai', city: 'Mumbai', state: 'Maharashtra', stateCode: 'MH', anchorPin: '400001', pinPrefix: '400', pinsPerCity: 21, petrol: 106.03, diesel: 94.27, cng: 49.40, png: 48.50, cgdSource: 'mgl_prices' },
  { key: 'bengaluru', city: 'Bengaluru', state: 'Karnataka', stateCode: 'KA', anchorPin: '560001', pinPrefix: '560', pinsPerCity: 21, petrol: 102.86, diesel: 88.94 },
  { key: 'hyderabad', city: 'Hyderabad', state: 'Telangana', stateCode: 'TS', anchorPin: '500001', pinPrefix: '500', pinsPerCity: 21, petrol: 109.66, diesel: 97.82 },
  { key: 'chennai', city: 'Chennai', state: 'Tamil Nadu', stateCode: 'TN', anchorPin: '600001', pinPrefix: '600', pinsPerCity: 21, petrol: 102.63, diesel: 94.24 },
  { key: 'kolkata', city: 'Kolkata', state: 'West Bengal', stateCode: 'WB', anchorPin: '700001', pinPrefix: '700', pinsPerCity: 21, petrol: 105.46, diesel: 92.03 },
  { key: 'pune', city: 'Pune', state: 'Maharashtra', stateCode: 'MH', anchorPin: '411001', pinPrefix: '411', pinsPerCity: 21, petrol: 105.80, diesel: 94.14, cng: 76.50, png: 50.20, cgdSource: 'mngl_prices' },
  { key: 'ahmedabad', city: 'Ahmedabad', state: 'Gujarat', stateCode: 'GJ', anchorPin: '380001', pinPrefix: '380', pinsPerCity: 21, petrol: 95.35, diesel: 89.19, cng: 72.80, png: 47.90, cgdSource: 'gujarat_gas_prices' },
  { key: 'jaipur', city: 'Jaipur', state: 'Rajasthan', stateCode: 'RJ', anchorPin: '302001', pinPrefix: '302', pinsPerCity: 21, petrol: 108.48, diesel: 93.67 },
  { key: 'lucknow', city: 'Lucknow', state: 'Uttar Pradesh', stateCode: 'UP', anchorPin: '226001', pinPrefix: '226', pinsPerCity: 21, petrol: 96.57, diesel: 89.76 },
  { key: 'kanpur', city: 'Kanpur', state: 'Uttar Pradesh', stateCode: 'UP', anchorPin: '208001', pinPrefix: '208', pinsPerCity: 21, petrol: 96.40, diesel: 89.55 },
  { key: 'nagpur', city: 'Nagpur', state: 'Maharashtra', stateCode: 'MH', anchorPin: '440001', pinPrefix: '440', pinsPerCity: 21, petrol: 106.20, diesel: 94.40 },
  { key: 'indore', city: 'Indore', state: 'Madhya Pradesh', stateCode: 'MP', anchorPin: '452001', pinPrefix: '452', pinsPerCity: 21, petrol: 108.65, diesel: 93.99 },
  { key: 'bhopal', city: 'Bhopal', state: 'Madhya Pradesh', stateCode: 'MP', anchorPin: '462001', pinPrefix: '462', pinsPerCity: 21, petrol: 108.20, diesel: 93.55 },
  { key: 'patna', city: 'Patna', state: 'Bihar', stateCode: 'BR', anchorPin: '800001', pinPrefix: '800', pinsPerCity: 21, petrol: 107.20, diesel: 94.10 },
  { key: 'chandigarh', city: 'Chandigarh', state: 'Chandigarh', stateCode: 'CH', anchorPin: '160001', pinPrefix: '160', pinsPerCity: 21, petrol: 96.90, diesel: 89.80 },
  { key: 'kochi', city: 'Kochi', state: 'Kerala', stateCode: 'KL', anchorPin: '682001', pinPrefix: '682', pinsPerCity: 21, petrol: 107.10, diesel: 95.20 },
  { key: 'coimbatore', city: 'Coimbatore', state: 'Tamil Nadu', stateCode: 'TN', anchorPin: '641001', pinPrefix: '641', pinsPerCity: 21, petrol: 102.40, diesel: 94.00 },
  { key: 'visakhapatnam', city: 'Visakhapatnam', state: 'Andhra Pradesh', stateCode: 'AP', anchorPin: '530001', pinPrefix: '530', pinsPerCity: 21, petrol: 109.10, diesel: 97.50 },
  { key: 'surat', city: 'Surat', state: 'Gujarat', stateCode: 'GJ', anchorPin: '395001', pinPrefix: '395', pinsPerCity: 21, petrol: 95.10, diesel: 89.00, cng: 71.50, png: 47.20, cgdSource: 'gujarat_gas_prices' },
  { key: 'vadodara', city: 'Vadodara', state: 'Gujarat', stateCode: 'GJ', anchorPin: '390001', pinPrefix: '390', pinsPerCity: 21, petrol: 95.00, diesel: 88.90, cng: 71.20, png: 47.00, cgdSource: 'gujarat_gas_prices' },
  { key: 'rajkot', city: 'Rajkot', state: 'Gujarat', stateCode: 'GJ', anchorPin: '360001', pinPrefix: '360', pinsPerCity: 21, petrol: 94.90, diesel: 88.80, cng: 70.90, png: 46.80, cgdSource: 'gujarat_gas_prices' },
  { key: 'bhubaneswar', city: 'Bhubaneswar', state: 'Odisha', stateCode: 'OD', anchorPin: '751001', pinPrefix: '751', pinsPerCity: 21, petrol: 103.50, diesel: 94.80 },
  { key: 'guwahati', city: 'Guwahati', state: 'Assam', stateCode: 'AS', anchorPin: '781001', pinPrefix: '781', pinsPerCity: 21, petrol: 97.50, diesel: 90.20 },
  { key: 'ranchi', city: 'Ranchi', state: 'Jharkhand', stateCode: 'JH', anchorPin: '834001', pinPrefix: '834', pinsPerCity: 21, petrol: 99.80, diesel: 91.40 },
  { key: 'raipur', city: 'Raipur', state: 'Chhattisgarh', stateCode: 'CG', anchorPin: '492001', pinPrefix: '492', pinsPerCity: 21, petrol: 106.80, diesel: 94.60 },
  { key: 'dehradun', city: 'Dehradun', state: 'Uttarakhand', stateCode: 'UK', anchorPin: '248001', pinPrefix: '248', pinsPerCity: 21, petrol: 95.80, diesel: 88.90 },
  { key: 'amritsar', city: 'Amritsar', state: 'Punjab', stateCode: 'PB', anchorPin: '143001', pinPrefix: '143', pinsPerCity: 21, petrol: 97.20, diesel: 89.90 },
  { key: 'ludhiana', city: 'Ludhiana', state: 'Punjab', stateCode: 'PB', anchorPin: '141001', pinPrefix: '141', pinsPerCity: 21, petrol: 97.00, diesel: 89.70 },
  { key: 'agra', city: 'Agra', state: 'Uttar Pradesh', stateCode: 'UP', anchorPin: '282001', pinPrefix: '282', pinsPerCity: 21, petrol: 96.30, diesel: 89.40 },
  { key: 'varanasi', city: 'Varanasi', state: 'Uttar Pradesh', stateCode: 'UP', anchorPin: '221001', pinPrefix: '221', pinsPerCity: 21, petrol: 96.50, diesel: 89.60 },
  { key: 'noida', city: 'Noida', state: 'Uttar Pradesh', stateCode: 'UP', anchorPin: '201301', pinPrefix: '201', pinsPerCity: 21, petrol: 96.80, diesel: 89.60, cng: 73.50, png: 48.80, cgdSource: 'igl_prices' },
  { key: 'gurugram', city: 'Gurugram', state: 'Haryana', stateCode: 'HR', anchorPin: '122001', pinPrefix: '122', pinsPerCity: 21, petrol: 96.60, diesel: 89.50, cng: 73.20, png: 48.60, cgdSource: 'igl_prices' },
  { key: 'faridabad', city: 'Faridabad', state: 'Haryana', stateCode: 'HR', anchorPin: '121001', pinPrefix: '121', pinsPerCity: 21, petrol: 96.55, diesel: 89.48, cng: 73.00, png: 48.50, cgdSource: 'igl_prices' },
  { key: 'ghaziabad', city: 'Ghaziabad', state: 'Uttar Pradesh', stateCode: 'UP', anchorPin: '201001', pinPrefix: '201', pinsPerCity: 21, petrol: 96.70, diesel: 89.55, cng: 73.30, png: 48.70, cgdSource: 'igl_prices' },
  { key: 'thane', city: 'Thane', state: 'Maharashtra', stateCode: 'MH', anchorPin: '400601', pinPrefix: '400', pinsPerCity: 21, petrol: 105.90, diesel: 94.20, cng: 49.20, png: 48.40, cgdSource: 'mgl_prices' },
  { key: 'navi_mumbai', city: 'Navi Mumbai', state: 'Maharashtra', stateCode: 'MH', anchorPin: '400703', pinPrefix: '400', pinsPerCity: 21, petrol: 105.85, diesel: 94.15, cng: 49.10, png: 48.30, cgdSource: 'mgl_prices' },
  { key: 'nashik', city: 'Nashik', state: 'Maharashtra', stateCode: 'MH', anchorPin: '422001', pinPrefix: '422', pinsPerCity: 21, petrol: 105.50, diesel: 93.90 },
  { key: 'aurangabad', city: 'Aurangabad', state: 'Maharashtra', stateCode: 'MH', anchorPin: '431001', pinPrefix: '431', pinsPerCity: 21, petrol: 105.40, diesel: 93.80 },
  { key: 'mysuru', city: 'Mysuru', state: 'Karnataka', stateCode: 'KA', anchorPin: '570001', pinPrefix: '570', pinsPerCity: 21, petrol: 102.50, diesel: 88.70 },
  { key: 'mangaluru', city: 'Mangaluru', state: 'Karnataka', stateCode: 'KA', anchorPin: '575001', pinPrefix: '575', pinsPerCity: 21, petrol: 102.30, diesel: 88.50 },
  { key: 'hubballi', city: 'Hubballi', state: 'Karnataka', stateCode: 'KA', anchorPin: '580001', pinPrefix: '580', pinsPerCity: 21, petrol: 102.20, diesel: 88.40 },
  { key: 'madurai', city: 'Madurai', state: 'Tamil Nadu', stateCode: 'TN', anchorPin: '625001', pinPrefix: '625', pinsPerCity: 21, petrol: 102.10, diesel: 93.90 },
  { key: 'tiruchirappalli', city: 'Tiruchirappalli', state: 'Tamil Nadu', stateCode: 'TN', anchorPin: '620001', pinPrefix: '620', pinsPerCity: 21, petrol: 102.00, diesel: 93.80 },
  { key: 'vijayawada', city: 'Vijayawada', state: 'Andhra Pradesh', stateCode: 'AP', anchorPin: '520001', pinPrefix: '520', pinsPerCity: 21, petrol: 108.90, diesel: 97.30 },
  { key: 'warangal', city: 'Warangal', state: 'Telangana', stateCode: 'TS', anchorPin: '506001', pinPrefix: '506', pinsPerCity: 21, petrol: 109.40, diesel: 97.60 },
  { key: 'thiruvananthapuram', city: 'Thiruvananthapuram', state: 'Kerala', stateCode: 'KL', anchorPin: '695001', pinPrefix: '695', pinsPerCity: 21, petrol: 107.00, diesel: 95.10 },
  { key: 'kozhikode', city: 'Kozhikode', state: 'Kerala', stateCode: 'KL', anchorPin: '673001', pinPrefix: '673', pinsPerCity: 21, petrol: 106.90, diesel: 95.00 },
  { key: 'jodhpur', city: 'Jodhpur', state: 'Rajasthan', stateCode: 'RJ', anchorPin: '342001', pinPrefix: '342', pinsPerCity: 21, petrol: 108.20, diesel: 93.50 },
  { key: 'udaipur', city: 'Udaipur', state: 'Rajasthan', stateCode: 'RJ', anchorPin: '313001', pinPrefix: '313', pinsPerCity: 21, petrol: 108.10, diesel: 93.40 },
  { key: 'gwalior', city: 'Gwalior', state: 'Madhya Pradesh', stateCode: 'MP', anchorPin: '474001', pinPrefix: '474', pinsPerCity: 21, petrol: 108.00, diesel: 93.30 },
  { key: 'jabalpur', city: 'Jabalpur', state: 'Madhya Pradesh', stateCode: 'MP', anchorPin: '482001', pinPrefix: '482', pinsPerCity: 21, petrol: 107.90, diesel: 93.20 },
];

export function expandCityPins(city: CityAnchor): string[] {
  const base = Number(city.anchorPin);
  const pins: string[] = [];
  for (let offset = 0; offset < city.pinsPerCity; offset += 1) {
    pins.push(String(base + offset).padStart(6, '0'));
  }
  return pins;
}

export function totalPinCount(): number {
  return COVERAGE_CITIES.reduce((sum, city) => sum + expandCityPins(city).length, 0);
}