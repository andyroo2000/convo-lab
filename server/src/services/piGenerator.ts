import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export type JLPTLevel = 'N5' | 'N4' | 'N3' | 'N2';

// Grammar point types across all JLPT levels
export type GrammarPointType =
  // N5
  | 'ha_vs_ga' // は vs が: Topic vs subject; basic identification & actor role
  | 'ni_vs_de' // に vs で: Location of existence vs location of action
  | 'wo_vs_ga' // を vs が: Object vs subject in trans/intrans alternations
  | 'e_vs_ni' // へ vs に: Destination nuance
  | 'mada_vs_mou' // まだ vs もう: Not yet vs already
  // N4
  | 'kara_vs_node' // 〜から vs 〜ので: Reason because vs explanatory because
  | 'ni_vs_to' // に vs と: Indirect object vs accompaniment vs quotation
  | 'teiru_aspect' // 〜ている: State vs ongoing action
  | 'to_vs_tari' // と vs たり: Complete list vs non-exhaustive list
  | 'ha_vs_mo' // は vs も: Contrastive topic vs inclusion
  // N3
  | 'passive_vs_active' // Passive vs Active: Agent vs receiver role
  | 'garu_vs_tai' // がる vs たい: "Seems to feel" vs "I want"
  | 'koto_ni_naru_vs_suru' // 〜ことになる vs 〜ことにする: External vs personal decision
  | 'conditional_types' // と vs ば vs たら: Conditional nuances
  | 'zu_ni_vs_nai_de' // ずに vs ないで: Without doing nuance
  // N2
  | 'discourse_ha_vs_ga' // は vs が at discourse level: Contrastive vs new information
  | 'wake_vs_hazu_vs_chigainai' // 〜わけだ vs 〜はずだ vs 〜に違いない: Logical conclusion nuances
  | 'causative_types' // Causative vs Causative-passive: Who causes vs who suffers
  | 'you_ni_vs_tame_ni' // 〜ように vs 〜ために: Purpose vs goal/achievement
  | 'koto_da_vs_mono_da'; // 〜ことだ vs 〜ものだ: Advice vs reminiscence

// Legacy task type (kept for backward compatibility with existing display logic)
export type PITaskType = 'who_did_it' | 'topic_vs_subject' | 'meaning_match';

export interface PIItem {
  type: PITaskType;
  question: string;
  contextSentence?: string; // Optional setup sentence to establish context
  japaneseSentence: string;
  audioText: string; // Same as japaneseSentence, or minimal pair for Type C
  choices: {
    id: string;
    text: string;
    isCorrect: boolean;
  }[];
  explanation: string;
  sentencePair?: {
    sentenceA: string;
    sentenceB: string;
  }; // For Type C only
}

export interface PISession {
  items: PIItem[];
  jlptLevel: JLPTLevel;
  grammarPoint: GrammarPointType;
}

// Grammar point metadata for UI and validation
export interface GrammarPointMetadata {
  id: GrammarPointType;
  name: string;
  level: JLPTLevel;
  category: 'particles' | 'aspect' | 'conditionals' | 'conjunctions' | 'voice' | 'modality';
  description: string;
}

