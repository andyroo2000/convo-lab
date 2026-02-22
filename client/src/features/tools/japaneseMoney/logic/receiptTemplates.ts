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
    categoryLabel: 'コンビニ レシート',
    headerLabel: '税込',
    itemPool: ['おにぎり', 'ペットボトル茶', 'コーヒー', 'スナック菓子', '日用品'],
  },
  'ab-shoe-square': {
    id: 'ab-shoe-square',
    storeName: 'AB SHOE SQUARE',
    storeKana: 'えーびー しゅー すくえあ',
    categoryLabel: 'お買上明細',
    headerLabel: 'お客様控え',
    itemPool: ['スニーカー', 'インソール', '靴下セット', '防水スプレー', '靴ひも'],
  },
  'yodocam-plaza': {
    id: 'yodocam-plaza',
    storeName: 'YODOCAM PLAZA',
    storeKana: '',
    categoryLabel: '家電 レシート',
    headerLabel: 'ポイント対象',
    itemPool: ['ヘッドホン', 'キーボード', 'SDカード', 'ポータブルSSD', 'モバイルバッテリー'],
  },
  'sakura-inn': {
    id: 'sakura-inn',
    storeName: 'SAKURA INN TOKYO',
    storeKana: 'さくら いん とうきょう',
    categoryLabel: '宿泊明細',
    headerLabel: 'ご宿泊料金',
    itemPool: ['室料', '朝食代', 'ランドリー代', '宿泊税', 'レイトチェックアウト'],
  },
  'imperial-bay-hotel': {
    id: 'imperial-bay-hotel',
    storeName: 'IMPERIAL BAY HOTEL',
    storeKana: 'いんぺりある べい ほてる',
    categoryLabel: '請求明細',
    headerLabel: '法人請求',
    itemPool: ['スイートルーム料', '宴会場利用料', 'バンケットサービス料', '送迎料', 'サービス料'],
  },
  'tokyo-property-ledger': {
    id: 'tokyo-property-ledger',
    storeName: 'TOKYO PROPERTY LEDGER',
    storeKana: 'とうきょう ぷろぱてぃ れじゃー',
    categoryLabel: '不動産精算書',
    headerLabel: '請求概要',
    itemPool: ['敷金', '仲介手数料', '契約印紙代', '火災保険料', '管理費積立金'],
  },
  'settlement-memo': {
    id: 'settlement-memo',
    storeName: 'SETTLEMENT MEMO',
    storeKana: 'せとるめんと めも',
    categoryLabel: '決済明細書',
    headerLabel: '取引メモ',
    itemPool: ['元金', '振込手数料', 'アドバイザリー料', '事務処理費', '書類作成費'],
  },
  'kizuna-bank': {
    id: 'kizuna-bank',
    storeName: 'KIZUNA BANK',
    storeKana: 'きずな ばんく',
    categoryLabel: '口座取引明細',
    headerLabel: '口座明細',
    itemPool: ['入金', '資産配分', '保管手数料', '口座管理料', '運用手数料'],
  },
};
