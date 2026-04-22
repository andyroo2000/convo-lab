ALTER TABLE "study_cards"
ADD CONSTRAINT "study_cards_card_type_check"
CHECK (
  "card_type" IN (
    'recognition',
    'production',
    'cloze'
  )
);