export const GRAMMAR_POINTS: Record<GrammarPointType, GrammarPointMetadata> = {
  // N5
  ha_vs_ga: {
    id: 'ha_vs_ga',
    name: 'は vs が',
    level: 'N5',
    category: 'particles',
    description: 'Topic vs subject; basic identification & actor role',
  },
  ni_vs_de: {
    id: 'ni_vs_de',
    name: 'に vs で',
    level: 'N5',
    category: 'particles',
    description: 'Location of existence vs location of action',
  },
  wo_vs_ga: {
    id: 'wo_vs_ga',
    name: 'を vs が',
    level: 'N5',
    category: 'particles',
    description: 'Object vs subject in transitive/intransitive alternations',
  },
  e_vs_ni: {
    id: 'e_vs_ni',
    name: 'へ vs に',
    level: 'N5',
    category: 'particles',
    description: 'Destination nuance',
  },
  mada_vs_mou: {
    id: 'mada_vs_mou',
    name: 'まだ vs もう',
    level: 'N5',
    category: 'aspect',
    description: 'Not yet vs already',
  },
  // N4
  kara_vs_node: {
    id: 'kara_vs_node',
    name: '〜から vs 〜ので',
    level: 'N4',
    category: 'conjunctions',
    description: 'Reason because vs explanatory because',
  },
  ni_vs_to: {
    id: 'ni_vs_to',
    name: 'に vs と',
    level: 'N4',
    category: 'particles',
    description: 'Indirect object vs accompaniment vs quotation',
  },
  teiru_aspect: {
    id: 'teiru_aspect',
    name: '〜ている',
    level: 'N4',
    category: 'aspect',
    description: 'State vs ongoing action',
  },
  to_vs_tari: {
    id: 'to_vs_tari',
    name: 'と vs たり',
    level: 'N4',
    category: 'conjunctions',
    description: 'Complete list vs non-exhaustive list',
  },
  ha_vs_mo: {
    id: 'ha_vs_mo',
    name: 'は vs も',
    level: 'N4',
    category: 'particles',
    description: 'Contrastive topic vs inclusion',
  },
  // N3
  passive_vs_active: {
    id: 'passive_vs_active',
    name: 'Passive vs Active',
    level: 'N3',
    category: 'voice',
    description: 'Agent vs receiver role',
  },
  garu_vs_tai: {
    id: 'garu_vs_tai',
    name: 'がる vs たい',
    level: 'N3',
    category: 'modality',
    description: 'Seems to feel vs I want',
  },
  koto_ni_naru_vs_suru: {
    id: 'koto_ni_naru_vs_suru',
    name: '〜ことになる vs 〜ことにする',
    level: 'N3',
    category: 'modality',
    description: 'External decision vs personal decision',
  },
  conditional_types: {
    id: 'conditional_types',
    name: 'と vs ば vs たら',
    level: 'N3',
    category: 'conditionals',
    description: 'Conditional nuances',
  },
  zu_ni_vs_nai_de: {
    id: 'zu_ni_vs_nai_de',
    name: 'ずに vs ないで',
    level: 'N3',
    category: 'conjunctions',
    description: 'Without doing nuance',
  },
  // N2
  discourse_ha_vs_ga: {
    id: 'discourse_ha_vs_ga',
    name: 'は vs が (discourse)',
    level: 'N2',
    category: 'particles',
    description: 'Contrastive vs new information at discourse level',
  },
  wake_vs_hazu_vs_chigainai: {
    id: 'wake_vs_hazu_vs_chigainai',
    name: '〜わけだ vs 〜はずだ vs 〜に違いない',
    level: 'N2',
    category: 'modality',
    description: 'Logical conclusion nuances',
  },
  causative_types: {
    id: 'causative_types',
    name: 'Causative vs Causative-passive',
    level: 'N2',
    category: 'voice',
    description: 'Who causes vs who suffers',
  },
  you_ni_vs_tame_ni: {
    id: 'you_ni_vs_tame_ni',
    name: '〜ように vs 〜ために',
    level: 'N2',
    category: 'modality',
    description: 'Purpose vs goal/achievement',
  },
  koto_da_vs_mono_da: {
    id: 'koto_da_vs_mono_da',
    name: '〜ことだ vs 〜ものだ',
    level: 'N2',
    category: 'modality',
    description: 'Advice vs reminiscence',
  },
};

/**
 * Generate a PI session with meaning-based tasks targeting a specific grammar point
 */
export async function generatePISession(
  jlptLevel: JLPTLevel,
  itemCount: number,
  grammarPoint: GrammarPointType
): Promise<PISession> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    generationConfig: {
      temperature: 0.9,
      responseMimeType: 'application/json',
    },
  });

  const prompt = buildPIPrompt(jlptLevel, itemCount, grammarPoint);

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const data = JSON.parse(responseText);

    return {
      items: data.items,
      jlptLevel,
      grammarPoint,
    };
  } catch (error: any) {
    console.error('Error generating PI session:', error);
    throw new Error(`Failed to generate PI session: ${error.message}`);
  }
}

