import type { Chapter } from '../../types/lesson'

export const a0Ch1: Chapter = {
  id: 'a0-ch1',
  levelId: 'A0',
  title: 'Alphabet, Salutations, Chiffres',
  description: 'French alphabet, greetings, and numbers for complete beginners',
  lessons: [
    {
      id: 'a0-ch1-l1',
      levelId: 'A0',
      chapterId: 'a0-ch1',
      lessonNumber: 1,
      title: 'The French Alphabet — Part 1 (A-M)',
      description: 'Learn French letters A through M and basic pronunciation',
      warmup: [],
      comprehensibleInput: {
        title: "L'alphabet français",
        frenchText:
          "L"alphabet français a vingt-six lettres, comme l'alphabet anglais. Mais la prononciation est différente ! Aujourd'hui, nous commençons avec les lettres A à M. Écoutez bien : A, B, C, D, E, F, G, H, I, J, K, L, M.\",
        englishHint:
          'The French alphabet has 26 letters, like the English alphabet. But the pronunciation is different!',
        vocabularyHighlights: [
          { french: "l"alphabet\", english: 'the alphabet" },
          { french: 'vingt-six', english: 'twenty-six' },
          { french: 'lettres', english: 'letters' },
          { french: 'la prononciation', english: 'the pronunciation' },
          { french: 'différente', english: 'different' },
          { french: 'écoutez', english: 'listen' }
        ]
      },
      drillQuestions: [
        {
          id: 'a0-ch1-l1-q1',
          type: 'multiple_choice',
          prompt: 'Which letter in French sounds most like the English word "ah"?',
          options: ['A', 'E', 'I', 'O'],
          correctIndex: 0,
          explanation:
            'The letter "A" in French is pronounced like "ah" in English, similar to the "a" in "father".'
        },
        {
          id: 'a0-ch1-l1-q2',
          type: 'translation',
          direction: 'fr_to_en',
          sourceText: 'B',
          correctAnswer: 'bay',
          acceptableAnswers: ['bay', 'bé', 'be'],
          explanation:
            'The letter "B" in French is pronounced "bay" (similar to English "bay" but shorter).'
        },
        {
          id: 'a0-ch1-l1-q3',
          type: 'fill_blank',
          sentence: 'The French alphabet has ___ letters.',
          correctAnswer: '26',
          acceptableAnswers: ['26', 'vingt-six', 'twenty-six'],
          explanation:
            'The French alphabet has 26 letters, just like the English alphabet: A to Z.'
        },
        {
          id: 'a0-ch1-l1-q4',
          type: 'multiple_choice',
          prompt: 'Which accent mark appears in the letter "é"?',
          options: ['Accent aigu', 'Accent grave', 'Accent circonflexe', 'Cédille'],
          correctIndex: 0,
          explanation:
            'The accent aigu (´) goes up from left to right, as in "é". It\'s the most common accent in French.'
        },
        {
          id: 'a0-ch1-l1-q5',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'the letter',
          correctAnswer: 'la lettre',
          explanation:
            '"La lettre" means "the letter" in French. "Lettre" is a feminine noun, so it uses "la".'
        },
        {
          id: 'a0-ch1-l1-q6',
          type: 'fill_blank',
          sentence: 'A, B, C, D, ___, F, G',
          correctAnswer: 'E',
          explanation:
            'E comes after D in the alphabet sequence. In French, E is pronounced "euh" or "ay".'
        },
        {
          id: 'a0-ch1-l1-q7',
          type: 'error_correction',
          incorrectSentence: 'The letter "è" uses an accent aigu.',
          options: [
            'The letter "è" uses an accent grave.',
            'The letter "è" uses an accent circonflexe.',
            'The letter "è" uses a cédille.',
            'The sentence is correct.'
          ],
          correctIndex: 0,
          explanation:
            'The letter "è" uses an accent grave (`), which goes down from left to right. "é" uses an accent aigu (´).'
        },
        {
          id: 'a0-ch1-l1-q8',
          type: 'multiple_choice',
          prompt: 'How is the letter "H" pronounced in French?',
          options: ['ash', 'aitch', 'hah', 'ay-sh'],
          correctIndex: 0,
          explanation:
            'In French, "H" is pronounced "ash" (like the English word "ash"), not "aitch" as in English.'
        },
        {
          id: 'a0-ch1-l1-q9',
          type: 'fill_blank',
          sentence: 'J, K, ___, M',
          correctAnswer: 'L',
          explanation: 'L comes between K and M in the alphabet. In French, it\'s pronounced "ell".'
        },
        {
          id: 'a0-ch1-l1-q10',
          type: 'translation',
          direction: 'fr_to_en',
          sourceText: 'différente',
          correctAnswer: 'different',
          explanation:
            '"Différente" means "different" in English. Notice the accent aigu on the first "e".'
        },
        {
          id: 'a0-ch1-l1-q11',
          type: 'multiple_choice',
          prompt: 'Which letter pair sounds very similar in French: "G" and "J"?',
          options: [
            'Yes, they both have a "zh" sound',
            'No, G is hard like "gay" and J is soft',
            'Yes, both sound like English "jay"',
            'No, they sound completely different'
          ],
          correctIndex: 0,
          explanation:
            'Both "G" (pronounced "zhay") and "J" (pronounced "zhee") contain the soft "zh" sound in French, though they\'re not identical.'
        },
        {
          id: 'a0-ch1-l1-q12',
          type: 'error_correction',
          incorrectSentence: 'The accent circonflexe looks like this: ´',
          options: [
            'The accent circonflexe looks like this: ^',
            'The accent circonflexe looks like this: `',
            'The accent circonflexe looks like this: ¨',
            'The sentence is correct.'
          ],
          correctIndex: 0,
          explanation:
            'The accent circonflexe looks like a little hat: ê, â, î. The symbol ´ is the accent aigu.'
        }
      ]
    },
    {
      id: 'a0-ch1-l2',
      levelId: 'A0',
      chapterId: 'a0-ch1',
      lessonNumber: 2,
      title: 'The French Alphabet — Part 2 (N-Z)',
      description: 'Learn French letters N through Z and special characters',
      warmup: [
        {
          id: 'a0-ch1-l2-q1',
          question: {
            id: 'a0-ch1-l2-q1',
            type: 'multiple_choice',
          prompt: 'Which accent mark is used in "é"?',
          options: ['Accent aigu', 'Accent grave', 'Accent circonflexe', 'Tréma'],
          correctIndex: 0,
          explanation: 'The accent aigu (´) goes upward from left to right, as seen in "é".'
          }
        },
        {
          id: 'a0-ch1-l2-q2',
          question: {
            id: 'a0-ch1-l2-q2',
            type: 'fill_blank',
          sentence: 'E, F, G, ___, I',
          correctAnswer: 'H',
          explanation: 'H comes between G and I in the alphabet.'
          }
        }
      ],
      comprehensibleInput: {
        title: 'Caractères spéciaux',
        frenchText:
          "Maintenant, nous étudions les lettres N à Z. Le français utilise aussi des caractères spéciaux : la cédille (ç), comme dans "français' et 'garçon'. Il y a aussi des accents sur d'autres lettres : û, ù, ô, î. Ces accents changent la prononciation !\",
        englishHint:
          'Now we study the letters N to Z. French also uses special characters like the cédille (ç).',
        vocabularyHighlights: [
          { french: 'maintenant', english: 'now' },
          { french: 'nous étudions', english: 'we study' },
          { french: 'utilise', english: 'uses' },
          { french: 'la cédille', english: 'the cedilla' },
          { french: 'comme dans', english: 'as in' },
          { french: 'changent', english: 'change' }
        ]
      },
      drillQuestions: [
        {
          id: 'a0-ch1-l2-q3',
          type: 'translation',
          direction: 'fr_to_en',
          sourceText: 'français',
          correctAnswer: 'French',
          explanation:
            '"Français" means "French" (the language or nationality). Note the cédille under the "c".'
        },
        {
          id: 'a0-ch1-l2-q4',
          type: 'multiple_choice',
          prompt: 'What does the cédille (ç) do to the letter "c"?',
          options: [
            'Makes it sound like "s"',
            'Makes it sound like "k"',
            'Makes it sound like "sh"',
            'Makes it silent'
          ],
          correctIndex: 0,
          explanation:
            'The cédille (ç) makes the "c" sound soft like "s", as in "français" (frahn-seh).'
        },
        {
          id: 'a0-ch1-l2-q5',
          type: 'fill_blank',
          sentence: 'N, O, P, ___, R',
          correctAnswer: 'Q',
          explanation: 'Q comes between P and R. In French, Q is pronounced "kew".'
        },
        {
          id: 'a0-ch1-l2-q6',
          type: 'error_correction',
          incorrectSentence: 'The word "garcon" is spelled correctly.',
          options: [
            'The word should be spelled "garçon".',
            'The word should be spelled "garsón".',
            'The word should be spelled "garcôn".',
            'The sentence is correct.'
          ],
          correctIndex: 0,
          explanation:
            '"Garçon" (boy) requires a cédille: "garçon". Without it, the pronunciation would be wrong.'
        },
        {
          id: 'a0-ch1-l2-q7',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'boy',
          correctAnswer: 'garçon',
          explanation:
            '"Garçon" means "boy" in French. Remember to include the cédille under the "c"!'
        },
        {
          id: 'a0-ch1-l2-q8',
          type: 'multiple_choice',
          prompt: 'How is the letter "W" pronounced in French?',
          options: ['doo-bluh-vay', 'dub-yoo', 'vay-vay', 'wuh'],
          correctIndex: 0,
          explanation:
            'In French, "W" is pronounced "double-vé" (doo-bluh-vay), literally meaning "double V".'
        },
        {
          id: 'a0-ch1-l2-q9',
          type: 'fill_blank',
          sentence: 'U, V, ___, X, Y, Z',
          correctAnswer: 'W',
          explanation: 'W comes between V and X in the alphabet.'
        },
        {
          id: 'a0-ch1-l2-q10',
          type: 'translation',
          direction: 'fr_to_en',
          sourceText: 'où',
          correctAnswer: 'where',
          explanation:
            '"Où" (with accent grave) means "where" in French. Without the accent, "ou" means "or".'
        },
        {
          id: 'a0-ch1-l2-q11',
          type: 'multiple_choice',
          prompt: 'Which letter is pronounced "ee-grek" (Greek i) in French?',
          options: ['Y', 'I', 'J', 'G'],
          correctIndex: 0,
          explanation:
            'The letter "Y" is called "i grec" (ee-grek) in French, meaning "Greek i" because of its Greek origin.'
        },
        {
          id: 'a0-ch1-l2-q12',
          type: 'error_correction',
          incorrectSentence: 'The accent on "û" is called an accent aigu.',
          options: [
            'The accent on "û" is called an accent circonflexe.',
            'The accent on "û" is called an accent grave.',
            'The accent on "û" is called a cédille.',
            'The sentence is correct.'
          ],
          correctIndex: 0,
          explanation:
            'The accent on "û" is the accent circonflexe (^), which looks like a little hat.'
        },
        {
          id: 'a0-ch1-l2-q13',
          type: 'fill_blank',
          sentence: 'The letter "Z" is pronounced ___ in French.',
          correctAnswer: 'zed',
          acceptableAnswers: ['zed', 'zède', 'zehd'],
          explanation:
            'In French, "Z" is pronounced "zed" (like British English), not "zee" like American English.'
        },
        {
          id: 'a0-ch1-l2-q14',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'special characters',
          correctAnswer: 'caractères spéciaux',
          explanation:
            '"Caractères spéciaux" means "special characters" in French. Note the accent grave on the "è".'
        }
      ]
    },
    {
      id: 'a0-ch1-l3',
      levelId: 'A0',
      chapterId: 'a0-ch1',
      lessonNumber: 3,
      title: 'Greetings & Goodbyes',
      description: 'Master basic French greetings and farewells',
      warmup: [
        {
          id: 'a0-ch1-l3-q1',
          question: {
            id: 'a0-ch1-l3-q1',
            type: 'multiple_choice',
          prompt: 'What does the cédille (ç) make the "c" sound like?',
          options: ['s', 'k', 'sh', 'ch'],
          correctIndex: 0,
          explanation: 'The cédille makes "c" sound like "s", as in "français".'
          }
        },
        {
          id: 'a0-ch1-l3-q2',
          question: {
            id: 'a0-ch1-l3-q2',
            type: 'fill_blank',
          sentence: 'X, ___, Z',
          correctAnswer: 'Y',
          explanation: 'Y comes between X and Z at the end of the alphabet.'
          }
        }
      ],
      comprehensibleInput: {
        title: 'Une rencontre',
        frenchText:
          "Marie : Bonjour ! Je m'appelle Marie.\nPierre : Bonjour Marie ! Je m'appelle Pierre. Comment allez-vous ?\nMarie : Très bien, merci ! Et vous ?\nPierre : Bien, merci. Au revoir, Marie !\nMarie : Au revoir !",
        englishHint: 'Marie and Pierre meet and greet each other politely.',
        vocabularyHighlights: [
          { french: 'Bonjour', english: 'Hello/Good morning' },
          { french: "Je m"appelle\", english: 'My name is" },
          { french: 'Comment allez-vous ?', english: 'How are you? (formal)' },
          { french: 'Très bien', english: 'Very well' },
          { french: 'merci', english: 'thank you' },
          { french: 'Et vous ?', english: 'And you?' },
          { french: 'Au revoir', english: 'Goodbye' }
        ]
      },
      drillQuestions: [
        {
          id: 'a0-ch1-l3-q3',
          type: 'translation',
          direction: 'fr_to_en',
          sourceText: 'Bonjour',
          correctAnswer: 'Hello',
          acceptableAnswers: ['Hello', 'Good morning', 'Good day', 'Hi'],
          explanation:
            '"Bonjour" is used to say hello during the day, literally meaning "good day".'
        },
        {
          id: 'a0-ch1-l3-q4',
          type: 'multiple_choice',
          prompt: 'Which greeting would you use in the evening?',
          options: ['Bonsoir', 'Bonjour', 'Salut', 'Bonne nuit'],
          correctIndex: 0,
          explanation:
            '"Bonsoir" means "good evening" and is used when greeting someone after around 6 PM.'
        },
        {
          id: 'a0-ch1-l3-q5',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'Goodbye',
          correctAnswer: 'Au revoir',
          explanation:
            '"Au revoir" is the standard way to say goodbye in French, literally "until we see each other again".'
        },
        {
          id: 'a0-ch1-l3-q6',
          type: 'fill_blank',
          sentence: 'Bonne ___ is used to say "Good night" before sleeping.',
          correctAnswer: 'nuit',
          explanation:
            '"Bonne nuit" means "good night" and is only used when someone is going to bed, not as a greeting.'
        },
        {
          id: 'a0-ch1-l3-q7',
          type: 'error_correction',
          incorrectSentence: 'You can say "Bonne nuit" when greeting someone in the evening.',
          options: [
            'You should say "Bonsoir" when greeting someone in the evening.',
            'You should say "Bonjour" when greeting someone in the evening.',
            'You should say "Salut" when greeting someone in the evening.',
            'The sentence is correct.'
          ],
          correctIndex: 0,
          explanation:
            '"Bonne nuit" is only for saying goodnight before bed. "Bonsoir" is the evening greeting.'
        },
        {
          id: 'a0-ch1-l3-q8',
          type: 'multiple_choice',
          prompt: 'Which greeting is informal and used with friends?',
          options: ['Salut', 'Bonjour', 'Bonsoir', 'Au revoir'],
          correctIndex: 0,
          explanation:
            '"Salut" is an informal greeting (like "hi" or "hey") used with friends, family, or people you know well.'
        },
        {
          id: 'a0-ch1-l3-q9',
          type: 'translation',
          direction: 'fr_to_en',
          sourceText: 'Comment allez-vous ?',
          correctAnswer: 'How are you?',
          acceptableAnswers: ['How are you?', 'How do you do?'],
          explanation:
            '"Comment allez-vous ?" is the formal way to ask "How are you?" using the formal "vous".'
        },
        {
          id: 'a0-ch1-l3-q10',
          type: 'fill_blank',
          sentence: 'To ask "How are you?" informally, you say: Comment ___ ?',
          correctAnswer: 'vas-tu',
          acceptableAnswers: ['vas-tu', 'ça va'],
          explanation:
            '"Comment vas-tu ?" uses the informal "tu". You can also simply say "Ça va ?" (How\'s it going?).'
        },
        {
          id: 'a0-ch1-l3-q11',
          type: 'multiple_choice',
          prompt: 'What does "merci" mean?',
          options: ['thank you', 'please', 'excuse me', 'sorry'],
          correctIndex: 0,
          explanation: '"Merci" means "thank you" in French. It\'s one of the most important words to know!'
        },
        {
          id: 'a0-ch1-l3-q12',
          type: 'error_correction',
          incorrectSentence: '"Tu" is the formal way to address someone you don\'t know well.',
          options: [
            '"Vous" is the formal way to address someone you don\'t know well.',
            '"Toi" is the formal way to address someone you don\'t know well.',
            '"Te" is the formal way to address someone you don\'t know well.',
            'The sentence is correct.'
          ],
          correctIndex: 0,
          explanation:
            '"Vous" is formal and polite. "Tu" is informal and used with friends, family, children, or peers.'
        },
        {
          id: 'a0-ch1-l3-q13',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'Good evening',
          correctAnswer: 'Bonsoir',
          explanation:
            '"Bonsoir" means "good evening" and is used to greet people after approximately 6 PM.'
        }
      ]
    },
    {
      id: 'a0-ch1-l4',
      levelId: 'A0',
      chapterId: 'a0-ch1',
      lessonNumber: 4,
      title: 'Introducing Yourself',
      description: 'Learn to introduce yourself in French',
      warmup: [
        {
          id: 'a0-ch1-l4-q1',
          question: {
            id: 'a0-ch1-l4-q1',
            type: 'translation',
          direction: 'fr_to_en',
          sourceText: 'Salut',
          correctAnswer: 'Hi',
          acceptableAnswers: ['Hi', 'Hey', 'Hello'],
          explanation: '"Salut" is an informal greeting meaning "hi" or "hey".'
          }
        },
        {
          id: 'a0-ch1-l4-q2',
          question: {
            id: 'a0-ch1-l4-q2',
            type: 'multiple_choice',
          prompt: 'Which is the formal way to say "you" in French?',
          options: ['vous', 'tu', 'toi', 'te'],
          correctIndex: 0,
          explanation: '"Vous" is formal and polite, while "tu" is informal.'
          }
        },
        {
          id: 'a0-ch1-l4-q3',
          question: {
            id: 'a0-ch1-l4-q3',
            type: 'fill_blank',
          sentence: 'To say goodbye, you say: Au ___',
          correctAnswer: 'revoir',
          explanation: '"Au revoir" means goodbye.'
          }
        }
      ],
      comprehensibleInput: {
        title: 'Je me présente',
        frenchText:
          "Bonjour ! Je m"appelle Sophie Dubois. J'ai vingt-cinq ans. Je suis française. J'habite à Paris. Je suis professeur. Enchanté de faire votre connaissance !\",
        englishHint: 'Sophie introduces herself with her name, age, nationality, and profession.',
        vocabularyHighlights: [
          { french: 'Je me présente', english: 'I introduce myself' },
          { french: "Je m"appelle\", english: 'My name is" },
          { french: "J'ai", english: 'I am/I have (for age)' },
          { french: 'ans', english: 'years old' },
          { french: 'Je suis', english: 'I am' },
          { french: "J'habite", english: 'I live' },
          { french: 'Enchanté', english: 'Nice to meet you' }
        ]
      },
      drillQuestions: [
        {
          id: 'a0-ch1-l4-q4',
          type: 'translation',
          direction: 'fr_to_en',
          sourceText: "Je m'appelle",
          correctAnswer: 'My name is',
          acceptableAnswers: ['My name is', 'I am called', 'I call myself'],
          explanation:
            '"Je m\'appelle" literally means "I call myself" but translates to "My name is".'
        },
        {
          id: 'a0-ch1-l4-q5',
          type: 'fill_blank',
          sentence: "Je ___ Marie. (My name is Marie)",
          correctAnswer: "m'appelle",
          explanation:
            '"Je m\'appelle" is the standard way to introduce your name in French.'
        },
        {
          id: 'a0-ch1-l4-q6',
          type: 'multiple_choice',
          prompt: 'How do you formally ask someone their name?',
          options: [
            'Comment vous appelez-vous ?',
            'Comment tu t\'appelles ?',
            'Quel est votre nom ?',
            'All of the above'
          ],
          correctIndex: 0,
          explanation:
            '"Comment vous appelez-vous ?" is the formal way. "Comment tu t\'appelles ?" is informal. Both are common, but option A is most standard for formal situations.'
        },
        {
          id: 'a0-ch1-l4-q7',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'Nice to meet you (masculine speaker)',
          correctAnswer: 'Enchanté',
          acceptableAnswers: ['Enchanté', 'Enchantée'],
          explanation:
            '"Enchanté" (masculine) or "Enchantée" (feminine) means "nice to meet you". The spelling changes based on the speaker\'s gender.'
        },
        {
          id: 'a0-ch1-l4-q8',
          type: 'error_correction',
          incorrectSentence: "To say 'I am 20 years old,' you say: Je suis vingt ans.",
          options: [
            "To say 'I am 20 years old,' you say: J'ai vingt ans.",
            "To say 'I am 20 years old,' you say: Je vingt ans.",
            "To say 'I am 20 years old,' you say: Je suis vingt années.",
            'The sentence is correct.'
          ],
          correctIndex: 0,
          explanation:
            'In French, you use "avoir" (to have) for age, not "être" (to be). So it\'s "J\'ai vingt ans" (I have 20 years).'
        },
        {
          id: 'a0-ch1-l4-q9',
          type: 'fill_blank',
          sentence: "___ française. (I am French - feminine)",
          correctAnswer: 'Je suis',
          explanation:
            '"Je suis" means "I am". Note: "française" is the feminine form; "français" is masculine.'
        },
        {
          id: 'a0-ch1-l4-q10',
          type: 'multiple_choice',
          prompt: 'What does "J\'habite à Paris" mean?',
          options: [
            'I live in Paris',
            'I visit Paris',
            'I am from Paris',
            'I like Paris'
          ],
          correctIndex: 0,
          explanation: '"J\'habite" means "I live" or "I reside". "J\'habite à Paris" = "I live in Paris".'
        },
        {
          id: 'a0-ch1-l4-q11',
          type: 'translation',
          direction: 'fr_to_en',
          sourceText: "J'ai vingt ans",
          correctAnswer: 'I am twenty years old',
          acceptableAnswers: ['I am twenty years old', 'I am 20 years old', 'I am twenty'],
          explanation:
            '"J\'ai vingt ans" literally means "I have twenty years" but translates to "I am twenty years old".'
        },
        {
          id: 'a0-ch1-l4-q12',
          type: 'error_correction',
          incorrectSentence: 'Comment tu vous appelez ?',
          options: [
            'Comment vous appelez-vous ?',
            'Comment tu appelles ?',
            'Comment t\'appelles tu ?',
            'The sentence is correct.'
          ],
          correctIndex: 0,
          explanation:
            'You cannot mix "tu" (informal) and "vous" (formal). The correct formal question is "Comment vous appelez-vous ?"'
        },
        {
          id: 'a0-ch1-l4-q13',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'I am a teacher (masculine)',
          correctAnswer: 'Je suis professeur',
          acceptableAnswers: ['Je suis professeur', 'Je suis un professeur'],
          explanation:
            '"Je suis professeur" means "I am a teacher". Note: in French, you often omit the article "un/une" with professions.'
        }
      ]
    },
    {
      id: 'a0-ch1-l5',
      levelId: 'A0',
      chapterId: 'a0-ch1',
      lessonNumber: 5,
      title: 'Numbers 0-20',
      description: 'Count from 0 to 20 in French',
      warmup: [
        {
          id: 'a0-ch1-l5-q1',
          question: {
            id: 'a0-ch1-l5-q1',
            type: 'fill_blank',
          sentence: "Je ___ Paul. (My name is Paul)",
          correctAnswer: "m'appelle",
          explanation: '"Je m\'appelle" is how you state your name.'
          }
        },
        {
          id: 'a0-ch1-l5-q2',
          question: {
            id: 'a0-ch1-l5-q2',
            type: 'translation',
          direction: 'fr_to_en',
          sourceText: 'Enchanté',
          correctAnswer: 'Nice to meet you',
          acceptableAnswers: ['Nice to meet you', 'Pleased to meet you', 'Enchanted'],
          explanation: '"Enchanté" is how you say "nice to meet you" in French (masculine form).'
          }
        }
      ],
      comprehensibleInput: {
        title: 'Compter en français',
        frenchText:
          "Un, deux, trois, quatre, cinq. Ces sont les premiers chiffres ! Comptons ensemble : zéro, un, deux, trois, quatre, cinq, six, sept, huit, neuf, dix. Continuons : onze, douze, treize, quatorze, quinze, seize, dix-sept, dix-huit, dix-neuf, vingt. Très bien !",
        englishHint: 'Counting from 0 to 20 in French. Let\'s count together!',
        vocabularyHighlights: [
          { french: 'compter', english: 'to count' },
          { french: 'les chiffres', english: 'the numbers' },
          { french: 'les premiers', english: 'the first' },
          { french: 'comptons ensemble', english: "let's count together" },
          { french: 'continuons', english: "let's continue" },
          { french: 'très bien', english: 'very good' }
        ]
      },
      drillQuestions: [
        {
          id: 'a0-ch1-l5-q3',
          type: 'translation',
          direction: 'fr_to_en',
          sourceText: 'trois',
          correctAnswer: 'three',
          acceptableAnswers: ['three', '3'],
          explanation: '"Trois" is the French word for "three" (3).'
        },
        {
          id: 'a0-ch1-l5-q4',
          type: 'multiple_choice',
          prompt: 'Which number comes after "dix" (10)?',
          options: ['onze', 'douze', 'neuf', 'vingt'],
          correctIndex: 0,
          explanation: '"Onze" (11) comes after "dix" (10) in French.'
        },
        {
          id: 'a0-ch1-l5-q5',
          type: 'fill_blank',
          sentence: 'un, deux, ___, quatre, cinq',
          correctAnswer: 'trois',
          explanation: '"Trois" (3) comes between "deux" (2) and "quatre" (4).'
        },
        {
          id: 'a0-ch1-l5-q6',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'fifteen',
          correctAnswer: 'quinze',
          explanation: '"Quinze" is the French word for fifteen (15).'
        },
        {
          id: 'a0-ch1-l5-q7',
          type: 'error_correction',
          incorrectSentence: 'The correct spelling of 14 in French is "quartorze".',
          options: [
            'The correct spelling of 14 in French is "quatorze".',
            'The correct spelling of 14 in French is "catorze".',
            'The correct spelling of 14 in French is "katorze".',
            'The sentence is correct.'
          ],
          correctIndex: 0,
          explanation:
            'Fourteen in French is spelled "quatorze" (not "quartorze"). It comes from "quatre" (4) + "onze" (11) pattern.'
        },
        {
          id: 'a0-ch1-l5-q8',
          type: 'multiple_choice',
          prompt: 'What is the French word for "zero"?',
          options: ['zéro', 'zero', 'nul', 'rien'],
          correctIndex: 0,
          explanation:
            '"Zéro" (with an accent) is the French word for zero. "Nul" means null, and "rien" means nothing.'
        },
        {
          id: 'a0-ch1-l5-q9',
          type: 'fill_blank',
          sentence: 'dix-huit, dix-neuf, ___',
          correctAnswer: 'vingt',
          explanation:
            '"Vingt" (20) comes after "dix-neuf" (19). Notice that 18 and 19 are hyphenated: dix-huit, dix-neuf.'
        },
        {
          id: 'a0-ch1-l5-q10',
          type: 'translation',
          direction: 'fr_to_en',
          sourceText: 'seize',
          correctAnswer: 'sixteen',
          acceptableAnswers: ['sixteen', '16'],
          explanation: '"Seize" is the French word for sixteen (16). Don\'t confuse it with "six" (6)!'
        },
        {
          id: 'a0-ch1-l5-q11',
          type: 'multiple_choice',
          prompt: 'Which number is spelled differently from the pattern of 17-19?',
          options: ['seize (16)', 'dix-sept (17)', 'dix-huit (18)', 'dix-neuf (19)'],
          correctIndex: 0,
          explanation:
            '"Seize" (16) is unique. Numbers 17-19 follow the pattern "dix-" + number: dix-sept, dix-huit, dix-neuf.'
        },
        {
          id: 'a0-ch1-l5-q12',
          type: 'error_correction',
          incorrectSentence: 'The number 11 in French is spelled "onse".',
          options: [
            'The number 11 in French is spelled "onze".',
            'The number 11 in French is spelled "once".',
            'The number 11 in French is spelled "unze".',
            'The sentence is correct.'
          ],
          correctIndex: 0,
          explanation:
            'Eleven in French is spelled "onze" (with a z, not an s). It\'s pronounced "onz".'
        },
        {
          id: 'a0-ch1-l5-q13',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'seven',
          correctAnswer: 'sept',
          explanation:
            '"Sept" is the French word for seven (7). Note that the "p" is usually silent in pronunciation.'
        }
      ]
    },
    {
      id: 'a0-ch1-l6',
      levelId: 'A0',
      chapterId: 'a0-ch1',
      lessonNumber: 6,
      title: 'Numbers 21-100 & Basic Counting',
      description: 'Master counting from 21 to 100 in French',
      warmup: [
        {
          id: 'a0-ch1-l6-q1',
          question: {
            id: 'a0-ch1-l6-q1',
            type: 'translation',
          direction: 'fr_to_en',
          sourceText: 'douze',
          correctAnswer: 'twelve',
          acceptableAnswers: ['twelve', '12'],
          explanation: '"Douze" is the French word for twelve (12).'
          }
        },
        {
          id: 'a0-ch1-l6-q2',
          question: {
            id: 'a0-ch1-l6-q2',
            type: 'fill_blank',
          sentence: 'treize, quatorze, ___, seize',
          correctAnswer: 'quinze',
          explanation: '"Quinze" (15) comes between "quatorze" (14) and "seize" (16).'
          }
        },
        {
          id: 'a0-ch1-l6-q3',
          question: {
            id: 'a0-ch1-l6-q3',
            type: 'multiple_choice',
          prompt: 'What is "vingt" in English?',
          options: ['twenty', 'twelve', 'two', 'ten'],
          correctIndex: 0,
          explanation: '"Vingt" is the French word for twenty (20).'
          }
        }
      ],
      comprehensibleInput: {
        title: 'Mon âge',
        frenchText:
          "Bonjour ! J'ai trente-deux ans. Mon frère a vingt-cinq ans et ma sœur a quarante ans. Mon père a soixante-dix ans - oui, soixante-dix ! C'est soixante plus dix. Ma mère a soixante-cinq ans. Les nombres français sont intéressants après soixante !",
        englishHint: 'A person talks about their age and their family members\' ages.',
        vocabularyHighlights: [
          { french: 'mon âge', english: 'my age' },
          { french: 'mon frère', english: 'my brother' },
          { french: 'ma sœur', english: 'my sister' },
          { french: 'mon père', english: 'my father' },
          { french: 'ma mère', english: 'my mother' },
          { french: 'intéressants', english: 'interesting' }
        ]
      },
      drillQuestions: [
        {
          id: 'a0-ch1-l6-q4',
          type: 'translation',
          direction: 'fr_to_en',
          sourceText: 'vingt-et-un',
          correctAnswer: 'twenty-one',
          acceptableAnswers: ['twenty-one', '21'],
          explanation:
            '"Vingt-et-un" means twenty-one (21). Note the special "et" (and) connecting 20 and 1.'
        },
        {
          id: 'a0-ch1-l6-q5',
          type: 'multiple_choice',
          prompt: 'How do you say "32" in French?',
          options: ['trente-deux', 'trente-et-deux', 'trois-deux', 'treize-deux'],
          correctIndex: 0,
          explanation:
            '"Trente-deux" is 32. After 21, you don\'t use "et" - just hyphenate: trente-deux, trente-trois, etc.'
        },
        {
          id: 'a0-ch1-l6-q6',
          type: 'fill_blank',
          sentence: 'vingt, trente, quarante, ___, soixante',
          correctAnswer: 'cinquante',
          explanation:
            '"Cinquante" (50) comes between "quarante" (40) and "soixante" (60) in the tens sequence.'
        },
        {
          id: 'a0-ch1-l6-q7',
          type: 'error_correction',
          incorrectSentence: 'The number 70 in French is "septante".',
          options: [
            'The number 70 in French is "soixante-dix" (sixty-ten).',
            'The number 70 in French is "soixante-sept".',
            'The number 70 in French is "sept-dix".',
            'The sentence is correct.'
          ],
          correctIndex: 0,
          explanation:
            'In standard French, 70 is "soixante-dix" (literally sixty-ten). "Septante" is used in Belgium and Switzerland but not in France.'
        },
        {
          id: 'a0-ch1-l6-q8',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'fifty-five',
          correctAnswer: 'cinquante-cinq',
          explanation:
            '"Cinquante-cinq" means fifty-five (55). It follows the pattern: cinquante (50) + cinq (5).'
        },
        {
          id: 'a0-ch1-l6-q9',
          type: 'multiple_choice',
          prompt: 'How is 80 said in French?',
          options: [
            'quatre-vingts (four twenties)',
            'huitante',
            'octante',
            'huit-dix (eight-ten)'
          ],
          correctIndex: 0,
          explanation:
            'In standard French, 80 is "quatre-vingts" (literally four twenties). Note the "s" on "vingts".'
        },
        {
          id: 'a0-ch1-l6-q10',
          type: 'fill_blank',
          sentence: 'The number 90 in French is quatre-vingt-___.',
          correctAnswer: 'dix',
          explanation:
            'Ninety is "quatre-vingt-dix" (literally four-twenty-ten = 4×20+10). French counting gets interesting after 60!'
        },
        {
          id: 'a0-ch1-l6-q11',
          type: 'translation',
          direction: 'fr_to_en',
          sourceText: 'soixante-quinze',
          correctAnswer: 'seventy-five',
          acceptableAnswers: ['seventy-five', '75'],
          explanation:
            '"Soixante-quinze" means seventy-five (75). It\'s literally sixty-fifteen (60+15).'
        },
        {
          id: 'a0-ch1-l6-q12',
          type: 'error_correction',
          incorrectSentence: 'The number 81 is "quatre-vingts-un" with an "s" on vingts.',
          options: [
            'The number 81 is "quatre-vingt-un" without an "s" on vingt.',
            'The number 81 is "quatre-vingt-et-un" with "et".',
            'The number 81 is "quatrevingtsun" all one word.',
            'The sentence is correct.'
          ],
          correctIndex: 0,
          explanation:
            'When 80 is followed by another number, "vingt" loses its "s": "quatre-vingt-un" (81), "quatre-vingt-deux" (82), etc. Only 80 alone is "quatre-vingts".'
        },
        {
          id: 'a0-ch1-l6-q13',
          type: 'multiple_choice',
          prompt: 'What is unique about the number "71" in French?',
          options: [
            'It\'s "soixante et onze" - the only 60-79 number with "et"',
            'It\'s the only number spelled with three words',
            'It uses "septante" in France',
            'Nothing is unique about it'
          ],
          correctIndex: 0,
          explanation:
            '"Soixante et onze" (71) is the only number in the 60-79 range that uses "et" (and). All others are just hyphenated: soixante-douze, soixante-treize, etc.'
        },
        {
          id: 'a0-ch1-l6-q14',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'one hundred',
          correctAnswer: 'cent',
          acceptableAnswers: ['cent', 'un cent'],
          explanation:
            '"Cent" means one hundred (100). Unlike English, you don\'t typically say "un cent" - just "cent".'
        }
      ]
    }
  ]
}
