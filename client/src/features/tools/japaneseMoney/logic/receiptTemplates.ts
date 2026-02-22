export type ReceiptTemplateId =
  | 'lawsen-24'
  | 'ab-shoe-square'
  | 'yodocam-plaza'
  | 'sakura-inn'
  | 'imperial-bay-hotel'
  | 'tokyo-property-ledger'
  | 'settlement-memo'
  | 'kizuna-bank';

export interface ReceiptStoreVariant {
  storeName: string;
  storeKana: string;
  itemPool: readonly string[];
}

export interface ReceiptTemplateDefinition {
  id: ReceiptTemplateId;
  categoryLabel: string;
  headerLabel: string;
  stores: readonly ReceiptStoreVariant[];
}

export const RECEIPT_TEMPLATE_DEFINITIONS: Record<ReceiptTemplateId, ReceiptTemplateDefinition> = {
  'lawsen-24': {
    id: 'lawsen-24',
    categoryLabel: 'コンビニ レシート',
    headerLabel: '税込',
    stores: [
      {
        storeName: 'LAWSEN 24',
        storeKana: 'ろーせん にじゅうよじかん',
        itemPool: ['おにぎり', 'ペットボトル茶', 'コーヒー', 'スナック菓子', '日用品'],
      },
      {
        storeName: 'FAMILY STOP',
        storeKana: 'ふぁみりー すとっぷ',
        itemPool: ['肉まん', '緑茶', 'チョコバー', 'ウェットティッシュ', 'カップスープ'],
      },
      {
        storeName: 'SEVEN MART',
        storeKana: 'せぶん まーと',
        itemPool: [
          'たまごサンド',
          'ミネラルウォーター',
          'ガム',
          'ハンドクリーム',
          '飲むヨーグルト',
        ],
      },
    ],
  },
  'ab-shoe-square': {
    id: 'ab-shoe-square',
    categoryLabel: 'お買上明細',
    headerLabel: 'お客様控え',
    stores: [
      {
        storeName: 'AB SHOE SQUARE',
        storeKana: 'えーびー しゅー すくえあ',
        itemPool: ['スニーカー', 'インソール', '靴下セット', '防水スプレー', '靴ひも'],
      },
      {
        storeName: 'STEP RUN TOKYO',
        storeKana: 'すてっぷ らん とうきょう',
        itemPool: ['ランニングシューズ', '中敷き', 'ソックス', 'シューズバッグ', '靴ひも'],
      },
      {
        storeName: 'KICKS WAREHOUSE',
        storeKana: 'きっくす うぇあはうす',
        itemPool: [
          'レザーブーツ',
          'シューケアセット',
          '靴べら',
          '防水スプレー',
          '交換用インソール',
        ],
      },
    ],
  },
  'yodocam-plaza': {
    id: 'yodocam-plaza',
    categoryLabel: '家電 レシート',
    headerLabel: 'ポイント対象',
    stores: [
      {
        storeName: 'YODOCAM PLAZA',
        storeKana: '',
        itemPool: ['ヘッドホン', 'キーボード', 'SDカード', 'ポータブルSSD', 'モバイルバッテリー'],
      },
      {
        storeName: 'BIC TECH HUB',
        storeKana: 'びっく てっく はぶ',
        itemPool: [
          'ワイヤレスイヤホン',
          'ゲーミングマウス',
          'USB-C充電器',
          '外付けSSD',
          '液晶保護フィルム',
        ],
      },
      {
        storeName: 'SAKURA DENKI',
        storeKana: 'さくら でんき',
        itemPool: ['炊飯器', '電気ケトル', '空気清浄フィルター', '単三電池セット', '延長コード'],
      },
    ],
  },
  'sakura-inn': {
    id: 'sakura-inn',
    categoryLabel: '宿泊明細',
    headerLabel: 'ご宿泊料金',
    stores: [
      {
        storeName: 'SAKURA INN TOKYO',
        storeKana: 'さくら いん とうきょう',
        itemPool: ['宿泊料金', '朝食代', 'ランドリー代', '宿泊税', 'レイトチェックアウト'],
      },
      {
        storeName: 'HARBOR VIEW HOTEL',
        storeKana: 'はーばー びゅー ほてる',
        itemPool: ['宿泊料金', '朝食ビュッフェ', 'クリーニング代', 'サービス料', '入湯税'],
      },
      {
        storeName: 'MIDTOWN BUSINESS HOTEL',
        storeKana: 'みっどたうん びじねす ほてる',
        itemPool: ['宿泊料金', '駐車料金', '客室ミニバー', 'ランドリー代', '宿泊税'],
      },
    ],
  },
  'imperial-bay-hotel': {
    id: 'imperial-bay-hotel',
    categoryLabel: '請求明細',
    headerLabel: '法人請求',
    stores: [
      {
        storeName: 'IMPERIAL BAY HOTEL',
        storeKana: 'いんぺりある べい ほてる',
        itemPool: [
          'スイート宿泊料',
          '宴会場利用料',
          'バンケットサービス料',
          '送迎サービス料',
          'サービス料',
        ],
      },
      {
        storeName: 'GRAND REGENCY TOKYO',
        storeKana: 'ぐらんど りーじぇんしー とうきょう',
        itemPool: ['特別室料金', '会議室利用料', '音響設備費', 'ケータリング費', '運営管理費'],
      },
      {
        storeName: 'ROYAL ORCHID PALACE',
        storeKana: 'ろいやる おーきっど ぱれす',
        itemPool: ['貴賓室利用料', '婚礼会場使用料', '装花費', '送迎費', 'サービス料'],
      },
    ],
  },
  'tokyo-property-ledger': {
    id: 'tokyo-property-ledger',
    categoryLabel: '不動産精算書',
    headerLabel: '請求概要',
    stores: [
      {
        storeName: 'TOKYO PROPERTY LEDGER',
        storeKana: 'とうきょう ぷろぱてぃ れじゃー',
        itemPool: ['敷金', '仲介手数料', '契約印紙代', '火災保険料', '管理費積立金'],
      },
      {
        storeName: 'METRO ESTATE PARTNERS',
        storeKana: 'めとろ えすてーと ぱーとなーず',
        itemPool: ['敷金', '礼金', '仲介手数料', '管理費', '修繕積立金'],
      },
      {
        storeName: 'URBAN CAPITAL REALTY',
        storeKana: 'あーばん きゃぴたる りあるてぃ',
        itemPool: ['保証金', '契約事務手数料', '登記関連費', '火災保険料', '共益費'],
      },
    ],
  },
  'settlement-memo': {
    id: 'settlement-memo',
    categoryLabel: '決済明細書',
    headerLabel: '取引メモ',
    stores: [
      {
        storeName: 'SETTLEMENT MEMO',
        storeKana: 'せとるめんと めも',
        itemPool: ['元本決済額', '振込手数料', 'アドバイザリー料', '事務処理費', '書類作成費'],
      },
      {
        storeName: 'STRATEGIC CLEARING DESK',
        storeKana: 'すとらてじっく くりありんぐ ですく',
        itemPool: ['受渡代金', '為替手数料', '精算手数料', '税務調整額', '監査対応費'],
      },
      {
        storeName: 'PRIME SETTLEMENT OFFICE',
        storeKana: 'ぷらいむ せとるめんと おふぃす',
        itemPool: ['決済元金', '送金手数料', '資金移動手数料', '契約書作成費', '運営費'],
      },
    ],
  },
  'kizuna-bank': {
    id: 'kizuna-bank',
    categoryLabel: '口座取引明細',
    headerLabel: '口座明細',
    stores: [
      {
        storeName: 'KIZUNA BANK',
        storeKana: 'きずな ばんく',
        itemPool: ['入金', '資産配分', '保管手数料', '口座管理料', '運用手数料'],
      },
      {
        storeName: 'SHINSEI TRUST BANK',
        storeKana: 'しんせい とらすと ばんく',
        itemPool: ['大口入金', '信託管理料', '資産運用手数料', '保管手数料', '口座維持費'],
      },
      {
        storeName: 'MIRAI CAPITAL BANK',
        storeKana: 'みらい きゃぴたる ばんく',
        itemPool: ['振込入金', '資産配分手数料', 'カストディ費用', '口座管理料', '運用報酬'],
      },
    ],
  },
};