function buildPIPrompt(
  jlptLevel: JLPTLevel,
  itemCount: number,
  grammarPoint: GrammarPointType
): string {
  const vocabularyConstraints = getVocabularyConstraints(jlptLevel);
  const grammarGuidance = getGrammarPointGuidance(grammarPoint, jlptLevel);
  const grammarMetadata = GRAMMAR_POINTS[grammarPoint];

  return `You are a Japanese language learning expert specializing in Processing Instruction (PI) methodology.

Generate ${itemCount} PI items that help learners process the "${grammarMetadata.name}" distinction through meaning-based comprehension tasks.

TARGET GRAMMAR POINT: ${grammarMetadata.name} (${grammarMetadata.description})
TARGET AUDIENCE: ${jlptLevel} level learners

CRITICAL PI PRINCIPLES:
1. Every task MUST be meaning-based - learners succeed only by processing the particle correctly
2. NEVER ask "which particle?" - always ask about meaning/interpretation
3. Remove shortcut strategies - don't let word order or context give away the answer
4. Make the particle choice ESSENTIAL to understanding
5. MANDATORY: The Japanese sentence MUST contain at least TWO plausible nouns (two people, OR two objects, OR two locations)
6. Context sentences must NEVER bias the answer or make one choice more likely than the other
7. ABSOLUTE REQUIREMENT: The main Japanese sentence MUST contain ALL competing referents from the answer choices
   - If choices are Tanaka and Suzuki, BOTH 田中さん AND 鈴木さん MUST appear in japaneseSentence
   - Do NOT rely on contextSentence to introduce competing nouns
   - The learner must be able to answer using ONLY the main sentence (context is just setup)

${vocabularyConstraints}

GRAMMAR-SPECIFIC GUIDANCE:
${grammarGuidance}

OUTPUT FORMAT:
{
  "items": [
    {
      "type": "who_did_it" | "topic_vs_subject" | "meaning_match",
      "question": "English question focusing on meaning",
      "contextSentence": "OPTIONAL: Neutral setup sentence that establishes all people/objects. Must NOT bias the answer. Good: 田中さんと鈴木さんが公園にいます。Bad: 田中さんはおなかがすいています。",
      "japaneseSentence": "The main Japanese sentence with the particle being tested",
      "audioText": "Same as japaneseSentence (or sentenceA for meaning_match)",
      "choices": [
        {"id": "a", "text": "Choice text in English", "isCorrect": true},
        {"id": "b", "text": "Another choice", "isCorrect": false}
      ],
      "explanation": "Short explanation (2-3 sentences) focusing on how は or が creates the meaning difference",
      "sentencePair": { // ONLY for meaning_match type
        "sentenceA": "Sentence with one particle",
        "sentenceB": "Minimal pair with other particle"
      }
    }
  ]
}

REQUIREMENTS:
- Mix task types roughly evenly
- Use varied vocabulary within ${jlptLevel} constraints
- Ensure distractors are plausible but clearly wrong if particle is processed
- Keep sentences short enough for audio comprehension
- All Japanese text should be in standard Japanese characters (not romaji)
- Explanations should teach, not just say "correct/incorrect"
- Use contrastive structures that make BOTH nouns equally plausible:
  • XはAしたが、YがBした
  • XはAですが、AしたのがYです
  • Xは〜だけど、〜したのがYです
  • XはYです vs YがXです
- **CRITICAL**: RANDOMIZE the order of correct answers across items
  • Approximately half should have the correct answer as choice "a"
  • Approximately half should have the correct answer as choice "b"
  • DO NOT make all correct answers the first choice
  • DO NOT create a predictable pattern

QUALITY CONTROL - REJECT ANY ITEM THAT:
1. Asks "Who did X?" when only ONE person is in the sentence or context
2. Asks "What does X like/want?" when only ONE object is in the sentence or context
3. Has answer choices that aren't mentioned in the MAIN Japanese sentence (japaneseSentence field)
4. Could be answered correctly without processing the particle (e.g., by elimination or common sense)
5. Has ambiguous or confusing answer choices
6. Uses vocabulary beyond the specified JLPT level
7. For WHO_DID_IT: Has the actor only in the context sentence but NOT in the main Japanese sentence with が
8. Has a context sentence that BIASES the answer (e.g., "田中さんはおなかがすいています" makes Tanaka more likely to eat)
9. Has only ONE plausible noun/actor in the sentence (MUST have at least TWO competing referents)
10. Uses distractors that are nonsensical or not equally plausible as the correct answer
11. CRITICAL: Has a distractor (wrong answer choice) that is NOT mentioned in the main Japanese sentence

BEFORE GENERATING: For each item, verify:
✓ The main Japanese sentence contains at least TWO plausible nouns/actors that are competitors
✓ ALL answer choices (correct AND incorrect) are explicitly mentioned in the MAIN Japanese sentence
✓ The distractor is NOT only in the context - it MUST be in the main sentence
✓ For WHO_DID_IT: The person who did the action appears in the MAIN sentence with が
✓ Context does NOT bias toward one answer (both options remain equally plausible)
✓ You cannot eliminate wrong answers without processing the particle
✓ BOTH answer choices are equally plausible based on the sentence structure
✓ The particle is doing meaningful semantic work in the sentence
✓ If you removed the context sentence entirely, you could still answer the question using only the main sentence

AFTER GENERATING ALL ITEMS: Verify answer distribution:
✓ Count how many items have "a" as correct answer vs "b" as correct answer
✓ If all or most correct answers are in the same position, SHUFFLE them to achieve ~50/50 distribution
✓ This prevents learners from gaming the system by always choosing the first or second option

Generate exactly ${itemCount} items now.`;
}

