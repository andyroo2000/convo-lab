export type ReceiptTemplateId =
  | 'lawsen-24'
  | 'ab-shoe-square'
  | 'yodocam-plaza'
  | 'sakura-inn'
  | 'imperial-bay-hotel'
  | 'tokyo-property-ledger'
  | 'settlement-memo'
  | 'kizuna-bank';

export interface ReceiptTemplateDefinition {
  id: ReceiptTemplateId;
  storeName: string;
  storeKana: string;
  categoryLabel: string;
  headerLabel: string;
  itemPool: readonly string[];
}

export const RECEIPT_TEMPLATE_DEFINITIONS: Record<ReceiptTemplateId, ReceiptTemplateDefinition> = {
  'lawsen-24': {
    id: 'lawsen-24',
    storeName: 'LAWSEN 24',
    storeKana: 'ろーせん にじゅうよじかん',
    categoryLabel: 'Convenience Receipt',
    headerLabel: 'Tax Included',
    itemPool: ['Onigiri', 'Bottled Tea', 'Coffee', 'Snack', 'Toiletries'],
  },
  'ab-shoe-square': {
    id: 'ab-shoe-square',
    storeName: 'AB SHOE SQUARE',
    storeKana: 'えーびー しゅー すくえあ',
    categoryLabel: 'Footwear Receipt',
    headerLabel: 'Customer Copy',
    itemPool: ['Sneakers', 'Insoles', 'Socks Pack', 'Shoe Care Spray', 'Laces'],
  },
  'yodocam-plaza': {
    id: 'yodocam-plaza',
    storeName: 'YODOCAM PLAZA',
    storeKana: '',
    categoryLabel: 'Electronics Receipt',
    headerLabel: 'Point Eligible',
    itemPool: ['Headphones', 'Keyboard', 'SD Card', 'Portable SSD', 'Battery Pack'],
  },
  'sakura-inn': {
    id: 'sakura-inn',
    storeName: 'SAKURA INN TOKYO',
    storeKana: 'さくら いん とうきょう',
    categoryLabel: 'Hotel Invoice',
    headerLabel: 'Guest Folio',
    itemPool: ['Room Charge', 'Breakfast Set', 'Laundry Service', 'City Tax', 'Late Checkout'],
  },
  'imperial-bay-hotel': {
    id: 'imperial-bay-hotel',
    storeName: 'IMPERIAL BAY HOTEL',
    storeKana: 'いんぺりある べい ほてる',
    categoryLabel: 'Premium Invoice',
    headerLabel: 'Corporate Billing',
    itemPool: [
      'Suite Charge',
      'Conference Hall',
      'Banquet Service',
      'Transport Fee',
      'Service Charge',
    ],
  },
  'tokyo-property-ledger': {
    id: 'tokyo-property-ledger',
    storeName: 'TOKYO PROPERTY LEDGER',
    storeKana: 'とうきょう ぷろぱてぃ れじゃー',
    categoryLabel: 'Property Statement',
    headerLabel: 'Invoice Summary',
    itemPool: ['Deposit', 'Broker Fee', 'Contract Stamp', 'Insurance Plan', 'Maintenance Reserve'],
  },
  'settlement-memo': {
    id: 'settlement-memo',
    storeName: 'SETTLEMENT MEMO',
    storeKana: 'せとるめんと めも',
    categoryLabel: 'Settlement Statement',
    headerLabel: 'Transaction Memo',
    itemPool: [
      'Principal Amount',
      'Transfer Fee',
      'Advisory Fee',
      'Processing Cost',
      'Documentation Fee',
    ],
  },
  'kizuna-bank': {
    id: 'kizuna-bank',
    storeName: 'KIZUNA BANK',
    storeKana: 'きずな ばんく',
    categoryLabel: 'Bank Statement',
    headerLabel: 'Account Statement',
    itemPool: [
      'Incoming Transfer',
      'Asset Allocation',
      'Custody Fee',
      'Account Charge',
      'Management Fee',
    ],
  },
};
