import type { Chapter } from '../../types/lesson'

export const b1Ch6: Chapter = {
  id: 'b1-ch6',
  title: 'Opinions, Conditionnel, Hypothèse',
  description: 'Express opinions, use conditional mood, form hypothetical statements with si clauses, introduction to subjunctive, and develop argumentation skills',
  level: 'B1',
  order: 6,
  lessons: [
    {
      id: 'b1-ch6-l1',
      title: 'Expressing Opinions',
      description: 'Learn to express and discuss opinions using various formal and informal expressions',
      order: 1,
      comprehensibleInput: {
        title: "L'importance de la lecture",
        frenchText: "À mon avis, la lecture est l"une des activités les plus enrichissantes. Je pense que lire régulièrement développe notre imagination et notre capacité de réflexion. Selon moi, les livres nous permettent de voyager dans le temps et l'espace sans quitter notre fauteuil. Il me semble que beaucoup de gens sous-estiment le pouvoir des mots. Je crois fermement que la lecture devrait occuper une place centrale dans notre vie quotidienne. D'après moi, ceux qui lisent développent une meilleure compréhension du monde. Je trouve que les bibliothèques sont des trésors qui méritent d'être préservés. Êtes-vous d'accord avec cette vision?\",
        englishHint: "An opinion piece about the importance of reading, using various opinion expressions",
        vocabularyHighlights: [
          { french: "enrichissante", english: "enriching" },
          { french: "la capacité de réflexion", english: "the ability to think/reflect" },
          { french: "sous-estiment", english: "underestimate" },
          { french: "fermement", english: "firmly" },
          { french: "quotidienne", english: "daily" },
          { french: "méritent d'être préservés", english: "deserve to be preserved" }
        ]
      },
      questions: [
        {
          id: 'b1-ch6-l1-q1',
          type: 'multiple_choice',
          prompt: 'Complete: "Cette ville est ___ belle que Paris."',
          options: ['plus', 'aussi', 'moins', 'All of the above'],
          correctIndex: 3,
          explanation: 'All three comparatives (plus, aussi, moins) can be used before adjectives to make comparisons. This A2 review prepares you for expressing comparative opinions.'
        },
        {
          id: 'b1-ch6-l1-q2',
          type: 'fill_blank',
          sentence: 'Demain, nous ___ au musée.',
          correctAnswer: 'irons',
          acceptableAnswers: ['irons', 'allons aller'],
          explanation: 'Review of futur simple: "nous irons" (we will go). The futur proche "allons aller" is also acceptable.'
        },
        {
          id: 'b1-ch6-l1-q3',
          type: 'multiple_choice',
          prompt: 'Which expression is most formal for expressing an opinion?',
          options: ['Je pense que', 'Il me semble que', 'Je trouve que', 'Je crois que'],
          correctIndex: 1,
          explanation: '"Il me semble que" (it seems to me that) is the most formal. "Je pense/crois/trouve que" are more commonly used in everyday conversation.'
        },
        {
          id: 'b1-ch6-l1-q4',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'In my opinion, this film is excellent.',
          correctAnswer: 'À mon avis, ce film est excellent.',
          acceptableAnswers: ['À mon avis, ce film est excellent.', 'Selon moi, ce film est excellent.', 'D\'après moi, ce film est excellent.'],
          explanation: '"À mon avis", "selon moi", and "d\'après moi" all mean "in my opinion" and are interchangeable for expressing personal viewpoints.'
        },
        {
          id: 'b1-ch6-l1-q5',
          type: 'fill_blank',
          sentence: 'Je ___ que cette solution est la meilleure.',
          correctAnswer: 'pense',
          acceptableAnswers: ['pense', 'crois', 'trouve'],
          explanation: '"Je pense/crois/trouve que" (I think that) are the most common ways to introduce an opinion. They all work in this context.'
        },
        {
          id: 'b1-ch6-l1-q6',
          type: 'multiple_choice',
          prompt: 'How do you say "I agree" in French?',
          options: ['Je suis accord', 'Je suis d\'accord', 'J\'ai d\'accord', 'Je fais d\'accord'],
          correctIndex: 1,
          explanation: '"Je suis d\'accord" means "I agree". Always use "être" (not avoir or faire) with "d\'accord". To disagree: "Je ne suis pas d\'accord".'
        },
        {
          id: 'b1-ch6-l1-q7',
          type: 'translation',
          direction: 'fr_to_en',
          sourceText: 'Selon moi, il est trop tard pour changer d\'avis.',
          correctAnswer: 'In my opinion, it is too late to change one\'s mind.',
          acceptableAnswers: ['In my opinion, it is too late to change one\'s mind.', 'According to me, it is too late to change your mind.', 'In my view, it is too late to change one\'s mind.'],
          explanation: '"Selon moi" = in my opinion/according to me. "Changer d\'avis" is an idiomatic expression meaning "to change one\'s mind".'
        },
        {
          id: 'b1-ch6-l1-q8',
          type: 'error_correction',
          incorrectSentence: 'Je trouve cette idée est brillante.',
          options: [
            'Je trouve cette idée brillante.',
            'Je trouve que cette idée est brillante.',
            'Je trouve cette idée soit brillante.',
            'Both A and B are correct'
          ],
          correctIndex: 3,
          explanation: 'You can say "Je trouve cette idée brillante" (I find this idea brilliant) OR "Je trouve que cette idée est brillante" (I think that this idea is brilliant). Both structures are correct.'
        },
        {
          id: 'b1-ch6-l1-q9',
          type: 'fill_blank',
          sentence: 'D\'___ moi, les réseaux sociaux ont changé notre société.',
          correctAnswer: 'après',
          acceptableAnswers: ['après'],
          explanation: '"D\'après moi" means "in my opinion" or "according to me". It\'s a slightly more formal way to express your viewpoint.'
        },
        {
          id: 'b1-ch6-l1-q10',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'I believe that education is essential.',
          correctAnswer: 'Je crois que l\'éducation est essentielle.',
          acceptableAnswers: ['Je crois que l\'éducation est essentielle.', 'Je pense que l\'éducation est essentielle.'],
          explanation: '"Je crois que" or "je pense que" both mean "I believe/think that". Remember that "éducation" is feminine, so the adjective is "essentielle".'
        },
        {
          id: 'b1-ch6-l1-q11',
          type: 'multiple_choice',
          prompt: 'Which sentence correctly expresses disagreement?',
          options: [
            'Je ne suis d\'accord pas.',
            'Je ne suis pas d\'accord.',
            'Je suis ne pas d\'accord.',
            'Je ne d\'accord suis pas.'
          ],
          correctIndex: 1,
          explanation: '"Je ne suis pas d\'accord" is the correct way to say "I disagree". The negation "ne...pas" surrounds the verb "suis".'
        },
        {
          id: 'b1-ch6-l1-q12',
          type: 'fill_blank',
          sentence: 'Il me ___ que vous avez raison sur ce point.',
          correctAnswer: 'semble',
          acceptableAnswers: ['semble'],
          explanation: '"Il me semble que" (it seems to me that) is a formal way to express an opinion with some uncertainty. "Sembler" means "to seem".'
        }
      ]
    },
    {
      id: 'b1-ch6-l2',
      title: 'Conditionnel Présent — Formation',
      description: 'Master the formation of the present conditional for regular verbs and polite requests',
      order: 2,
      comprehensibleInput: {
        title: "Si je gagnais à la loterie",
        frenchText: "Si je gagnais à la loterie, ma vie changerait complètement. D"abord, je voyagerais autour du monde. Je visiterais tous les pays que j'ai toujours rêvé de voir. J'achèterais une belle maison au bord de la mer où je passerais mes étés. Je donnerais une partie de mon argent à des associations caritatives. Je travaillerais moins et je consacrerais plus de temps à mes passions. J'apprendrais à jouer du piano, quelque chose que je n'ai jamais eu le temps de faire. Je partagerais ma fortune avec ma famille et mes amis proches. Nous organiserions des fêtes mémorables. Bien sûr, je placerais aussi une somme importante pour assurer mon avenir. Ce serait un rêve devenu réalité!\",
        englishHint: "A fantasy text about what someone would do if they won the lottery, using the conditional mood throughout",
        vocabularyHighlights: [
          { french: "au bord de la mer", english: "by the seaside" },
          { french: "des associations caritatives", english: "charitable organizations" },
          { french: "consacrerais", english: "would dedicate" },
          { french: "mes passions", english: "my passions" },
          { french: "placer une somme", english: "to invest a sum" },
          { french: "assurer mon avenir", english: "to secure my future" }
        ]
      },
      questions: [
        {
          id: 'b1-ch6-l2-q1',
          type: 'fill_blank',
          sentence: 'Je ___ que ce restaurant est trop cher.',
          correctAnswer: 'pense',
          acceptableAnswers: ['pense', 'trouve', 'crois'],
          explanation: 'Review: "Je pense/trouve/crois que" all express opinion. Now we\'ll learn how to make these more polite with the conditional!'
        },
        {
          id: 'b1-ch6-l2-q2',
          type: 'multiple_choice',
          prompt: 'How do you say "in my opinion" most formally?',
          options: ['Je pense que', 'À mon avis', 'Il me semble que', 'Je trouve que'],
          correctIndex: 2,
          explanation: 'Review: "Il me semble que" is the most formal opinion expression. The conditional will add even more politeness!'
        },
        {
          id: 'b1-ch6-l2-q3',
          type: 'multiple_choice',
          prompt: 'What is the conditional stem for regular verbs?',
          options: ['The present tense stem', 'The infinitive', 'The past participle', 'The imparfait stem'],
          correctIndex: 1,
          explanation: 'The conditional is formed using the full infinitive as the stem, then adding imparfait endings: -ais, -ais, -ait, -ions, -iez, -aient.'
        },
        {
          id: 'b1-ch6-l2-q4',
          type: 'fill_blank',
          sentence: 'Je ___ (parler) avec le directeur demain.',
          correctAnswer: 'parlerais',
          acceptableAnswers: ['parlerais'],
          explanation: 'Parler → parler + ais = parlerais (I would speak). Take the infinitive "parler" and add the ending "-ais" for "je".'
        },
        {
          id: 'b1-ch6-l2-q5',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'I would like a coffee, please.',
          correctAnswer: 'Je voudrais un café, s\'il vous plaît.',
          acceptableAnswers: ['Je voudrais un café, s\'il vous plaît.', 'J\'aimerais un café, s\'il vous plaît.'],
          explanation: '"Je voudrais" (I would like) is much more polite than "je veux" (I want). This is one of the most important uses of the conditional for politeness.'
        },
        {
          id: 'b1-ch6-l2-q6',
          type: 'fill_blank',
          sentence: 'Tu ___ (finir) ton travail plus rapidement avec de l\'aide.',
          correctAnswer: 'finirais',
          acceptableAnswers: ['finirais'],
          explanation: 'Finir → finir + ais = finirais (you would finish). For -ir verbs, keep the full infinitive and add the conditional ending.'
        },
        {
          id: 'b1-ch6-l2-q7',
          type: 'error_correction',
          incorrectSentence: 'Nous attendrions le bus, mais il ne vient jamais.',
          options: [
            'Nous attendions le bus, mais il ne vient jamais.',
            'Nous attendrions le bus, mais il ne venait jamais.',
            'Nous attendions le bus, mais il ne venait jamais.',
            'The sentence is correct as written'
          ],
          correctIndex: 2,
          explanation: 'When describing a past habitual action, use imparfait for both verbs: "nous attendions" and "il ne venait jamais". The conditional "attendrions" suggests a hypothetical, not a past habit.'
        },
        {
          id: 'b1-ch6-l2-q8',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'Could you help me, please?',
          correctAnswer: 'Pourriez-vous m\'aider, s\'il vous plaît?',
          acceptableAnswers: ['Pourriez-vous m\'aider, s\'il vous plaît?', 'Pourrais-tu m\'aider, s\'il te plaît?'],
          explanation: '"Pourriez-vous" (could you - formal) or "pourrais-tu" (could you - informal) uses the conditional of "pouvoir" to make a very polite request.'
        },
        {
          id: 'b1-ch6-l2-q9',
          type: 'fill_blank',
          sentence: 'Ils ___ (aimer) visiter ce musée.',
          correctAnswer: 'aimeraient',
          acceptableAnswers: ['aimeraient'],
          explanation: 'Aimer → aimer + aient = aimeraient (they would like). The ending "-aient" is used for "ils/elles" in the conditional.'
        },
        {
          id: 'b1-ch6-l2-q10',
          type: 'multiple_choice',
          prompt: 'Which sentence uses the conditional correctly for politeness?',
          options: [
            'Je veux un rendez-vous.',
            'Je voudrais un rendez-vous.',
            'Je voulais un rendez-vous.',
            'Je voudrai un rendez-vous.'
          ],
          correctIndex: 1,
          explanation: '"Je voudrais" (I would like) is the conditional form used for polite requests. "Je veux" is too direct, "je voulais" is imparfait, and "je voudrai" is future.'
        },
        {
          id: 'b1-ch6-l2-q11',
          type: 'fill_blank',
          sentence: 'Vous ___ (réussir) si vous travailliez davantage.',
          correctAnswer: 'réussiriez',
          acceptableAnswers: ['réussiriez'],
          explanation: 'Réussir → réussir + iez = réussiriez (you would succeed). The ending "-iez" is for "vous" in the conditional.'
        },
        {
          id: 'b1-ch6-l2-q12',
          type: 'translation',
          direction: 'fr_to_en',
          sourceText: 'Nous regarderions un film ce soir.',
          correctAnswer: 'We would watch a film tonight.',
          acceptableAnswers: ['We would watch a film tonight.', 'We would watch a movie tonight.'],
          explanation: '"Nous regarderions" is the conditional of "regarder" (to watch). Formation: regarder + ions = regarderions.'
        }
      ]
    },
    {
      id: 'b1-ch6-l3',
      title: 'Conditionnel — Irregular Stems',
      description: 'Learn the irregular stems for the conditional mood, similar to futur simple',
      order: 3,
      comprehensibleInput: {
        title: "Conseils pour une vie équilibrée",
        frenchText: "Chère lectrice, cher lecteur, si vous me demandiez des conseils pour vivre mieux, voici ce que je vous dirais. Vous devriez dormir au moins huit heures par nuit. Vous pourriez commencer chaque journée par une activité physique légère. Il faudrait manger des repas équilibrés et boire beaucoup d'eau. Vous auriez intérêt à réduire le temps passé devant les écrans. Il serait bénéfique de cultiver des relations authentiques avec vos proches. Vous voudriez peut-être apprendre une nouvelle compétence ou un hobby. Il faudrait savoir dire non quand vous êtes déjà surchargé. Vous viendriez à réaliser que le bonheur se trouve dans les petites choses. Vous verriez rapidement des améliorations dans votre bien-être. Enfin, vous feriez bien de prendre du temps pour vous-même chaque jour. Ces simples changements pourraient transformer votre vie!",
        englishHint: "An advice column using conditional with irregular verbs to give suggestions for a balanced life",
        vocabularyHighlights: [
          { french: "équilibrée", english: "balanced" },
          { french: "au moins", english: "at least" },
          { french: "avoir intérêt à", english: "to benefit from, to have an interest in" },
          { french: "les écrans", english: "screens" },
          { french: "surchargé", english: "overloaded, overwhelmed" },
          { french: "le bien-être", english: "well-being" }
        ]
      },
      questions: [
        {
          id: 'b1-ch6-l3-q1',
          type: 'fill_blank',
          sentence: 'Je ___ (vouloir) un thé, s\'il vous plaît.',
          correctAnswer: 'voudrais',
          acceptableAnswers: ['voudrais'],
          explanation: 'Review: "Je voudrais" (I would like) uses the conditional for politeness. Now we\'ll learn all the irregular conditional stems!'
        },
        {
          id: 'b1-ch6-l3-q2',
          type: 'multiple_choice',
          prompt: 'What is the conditional ending for "nous"?',
          options: ['-ons', '-ions', '-erions', '-rions'],
          correctIndex: 1,
          explanation: 'Review: The conditional uses imparfait endings. For "nous", it\'s "-ions" (same as imparfait).'
        },
        {
          id: 'b1-ch6-l3-q3',
          type: 'fill_blank',
          sentence: 'Je ___ (être) ravi de vous aider.',
          correctAnswer: 'serais',
          acceptableAnswers: ['serais'],
          explanation: 'Être has the irregular stem "ser-" in the conditional: je serais, tu serais, il serait, nous serions, vous seriez, ils seraient.'
        },
        {
          id: 'b1-ch6-l3-q4',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'I would have the time to help you.',
          correctAnswer: 'J\'aurais le temps de vous aider.',
          acceptableAnswers: ['J\'aurais le temps de vous aider.', 'J\'aurais le temps de t\'aider.'],
          explanation: 'Avoir has the irregular stem "aur-": j\'aurais (I would have). This is identical to the futur simple stem.'
        },
        {
          id: 'b1-ch6-l3-q5',
          type: 'fill_blank',
          sentence: 'Nous ___ (faire) mieux de partir maintenant.',
          correctAnswer: 'ferions',
          acceptableAnswers: ['ferions'],
          explanation: 'Faire has the irregular stem "fer-": nous ferions (we would do). "Faire mieux de" means "to do better to / should".'
        },
        {
          id: 'b1-ch6-l3-q6',
          type: 'multiple_choice',
          prompt: 'What is the irregular stem of "aller" in the conditional?',
          options: ['all-', 'ir-', 'aur-', 'all-er-'],
          correctIndex: 1,
          explanation: 'Aller has the very irregular stem "ir-": j\'irais, tu irais, il irait, nous irions, vous iriez, ils iraient (I would go, etc.).'
        },
        {
          id: 'b1-ch6-l3-q7',
          type: 'fill_blank',
          sentence: 'Tu ___ (pouvoir) m\'aider avec ce projet?',
          correctAnswer: 'pourrais',
          acceptableAnswers: ['pourrais'],
          explanation: 'Pouvoir has the stem "pourr-": tu pourrais (you could/would be able to). This is commonly used for polite requests.'
        },
        {
          id: 'b1-ch6-l3-q8',
          type: 'error_correction',
          incorrectSentence: 'Si j\'avais plus d\'argent, je venirais plus souvent.',
          options: [
            'Si j\'avais plus d\'argent, je viendrais plus souvent.',
            'Si j\'aurais plus d\'argent, je viendrais plus souvent.',
            'Si j\'avais plus d\'argent, je viendrai plus souvent.',
            'The sentence is correct'
          ],
          correctIndex: 0,
          explanation: 'Venir has the stem "viendr-": je viendrais (I would come). Note: "venirais" is not correct. Also remember: never use "si + conditionnel"!'
        },
        {
          id: 'b1-ch6-l3-q9',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'You would see the difference immediately.',
          correctAnswer: 'Vous verriez la différence immédiatement.',
          acceptableAnswers: ['Vous verriez la différence immédiatement.', 'Tu verrais la différence immédiatement.'],
          explanation: 'Voir has the stem "verr-": vous verriez (you would see), tu verrais. Same stem as futur simple.'
        },
        {
          id: 'b1-ch6-l3-q10',
          type: 'fill_blank',
          sentence: 'Il ___ (savoir) quoi faire dans cette situation.',
          correctAnswer: 'saurait',
          acceptableAnswers: ['saurait'],
          explanation: 'Savoir has the stem "saur-": il saurait (he would know). This stem is the same as futur simple.'
        },
        {
          id: 'b1-ch6-l3-q11',
          type: 'multiple_choice',
          prompt: 'Which sentence correctly uses the conditional of "devoir"?',
          options: [
            'Vous deverez étudier davantage.',
            'Vous deviez étudier davantage.',
            'Vous devriez étudier davantage.',
            'Vous devrez étudier davantage.'
          ],
          correctIndex: 2,
          explanation: 'Devoir has the stem "devr-": vous devriez (you should/ought to). Option A is incorrect spelling, B is imparfait, D is futur simple.'
        },
        {
          id: 'b1-ch6-l3-q12',
          type: 'translation',
          direction: 'fr_to_en',
          sourceText: 'Ils voudraient partir en vacances cet été.',
          correctAnswer: 'They would like to go on vacation this summer.',
          acceptableAnswers: ['They would like to go on vacation this summer.', 'They would like to leave on vacation this summer.'],
          explanation: 'Vouloir has the stem "voudr-": ils voudraient (they would like). "Partir en vacances" = to go on vacation.'
        }
      ]
    },
    {
      id: 'b1-ch6-l4',
      title: 'Si Clauses — Type 1 & 2',
      description: 'Form hypothetical statements using si clauses with present/future and imparfait/conditional',
      order: 4,
      comprehensibleInput: {
        title: "Scénarios hypothétiques",
        frenchText: "Les phrases avec « si » nous permettent d"imaginer différentes possibilités. Si vous apprenez une langue étrangère, vous aurez plus d'opportunités professionnelles. Si nous prenons le train de 8h, nous arriverons à temps pour la réunion. Mais attention : si j'avais plus de temps libre, je voyagerais davantage - voilà une situation hypothétique. Si elle étudiait plus sérieusement, elle réussirait ses examens. Si nous habitions à la campagne, nous aurions un grand jardin. Si tu étais à ma place, que ferais-tu? Si on gagnait à la loterie, on achèterait une maison en bord de mer. Remarquez la différence : les premières phrases parlent de situations réelles et possibles, tandis que les dernières décrivent des situations hypothétiques ou irréelles. C'est la clé pour bien utiliser les structures avec « si ».\",
        englishHint: "A text explaining and demonstrating both types of si clauses: real/possible conditions and hypothetical/unreal conditions",
        vocabularyHighlights: [
          { french: "nous permettent de", english: "allow us to" },
          { french: "des opportunités", english: "opportunities" },
          { french: "à temps", english: "on time" },
          { french: "davantage", english: "more" },
          { french: "à ma place", english: "in my place/shoes" },
          { french: "tandis que", english: "while, whereas" }
        ]
      },
      questions: [
        {
          id: 'b1-ch6-l4-q1',
          type: 'fill_blank',
          sentence: 'Vous ___ (devoir) consulter un médecin.',
          correctAnswer: 'devriez',
          acceptableAnswers: ['devriez'],
          explanation: 'Review: "Vous devriez" (you should) uses the conditional of devoir with the stem "devr-". Perfect for giving advice!'
        },
        {
          id: 'b1-ch6-l4-q2',
          type: 'multiple_choice',
          prompt: 'What is the conditional form of "je vais"?',
          options: ['j\'allais', 'j\'irai', 'j\'irais', 'je vais aller'],
          correctIndex: 2,
          explanation: 'Review: Aller has the stem "ir-" in conditional: j\'irais (I would go). Option A is imparfait, B is futur, D is futur proche.'
        },
        {
          id: 'b1-ch6-l4-q3',
          type: 'multiple_choice',
          prompt: 'In a Type 1 si clause (real/possible), what tenses are used? Si + ___, ___',
          options: [
            'présent, présent',
            'présent, futur simple',
            'imparfait, conditionnel',
            'futur, conditionnel'
          ],
          correctIndex: 1,
          explanation: 'Type 1 (real/possible): Si + présent, futur simple. Example: "Si j\'ai le temps, j\'irai au cinéma" (If I have time, I will go to the cinema).'
        },
        {
          id: 'b1-ch6-l4-q4',
          type: 'fill_blank',
          sentence: 'Si tu ___ (venir) ce soir, nous serons contents.',
          correctAnswer: 'viens',
          acceptableAnswers: ['viens'],
          explanation: 'Type 1 si clause: Use présent after "si" for real/possible conditions. "Si tu viens, nous serons contents" (If you come, we will be happy).'
        },
        {
          id: 'b1-ch6-l4-q5',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'If it rains tomorrow, we will stay home.',
          correctAnswer: 'S\'il pleut demain, nous resterons à la maison.',
          acceptableAnswers: ['S\'il pleut demain, nous resterons à la maison.', 'S\'il pleut demain, on restera à la maison.'],
          explanation: 'Type 1: Si + présent (pleut), futur simple (resterons). This describes a real possibility about tomorrow.'
        },
        {
          id: 'b1-ch6-l4-q6',
          type: 'multiple_choice',
          prompt: 'In a Type 2 si clause (hypothetical/unreal), what tenses are used? Si + ___, ___',
          options: [
            'présent, futur',
            'imparfait, conditionnel',
            'conditionnel, conditionnel',
            'futur, conditionnel'
          ],
          correctIndex: 1,
          explanation: 'Type 2 (hypothetical/unreal): Si + imparfait, conditionnel. Example: "Si j\'avais de l\'argent, j\'achèterais une maison" (If I had money, I would buy a house).'
        },
        {
          id: 'b1-ch6-l4-q7',
          type: 'fill_blank',
          sentence: 'Si je ___ (être) riche, je voyagerais autour du monde.',
          correctAnswer: 'étais',
          acceptableAnswers: ['étais'],
          explanation: 'Type 2: Use imparfait after "si" for hypothetical conditions. "Si j\'étais riche" (If I were rich) expresses something unreal or contrary to current reality.'
        },
        {
          id: 'b1-ch6-l4-q8',
          type: 'error_correction',
          incorrectSentence: 'Si tu auras le temps, tu pourras m\'aider.',
          options: [
            'Si tu as le temps, tu pourras m\'aider.',
            'Si tu avais le temps, tu pourrais m\'aider.',
            'Si tu auras le temps, tu pouvais m\'aider.',
            'Both A and B are correct'
          ],
          correctIndex: 3,
          explanation: 'NEVER use futur or conditionnel after "si"! Option A is Type 1 (real): Si + présent, futur. Option B is Type 2 (hypothetical): Si + imparfait, conditionnel. Both are grammatically correct but have different meanings.'
        },
        {
          id: 'b1-ch6-l4-q9',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'If I had more time, I would read more books.',
          correctAnswer: 'Si j\'avais plus de temps, je lirais plus de livres.',
          acceptableAnswers: ['Si j\'avais plus de temps, je lirais plus de livres.', 'Si j\'avais plus de temps, je lirais davantage de livres.'],
          explanation: 'Type 2: Si + imparfait (avais), conditionnel (lirais). This expresses a hypothetical situation - the speaker doesn\'t currently have more time.'
        },
        {
          id: 'b1-ch6-l4-q10',
          type: 'fill_blank',
          sentence: 'Si nous ___ (partir) maintenant, nous arriverons avant midi.',
          correctAnswer: 'partons',
          acceptableAnswers: ['partons'],
          explanation: 'Type 1: Use présent (partons) after "si" because this is a real, possible scenario. The result clause uses futur (arriverons).'
        },
        {
          id: 'b1-ch6-l4-q11',
          type: 'error_correction',
          incorrectSentence: 'Si j\'aurais su, je ne serais pas venu.',
          options: [
            'Si j\'ai su, je ne serais pas venu.',
            'Si j\'avais su, je ne serais pas venu.',
            'Si je saurais, je ne viendrais pas.',
            'The sentence is correct'
          ],
          correctIndex: 1,
          explanation: 'Common error! NEVER "si + conditionnel". Use "si j\'avais su" (if I had known). This is actually Type 3 (past hypothetical), but the rule is the same: never conditionnel after "si".'
        },
        {
          id: 'b1-ch6-l4-q12',
          type: 'translation',
          direction: 'fr_to_en',
          sourceText: 'Si vous étudiez régulièrement, vous ferez des progrès.',
          correctAnswer: 'If you study regularly, you will make progress.',
          acceptableAnswers: ['If you study regularly, you will make progress.', 'If you study regularly, you\'ll make progress.'],
          explanation: 'Type 1: Si + présent (étudiez), futur simple (ferez). "Faire des progrès" = to make progress. This describes a real, probable outcome.'
        }
      ]
    },
    {
      id: 'b1-ch6-l5',
      title: 'Subjunctive Introduction',
      description: 'Introduction to the subjunctive mood for expressing necessity, wishes, emotions, and doubt',
      order: 5,
      comprehensibleInput: {
        title: "Souhaits et nécessités",
        frenchText: "Dans la vie, il y a beaucoup de choses que nous voulons et devons faire. Il faut que nous soyons réalistes dans nos ambitions. Je veux que tu saches combien tu es important pour moi. Il est important que vous fassiez attention à votre santé. Je souhaite que mes enfants aillent à l"université un jour. Bien que ce soit difficile, nous devons continuer. Il est essentiel que tu aies confiance en tes capacités. Mes parents veulent que je puisse réussir dans la vie. Il faut que nous fassions des efforts pour protéger l'environnement. Le professeur demande que les étudiants soient à l'heure. Je doute qu'il vienne à la fête ce soir. Il est possible qu'elle ait raison sur ce point. Bien que nous soyons fatigués, le travail doit continuer. Ces expressions montrent l'importance du subjonctif pour exprimer la subjectivité.\",
        englishHint: "A text about wishes, desires, and necessities, introducing the subjunctive mood and its common triggers",
        vocabularyHighlights: [
          { french: "les souhaits", english: "wishes" },
          { french: "les nécessités", english: "necessities" },
          { french: "réalistes", english: "realistic" },
          { french: "les ambitions", english: "ambitions" },
          { french: "aies confiance en", english: "have confidence in" },
          { french: "la subjectivité", english: "subjectivity" }
        ]
      },
      questions: [
        {
          id: 'b1-ch6-l5-q1',
          type: 'fill_blank',
          sentence: 'Si elle ___ (avoir) plus d\'argent, elle achèterait une voiture.',
          correctAnswer: 'avait',
          acceptableAnswers: ['avait'],
          explanation: 'Review: Type 2 si clause uses imparfait (avait) after "si" and conditionnel (achèterait) in the result clause.'
        },
        {
          id: 'b1-ch6-l5-q2',
          type: 'error_correction',
          incorrectSentence: 'Si nous irons au restaurant, nous mangerons bien.',
          options: [
            'Si nous allons au restaurant, nous mangerons bien.',
            'Si nous allions au restaurant, nous mangerions bien.',
            'Si nous sommes allés au restaurant, nous avons bien mangé.',
            'Both A and B are correct'
          ],
          correctIndex: 3,
          explanation: 'Review: NEVER "si + futur"! Use Type 1 (si + présent, futur) or Type 2 (si + imparfait, conditionnel). Both A and B are correct with different meanings.'
        },
        {
          id: 'b1-ch6-l5-q3',
          type: 'multiple_choice',
          prompt: 'The subjunctive mood is used to express:',
          options: [
            'Facts and certainty',
            'Wishes, necessity, doubt, and emotions',
            'Past actions only',
            'Future plans'
          ],
          correctIndex: 1,
          explanation: 'The subjunctive expresses subjectivity: wishes, necessity, doubt, emotions. The indicative expresses facts and certainty.'
        },
        {
          id: 'b1-ch6-l5-q4',
          type: 'fill_blank',
          sentence: 'Il faut que je ___ (être) à l\'heure.',
          correctAnswer: 'sois',
          acceptableAnswers: ['sois'],
          explanation: '"Il faut que" (it is necessary that) triggers the subjunctive. Être → que je sois. This is one of the most common subjunctive triggers.'
        },
        {
          id: 'b1-ch6-l5-q5',
          type: 'multiple_choice',
          prompt: 'What is the subjunctive form of "avoir" for "tu"?',
          options: ['aies', 'as', 'avais', 'auras'],
          correctIndex: 0,
          explanation: 'Avoir in subjunctive: que j\'aie, que tu aies, qu\'il ait, que nous ayons, que vous ayez, qu\'ils aient. Very irregular!'
        },
        {
          id: 'b1-ch6-l5-q6',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'I want you to come to the party.',
          correctAnswer: 'Je veux que tu viennes à la fête.',
          acceptableAnswers: ['Je veux que tu viennes à la fête.', 'Je veux que vous veniez à la fête.'],
          explanation: '"Je veux que" (I want that) triggers the subjunctive. Venir → que tu viennes (that you come). Note the different subjects: je veux vs. tu viennes.'
        },
        {
          id: 'b1-ch6-l5-q7',
          type: 'fill_blank',
          sentence: 'Il est important que vous ___ (faire) vos devoirs.',
          correctAnswer: 'fassiez',
          acceptableAnswers: ['fassiez'],
          explanation: '"Il est important que" triggers subjunctive. Faire is irregular: que je fasse, que tu fasses, qu\'il fasse, que nous fassions, que vous fassiez, qu\'ils fassent.'
        },
        {
          id: 'b1-ch6-l5-q8',
          type: 'error_correction',
          incorrectSentence: 'Je souhaite que tu vas bien.',
          options: [
            'Je souhaite que tu es bien.',
            'Je souhaite que tu ailles bien.',
            'Je souhaite que tu iras bien.',
            'The sentence is correct'
          ],
          correctIndex: 1,
          explanation: '"Je souhaite que" (I wish that) requires subjunctive. Aller → que tu ailles. NEVER use indicative (vas, es) or future (iras) after expressions requiring subjunctive.'
        },
        {
          id: 'b1-ch6-l5-q9',
          type: 'fill_blank',
          sentence: 'Bien que ce ___ (être) difficile, je vais continuer.',
          correctAnswer: 'soit',
          acceptableAnswers: ['soit'],
          explanation: '"Bien que" (although) always triggers subjunctive. Être → que ce soit. "Bien que ce soit difficile" = although it is difficult.'
        },
        {
          id: 'b1-ch6-l5-q10',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'It is necessary that we have patience.',
          correctAnswer: 'Il faut que nous ayons de la patience.',
          acceptableAnswers: ['Il faut que nous ayons de la patience.', 'Il faut que nous ayons patience.'],
          explanation: '"Il faut que" + subjunctive. Avoir → que nous ayons. Note: "de la patience" (some patience) is more natural in French.'
        },
        {
          id: 'b1-ch6-l5-q11',
          type: 'multiple_choice',
          prompt: 'Which expression does NOT trigger the subjunctive?',
          options: [
            'Il faut que',
            'Je veux que',
            'Je sais que',
            'Bien que'
          ],
          correctIndex: 2,
          explanation: '"Je sais que" (I know that) expresses certainty, so it uses indicative, NOT subjunctive. "Il faut que", "je veux que", and "bien que" all trigger subjunctive.'
        },
        {
          id: 'b1-ch6-l5-q12',
          type: 'fill_blank',
          sentence: 'Je doute qu\'il ___ (pouvoir) finir à temps.',
          correctAnswer: 'puisse',
          acceptableAnswers: ['puisse'],
          explanation: '"Je doute que" (I doubt that) triggers subjunctive. Pouvoir → que je puisse, que tu puisses, qu\'il puisse, que nous puissions, que vous puissiez, qu\'ils puissent.'
        }
      ]
    },
    {
      id: 'b1-ch6-l6',
      title: 'Debate & Argumentation',
      description: 'Master discourse connectors and argumentation strategies for structured debates',
      order: 6,
      comprehensibleInput: {
        title: "Le télétravail : pour ou contre?",
        frenchText: "Le débat sur le télétravail divise les opinions. D"une part, le travail à domicile offre une flexibilité appréciable. Il permet d'économiser du temps de transport et de mieux équilibrer vie professionnelle et vie personnelle. Cependant, certains soulignent les inconvénients. Premièrement, l'isolement social peut affecter le moral des employés. Deuxièmement, la frontière entre travail et vie privée devient floue. En revanche, les employeurs constatent souvent une productivité accrue. Bien que les employés soient physiquement absents du bureau, ils accomplissent davantage de tâches. Néanmoins, la collaboration spontanée et la créativité collective en souffrent. Tandis que les jeunes générations embrassent ce mode de travail, les managers traditionnels y résistent. En conclusion, il faut trouver un équilibre. Le modèle hybride, combinant présentiel et distanciel, semble être la solution la plus raisonnable. Qu'en pensez-vous?\",
        englishHint: "A balanced debate text about remote work, using advanced connectors and argumentation structures",
        vocabularyHighlights: [
          { french: "divise les opinions", english: "divides opinions" },
          { french: "appréciable", english: "appreciable, significant" },
          { french: "soulignent", english: "emphasize, point out" },
          { french: "floue", english: "blurry, unclear" },
          { french: "la productivité accrue", english: "increased productivity" },
          { french: "en souffrent", english: "suffer from it" },
          { french: "embrassent", english: "embrace" }
        ]
      },
      questions: [
        {
          id: 'b1-ch6-l6-q1',
          type: 'fill_blank',
          sentence: 'Il faut que nous ___ (être) plus responsables.',
          correctAnswer: 'soyons',
          acceptableAnswers: ['soyons'],
          explanation: 'Review: "Il faut que" + subjunctive. Être → que nous soyons. Essential for expressing necessity in arguments!'
        },
        {
          id: 'b1-ch6-l6-q2',
          type: 'multiple_choice',
          prompt: 'What does "bien que" mean and what mood does it require?',
          options: [
            '"well that" - indicative',
            '"although" - subjunctive',
            '"so that" - infinitive',
            '"because" - indicative'
          ],
          correctIndex: 1,
          explanation: 'Review: "Bien que" means "although" and ALWAYS requires subjunctive. Essential for conceding points in debates!'
        },
        {
          id: 'b1-ch6-l6-q3',
          type: 'fill_blank',
          sentence: 'Je voudrais partir tôt demain. ___, j\'ai beaucoup de travail.',
          correctAnswer: 'Cependant',
          acceptableAnswers: ['Cependant', 'Néanmoins', 'Toutefois'],
          explanation: '"Cependant" (however), "néanmoins" (nevertheless), or "toutefois" (however) introduce a contrast or objection. Essential for nuanced argumentation.'
        },
        {
          id: 'b1-ch6-l6-q4',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'On one hand, technology is useful. On the other hand, it can be dangerous.',
          correctAnswer: 'D\'une part, la technologie est utile. D\'autre part, elle peut être dangereuse.',
          acceptableAnswers: ['D\'une part, la technologie est utile. D\'autre part, elle peut être dangereuse.'],
          explanation: '"D\'une part...d\'autre part" (on one hand...on the other hand) structures balanced arguments perfectly.'
        },
        {
          id: 'b1-ch6-l6-q5',
          type: 'multiple_choice',
          prompt: 'Which connector means "whereas" or "while" (showing contrast)?',
          options: ['cependant', 'tandis que', 'bien que', 'premièrement'],
          correctIndex: 1,
          explanation: '"Tandis que" means "whereas/while" and contrasts two different situations. "Cependant" = however, "bien que" = although + subjunctive, "premièrement" = firstly.'
        },
        {
          id: 'b1-ch6-l6-q6',
          type: 'fill_blank',
          sentence: '___ que le problème soit complexe, nous devons trouver une solution.',
          correctAnswer: 'Bien',
          acceptableAnswers: ['Bien'],
          explanation: '"Bien que" (although) + subjunctive concedes a point while maintaining your position. Key for sophisticated argumentation.'
        },
        {
          id: 'b1-ch6-l6-q7',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'First, we must understand the problem. Second, we need to find solutions.',
          correctAnswer: 'Premièrement, nous devons comprendre le problème. Deuxièmement, nous devons trouver des solutions.',
          acceptableAnswers: ['Premièrement, nous devons comprendre le problème. Deuxièmement, nous devons trouver des solutions.', 'Premièrement, il faut comprendre le problème. Deuxièmement, il faut trouver des solutions.'],
          explanation: '"Premièrement...deuxièmement" (firstly...secondly) organize arguments sequentially. You can continue with "troisièmement", etc.'
        },
        {
          id: 'b1-ch6-l6-q8',
          type: 'fill_blank',
          sentence: 'Ce projet est coûteux. ___, il est essentiel pour notre avenir.',
          correctAnswer: 'Néanmoins',
          acceptableAnswers: ['Néanmoins', 'Cependant', 'Toutefois'],
          explanation: '"Néanmoins" (nevertheless), "cependant", or "toutefois" acknowledge a problem but argue for proceeding anyway. Powerful in debates!'
        },
        {
          id: 'b1-ch6-l6-q9',
          type: 'error_correction',
          incorrectSentence: 'J\'aime le café tandis que je préfère le thé le matin.',
          options: [
            'J\'aime le café, cependant je préfère le thé le matin.',
            'J\'aime le café mais je préfère le thé le matin.',
            'J\'aime le café en revanche je préfère le thé le matin.',
            'Both A and B are correct'
          ],
          correctIndex: 3,
          explanation: '"Tandis que" contrasts two different subjects/situations. Here, same subject (je) with contradiction needs "cependant" (however) or "mais" (but). "En revanche" also works.'
        },
        {
          id: 'b1-ch6-l6-q10',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'In conclusion, we must act quickly.',
          correctAnswer: 'En conclusion, nous devons agir rapidement.',
          acceptableAnswers: ['En conclusion, nous devons agir rapidement.', 'En conclusion, il faut agir rapidement.', 'Pour conclure, nous devons agir rapidement.'],
          explanation: '"En conclusion" or "pour conclure" signal your final argument. Essential for structured debates and essays.'
        },
        {
          id: 'b1-ch6-l6-q11',
          type: 'fill_blank',
          sentence: 'Les jeunes préfèrent les réseaux sociaux, ___ que les personnes âgées lisent encore des journaux.',
          correctAnswer: 'tandis',
          acceptableAnswers: ['tandis'],
          explanation: '"Tandis que" (whereas/while) contrasts two different groups or situations. Perfect for comparing opposing viewpoints in debates.'
        },
        {
          id: 'b1-ch6-l6-q12',
          type: 'multiple_choice',
          prompt: 'Which phrase structure presents a balanced argument?',
          options: [
            'Premièrement...deuxièmement',
            'D\'une part...d\'autre part',
            'Bien que...néanmoins',
            'Si...alors'
          ],
          correctIndex: 1,
          explanation: '"D\'une part...d\'autre part" (on one hand...on the other hand) perfectly balances two sides of an argument. Options A is sequential, C is concession, D is conditional.'
        }
      ]
    }
  ]
}