/**
 * Get grammar-specific guidance for building PI items
 */
function getGrammarPointGuidance(grammarPoint: GrammarPointType, jlptLevel: JLPTLevel): string {
  switch (grammarPoint) {
    // === N5 GRAMMAR POINTS ===
    case 'ha_vs_ga':
      return `${getTaskTypeGuidance(jlptLevel)}\n\n${getMinimalPairExamples(jlptLevel)}`;

    case 'ni_vs_de':
      return `CONTRAST TO TEST: に (location of existence) vs で (location of action)

TARGET MEANINGS:
- に: "where something/someone IS" (static location)
- で: "where an ACTION happens" (location of activity)

REQUIRED STRUCTURE:
- Main sentence must contain TWO people/things doing different activities
- Example: 「田中さんは図書館にいますが、鈴木さんは図書館で勉強します。」
- Both locations AND both actors must be in the main sentence

MINIMAL PAIR EXAMPLES:
✅ GOOD: 「田中さんは公園にいますが、鈴木さんは公園で遊びます。」
   Question: "Where is Tanaka?" → In the park (に marks existence)
   Question: "Where is Suzuki playing?" → In the park (で marks location of action)

❌ BAD: 「田中さんは図書館にいます。」(Only one person/activity)
❌ BAD: Asking "Where is X?" when only one location mentioned

TASK TYPES:
1. Question: "Where is [Person]?" (testing に for existence)
2. Question: "Where is [Person] doing [action]?" (testing で for activity location)

CRITICAL RULES:
- Both に and で contexts must appear in the same sentence
- Must include two people OR same person doing two different things
- Location must be explicitly stated for both contexts`;

    case 'wo_vs_ga':
      return `CONTRAST TO TEST: を (transitive object marker) vs が (intransitive subject marker)

TARGET MEANINGS:
- を: Someone does an action TO an object (transitive)
- が: Something changes state by itself (intransitive)

REQUIRED STRUCTURE:
- Sentence pairs showing transitive/intransitive verb alternations
- Example: 「田中さんがドアを開けましたが、窓が開きました。」
- Both the door AND the window must be in the main sentence

MINIMAL PAIR EXAMPLES:
✅ GOOD: 「田中さんがドアを開けましたが、窓が開きました。」
   Question: "What did Tanaka open?" → The door (を marks object of action)
   Question: "What opened by itself?" → The window (が marks subject of change)

COMMON TRANSITIVE/INTRANSITIVE PAIRS:
- 開ける/開く (open something / something opens)
- 閉める/閉まる (close something / something closes)
- 始める/始まる (start something / something starts)
- 止める/止まる (stop something / something stops)
- 壊す/壊れる (break something / something breaks)

TASK TYPES:
1. Question: "What did [Person] do?" (testing を for direct object)
2. Question: "What happened by itself?" (testing が for intransitive subject)`;

    case 'e_vs_ni':
      return `CONTRAST TO TEST: へ (general direction) vs に (specific destination/arrival)

TARGET MEANINGS:
- へ: General direction toward something
- に: Specific arrival point or destination

REQUIRED STRUCTURE:
- Sentence with two people going to different places or same person with nuanced difference
- Example: 「田中さんは学校へ行きますが、鈴木さんは学校に行きます。」
- Both people and both destinations must be in the main sentence

MINIMAL PAIR EXAMPLES:
✅ GOOD: 「田中さんは東京へ行きますが、鈴木さんは大阪に行きます。」
   (Both destinations mentioned, subtle nuance difference)

NOTE: This is a subtle distinction. Focus on:
- へ: Directional movement (may not arrive)
- に: Destination focus (implies arrival)`;

    case 'mada_vs_mou':
      return `CONTRAST TO TEST: まだ (not yet/still) vs もう (already)

TARGET MEANINGS:
- まだ: Action not completed yet OR state continues
- もう: Action already completed

REQUIRED STRUCTURE:
- Two people in different states of completion
- Example: 「田中さんはまだ食べていませんが、鈴木さんはもう食べました。」
- Both people must be in the main sentence

MINIMAL PAIR EXAMPLES:
✅ GOOD: 「田中さんはまだ宿題をしていませんが、鈴木さんはもう宿題をしました。」
   Question: "Who finished homework?" → Suzuki (もう indicates completion)
   Question: "Who hasn't finished?" → Tanaka (まだ indicates non-completion)

TASK TYPES:
1. Question: "Who has already done [action]?"
2. Question: "Who hasn't done [action] yet?"`;

    // === N4 GRAMMAR POINTS ===
    case 'kara_vs_node':
      return `CONTRAST TO TEST: 〜から (direct reason) vs 〜ので (explanatory reason)

TARGET MEANINGS:
- から: Direct, subjective cause/reason
- ので: Explanatory, objective reason

REQUIRED STRUCTURE:
- Two people with different reasons for same outcome OR different actions
- Example: 「田中さんは雨だから行きませんが、鈴木さんは忙しいので行きません。」
- Both people and both reasons must be in the main sentence

NOTE: Focus on the semantic difference in how the reason is presented`;

    case 'ni_vs_to':
      return `CONTRAST TO TEST: に (indirect object/destination) vs と (accompaniment/quotation)

TARGET MEANINGS:
- に: "to someone" (indirect object)
- と: "with someone" (accompaniment) OR quotation marker

REQUIRED STRUCTURE:
- Two people interacting differently
- Example: 「田中さんに言いましたが、鈴木さんと話しました。」
- Both people must be in the main sentence

MINIMAL PAIR EXAMPLES:
✅ GOOD: 「田中さんに会いましたが、鈴木さんと会いました。」
   Question: "Who did you meet?" → Tanaka (に = met with)
   Question: "Who did you meet together with?" → Suzuki (と = accompanied by)`;

    case 'teiru_aspect':
      return `CONTRAST TO TEST: 〜ている (result state vs progressive action)

TARGET MEANINGS:
- ている as result state: The result of a past action continues
- ている as progressive: An ongoing action

REQUIRED STRUCTURE:
- Two people/things in different aspectual states
- Example: 「ドアが開いていますが、田中さんがドアを開けています。」
- Both subjects must be in the main sentence

MINIMAL PAIR EXAMPLES:
✅ GOOD: 「窓が開いていますが、田中さんが窓を開けています。」
   Question: "What is in an open state?" → The window (result state)
   Question: "Who is opening something?" → Tanaka (progressive)`;

    case 'to_vs_tari':
      return `CONTRAST TO TEST: と (complete/exhaustive list) vs たり〜たり (non-exhaustive examples)

TARGET MEANINGS:
- と: Lists all items completely
- たり: Gives representative examples (among other things)

REQUIRED STRUCTURE:
- Two people with different list types
- Example: 「田中さんはパンとコーヒーを買いましたが、鈴木さんはパンを食べたりコーヒーを飲んだりしました。」`;

    case 'ha_vs_mo':
      return `CONTRAST TO TEST: は (contrastive topic) vs も (inclusion/addition)

TARGET MEANINGS:
- は: Contrastive topic (but not others)
- も: Also, inclusion (in addition to others)

REQUIRED STRUCTURE:
- Two people with different preferences/states
- Example: 「田中さんは寿司が好きですが、鈴木さんも寿司が好きです。」
- Both people must be in the main sentence`;

    // === N3 GRAMMAR POINTS ===
    case 'passive_vs_active':
      return `CONTRAST TO TEST: Passive (receiver focus) vs Active (actor focus)

TARGET MEANINGS:
- Passive: Focus on who experienced the action
- Active: Focus on who performed the action

REQUIRED STRUCTURE:
- Same event described from different perspectives
- Example: 「田中さんが鈴木さんに褒められましたが、山田さんが森さんを褒めました。」
- All people must be in the main sentence

MINIMAL PAIR EXAMPLES:
✅ GOOD: 「田中さんが鈴木さんに褒められましたが、山本さんが森さんを褒めました。」
   Question: "Who received praise?" → Tanaka (passive = receiver)
   Question: "Who gave praise?" → Yamamoto (active = agent)`;

    case 'garu_vs_tai':
      return `CONTRAST TO TEST: 〜がる (observed desire) vs 〜たい (self desire)

TARGET MEANINGS:
- がる: Someone seems to want (third person, observed)
- たい: I want (first person desire)

REQUIRED STRUCTURE:
- Two people with desires expressed differently
- Example: 「田中さんは行きたがっていますが、私は行きたいです。」
- Both people must be in the main sentence`;

    case 'koto_ni_naru_vs_suru':
      return `CONTRAST TO TEST: 〜ことになる (external decision) vs 〜ことにする (personal decision)

TARGET MEANINGS:
- ことになる: It has been decided (by circumstances/others)
- ことにする: I/we decided (personal choice)

REQUIRED STRUCTURE:
- Two people with different decision types
- Example: 「田中さんは留学することになりましたが、鈴木さんは留学することにしました。」
- Both people must be in the main sentence`;

    case 'conditional_types':
      return `CONTRAST TO TEST: と (factual) vs ば (conditional) vs たら (temporal/hypothetical)

TARGET MEANINGS:
- と: Whenever/natural consequence
- ば: If (hypothetical condition)
- たら: When/if (temporal or conditional)

REQUIRED STRUCTURE:
- Two people with different conditional situations
- Example: 「春になると桜が咲きますが、春になれば暖かいです。」
- Both conditions must be in the main sentence`;

    case 'zu_ni_vs_nai_de':
      return `CONTRAST TO TEST: ずに (manner - without doing) vs ないで (circumstance - don't do)

TARGET MEANINGS:
- ずに: Without doing (manner of doing something else)
- ないで: Don't do / without doing (circumstance)

REQUIRED STRUCTURE:
- Two people doing things differently
- Example: 「田中さんは食べずに寝ましたが、鈴木さんは食べないで待っています。」
- Both people must be in the main sentence`;

    // === N2 GRAMMAR POINTS ===
    case 'discourse_ha_vs_ga':
      return `CONTRAST TO TEST: は vs が at discourse level

TARGET MEANINGS:
- は: Topic/contrastive (continuing previous topic)
- が: New information/event focus

REQUIRED STRUCTURE:
- Discourse-level contrast with both は and が
- Example: 「会議は明日ですが、決定があるのが今日です。」
- Both referents must be in the main sentence

NOTE: This is more advanced than basic は vs が, focusing on information structure`;

    case 'wake_vs_hazu_vs_chigainai':
      return `CONTRAST TO TEST: 〜わけだ vs 〜はずだ vs 〜に違いない

TARGET MEANINGS:
- わけだ: Logical conclusion (that's why/no wonder)
- はずだ: Expectation (should be/must be)
- に違いない: Conviction (must be/certainly)

REQUIRED STRUCTURE:
- Two people making different types of conclusions
- Example: 「田中さんが遅れるわけですが、鈴木さんが来るはずです。」
- Both people must be in the main sentence`;

    case 'causative_types':
      return `CONTRAST TO TEST: Causative vs Causative-passive

TARGET MEANINGS:
- Causative: Who causes someone to do something
- Causative-passive: Who is made to do something (suffers)

REQUIRED STRUCTURE:
- Two people in different causative roles
- Example: 「田中さんが鈴木さんに食べさせましたが、山田さんが森さんに食べさせられました。」
- All people must be in the main sentence`;

    case 'you_ni_vs_tame_ni':
      return `CONTRAST TO TEST: 〜ように (purpose) vs 〜ために (goal/achievement)

TARGET MEANINGS:
- ように: So that, in order to (general purpose, often uncontrollable)
- ために: For the purpose of (specific goal with agent control)

REQUIRED STRUCTURE:
- Two people with different purpose expressions
- Example: 「田中さんは合格するように勉強しますが、鈴木さんは合格するために勉強します。」
- Both people must be in the main sentence`;

    case 'koto_da_vs_mono_da':
      return `CONTRAST TO TEST: 〜ことだ (advice) vs 〜ものだ (reminiscence/general truth)

TARGET MEANINGS:
- ことだ: Advice, what one should do
- ものだ: Reminiscence or general truth about how things are

REQUIRED STRUCTURE:
- Two people giving different types of statements
- Example: 「早く寝ることですが、昔はよく遊んだものです。」
- Both clauses must be in the main sentence`;

    default:
      // Fallback to basic は vs が guidance
      return `${getTaskTypeGuidance(jlptLevel)}\n\n${getMinimalPairExamples(jlptLevel)}`;
  }
}

