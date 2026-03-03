import axios from 'axios';

interface CbrRate {
  usdRate: number;
  updateTime: string;
}

export async function getCbrUsdRate(): Promise<CbrRate | null> {
  try {
    const response = await axios.get('https://www.cbr-xml-daily.ru/daily_json.js');
    const usdRate = Math.round(response.data.Valute.USD.Value * 1.06 * 100) / 100;
    const updateTime = new Date(response.data.Date).toLocaleString('ru-RU');
    return { usdRate, updateTime };
  } catch (error) {
    console.error('Ошибка курса ЦБ:', error);
    return null;
  }
}

export function rubToUsd(amount: number, usdRate: number): number {
  return Math.round((amount / usdRate) * 100) / 100;
}
