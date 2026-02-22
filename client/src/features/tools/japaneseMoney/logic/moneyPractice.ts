import {
  RECEIPT_TEMPLATE_DEFINITIONS,
  type ReceiptTemplateDefinition,
  type ReceiptTemplateId,
} from './receiptTemplates';

export type MoneyTierId =
  | 'lt_1k'
  | 'lt_10k'
  | 'lt_100k'
  | 'lt_1m'
  | 'lt_10m'
  | 'lt_100m'
  | 'lt_1b'
  | 'lt_10b';

export interface MoneyTier {
  id: MoneyTierId;
  label: string;
  minInclusive: number;
  maxExclusive: number;
}

export interface ReceiptLineItem {
  id: string;
  description: string;
  amount: number;
}

export interface MoneyPracticeCard {
  id: string;
  amount: number;
  tierId: MoneyTierId;
  tierLabel: string;
  templateId: ReceiptTemplateId;
  template: ReceiptTemplateDefinition;
  issuedAt: Date;
  receiptNumber: string;
  lineItems: ReceiptLineItem[];
}

export const MONEY_TIERS: MoneyTier[] = [
  { id: 'lt_1k', label: '< 1,000', minInclusive: 1, maxExclusive: 1_000 },
  { id: 'lt_10k', label: '< 10,000', minInclusive: 1_000, maxExclusive: 10_000 },
  { id: 'lt_100k', label: '< 100,000', minInclusive: 10_000, maxExclusive: 100_000 },
  { id: 'lt_1m', label: '< 1,000,000', minInclusive: 100_000, maxExclusive: 1_000_000 },
  { id: 'lt_10m', label: '< 10,000,000', minInclusive: 1_000_000, maxExclusive: 10_000_000 },
  { id: 'lt_100m', label: '< 100,000,000', minInclusive: 10_000_000, maxExclusive: 100_000_000 },
  {
    id: 'lt_1b',
    label: '< 1,000,000,000',
    minInclusive: 100_000_000,
    maxExclusive: 1_000_000_000,
  },
  {
    id: 'lt_10b',
    label: '< 10,000,000,000',
    minInclusive: 1_000_000_000,
    maxExclusive: 10_000_000_000,
  },
];

const MONEY_TIER_BY_ID = new Map<MoneyTierId, MoneyTier>(MONEY_TIERS.map((tier) => [tier.id, tier]));

const TEMPLATE_BY_TIER: Record<MoneyTierId, ReceiptTemplateId> = {
  lt_1k: 'lawsen-24',
  lt_10k: 'ab-shoe-square',
  lt_100k: 'yodocam-plaza',
  lt_1m: 'sakura-inn',
  lt_10m: 'imperial-bay-hotel',
  lt_100m: 'tokyo-property-ledger',
  lt_1b: 'settlement-memo',
  lt_10b: 'kizuna-bank',
};

export const DEFAULT_MONEY_TIER_ID: MoneyTierId = 'lt_1k';

const randomInt = (min: number, max: number): number => {
  const lower = Math.ceil(min);
  const upper = Math.floor(max);
  return Math.floor(Math.random() * (upper - lower + 1)) + lower;
};

const randomItem = <T,>(items: readonly T[]): T => items[randomInt(0, items.length - 1)];

const buildReceiptNumber = (): string => {
  const timestampPart = Date.now().toString(36).toUpperCase();
  const randomPart = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `R-${timestampPart}-${randomPart}`;
};

const splitAmount = (totalAmount: number, count: number): number[] => {
  if (count <= 1) {
    return [totalAmount];
  }

  const parts: number[] = [];
  let remaining = totalAmount;

  for (let index = 0; index < count - 1; index += 1) {
    const minimumRemaining = count - index - 1;
    const maxPart = remaining - minimumRemaining;
    const cap = Math.max(1, Math.floor(remaining * 0.72));
    const upperBound = Math.max(1, Math.min(maxPart, cap));
    const part = randomInt(1, upperBound);
    parts.push(part);
    remaining -= part;
  }

  parts.push(remaining);
  return parts;
};

const pickLineItems = (template: ReceiptTemplateDefinition, amount: number): ReceiptLineItem[] => {
  const itemCount =
    amount < 3_000 ? 1 : amount < 1_000_000 ? randomInt(2, 3) : randomInt(3, 4);

  const labels = [...template.itemPool];
  const chosenLabels: string[] = [];

  for (let index = 0; index < itemCount; index += 1) {
    if (labels.length === 0) {
      chosenLabels.push(`Line Item ${index + 1}`);
      continue;
    }

    const labelIndex = randomInt(0, labels.length - 1);
    const [label] = labels.splice(labelIndex, 1);
    chosenLabels.push(label);
  }

  const split = splitAmount(amount, itemCount).sort((left, right) => right - left);

  return chosenLabels.map((description, index) => ({
    id: `${description.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index}`,
    description,
    amount: split[index] ?? 0,
  }));
};

const createAmountFromTier = (tier: MoneyTier): number => randomInt(tier.minInclusive, tier.maxExclusive - 1);

export function sanitizeMoneyTierId(value: string | null | undefined): MoneyTierId {
  if (!value || !MONEY_TIER_BY_ID.has(value as MoneyTierId)) {
    return DEFAULT_MONEY_TIER_ID;
  }

  return value as MoneyTierId;
}

export function getMoneyTierById(tierId: MoneyTierId): MoneyTier {
  const tier = MONEY_TIER_BY_ID.get(tierId);
  if (!tier) {
    throw new Error(`Unsupported money tier id: ${tierId}`);
  }

  return tier;
}

export function createMoneyPracticeCard(tierId: MoneyTierId = DEFAULT_MONEY_TIER_ID): MoneyPracticeCard {
  const tier = getMoneyTierById(tierId);
  const amount = createAmountFromTier(tier);
  const templateId = TEMPLATE_BY_TIER[tierId];
  const template = RECEIPT_TEMPLATE_DEFINITIONS[templateId];

  if (!template) {
    throw new Error(`Missing receipt template for tier id: ${tierId}`);
  }

  const issuedAt = new Date(Date.now() - randomInt(0, 20 * 24 * 60 * 60 * 1000));
  const lineItems = pickLineItems(template, amount);

  return {
    id: `${tierId}:${amount}:${Math.random().toString(36).slice(2, 8)}`,
    amount,
    tierId,
    tierLabel: tier.label,
    templateId,
    template,
    issuedAt,
    receiptNumber: buildReceiptNumber(),
    lineItems,
  };
}

export function getNextRandomCardFromTier(tierId: MoneyTierId): MoneyPracticeCard {
  return createMoneyPracticeCard(tierId);
}

export function randomizeTier(): MoneyTier {
  return randomItem(MONEY_TIERS);
}