function getVocabularyConstraints(jlptLevel: JLPTLevel): string {
  const constraints = {
    N5: `VOCABULARY CONSTRAINTS:
- Use only very basic, concrete vocabulary
- Verbs: 来る, 行く, 食べる, 飲む, 読む, 寝る, 見る, する, etc.
- Nouns: Family members (母, 父, etc.), common people (先生, 学生, 友だち), animals (犬, 猫), basic objects (本, ケーキ, お茶)
- NO relative clauses or subordinate clauses
- Sentences should be 1 clause, very simple structure`,

    N4: `VOCABULARY CONSTRAINTS:
- Use N5 + N4 vocabulary
- Can include simple relative clauses (e.g., 本を読んでいる人)
- Verbs: Add ～ている, ～た forms, basic て-form connections
- Slightly longer sentences (max 2 clauses) are OK
- Keep complexity moderate - focus on the particle contrast`,

    N3: `VOCABULARY CONSTRAINTS:
- Use N5/N4/N3 vocabulary
- Can include one relative clause or simple contrastive structure
- Allow for slightly more nuanced contexts
- BUT keep sentences short enough for clear audio comprehension
- The particle contrast should still be the PRIMARY signal`,

    N2: `VOCABULARY CONSTRAINTS:
- Use N5/N4/N3/N2 vocabulary
- Can include complex clauses and discourse markers
- Allow for abstract concepts and nuanced expressions
- Maintain clarity for audio comprehension
- Focus on discourse-level and pragmatic contrasts`,
  };

  return constraints[jlptLevel];
}

