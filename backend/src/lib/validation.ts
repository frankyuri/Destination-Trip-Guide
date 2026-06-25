import { AppError } from '../middleware/errorHandler';

export const asRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AppError('請求內容格式錯誤', 400);
  }
  return value as Record<string, unknown>;
};

export const requireString = (value: unknown, field: string, maxLength = 200): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AppError(`${field} 為必填`, 400);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) throw new AppError(`${field} 長度不可超過 ${maxLength}`, 400);
  return normalized;
};

export const optionalString = (value: unknown, field: string, maxLength = 5000): string | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return '';
  if (typeof value !== 'string') throw new AppError(`${field} 必須是字串`, 400);
  if (value.length > maxLength) throw new AppError(`${field} 長度不可超過 ${maxLength}`, 400);
  return value.trim();
};

export const requireBoolean = (value: unknown, field: string): boolean => {
  if (typeof value !== 'boolean') throw new AppError(`${field} 必須是布林值`, 400);
  return value;
};

export const requireFiniteNumber = (value: unknown, field: string, min: number, max: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new AppError(`${field} 格式錯誤`, 400);
  }
  return value;
};

export const requireArray = (value: unknown, field: string, maxLength = 100): unknown[] => {
  if (!Array.isArray(value)) throw new AppError(`${field} 必須為陣列`, 400);
  if (value.length > maxLength) throw new AppError(`${field} 最多 ${maxLength} 筆`, 400);
  return value;
};

export const requireIsoDate = (value: unknown, field: string): Date => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError(`${field} 必須為 YYYY-MM-DD`, 400);
  }
  const result = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(result.getTime())) throw new AppError(`${field} 日期無效`, 400);
  return result;
};