import type { Chapter } from '../../types/lesson'

export const a1Ch2: Chapter = {
  id: 'a1-ch2',
  levelId: 'A1',
  title: 'Articles, Adjectifs, Verbes Présent',
  description: 'Master definite and indefinite articles, adjective agreement, and present tense verb conjugation',
  lessons: [
    {
      id: 'a1-ch2-l1',
      levelId: 'A1',
      chapterId: 'a1-ch2',
      lessonNumber: 1,
      title: 'Definite Articles (le, la, l\', les)',
      description: 'Learn when and how to use French definite articles',
      comprehensibleInput: {
        title: 'Dans la Maison',
        frenchText: 'Voici la maison. Le chat est sur le sofa. La table est dans la cuisine. L\'ordinateur est sur le bureau. Les livres sont sur l\'étagère. Les fenêtres sont grandes.',
        englishHint: 'Here is the house. The cat is on the sofa. The table is in the kitchen. The computer is on the desk. The books are on the shelf. The windows are big.',
        vocabularyHighlights: [
          { french: 'la maison', english: 'the house' },
          { french: 'le chat', english: 'the cat' },
          { french: 'le sofa', english: 'the sofa' },
          { french: 'la cuisine', english: 'the kitchen' },
          { french: 'l\'ordinateur', english: 'the computer' },
          { french: 'les livres', english: 'the books' },
          { french: 'les fenêtres', english: 'the windows' }
        ]
      },
      warmup: [
        {
          id: 'a1-ch2-l1-q1',
          question: {
            id: 'a1-ch2-l1-q1',
            type: 'multiple_choice',
          prompt: 'How do you say "Hello" in French?',
          options: ['Bonjour', 'Au revoir', 'Merci', 'S\'il vous plaît'],
          correctIndex: 0,
          explanation: 'Bonjour means "hello" or "good day" in French.'
          }
        },
        {
          id: 'a1-ch2-l1-q2',
          question: {
            id: 'a1-ch2-l1-q2',
            type: 'multiple_choice',
          prompt: 'What is the French word for the number 5?',
          options: ['trois', 'quatre', 'cinq', 'six'],
          correctIndex: 2,
          explanation: 'Cinq is the French word for five.'
          }
        }
      ],
      drillQuestions: [
        {
          id: 'a1-ch2-l1-q3',
          type: 'multiple_choice',
          prompt: 'Which definite article is used for masculine singular nouns?',
          options: ['la', 'le', 'les', 'l\''],
          correctIndex: 1,
          explanation: '"Le" is the definite article for masculine singular nouns (e.g., le chat = the cat).'
        },
        {
          id: 'a1-ch2-l1-q4',
          type: 'multiple_choice',
          prompt: 'Which definite article is used for feminine singular nouns?',
          options: ['le', 'la', 'les', 'un'],
          correctIndex: 1,
          explanation: '"La" is the definite article for feminine singular nouns (e.g., la table = the table).'
        },
        {
          id: 'a1-ch2-l1-q5',
          type: 'fill_blank',
          sentence: '___ chien est grand.',
          correctAnswer: 'Le',
          acceptableAnswers: ['le'],
          explanation: '"Le chien" means "the dog." Chien is masculine, so we use "le."'
        },
        {
          id: 'a1-ch2-l1-q6',
          type: 'fill_blank',
          sentence: '___ fenêtre est ouverte.',
          correctAnswer: 'La',
          acceptableAnswers: ['la'],
          explanation: '"La fenêtre" means "the window." Fenêtre is feminine, so we use "la."'
        },
        {
          id: 'a1-ch2-l1-q7',
          type: 'multiple_choice',
          prompt: 'When do we use "l\'" instead of "le" or "la"?',
          options: [
            'Before plural nouns',
            'Before nouns starting with a vowel or silent h',
            'Before masculine nouns only',
            'Before feminine nouns only'
          ],
          correctIndex: 1,
          explanation: 'We use "l\'" before singular nouns (masculine or feminine) that start with a vowel or silent h (e.g., l\'ordinateur, l\'école).'
        },
        {
          id: 'a1-ch2-l1-q8',
          type: 'fill_blank',
          sentence: '___ école est moderne.',
          correctAnswer: 'L\'',
          acceptableAnswers: ['l\'', 'L\''],
          explanation: '"L\'école" means "the school." We use "l\'" because école starts with a vowel.'
        },
        {
          id: 'a1-ch2-l1-q9',
          type: 'multiple_choice',
          prompt: 'Which article is used for ALL plural nouns?',
          options: ['le', 'la', 'les', 'l\''],
          correctIndex: 2,
          explanation: '"Les" is used for all plural nouns, both masculine and feminine (e.g., les chats, les tables).'
        },
        {
          id: 'a1-ch2-l1-q10',
          type: 'fill_blank',
          sentence: '___ livres sont intéressants.',
          correctAnswer: 'Les',
          acceptableAnswers: ['les'],
          explanation: '"Les livres" means "the books." We use "les" for plural nouns.'
        },
        {
          id: 'a1-ch2-l1-q11',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'the cat',
          correctAnswer: 'le chat',
          acceptableAnswers: ['le chat'],
          explanation: 'Chat is masculine, so we use "le chat."'
        },
        {
          id: 'a1-ch2-l1-q12',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'the house',
          correctAnswer: 'la maison',
          acceptableAnswers: ['la maison'],
          explanation: 'Maison is feminine, so we use "la maison."'
        },
        {
          id: 'a1-ch2-l1-q13',
          type: 'translation',
          direction: 'fr_to_en',
          sourceText: 'les enfants',
          correctAnswer: 'the children',
          acceptableAnswers: ['the children', 'the kids'],
          explanation: '"Les enfants" means "the children." Les is used for plural nouns.'
        },
        {
          id: 'a1-ch2-l1-q14',
          type: 'error_correction',
          incorrectSentence: 'La ordinateur est sur le bureau.',
          options: [
            'L\'ordinateur est sur le bureau.',
            'Le ordinateur est sur le bureau.',
            'Les ordinateur est sur le bureau.',
            'Un ordinateur est sur le bureau.'
          ],
          correctIndex: 0,
          explanation: 'We must use "l\'" before "ordinateur" because it starts with a vowel. The correct sentence is "L\'ordinateur est sur le bureau."'
        }
      ]
    },
    {
      id: 'a1-ch2-l2',
      levelId: 'A1',
      chapterId: 'a1-ch2',
      lessonNumber: 2,
      title: 'Indefinite Articles & Partitive (un, une, des, du, de la)',
      description: 'Learn indefinite articles and partitive articles for expressing quantity',
      comprehensibleInput: {
        title: 'Au Marché',
        frenchText: 'Je voudrais un pain, une pomme et des bananes. Il y a du fromage et de la viande. J\'achète un gâteau pour mon ami. Il y a des légumes frais aujourd\'hui.',
        englishHint: 'I would like a bread, an apple and some bananas. There is some cheese and some meat. I\'m buying a cake for my friend. There are some fresh vegetables today.',
        vocabularyHighlights: [
          { french: 'un pain', english: 'a bread' },
          { french: 'une pomme', english: 'an apple' },
          { french: 'des bananes', english: 'some bananas' },
          { french: 'du fromage', english: 'some cheese' },
          { french: 'de la viande', english: 'some meat' },
          { french: 'un gâteau', english: 'a cake' },
          { french: 'des légumes', english: 'some vegetables' }
        ]
      },
      warmupQuestions: [
        {
          id: 'a1-ch2-l2-q1',
          type: 'fill_blank',
          sentence: '___ chat dort sur le sofa.',
          correctAnswer: 'Le',
          acceptableAnswers: ['le'],
          explanation: 'We use "le" for masculine singular nouns. "Le chat" means "the cat."'
        },
        {
          id: 'a1-ch2-l2-q2',
          type: 'multiple_choice',
          prompt: 'Which article do we use before a singular feminine noun?',
          options: ['le', 'la', 'les', 'un'],
          correctIndex: 1,
          explanation: '"La" is the definite article for feminine singular nouns.'
        }
      ],
      drillQuestions: [
        {
          id: 'a1-ch2-l2-q3',
          type: 'multiple_choice',
          prompt: 'Which indefinite article is used for masculine singular nouns?',
          options: ['une', 'un', 'des', 'du'],
          correctIndex: 1,
          explanation: '"Un" is the indefinite article for masculine singular nouns (e.g., un chat = a cat).'
        },
        {
          id: 'a1-ch2-l2-q4',
          type: 'multiple_choice',
          prompt: 'Which indefinite article is used for feminine singular nouns?',
          options: ['un', 'une', 'des', 'de la'],
          correctIndex: 1,
          explanation: '"Une" is the indefinite article for feminine singular nouns (e.g., une table = a table).'
        },
        {
          id: 'a1-ch2-l2-q5',
          type: 'fill_blank',
          sentence: 'J\'ai ___ chien.',
          correctAnswer: 'un',
          acceptableAnswers: ['un'],
          explanation: '"Un chien" means "a dog." Chien is masculine, so we use "un."'
        },
        {
          id: 'a1-ch2-l2-q6',
          type: 'fill_blank',
          sentence: 'Elle a ___ voiture.',
          correctAnswer: 'une',
          acceptableAnswers: ['une'],
          explanation: '"Une voiture" means "a car." Voiture is feminine, so we use "une."'
        },
        {
          id: 'a1-ch2-l2-q7',
          type: 'multiple_choice',
          prompt: 'Which article means "some" for plural nouns?',
          options: ['un', 'une', 'des', 'le'],
          correctIndex: 2,
          explanation: '"Des" is used for plural nouns and means "some" (e.g., des livres = some books).'
        },
        {
          id: 'a1-ch2-l2-q8',
          type: 'fill_blank',
          sentence: 'Il y a ___ livres sur la table.',
          correctAnswer: 'des',
          acceptableAnswers: ['des'],
          explanation: '"Des livres" means "some books." We use "des" for plural nouns.'
        },
        {
          id: 'a1-ch2-l2-q9',
          type: 'multiple_choice',
          prompt: 'Which partitive article is used for uncountable masculine nouns?',
          options: ['du', 'de la', 'des', 'un'],
          correctIndex: 0,
          explanation: '"Du" is the partitive article for uncountable masculine nouns (e.g., du pain = some bread).'
        },
        {
          id: 'a1-ch2-l2-q10',
          type: 'fill_blank',
          sentence: 'Je mange ___ pain.',
          correctAnswer: 'du',
          acceptableAnswers: ['du'],
          explanation: '"Du pain" means "some bread." Pain is masculine and uncountable, so we use "du."'
        },
        {
          id: 'a1-ch2-l2-q11',
          type: 'fill_blank',
          sentence: 'Elle boit ___ eau.',
          correctAnswer: 'de l\'',
          acceptableAnswers: ['de l\'', 'de l\''],
          explanation: '"De l\'eau" means "some water." We use "de l\'" before "eau" because it starts with a vowel.'
        },
        {
          id: 'a1-ch2-l2-q12',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'a book',
          correctAnswer: 'un livre',
          acceptableAnswers: ['un livre'],
          explanation: 'Livre is masculine, so we use "un livre."'
        },
        {
          id: 'a1-ch2-l2-q13',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'some cheese',
          correctAnswer: 'du fromage',
          acceptableAnswers: ['du fromage'],
          explanation: 'Fromage is masculine and uncountable, so we use "du fromage."'
        },
        {
          id: 'a1-ch2-l2-q14',
          type: 'error_correction',
          incorrectSentence: 'J\'ai des pain.',
          options: [
            'J\'ai du pain.',
            'J\'ai un pain.',
            'J\'ai de la pain.',
            'J\'ai le pain.'
          ],
          correctIndex: 0,
          explanation: 'Pain is uncountable and masculine, so we use "du pain" (some bread). "J\'ai du pain" is correct.'
        }
      ]
    },
    {
      id: 'a1-ch2-l3',
      title: 'Adjective Agreement & Placement',
      description: 'Learn how adjectives agree in gender and number, and where they are placed',
      order: 3,
      comprehensibleInput: {
        title: 'Ma Famille',
        frenchText: 'J\'ai une petite sœur. Elle est gentille et intelligente. Mon grand frère est sportif. Mes parents sont généreux. Nous avons une belle maison avec un grand jardin. C\'est une famille heureuse.',
        englishHint: 'I have a little sister. She is kind and intelligent. My big brother is athletic. My parents are generous. We have a beautiful house with a big garden. It\'s a happy family.',
        vocabularyHighlights: [
          { french: 'petite sœur', english: 'little sister' },
          { french: 'gentille', english: 'kind (feminine)' },
          { french: 'intelligente', english: 'intelligent (feminine)' },
          { french: 'grand frère', english: 'big brother' },
          { french: 'sportif', english: 'athletic (masculine)' },
          { french: 'généreux', english: 'generous (plural)' },
          { french: 'belle maison', english: 'beautiful house' },
          { french: 'grand jardin', english: 'big garden' }
        ]
      },
      warmupQuestions: [
        {
          id: 'a1-ch2-l3-q1',
          type: 'fill_blank',
          sentence: 'Je voudrais ___ pomme.',
          correctAnswer: 'une',
          acceptableAnswers: ['une'],
          explanation: 'Pomme is feminine, so we use "une pomme" (a/an apple).'
        },
        {
          id: 'a1-ch2-l3-q2',
          type: 'multiple_choice',
          prompt: 'Which partitive article is used for uncountable feminine nouns?',
          options: ['du', 'de la', 'des', 'une'],
          correctIndex: 1,
          explanation: '"De la" is the partitive article for uncountable feminine nouns (e.g., de la salade = some salad).'
        }
      ],
      drillQuestions: [
        {
          id: 'a1-ch2-l3-q3',
          type: 'multiple_choice',
          prompt: 'What must adjectives agree with in French?',
          options: [
            'Only the gender of the noun',
            'Only the number of the noun',
            'Both the gender and number of the noun',
            'Adjectives never change'
          ],
          correctIndex: 2,
          explanation: 'French adjectives must agree in both gender (masculine/feminine) and number (singular/plural) with the noun they describe.'
        },
        {
          id: 'a1-ch2-l3-q4',
          type: 'multiple_choice',
          prompt: 'How do you usually make an adjective feminine?',
          options: [
            'Add -s',
            'Add -e',
            'Add -es',
            'No change needed'
          ],
          correctIndex: 1,
          explanation: 'Most adjectives become feminine by adding -e (e.g., grand → grande, petit → petite).'
        },
        {
          id: 'a1-ch2-l3-q5',
          type: 'fill_blank',
          sentence: 'Elle est ___ (intelligent).',
          correctAnswer: 'intelligente',
          acceptableAnswers: ['intelligente'],
          explanation: 'Since "elle" is feminine, we add -e to make "intelligent" become "intelligente."'
        },
        {
          id: 'a1-ch2-l3-q6',
          type: 'multiple_choice',
          prompt: 'How do you usually make an adjective plural?',
          options: [
            'Add -e',
            'Add -s',
            'Add -es',
            'Add -x'
          ],
          correctIndex: 1,
          explanation: 'Most adjectives become plural by adding -s (e.g., grand → grands, petite → petites).'
        },
        {
          id: 'a1-ch2-l3-q7',
          type: 'fill_blank',
          sentence: 'Les filles sont ___ (content).',
          correctAnswer: 'contentes',
          acceptableAnswers: ['contentes'],
          explanation: '"Les filles" is feminine plural, so we add -e for feminine and -s for plural: "contentes."'
        },
        {
          id: 'a1-ch2-l3-q8',
          type: 'multiple_choice',
          prompt: 'What does BANGS stand for in French adjective placement?',
          options: [
            'Big, Ancient, New, Good, Small',
            'Beauty, Age, Number, Goodness, Size',
            'Beautiful, Angry, Nice, Great, Short',
            'Best, Average, Negative, Good, Super'
          ],
          correctIndex: 1,
          explanation: 'BANGS (Beauty, Age, Number, Goodness, Size) are adjectives that typically come BEFORE the noun in French.'
        },
        {
          id: 'a1-ch2-l3-q9',
          type: 'multiple_choice',
          prompt: 'Where do most French adjectives go?',
          options: [
            'Before the noun',
            'After the noun',
            'Either before or after',
            'At the beginning of the sentence'
          ],
          correctIndex: 1,
          explanation: 'Most French adjectives come AFTER the noun (e.g., une voiture rouge = a red car), except BANGS adjectives.'
        },
        {
          id: 'a1-ch2-l3-q10',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'a big house',
          correctAnswer: 'une grande maison',
          acceptableAnswers: ['une grande maison'],
          explanation: '"Grand" is a BANGS adjective (size), so it goes before the noun. Maison is feminine, so "grand" becomes "grande."'
        },
        {
          id: 'a1-ch2-l3-q11',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'a red car',
          correctAnswer: 'une voiture rouge',
          acceptableAnswers: ['une voiture rouge'],
          explanation: 'Color adjectives come after the noun in French. "Une voiture rouge" = a red car.'
        },
        {
          id: 'a1-ch2-l3-q12',
          type: 'error_correction',
          incorrectSentence: 'Elle a un chat noir et un chat blanc.',
          options: [
            'Elle a un chat noir et une chat blanche.',
            'Elle a un chat noir et un chatte blanche.',
            'Elle a un chat noir et une chatte blanche.',
            'Elle a un chat noir et un chat blanche.'
          ],
          correctIndex: 2,
          explanation: 'The second cat is feminine (une chatte), so "blanc" becomes "blanche." The correct answer is "Elle a un chat noir et une chatte blanche."'
        },
        {
          id: 'a1-ch2-l3-q13',
          type: 'error_correction',
          incorrectSentence: 'J\'ai une maison belle.',
          options: [
            'J\'ai une belle maison.',
            'J\'ai un belle maison.',
            'J\'ai des belle maison.',
            'J\'ai la maison belle.'
          ],
          correctIndex: 0,
          explanation: '"Beau/belle" is a BANGS adjective (beauty) and goes before the noun. The correct sentence is "J\'ai une belle maison."'
        },
        {
          id: 'a1-ch2-l3-q14',
          type: 'fill_blank',
          sentence: 'Les garçons sont ___ (sportif).',
          correctAnswer: 'sportifs',
          acceptableAnswers: ['sportifs'],
          explanation: '"Les garçons" is masculine plural, so we add -s to make "sportif" become "sportifs."'
        }
      ]
    },
    {
      id: 'a1-ch2-l4',
      title: 'Common Adjectives Practice',
      description: 'Practice using common French adjectives with proper agreement',
      order: 4,
      comprehensibleInput: {
        title: 'Description',
        frenchText: 'Mon ami a un petit chien noir. Sa sœur a un grand chat blanc. Leur maison est belle avec des murs bleus. Le jardin a des fleurs rouges et des arbres verts. C\'est très joli !',
        englishHint: 'My friend has a small black dog. His sister has a big white cat. Their house is beautiful with blue walls. The garden has red flowers and green trees. It\'s very pretty!',
        vocabularyHighlights: [
          { french: 'petit', english: 'small (masculine)' },
          { french: 'noir', english: 'black (masculine)' },
          { french: 'grand', english: 'big (masculine)' },
          { french: 'blanc', english: 'white (masculine)' },
          { french: 'belle', english: 'beautiful (feminine)' },
          { french: 'bleus', english: 'blue (masculine plural)' },
          { french: 'rouges', english: 'red (plural)' },
          { french: 'verts', english: 'green (masculine plural)' }
        ]
      },
      warmupQuestions: [
        {
          id: 'a1-ch2-l4-q1',
          type: 'fill_blank',
          sentence: 'J\'ai une ___ voiture (petit).',
          correctAnswer: 'petite',
          acceptableAnswers: ['petite'],
          explanation: 'Voiture is feminine, so "petit" becomes "petite." "Petit" is a BANGS adjective, so it goes before the noun.'
        },
        {
          id: 'a1-ch2-l4-q2',
          type: 'multiple_choice',
          prompt: 'Where do color adjectives typically go in French?',
          options: [
            'Before the noun',
            'After the noun',
            'At the end of the sentence',
            'At the beginning of the sentence'
          ],
          correctIndex: 1,
          explanation: 'Color adjectives come after the noun in French (e.g., une voiture rouge = a red car).'
        }
      ],
      drillQuestions: [
        {
          id: 'a1-ch2-l4-q3',
          type: 'fill_blank',
          sentence: 'La maison est ___ (grand).',
          correctAnswer: 'grande',
          acceptableAnswers: ['grande'],
          explanation: 'Maison is feminine, so "grand" becomes "grande."'
        },
        {
          id: 'a1-ch2-l4-q4',
          type: 'fill_blank',
          sentence: 'Le chat est ___ (petit).',
          correctAnswer: 'petit',
          acceptableAnswers: ['petit'],
          explanation: 'Chat is masculine, so "petit" stays the same.'
        },
        {
          id: 'a1-ch2-l4-q5',
          type: 'multiple_choice',
          prompt: 'What is the feminine form of "bon"?',
          options: ['bone', 'bonne', 'bons', 'bon'],
          correctIndex: 1,
          explanation: 'The feminine form of "bon" (good) is "bonne." The final -n is doubled before adding -e.'
        },
        {
          id: 'a1-ch2-l4-q6',
          type: 'multiple_choice',
          prompt: 'What is the feminine form of "mauvais"?',
          options: ['mauvaise', 'mauvais', 'mauvaises', 'mauvase'],
          correctIndex: 0,
          explanation: 'The feminine form of "mauvais" (bad) is "mauvaise."'
        },
        {
          id: 'a1-ch2-l4-q7',
          type: 'fill_blank',
          sentence: 'C\'est une ___ idée (bon).',
          correctAnswer: 'bonne',
          acceptableAnswers: ['bonne'],
          explanation: 'Idée is feminine, so "bon" becomes "bonne."'
        },
        {
          id: 'a1-ch2-l4-q8',
          type: 'multiple_choice',
          prompt: 'What is the feminine singular form of "beau"?',
          options: ['beau', 'beaux', 'belle', 'belles'],
          correctIndex: 2,
          explanation: 'The feminine singular form of "beau" (beautiful/handsome) is "belle."'
        },
        {
          id: 'a1-ch2-l4-q9',
          type: 'fill_blank',
          sentence: 'J\'ai une voiture ___ (rouge).',
          correctAnswer: 'rouge',
          acceptableAnswers: ['rouge'],
          explanation: '"Rouge" is the same for both masculine and feminine. Colors come after the noun.'
        },
        {
          id: 'a1-ch2-l4-q10',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'a blue car',
          correctAnswer: 'une voiture bleue',
          acceptableAnswers: ['une voiture bleue'],
          explanation: 'Voiture is feminine, so "bleu" becomes "bleue." Colors come after the noun: "une voiture bleue."'
        },
        {
          id: 'a1-ch2-l4-q11',
          type: 'fill_blank',
          sentence: 'Les murs sont ___ (vert).',
          correctAnswer: 'verts',
          acceptableAnswers: ['verts'],
          explanation: '"Les murs" is masculine plural, so "vert" becomes "verts."'
        },
        {
          id: 'a1-ch2-l4-q12',
          type: 'fill_blank',
          sentence: 'Elle a une robe ___ (noir).',
          correctAnswer: 'noire',
          acceptableAnswers: ['noire'],
          explanation: 'Robe is feminine, so "noir" becomes "noire."'
        },
        {
          id: 'a1-ch2-l4-q13',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'a white cat',
          correctAnswer: 'un chat blanc',
          acceptableAnswers: ['un chat blanc'],
          explanation: 'Chat is masculine, so "blanc" stays the same. Colors come after the noun: "un chat blanc."'
        },
        {
          id: 'a1-ch2-l4-q14',
          type: 'error_correction',
          incorrectSentence: 'J\'ai des fleurs bleue.',
          options: [
            'J\'ai des fleurs bleues.',
            'J\'ai des fleurs bleu.',
            'J\'ai des fleur bleues.',
            'J\'ai une fleurs bleues.'
          ],
          correctIndex: 0,
          explanation: '"Fleurs" is feminine plural, so "bleu" becomes "bleues." The correct sentence is "J\'ai des fleurs bleues."'
        }
      ]
    },
    {
      id: 'a1-ch2-l5',
      title: 'Present Tense — ER Verbs (parler, manger, aimer)',
      description: 'Learn to conjugate regular -ER verbs in the present tense',
      order: 5,
      comprehensibleInput: {
        title: 'Ma Routine',
        frenchText: 'Je parle français tous les jours. Tu manges à la cantine. Il aime le chocolat. Elle étudie beaucoup. Nous regardons la télévision. Vous travaillez ensemble. Ils jouent au football. Elles dansent bien.',
        englishHint: 'I speak French every day. You eat at the cafeteria. He loves chocolate. She studies a lot. We watch television. You work together. They play football. They dance well.',
        vocabularyHighlights: [
          { french: 'je parle', english: 'I speak' },
          { french: 'tu manges', english: 'you eat' },
          { french: 'il aime', english: 'he loves' },
          { french: 'elle étudie', english: 'she studies' },
          { french: 'nous regardons', english: 'we watch' },
          { french: 'vous travaillez', english: 'you work' },
          { french: 'ils jouent', english: 'they play' },
          { french: 'elles dansent', english: 'they dance' }
        ]
      },
      warmupQuestions: [
        {
          id: 'a1-ch2-l5-q1',
          type: 'fill_blank',
          sentence: 'Elle a un ___ chien (beau).',
          correctAnswer: 'beau',
          acceptableAnswers: ['beau'],
          explanation: 'Chien is masculine, so "beau" stays the same. BANGS adjectives go before the noun.'
        },
        {
          id: 'a1-ch2-l5-q2',
          type: 'multiple_choice',
          prompt: 'What is the feminine plural form of "vert"?',
          options: ['vert', 'verte', 'verts', 'vertes'],
          correctIndex: 3,
          explanation: 'The feminine plural form of "vert" is "vertes" (add -e for feminine, then -s for plural).'
        },
        {
          id: 'a1-ch2-l5-q3',
          type: 'fill_blank',
          sentence: 'Les maisons sont ___ (blanc).',
          correctAnswer: 'blanches',
          acceptableAnswers: ['blanches'],
          explanation: '"Les maisons" is feminine plural, so "blanc" becomes "blanches."'
        }
      ],
      drillQuestions: [
        {
          id: 'a1-ch2-l5-q4',
          type: 'multiple_choice',
          prompt: 'What are the present tense endings for -ER verbs?',
          options: [
            '-e, -es, -e, -ons, -ez, -ent',
            '-s, -s, -t, -ons, -ez, -ent',
            '-is, -is, -it, -issons, -issez, -issent',
            '-e, -e, -e, -ons, -ez, -ent'
          ],
          correctIndex: 0,
          explanation: 'Regular -ER verbs use the endings: -e, -es, -e, -ons, -ez, -ent (je parle, tu parles, il/elle parle, nous parlons, vous parlez, ils/elles parlent).'
        },
        {
          id: 'a1-ch2-l5-q5',
          type: 'fill_blank',
          sentence: 'Je ___ (parler) français.',
          correctAnswer: 'parle',
          acceptableAnswers: ['parle'],
          explanation: 'For "je" with -ER verbs, remove -er and add -e: "je parle."'
        },
        {
          id: 'a1-ch2-l5-q6',
          type: 'fill_blank',
          sentence: 'Tu ___ (manger) une pomme.',
          correctAnswer: 'manges',
          acceptableAnswers: ['manges'],
          explanation: 'For "tu" with -ER verbs, remove -er and add -es: "tu manges."'
        },
        {
          id: 'a1-ch2-l5-q7',
          type: 'fill_blank',
          sentence: 'Il ___ (aimer) le chocolat.',
          correctAnswer: 'aime',
          acceptableAnswers: ['aime'],
          explanation: 'For "il/elle" with -ER verbs, remove -er and add -e: "il aime."'
        },
        {
          id: 'a1-ch2-l5-q8',
          type: 'fill_blank',
          sentence: 'Nous ___ (regarder) la télévision.',
          correctAnswer: 'regardons',
          acceptableAnswers: ['regardons'],
          explanation: 'For "nous" with -ER verbs, remove -er and add -ons: "nous regardons."'
        },
        {
          id: 'a1-ch2-l5-q9',
          type: 'fill_blank',
          sentence: 'Vous ___ (travailler) ici.',
          correctAnswer: 'travaillez',
          acceptableAnswers: ['travaillez'],
          explanation: 'For "vous" with -ER verbs, remove -er and add -ez: "vous travaillez."'
        },
        {
          id: 'a1-ch2-l5-q10',
          type: 'fill_blank',
          sentence: 'Elles ___ (danser) bien.',
          correctAnswer: 'dansent',
          acceptableAnswers: ['dansent'],
          explanation: 'For "ils/elles" with -ER verbs, remove -er and add -ent: "elles dansent."'
        },
        {
          id: 'a1-ch2-l5-q11',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'I study',
          correctAnswer: 'j\'étudie',
          acceptableAnswers: ['j\'étudie', 'j\'étudie', 'je étudie'],
          explanation: '"Étudier" is a regular -ER verb. "Je" + "étudie" = "j\'étudie" (I study).'
        },
        {
          id: 'a1-ch2-l5-q12',
          type: 'translation',
          direction: 'fr_to_en',
          sourceText: 'Ils jouent au football.',
          correctAnswer: 'They play football',
          acceptableAnswers: ['They play football', 'They play soccer', 'They are playing football', 'They are playing soccer'],
          explanation: '"Ils jouent" means "they play." "Jouer" is a regular -ER verb conjugated with "ils."'
        },
        {
          id: 'a1-ch2-l5-q13',
          type: 'error_correction',
          incorrectSentence: 'Nous parlons français mais tu parle anglais.',
          options: [
            'Nous parlons français mais tu parles anglais.',
            'Nous parle français mais tu parles anglais.',
            'Nous parlent français mais tu parles anglais.',
            'Nous parlons français mais tu parler anglais.'
          ],
          correctIndex: 0,
          explanation: 'For "tu," the correct ending is -es: "tu parles." The correct sentence is "Nous parlons français mais tu parles anglais."'
        },
        {
          id: 'a1-ch2-l5-q14',
          type: 'error_correction',
          incorrectSentence: 'Elle aimer le chocolat.',
          options: [
            'Elle aime le chocolat.',
            'Elle aimes le chocolat.',
            'Elle aimons le chocolat.',
            'Elle aimez le chocolat.'
          ],
          correctIndex: 0,
          explanation: 'For "elle," the correct ending is -e: "elle aime." The correct sentence is "Elle aime le chocolat."'
        },
        {
          id: 'a1-ch2-l5-q15',
          type: 'multiple_choice',
          prompt: 'Which form is correct for "we eat"?',
          options: ['nous mange', 'nous manges', 'nous mangons', 'nous mangent'],
          correctIndex: 2,
          explanation: 'For "nous" with -ER verbs, the ending is -ons: "nous mangons."'
        }
      ]
    },
    {
      id: 'a1-ch2-l6',
      title: 'Present Tense — IR/RE Verbs (finir, attendre)',
      description: 'Learn to conjugate regular -IR and -RE verbs in the present tense',
      order: 6,
      comprehensibleInput: {
        title: 'Activités Quotidiennes',
        frenchText: 'Je finis mes devoirs à huit heures. Tu choisis un livre à la bibliothèque. Elle attend le bus. Nous répondons aux questions. Vous réussissez vos examens. Ils vendent des légumes au marché.',
        englishHint: 'I finish my homework at eight o\'clock. You choose a book at the library. She waits for the bus. We answer the questions. You succeed at your exams. They sell vegetables at the market.',
        vocabularyHighlights: [
          { french: 'je finis', english: 'I finish' },
          { french: 'tu choisis', english: 'you choose' },
          { french: 'elle attend', english: 'she waits' },
          { french: 'nous répondons', english: 'we answer' },
          { french: 'vous réussissez', english: 'you succeed' },
          { french: 'ils vendent', english: 'they sell' }
        ]
      },
      warmupQuestions: [
        {
          id: 'a1-ch2-l6-q1',
          type: 'fill_blank',
          sentence: 'Nous ___ (parler) français en classe.',
          correctAnswer: 'parlons',
          acceptableAnswers: ['parlons'],
          explanation: 'For "nous" with -ER verbs, the ending is -ons: "nous parlons."'
        },
        {
          id: 'a1-ch2-l6-q2',
          type: 'multiple_choice',
          prompt: 'What is the correct conjugation of "aimer" for "ils"?',
          options: ['aime', 'aimes', 'aiment', 'aimez'],
          correctIndex: 2,
          explanation: 'For "ils/elles" with -ER verbs, the ending is -ent: "ils aiment."'
        }
      ],
      drillQuestions: [
        {
          id: 'a1-ch2-l6-q3',
          type: 'multiple_choice',
          prompt: 'What are the present tense endings for regular -IR verbs?',
          options: [
            '-e, -es, -e, -ons, -ez, -ent',
            '-is, -is, -it, -issons, -issez, -issent',
            '-s, -s, -t, -ons, -ez, -ent',
            '-i, -is, -it, -issons, -issez, -issent'
          ],
          correctIndex: 1,
          explanation: 'Regular -IR verbs use the endings: -is, -is, -it, -issons, -issez, -issent (je finis, tu finis, il finit, nous finissons, vous finissez, ils finissent).'
        },
        {
          id: 'a1-ch2-l6-q4',
          type: 'fill_blank',
          sentence: 'Je ___ (finir) mes devoirs.',
          correctAnswer: 'finis',
          acceptableAnswers: ['finis'],
          explanation: 'For "je" with -IR verbs, remove -ir and add -is: "je finis."'
        },
        {
          id: 'a1-ch2-l6-q5',
          type: 'fill_blank',
          sentence: 'Tu ___ (choisir) un livre.',
          correctAnswer: 'choisis',
          acceptableAnswers: ['choisis'],
          explanation: 'For "tu" with -IR verbs, remove -ir and add -is: "tu choisis."'
        },
        {
          id: 'a1-ch2-l6-q6',
          type: 'fill_blank',
          sentence: 'Nous ___ (réussir) l\'examen.',
          correctAnswer: 'réussissons',
          acceptableAnswers: ['réussissons'],
          explanation: 'For "nous" with -IR verbs, remove -ir and add -issons: "nous réussissons."'
        },
        {
          id: 'a1-ch2-l6-q7',
          type: 'multiple_choice',
          prompt: 'What are the present tense endings for regular -RE verbs?',
          options: [
            '-e, -es, -e, -ons, -ez, -ent',
            '-is, -is, -it, -issons, -issez, -issent',
            '-s, -s, -, -ons, -ez, -ent',
            '-re, -res, -re, -rons, -rez, -rent'
          ],
          correctIndex: 2,
          explanation: 'Regular -RE verbs use the endings: -s, -s, - (nothing for il/elle), -ons, -ez, -ent (j\'attends, tu attends, il attend, nous attendons, vous attendez, ils attendent).'
        },
        {
          id: 'a1-ch2-l6-q8',
          type: 'fill_blank',
          sentence: 'J\'___ (attendre) le bus.',
          correctAnswer: 'attends',
          acceptableAnswers: ['attends'],
          explanation: 'For "je" with -RE verbs, remove -re and add -s: "j\'attends."'
        },
        {
          id: 'a1-ch2-l6-q9',
          type: 'fill_blank',
          sentence: 'Elle ___ (répondre) à la question.',
          correctAnswer: 'répond',
          acceptableAnswers: ['répond'],
          explanation: 'For "il/elle" with -RE verbs, remove -re and add nothing: "elle répond."'
        },
        {
          id: 'a1-ch2-l6-q10',
          type: 'fill_blank',
          sentence: 'Vous ___ (vendre) des fruits.',
          correctAnswer: 'vendez',
          acceptableAnswers: ['vendez'],
          explanation: 'For "vous" with -RE verbs, remove -re and add -ez: "vous vendez."'
        },
        {
          id: 'a1-ch2-l6-q11',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'They finish',
          correctAnswer: 'ils finissent',
          acceptableAnswers: ['ils finissent', 'elles finissent'],
          explanation: 'For "ils/elles" with -IR verbs, remove -ir and add -issent: "ils finissent."'
        },
        {
          id: 'a1-ch2-l6-q12',
          type: 'translation',
          direction: 'fr_to_en',
          sourceText: 'Nous attendons le train.',
          correctAnswer: 'We wait for the train',
          acceptableAnswers: ['We wait for the train', 'We are waiting for the train', 'We await the train'],
          explanation: '"Nous attendons" means "we wait" or "we are waiting." "Attendre" is a regular -RE verb.'
        },
        {
          id: 'a1-ch2-l6-q13',
          type: 'error_correction',
          incorrectSentence: 'Il finir son travail.',
          options: [
            'Il finit son travail.',
            'Il finis son travail.',
            'Il finissons son travail.',
            'Il finissent son travail.'
          ],
          correctIndex: 0,
          explanation: 'For "il" with -IR verbs, the ending is -it: "il finit." The correct sentence is "Il finit son travail."'
        },
        {
          id: 'a1-ch2-l6-q14',
          type: 'error_correction',
          incorrectSentence: 'Je réponds mais tu répond aussi.',
          options: [
            'Je réponds mais tu répondes aussi.',
            'Je réponds mais tu réponds aussi.',
            'Je répond mais tu réponds aussi.',
            'Je réponds mais tu répondre aussi.'
          ],
          correctIndex: 1,
          explanation: 'For "tu" with -RE verbs, the ending is -s: "tu réponds." The correct sentence is "Je réponds mais tu réponds aussi."'
        }
      ]
    },
    {
      id: 'a1-ch2-l7',
      title: 'Irregular Present Tense (être, avoir, aller, faire)',
      description: 'Master the most common irregular verbs in the present tense',
      order: 7,
      comprehensibleInput: {
        title: 'Une Journée Typique',
        frenchText: 'Je suis étudiant. Tu as un livre. Il va à l\'école. Nous faisons nos devoirs. Vous êtes gentils. Elles ont une voiture. Je vais au parc. Nous sommes contents. Ils font du sport.',
        englishHint: 'I am a student. You have a book. He goes to school. We do our homework. You are kind. They have a car. I go to the park. We are happy. They play sports.',
        vocabularyHighlights: [
          { french: 'je suis', english: 'I am' },
          { french: 'tu as', english: 'you have' },
          { french: 'il va', english: 'he goes' },
          { french: 'nous faisons', english: 'we do/make' },
          { french: 'vous êtes', english: 'you are' },
          { french: 'elles ont', english: 'they have' },
          { french: 'je vais', english: 'I go' },
          { french: 'nous sommes', english: 'we are' }
        ]
      },
      warmupQuestions: [
        {
          id: 'a1-ch2-l7-q1',
          type: 'fill_blank',
          sentence: 'Tu ___ (finir) tes devoirs.',
          correctAnswer: 'finis',
          acceptableAnswers: ['finis'],
          explanation: 'For "tu" with -IR verbs, the ending is -is: "tu finis."'
        },
        {
          id: 'a1-ch2-l7-q2',
          type: 'fill_blank',
          sentence: 'Elle ___ (attendre) son ami.',
          correctAnswer: 'attend',
          acceptableAnswers: ['attend'],
          explanation: 'For "elle" with -RE verbs, there is no ending added: "elle attend."'
        },
        {
          id: 'a1-ch2-l7-q3',
          type: 'multiple_choice',
          prompt: 'What is the correct conjugation of "répondre" for "nous"?',
          options: ['répondons', 'répondez', 'répondent', 'réponds'],
          correctIndex: 0,
          explanation: 'For "nous" with -RE verbs, the ending is -ons: "nous répondons."'
        }
      ],
      drillQuestions: [
        {
          id: 'a1-ch2-l7-q4',
          type: 'multiple_choice',
          prompt: 'What is the conjugation of "être" (to be) for "je"?',
          options: ['suis', 'es', 'est', 'sommes'],
          correctIndex: 0,
          explanation: '"Être" is irregular. For "je," the form is "suis": "je suis."'
        },
        {
          id: 'a1-ch2-l7-q5',
          type: 'fill_blank',
          sentence: 'Tu ___ (être) intelligent.',
          correctAnswer: 'es',
          acceptableAnswers: ['es'],
          explanation: 'For "tu," the form of "être" is "es": "tu es."'
        },
        {
          id: 'a1-ch2-l7-q6',
          type: 'fill_blank',
          sentence: 'Nous ___ (être) contents.',
          correctAnswer: 'sommes',
          acceptableAnswers: ['sommes'],
          explanation: 'For "nous," the form of "être" is "sommes": "nous sommes."'
        },
        {
          id: 'a1-ch2-l7-q7',
          type: 'multiple_choice',
          prompt: 'What is the conjugation of "avoir" (to have) for "j\'"?',
          options: ['ai', 'as', 'a', 'avons'],
          correctIndex: 0,
          explanation: '"Avoir" is irregular. For "je," the form is "ai": "j\'ai."'
        },
        {
          id: 'a1-ch2-l7-q8',
          type: 'fill_blank',
          sentence: 'Elle ___ (avoir) un chat.',
          correctAnswer: 'a',
          acceptableAnswers: ['a'],
          explanation: 'For "il/elle," the form of "avoir" is "a": "elle a."'
        },
        {
          id: 'a1-ch2-l7-q9',
          type: 'fill_blank',
          sentence: 'Vous ___ (avoir) raison.',
          correctAnswer: 'avez',
          acceptableAnswers: ['avez'],
          explanation: 'For "vous," the form of "avoir" is "avez": "vous avez."'
        },
        {
          id: 'a1-ch2-l7-q10',
          type: 'multiple_choice',
          prompt: 'What is the conjugation of "aller" (to go) for "je"?',
          options: ['vais', 'vas', 'va', 'allons'],
          correctIndex: 0,
          explanation: '"Aller" is irregular. For "je," the form is "vais": "je vais."'
        },
        {
          id: 'a1-ch2-l7-q11',
          type: 'fill_blank',
          sentence: 'Ils ___ (aller) à l\'école.',
          correctAnswer: 'vont',
          acceptableAnswers: ['vont'],
          explanation: 'For "ils/elles," the form of "aller" is "vont": "ils vont."'
        },
        {
          id: 'a1-ch2-l7-q12',
          type: 'fill_blank',
          sentence: 'Je ___ (faire) mes devoirs.',
          correctAnswer: 'fais',
          acceptableAnswers: ['fais'],
          explanation: 'For "je," the form of "faire" is "fais": "je fais."'
        },
        {
          id: 'a1-ch2-l7-q13',
          type: 'fill_blank',
          sentence: 'Vous ___ (faire) du sport.',
          correctAnswer: 'faites',
          acceptableAnswers: ['faites'],
          explanation: 'For "vous," the form of "faire" is "faites": "vous faites."'
        },
        {
          id: 'a1-ch2-l7-q14',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'We are',
          correctAnswer: 'nous sommes',
          acceptableAnswers: ['nous sommes'],
          explanation: '"We are" is "nous sommes" in French. "Être" is irregular.'
        },
        {
          id: 'a1-ch2-l7-q15',
          type: 'translation',
          direction: 'fr_to_en',
          sourceText: 'Ils ont un chien.',
          correctAnswer: 'They have a dog',
          acceptableAnswers: ['They have a dog', 'They\'ve got a dog'],
          explanation: '"Ils ont" means "they have." "Avoir" is an irregular verb.'
        },
        {
          id: 'a1-ch2-l7-q16',
          type: 'error_correction',
          incorrectSentence: 'Je vais à l\'école et tu vas aussi, mais il aller demain.',
          options: [
            'Je vais à l\'école et tu vas aussi, mais il va demain.',
            'Je va à l\'école et tu vas aussi, mais il va demain.',
            'Je vais à l\'école et tu va aussi, mais il va demain.',
            'Je vais à l\'école et tu vas aussi, mais il ira demain.'
          ],
          correctIndex: 0,
          explanation: 'For "il," the form of "aller" is "va," not "aller." The correct sentence is "Je vais à l\'école et tu vas aussi, mais il va demain."'
        },
        {
          id: 'a1-ch2-l7-q17',
          type: 'error_correction',
          incorrectSentence: 'Nous faisons du sport mais vous faire du yoga.',
          options: [
            'Nous faisons du sport mais vous faites du yoga.',
            'Nous faites du sport mais vous faites du yoga.',
            'Nous faisons du sport mais vous faisons du yoga.',
            'Nous faire du sport mais vous faites du yoga.'
          ],
          correctIndex: 0,
          explanation: 'For "vous," the form of "faire" is "faites." The correct sentence is "Nous faisons du sport mais vous faites du yoga."'
        }
      ]
    }
  ]
}