function getTaskTypeGuidance(jlptLevel: JLPTLevel): string {
  return `1. WHO_DID_IT (Actor Identification):
   - CRITICAL: The MAIN SENTENCE must have が marking which person did the action
   - The person marked by が MUST appear in the main Japanese sentence
   - Other people can be established in the context sentence
   - Question: "Who did X?" (where X is an action that only ONE person did)
   - 2-3 choices naming different people who are ALL mentioned somewhere (context or main sentence)

   - BAD Example (AVOID):
     * Context: Tanaka and Suzuki went to the park
     * Main Sentence: 「遊びました。」(no subject)
     * Question: "Who played?"
     * WHY BAD: Main sentence doesn't have が marking who did it

   - GOOD Example:
     * Context: 「田中さんと鈴木さんが公園にいます。」
     * Main Sentence: 「田中さんが遊びました。」
     * Question: "Who played?"
     * Choices: A) Tanaka, B) Suzuki
     * Correct: A
     * Explanation: "が marks Tanaka as the one who played, not Suzuki"

2. TOPIC_VS_SUBJECT (Topic vs Identification):
   - Question: "What is this sentence about?" or "Which interpretation fits?"
   - Sentence using XはYです pattern
   - Choices describe different interpretations (topic-comment vs identification)
   - The contrast must be CLEAR and meaningful
   - Example:
     * Sentence: 「田中さんは学生です。」
     * Choices:
       A) "This is talking about Tanaka, saying he is a student"
       B) "Among several people, this identifies which one is the student"
     * Correct: A
     * Explanation: "は sets up Tanaka as the topic. We're describing Tanaka (he's a student)"

3. MEANING_MATCH (Form→Meaning):
   - Question: "Which sentence means: [specific meaning]?"
   - Present TWO sentences (A and B) that differ ONLY in は vs が
   - The meaning difference must be clear and testable
   - Example:
     * Question: "Which sentence means: 'It's Tanaka (not someone else) who came'?"
     * Sentence A: 「田中さんは来ました。」
     * Sentence B: 「田中さんが来ました。」
     * Correct: B
     * Explanation: "が emphasizes that TANAKA is the one who came, implying others didn't"

CRITICAL RULES FOR ALL TASKS:
- WHO questions: If asking "Who did X?", ALL people in the answer choices MUST be mentioned in the MAIN Japanese sentence
- WHAT questions: If asking "What does X like/want?", ALL objects in the answer choices MUST be mentioned in the MAIN Japanese sentence
- The particle must be the ONLY way to determine the correct answer
- Don't create scenarios where both answers could be correct
- NEVER include answer choices that aren't in the MAIN Japanese sentence (not just context)
- Make sure distractors are plausible based on the sentence structure
- Context sentences are optional setup only - the main sentence must be self-contained

INVALID EXAMPLES TO AVOID:
❌ Sentence: 「田中さんは犬が好きです。」Question: "What does Tanaka like?" Choices: Dogs/Cats
   Why invalid: Only dogs are mentioned in the sentence, so the answer is obvious without processing particles

✅ VALID: Sentence: 「田中さんは犬が好きですが、猫は好きじゃないです。」Question: "What does Tanaka like?" Choices: Dogs/Cats
   Why valid: Both dogs AND cats are mentioned in the main sentence, must process が to find what is liked

❌ Main sentence: 「田中さんが来ました。」Question: "Who came?" Choices: Tanaka/Suzuki
   Why invalid: Only Tanaka is mentioned in the main sentence - Suzuki is nowhere to be found

❌ Context: 「田中さんと鈴木さんが公園にいます。」Main sentence: 「帰りました。」Question: "Who went home?" Choices: Tanaka/Suzuki
   Why invalid: NEITHER person is mentioned in the main sentence - both are only in context

✅ VALID: Main sentence: 「田中さんは公園にいますが、鈴木さんが帰りました。」Question: "Who went home?" Choices: Tanaka/Suzuki
   Why valid: Both Tanaka AND Suzuki are in the MAIN sentence, must process が to determine who went home`;
}

function getMinimalPairExamples(jlptLevel: JLPTLevel): string {
  const examples = {
    N5: `N5 MINIMAL PAIRS:

A. Actor Identification (MUST mention multiple people):
   - Context: Both Tanaka and Suzuki were at the park
     * 「田中さんが来ました。」(Tanaka came)
     * 「鈴木さんが来ました。」(Suzuki came)
     * Question: "Who came?" with both names as choices

   - Context: The child and teacher were together
     * 「子どもが遊びました。」(The child played)
     * 「先生が遊びました。」(The teacher played)
     * Question: "Who played?"

   - Context: Tanaka and Yumi were eating together
     * 「田中さんがケーキを食べました。」(Tanaka ate cake)
     * 「ゆみさんがケーキを食べました。」(Yumi ate cake)
     * Question: "Who ate the cake?"

B. Topic vs Identification (XはYです vs YがXです):
   - 「田中さんは学生です。」(About Tanaka: he's a student)
   - 「学生が田中さんです。」(Among people, the student is Tanaka)
   - 「山本さんは先生です。」(About Yamamoto: she's a teacher)
   - 「先生が山本さんです。」(Among people, the teacher is Yamamoto)

C. Likes/Preferences (subject of emotion marked by が):
   - 「田中さんは犬が好きです。」(Tanaka likes dogs - は marks topic, が marks what is liked)
   - Question should be about WHAT Tanaka likes, not WHO likes dogs
   - Wrong: "Who likes dogs?"
   - Right: "What does Tanaka like?"`,

    N4: `N4 MINIMAL PAIRS:

A. Exhaustive/Focus が:
   - 「田中さんは早く来ました。」vs「一番早く来たのが田中さんです。」
   - 「みんな宿題をしました。」vs「ちゃんとやったのが田中さんです。」

B. Embedded Identification:
   - 「本を読んでいる人は田中さんです。」vs「本を読んでいるのが田中さんです。」
   - 「東京に住んでいる人は山田さんです。」vs「東京に住んでいるのが山田さんです。」

C. Multiple entities:
   - 「犬は公園にいます。猫が家にいます。」(Dog is topic, cat is focused subject)`,

    N3: `N3 MINIMAL PAIRS:

A. Contrastive は vs Focus が:
   - 「私はコーヒーは好きですが、田中さんが好きなのは紅茶です。」
   - 「雨は降らないと思っていましたが、実際に降ったのが午後でした。」

B. Frame-setting vs Focused Subject:
   - 「昨日のパーティーは楽しかったです。盛り上がったのがゲームの時間でした。」
   - 「この町は静かですが、夜ににぎやかになるのが駅前のバーです。」`,
  };

  return examples[jlptLevel];
}

/**
 * Get all grammar points for a specific JLPT level
 */
export function getGrammarPointsForLevel(level: JLPTLevel): GrammarPointType[] {
  return Object.values(GRAMMAR_POINTS)
    .filter((gp) => gp.level === level)
    .map((gp) => gp.id);
}

/**
 * Get metadata for a specific grammar point
 */
export function getGrammarPointMetadata(grammarPoint: GrammarPointType): GrammarPointMetadata {
  return GRAMMAR_POINTS[grammarPoint];
}

/**
 * Validate that a grammar point is appropriate for a JLPT level
 */
export function isGrammarPointValidForLevel(
  grammarPoint: GrammarPointType,
  level: JLPTLevel
): boolean {
  const metadata = GRAMMAR_POINTS[grammarPoint];
  return metadata.level === level;
}
