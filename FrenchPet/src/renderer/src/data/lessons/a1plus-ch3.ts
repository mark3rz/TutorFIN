import type { Chapter } from '../../types/lesson'

export const a1PlusCh3: Chapter = {
  id: 'a1plus-ch3',
  title: 'Passé Composé, Futur Proche, Expressions',
  description: 'Master past tense, near future, and essential French expressions',
  level: 'A1+',
  order: 3,
  lessons: [
    {
      id: 'a1p-ch3-l1',
      title: 'Passé Composé with Avoir — Regular',
      order: 1,
      comprehensibleInput: {
        title: 'Mon journal - Hier',
        frenchText:
          "Hier, j"ai regardé un film français. J'ai mangé une pizza délicieuse et j'ai téléphoné à ma mère. Mon ami Thomas a écouté de la musique et il a préparé le dîner. Nous avons parlé de nos projets pour le weekend. J'ai fini mes devoirs très tard et j'ai attendu le bus pendant vingt minutes ce matin. Quelle journée!\",
        englishHint: 'A diary entry about what someone did yesterday',
        vocabularyHighlights: [
          { french: 'hier', english: 'yesterday' },
          { french: "j'ai regardé", english: "I watched" },
          { french: "j'ai mangé", english: "I ate" },
          { french: "j'ai téléphoné", english: "I called" },
          { french: "il a préparé", english: "he prepared" },
          { french: "nous avons parlé", english: "we talked" },
          { french: "j'ai fini", english: "I finished" },
          { french: "j'ai attendu", english: "I waited" }
        ]
      },
      warmupQuestions: [
        {
          id: 'a1p-ch3-l1-q1',
          type: 'multiple_choice',
          prompt: 'Conjugate "être" in the present tense: Je ___ étudiant.',
          options: ['suis', 'es', 'est', 'sommes'],
          correctIndex: 0,
          explanation: '"Je suis" is the correct present tense conjugation of être for "I am".'
        },
        {
          id: 'a1p-ch3-l1-q2',
          type: 'multiple_choice',
          prompt: 'Conjugate "avoir" in the present tense: Nous ___ une maison.',
          options: ['avons', 'avez', 'ont', 'as'],
          correctIndex: 0,
          explanation:
            '"Nous avons" is the correct present tense conjugation of avoir for "we have".'
        }
      ],
      drillQuestions: [
        {
          id: 'a1p-ch3-l1-q3',
          type: 'multiple_choice',
          prompt: 'How do you form the passé composé with avoir?',
          options: [
            'subject + avoir conjugated + past participle',
            'subject + être conjugated + past participle',
            'subject + past participle + avoir',
            'avoir + subject + infinitive'
          ],
          correctIndex: 0,
          explanation:
            "Passé composé with avoir uses: subject + avoir (conjugated) + past participle. Example: j'ai mangé (I ate)."
        },
        {
          id: 'a1p-ch3-l1-q4',
          type: 'fill_blank',
          sentence: 'Je ___ parlé avec mon professeur.',
          correctAnswer: 'ai',
          acceptableAnswers: ['ai'],
          explanation:
            '"J'ai parlé" means "I spoke/have spoken". Use "ai" (from avoir) with je in passé composé.'
        },
        {
          id: 'a1p-ch3-l1-q5',
          type: 'multiple_choice',
          prompt: 'What is the past participle of "manger" (to eat)?',
          options: ['mangé', 'manger', 'mangés', 'mange'],
          correctIndex: 0,
          explanation:
            'Regular -er verbs form their past participle by replacing -er with -é. Manger → mangé.'
        },
        {
          id: 'a1p-ch3-l1-q6',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'She finished the book.',
          correctAnswer: 'Elle a fini le livre.',
          acceptableAnswers: ['Elle a fini le livre', "Elle a fini l'livre"],
          explanation:
            '"Finir" is a regular -ir verb. Past participle: fini. Elle a fini = she finished/has finished.'
        },
        {
          id: 'a1p-ch3-l1-q7',
          type: 'fill_blank',
          sentence: 'Nous ___ attendu le bus.',
          correctAnswer: 'avons',
          acceptableAnswers: ['avons'],
          explanation:
            '"Nous avons attendu" means "we waited/have waited". Attendre (to wait) is a regular -re verb: attendu.'
        },
        {
          id: 'a1p-ch3-l1-q8',
          type: 'multiple_choice',
          prompt: 'What is the past participle of "répondre" (to answer)?',
          options: ['répondu', 'répondé', 'répondi', 'répondre'],
          correctIndex: 0,
          explanation:
            'Regular -re verbs form their past participle by replacing -re with -u. Répondre → répondu.'
        },
        {
          id: 'a1p-ch3-l1-q9',
          type: 'error_correction',
          incorrectSentence: 'Tu a regardé la télévision.',
          options: [
            'Tu as regardé la télévision.',
            'Tu ai regardé la télévision.',
            'Tu avons regardé la télévision.',
            'Tu es regardé la télévision.'
          ],
          correctIndex: 0,
          explanation:
            'With "tu" in passé composé, use "as" (from avoir). Tu as regardé = you watched/have watched.'
        },
        {
          id: 'a1p-ch3-l1-q10',
          type: 'translation',
          direction: 'fr_to_en',
          sourceText: 'Ils ont vendu leur voiture.',
          correctAnswer: 'They sold their car.',
          acceptableAnswers: ['They sold their car', 'They have sold their car'],
          explanation:
            '"Vendre" (to sell) is a regular -re verb. Past participle: vendu. Ils ont vendu = they sold/have sold.'
        },
        {
          id: 'a1p-ch3-l1-q11',
          type: 'fill_blank',
          sentence: 'Vous ___ choisi un bon restaurant.',
          correctAnswer: 'avez',
          acceptableAnswers: ['avez'],
          explanation:
            '"Vous avez choisi" means "you chose/have chosen". Choisir (to choose) is a regular -ir verb: choisi.'
        },
        {
          id: 'a1p-ch3-l1-q12',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'I listened to music.',
          correctAnswer: 'J'ai écouté de la musique.',
          acceptableAnswers: [
            'J'ai écouté de la musique',
            "J'ai écouté la musique",
            'Je ai écouté de la musique'
          ],
          explanation:
            '"Écouter" (to listen) is a regular -er verb. Past participle: écouté. J'ai écouté = I listened/have listened.'
        }
      ]
    },
    {
      id: 'a1p-ch3-l2',
      title: 'Passé Composé with Être',
      order: 2,
      comprehensibleInput: {
        title: 'Mon voyage à Paris',
        frenchText:
          "Je suis allé à Paris le weekend dernier. Je suis arrivé vendredi soir et je suis entré dans mon hôtel. Samedi matin, je suis sorti tôt pour visiter la Tour Eiffel. Je suis monté au sommet et la vue était magnifique! Ensuite, je suis descendu et je suis allé au café. Ma sœur est venue avec moi dimanche. Nous sommes partis pour Versailles et nous sommes rentrés tard. Elle est restée à Paris deux jours. Quelle aventure!",
        englishHint: 'A story about someone's trip to Paris using movement verbs',
        vocabularyHighlights: [
          { french: 'je suis allé', english: 'I went' },
          { french: 'je suis arrivé', english: 'I arrived' },
          { french: 'je suis entré', english: 'I entered' },
          { french: 'je suis sorti', english: 'I went out' },
          { french: 'je suis monté', english: 'I went up' },
          { french: 'je suis descendu', english: 'I went down' },
          { french: 'elle est venue', english: 'she came' },
          { french: 'nous sommes partis', english: 'we left' },
          { french: 'elle est restée', english: 'she stayed' }
        ]
      },
      warmupQuestions: [
        {
          id: 'a1p-ch3-l2-q1',
          type: 'fill_blank',
          sentence: 'J'___ parlé français hier.',
          correctAnswer: 'ai',
          acceptableAnswers: ['ai'],
          explanation:
            'Review: "Parler" uses avoir in passé composé. J'ai parlé = I spoke/have spoken.'
        },
        {
          id: 'a1p-ch3-l2-q2',
          type: 'multiple_choice',
          prompt: 'What is the past participle of "finir"?',
          options: ['fini', 'finé', 'finit', 'finir'],
          correctIndex: 0,
          explanation: 'Review: Regular -ir verbs form past participle with -i. Finir → fini.'
        }
      ],
      drillQuestions: [
        {
          id: 'a1p-ch3-l2-q3',
          type: 'multiple_choice',
          prompt: 'Which auxiliary verb do movement verbs use in passé composé?',
          options: ['être', 'avoir', 'faire', 'aller'],
          correctIndex: 0,
          explanation:
            'Most movement verbs (DR MRS VANDERTRAMP) use être as the auxiliary in passé composé.'
        },
        {
          id: 'a1p-ch3-l2-q4',
          type: 'fill_blank',
          sentence: 'Je ___ allé au cinéma. (masculine speaker)',
          correctAnswer: 'suis',
          acceptableAnswers: ['suis'],
          explanation:
            '"Aller" uses être in passé composé. Je suis allé = I went (masculine). Note: allée for feminine.'
        },
        {
          id: 'a1p-ch3-l2-q5',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'She arrived yesterday. (use arriver)',
          correctAnswer: 'Elle est arrivée hier.',
          acceptableAnswers: ['Elle est arrivée hier', 'Elle est arrivé hier'],
          explanation:
            '"Arriver" uses être. Elle est arrivée (feminine agreement adds -e). Arriver → arrivé(e).'
        },
        {
          id: 'a1p-ch3-l2-q6',
          type: 'multiple_choice',
          prompt: 'Why does "Elle est partie" have an extra "e" at the end?',
          options: [
            'Agreement with feminine subject',
            'It's a different verb',
            'All être verbs add -e',
            'It's optional'
          ],
          correctIndex: 0,
          explanation:
            'With être, the past participle agrees with the subject. "Elle" is feminine, so parti → partie.'
        },
        {
          id: 'a1p-ch3-l2-q7',
          type: 'fill_blank',
          sentence: 'Nous ___ venus à la fête. (masculine or mixed group)',
          correctAnswer: 'sommes',
          acceptableAnswers: ['sommes'],
          explanation:
            '"Venir" uses être. Nous sommes venus = we came (masculine/mixed). Add -es for all feminine group: venues.'
        },
        {
          id: 'a1p-ch3-l2-q8',
          type: 'error_correction',
          incorrectSentence: 'Ils ont sortis hier soir.',
          options: [
            'Ils sont sortis hier soir.',
            'Ils ont sorti hier soir.',
            'Ils es sortis hier soir.',
            'Ils être sortis hier soir.'
          ],
          correctIndex: 0,
          explanation:
            '"Sortir" (to go out) uses être, not avoir. Ils sont sortis = they went out (masculine/mixed).'
        },
        {
          id: 'a1p-ch3-l2-q9',
          type: 'translation',
          direction: 'fr_to_en',
          sourceText: 'Elles sont montées au troisième étage.',
          correctAnswer: 'They went up to the third floor.',
          acceptableAnswers: [
            'They went up to the third floor',
            'They have gone up to the third floor',
            'They climbed to the third floor'
          ],
          explanation:
            '"Monter" uses être. Elles sont montées (feminine plural agreement). Monter = to go up/climb.'
        },
        {
          id: 'a1p-ch3-l2-q10',
          type: 'fill_blank',
          sentence: 'Marie ___ restée à la maison.',
          correctAnswer: 'est',
          acceptableAnswers: ['est'],
          explanation:
            '"Rester" (to stay) uses être. Marie est restée (feminine singular agreement). Rester → resté(e).'
        },
        {
          id: 'a1p-ch3-l2-q11',
          type: 'multiple_choice',
          prompt:
            'Which sentence correctly shows agreement? (Thomas and Marie left)',
          options: [
            'Thomas et Marie sont partis.',
            'Thomas et Marie sont parties.',
            'Thomas et Marie sont parti.',
            'Thomas et Marie ont partis.'
          ],
          correctIndex: 0,
          explanation:
            'Mixed gender group uses masculine plural agreement. Partis (masculine plural) is correct, not parties.'
        },
        {
          id: 'a1p-ch3-l2-q12',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'We returned home. (use rentrer, mixed group)',
          correctAnswer: 'Nous sommes rentrés.',
          acceptableAnswers: [
            'Nous sommes rentrés',
            'Nous sommes rentrés à la maison',
            'Nous sommes rentré'
          ],
          explanation:
            '"Rentrer" (to return home) uses être. Nous sommes rentrés (masculine/mixed plural). Rentrer → rentré(e)(s).'
        }
      ]
    },
    {
      id: 'a1p-ch3-l3',
      title: 'Passé Composé — Irregular Past Participles',
      order: 3,
      comprehensibleInput: {
        title: 'Rapport de police',
        frenchText:
          "Hier soir, nous avons vu un accident rue Victor Hugo. Un homme a pris son téléphone et il a fait une vidéo. J"ai dit à ma femme d'appeler la police. Elle a eu peur mais elle a été courageuse. Les ambulances ont mis quinze minutes pour arriver. Un témoin a bu un café au bar et il a écrit une déclaration. La police a lu tous les témoignages. Heureusement, personne n'a eu de blessures graves. Les policiers ont pris nos coordonnées et nous avons pu partir.\",
        englishHint: 'A police report using many irregular past participles',
        vocabularyHighlights: [
          { french: 'nous avons vu', english: 'we saw' },
          { french: 'il a pris', english: 'he took' },
          { french: 'il a fait', english: 'he made/did' },
          { french: "j'ai dit", english: "I said" },
          { french: 'elle a eu', english: 'she had' },
          { french: 'elle a été', english: 'she was' },
          { french: 'ont mis', english: 'they took (time)' },
          { french: 'il a bu', english: 'he drank' },
          { french: 'il a écrit', english: 'he wrote' },
          { french: 'a lu', english: 'read' }
        ]
      },
      warmupQuestions: [
        {
          id: 'a1p-ch3-l3-q1',
          type: 'fill_blank',
          sentence: 'Elle ___ allée au marché.',
          correctAnswer: 'est',
          acceptableAnswers: ['est'],
          explanation:
            'Review: "Aller" uses être in passé composé. Elle est allée = she went (feminine agreement).'
        },
        {
          id: 'a1p-ch3-l3-q2',
          type: 'multiple_choice',
          prompt: 'Which auxiliary does "venir" use?',
          options: ['être', 'avoir', 'faire', 'both'],
          correctIndex: 0,
          explanation: 'Review: "Venir" is a DR MRS VANDERTRAMP verb and uses être.'
        }
      ],
      drillQuestions: [
        {
          id: 'a1p-ch3-l3-q3',
          type: 'multiple_choice',
          prompt: 'What is the past participle of "faire" (to do/make)?',
          options: ['fait', 'faisé', 'faisi', 'fer'],
          correctIndex: 0,
          explanation:
            '"Faire" has an irregular past participle: fait. J'ai fait = I did/made.'
        },
        {
          id: 'a1p-ch3-l3-q4',
          type: 'fill_blank',
          sentence: 'J'ai ___ un film hier. (voir - to see)',
          correctAnswer: 'vu',
          acceptableAnswers: ['vu'],
          explanation:
            '"Voir" has irregular past participle: vu. J'ai vu = I saw/have seen.'
        },
        {
          id: 'a1p-ch3-l3-q5',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'She took the bus.',
          correctAnswer: 'Elle a pris le bus.',
          acceptableAnswers: ['Elle a pris le bus', "Elle a pris l'bus"],
          explanation:
            '"Prendre" (to take) has irregular past participle: pris. Elle a pris = she took/has taken.'
        },
        {
          id: 'a1p-ch3-l3-q6',
          type: 'multiple_choice',
          prompt: 'What is the past participle of "boire" (to drink)?',
          options: ['bu', 'boi', 'buvé', 'boire'],
          correctIndex: 0,
          explanation: '"Boire" has irregular past participle: bu. J'ai bu = I drank/have drunk.'
        },
        {
          id: 'a1p-ch3-l3-q7',
          type: 'fill_blank',
          sentence: 'Nous avons ___ la vérité. (dire - to say/tell)',
          correctAnswer: 'dit',
          acceptableAnswers: ['dit'],
          explanation:
            '"Dire" has irregular past participle: dit. Nous avons dit = we said/have said.'
        },
        {
          id: 'a1p-ch3-l3-q8',
          type: 'error_correction',
          incorrectSentence: 'Il a écrité une lettre.',
          options: [
            'Il a écrit une lettre.',
            'Il a écrivé une lettre.',
            'Il a écrire une lettre.',
            'Il est écrit une lettre.'
          ],
          correctIndex: 0,
          explanation:
            '"Écrire" (to write) has irregular past participle: écrit. Il a écrit = he wrote/has written.'
        },
        {
          id: 'a1p-ch3-l3-q9',
          type: 'translation',
          direction: 'fr_to_en',
          sourceText: 'J'ai lu ce livre trois fois.',
          correctAnswer: 'I read this book three times.',
          acceptableAnswers: ['I read this book three times', 'I have read this book three times'],
          explanation:
            '"Lire" (to read) has irregular past participle: lu. J'ai lu = I read/have read.'
        },
        {
          id: 'a1p-ch3-l3-q10',
          type: 'fill_blank',
          sentence: 'Tu as ___ tes clés sur la table. (mettre - to put)',
          correctAnswer: 'mis',
          acceptableAnswers: ['mis'],
          explanation:
            '"Mettre" has irregular past participle: mis. Tu as mis = you put/have put.'
        },
        {
          id: 'a1p-ch3-l3-q11',
          type: 'multiple_choice',
          prompt: 'What is the past participle of "être" (to be)?',
          options: ['été', 'étai', 'étré', 'suis'],
          correctIndex: 0,
          explanation:
            '"Être" has irregular past participle: été. J'ai été = I was/have been (when used with avoir).'
        },
        {
          id: 'a1p-ch3-l3-q12',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'They had good luck.',
          correctAnswer: 'Ils ont eu de la chance.',
          acceptableAnswers: [
            'Ils ont eu de la chance',
            'Elles ont eu de la chance',
            'Ils ont eus de la chance'
          ],
          explanation:
            '"Avoir" has irregular past participle: eu. Ils ont eu = they had/have had. "De la chance" = luck.'
        }
      ]
    },
    {
      id: 'a1p-ch3-l4',
      title: 'Futur Proche (aller + infinitive)',
      order: 4,
      comprehensibleInput: {
        title: 'Mes projets pour demain',
        frenchText:
          "Demain, je vais me réveiller tôt parce que je vais aller au marché. Je vais acheter des fruits frais et des légumes. Mon ami Pierre va venir avec moi et nous allons prendre un café ensemble. L'après-midi, je vais étudier pour mon examen de français. Ma sœur va partir en voyage et elle va visiter Bordeaux. Le soir, nous allons regarder un film en famille. Mes parents vont préparer un bon dîner. Je ne vais pas me coucher tard parce que lundi, je vais travailler tôt.",
        englishHint: 'Someone talking about their plans for tomorrow using near future tense',
        vocabularyHighlights: [
          { french: 'je vais me réveiller', english: 'I am going to wake up' },
          { french: 'je vais aller', english: 'I am going to go' },
          { french: 'je vais acheter', english: 'I am going to buy' },
          { french: 'il va venir', english: 'he is going to come' },
          { french: 'nous allons prendre', english: 'we are going to take/have' },
          { french: 'je vais étudier', english: 'I am going to study' },
          { french: 'elle va partir', english: 'she is going to leave' },
          { french: 'je ne vais pas', english: 'I am not going to' }
        ]
      },
      warmupQuestions: [
        {
          id: 'a1p-ch3-l4-q1',
          type: 'multiple_choice',
          prompt: 'What is the past participle of "prendre"?',
          options: ['pris', 'prendu', 'prené', 'prendre'],
          correctIndex: 0,
          explanation: 'Review: "Prendre" has irregular past participle: pris.'
        },
        {
          id: 'a1p-ch3-l4-q2',
          type: 'fill_blank',
          sentence: 'Nous avons ___ la vérité. (dire)',
          correctAnswer: 'dit',
          acceptableAnswers: ['dit'],
          explanation: 'Review: "Dire" has irregular past participle: dit. Nous avons dit = we said.'
        }
      ],
      drillQuestions: [
        {
          id: 'a1p-ch3-l4-q3',
          type: 'multiple_choice',
          prompt: 'How do you form the futur proche (near future)?',
          options: [
            'conjugated aller + infinitive',
            'conjugated être + infinitive',
            'conjugated avoir + infinitive',
            'subject + infinitive'
          ],
          correctIndex: 0,
          explanation:
            'Futur proche uses: conjugated aller + infinitive. Example: je vais manger = I am going to eat.'
        },
        {
          id: 'a1p-ch3-l4-q4',
          type: 'fill_blank',
          sentence: 'Je ___ manger au restaurant ce soir.',
          correctAnswer: 'vais',
          acceptableAnswers: ['vais'],
          explanation:
            '"Je vais manger" means "I am going to eat". Use vais (from aller) with je in futur proche.'
        },
        {
          id: 'a1p-ch3-l4-q5',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'She is going to leave tomorrow.',
          correctAnswer: 'Elle va partir demain.',
          acceptableAnswers: ['Elle va partir demain', 'Elle vas partir demain'],
          explanation:
            'Elle va partir = she is going to leave. Aller conjugated (va) + infinitive (partir).'
        },
        {
          id: 'a1p-ch3-l4-q6',
          type: 'fill_blank',
          sentence: "Nous ___ étudier pour l'examen.",
          correctAnswer: 'allons',
          acceptableAnswers: ['allons'],
          explanation:
            '"Nous allons étudier" means "we are going to study". Use allons (from aller) with nous.'
        },
        {
          id: 'a1p-ch3-l4-q7',
          type: 'multiple_choice',
          prompt: 'What does "Ils vont regarder la télé" mean?',
          options: [
            'They are going to watch TV',
            'They watched TV',
            'They watch TV',
            'They want to watch TV'
          ],
          correctIndex: 0,
          explanation:
            '"Ils vont regarder" is futur proche: they are going to watch. Vont (aller) + regarder (infinitive).'
        },
        {
          id: 'a1p-ch3-l4-q8',
          type: 'error_correction',
          incorrectSentence: 'Tu va acheter du pain.',
          options: [
            'Tu vas acheter du pain.',
            'Tu vais acheter du pain.',
            'Tu allez acheter du pain.',
            'Tu aller acheter du pain.'
          ],
          correctIndex: 0,
          explanation:
            'With "tu", use "vas" (from aller). Tu vas acheter = you are going to buy.'
        },
        {
          id: 'a1p-ch3-l4-q9',
          type: 'translation',
          direction: 'fr_to_en',
          sourceText: 'Vous allez visiter Paris?',
          correctAnswer: 'Are you going to visit Paris?',
          acceptableAnswers: [
            'Are you going to visit Paris',
            'You are going to visit Paris',
            'Will you visit Paris'
          ],
          explanation:
            '"Vous allez visiter" means "you are going to visit". Allez (aller) + visiter (infinitive).'
        },
        {
          id: 'a1p-ch3-l4-q10',
          type: 'fill_blank',
          sentence: 'Je ne ___ pas partir demain.',
          correctAnswer: 'vais',
          acceptableAnswers: ['vais'],
          explanation:
            'Negation in futur proche: ne + aller conjugated + pas + infinitive. Je ne vais pas partir = I am not going to leave.'
        },
        {
          id: 'a1p-ch3-l4-q11',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'We are not going to work tomorrow.',
          correctAnswer: "Nous n'allons pas travailler demain.",
          acceptableAnswers: [
            "Nous n'allons pas travailler demain",
            'Nous ne allons pas travailler demain',
            "On n'va pas travailler demain"
          ],
          explanation:
            "Negation: Nous n'allons pas + infinitive. Nous n'allons pas travailler = we are not going to work."
        },
        {
          id: 'a1p-ch3-l4-q12',
          type: 'multiple_choice',
          prompt: 'Which sentence uses futur proche correctly?',
          options: [
            'Elles vont danser ce soir.',
            'Elles vont dansé ce soir.',
            'Elles allons danser ce soir.',
            'Elles va danser ce soir.'
          ],
          correctIndex: 0,
          explanation:
            '"Elles vont danser" is correct. Vont (aller for elles) + danser (infinitive, not past participle).'
        }
      ]
    },
    {
      id: 'a1p-ch3-l5',
      title: 'Common Expressions with Avoir',
      order: 5,
      comprehensibleInput: {
        title: 'Dialogue: Comment ça va?',
        frenchText:
          "Marc: Salut Sophie! Comment ça va?\nSophie: Ça va, mais j"ai très faim. Je n'ai pas mangé ce matin.\nMarc: Moi aussi, j'ai faim! Et j'ai soif. On va au café?\nSophie: Bonne idée! Mais attention, il fait très froid dehors. Tu as froid?\nMarc: Oui, j'ai un peu froid. Et toi?\nSophie: Moi, j'ai toujours chaud! Mais j'ai besoin de mon manteau quand même.\nMarc: Tu as raison. Bon, j'ai envie d'un bon café bien chaud.\nSophie: Parfait! Allons-y. J'ai peur d'avoir tort sur la météo - peut-être qu'il va neiger!\",
        englishHint: 'A dialogue where people express feelings and states using avoir',
        vocabularyHighlights: [
          { french: "j'ai faim", english: "I am hungry" },
          { french: "j'ai soif", english: "I am thirsty" },
          { french: 'il fait froid', english: 'it is cold (weather)' },
          { french: 'tu as froid', english: 'you are cold' },
          { french: "j'ai chaud", english: "I am hot" },
          { french: "j'ai besoin de", english: "I need" },
          { french: 'tu as raison', english: 'you are right' },
          { french: "j'ai envie de", english: "I want/feel like" },
          { french: "j'ai peur de", english: "I am afraid of" },
          { french: 'avoir tort', english: 'to be wrong' }
        ]
      },
      warmupQuestions: [
        {
          id: 'a1p-ch3-l5-q1',
          type: 'fill_blank',
          sentence: 'Demain, je ___ visiter le musée.',
          correctAnswer: 'vais',
          acceptableAnswers: ['vais'],
          explanation: 'Review: Futur proche: je vais + infinitive. Je vais visiter = I am going to visit.'
        },
        {
          id: 'a1p-ch3-l5-q2',
          type: 'multiple_choice',
          prompt: 'How do you say "We are not going to eat"?',
          options: [
            "Nous n'allons pas manger",
            'Nous allons ne pas manger',
            'Nous ne vais pas manger',
            'Nous pas allons manger'
          ],
          correctIndex: 0,
          explanation:
            "Review: Negation in futur proche: ne + aller + pas + infinitive. Nous n'allons pas manger."
        }
      ],
      drillQuestions: [
        {
          id: 'a1p-ch3-l5-q3',
          type: 'multiple_choice',
          prompt: 'How do you say "I am hungry" in French?',
          options: ['J'ai faim', 'Je suis faim', 'J'être faim', 'Je fais faim'],
          correctIndex: 0,
          explanation:
            "In French, you use avoir (to have) for hunger: j'ai faim (literally \"I have hunger\")."
        },
        {
          id: 'a1p-ch3-l5-q4',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'She is thirsty.',
          correctAnswer: 'Elle a soif.',
          acceptableAnswers: ['Elle a soif', 'Elle as soif'],
          explanation:
            '"Avoir soif" means to be thirsty. Elle a soif (literally "she has thirst").'
        },
        {
          id: 'a1p-ch3-l5-q5',
          type: 'fill_blank',
          sentence: 'Nous ___ peur du chien.',
          correctAnswer: 'avons',
          acceptableAnswers: ['avons'],
          explanation:
            '"Avoir peur (de)" means to be afraid (of). Nous avons peur = we are afraid.'
        },
        {
          id: 'a1p-ch3-l5-q6',
          type: 'multiple_choice',
          prompt: 'What does "Tu as raison" mean?',
          options: ['You are right', 'You are wrong', 'You have a reason', 'You are hungry'],
          correctIndex: 0,
          explanation:
            '"Avoir raison" means to be right. Tu as raison = you are right (literally "you have reason").'
        },
        {
          id: 'a1p-ch3-l5-q7',
          type: 'translation',
          direction: 'fr_to_en',
          sourceText: 'Il a tort.',
          correctAnswer: 'He is wrong.',
          acceptableAnswers: ['He is wrong', 'He\'s wrong'],
          explanation: '"Avoir tort" means to be wrong. Il a tort = he is wrong.'
        },
        {
          id: 'a1p-ch3-l5-q8',
          type: 'fill_blank',
          sentence: 'J'___ chaud en été.',
          correctAnswer: 'ai',
          acceptableAnswers: ['ai'],
          explanation:
            '"Avoir chaud" means to be hot/warm. J'ai chaud = I am hot. (En été = in summer)'
        },
        {
          id: 'a1p-ch3-l5-q9',
          type: 'error_correction',
          incorrectSentence: 'Vous êtes froid?',
          options: [
            'Vous avez froid?',
            'Vous faites froid?',
            'Vous suis froid?',
            'Vous être froid?'
          ],
          correctIndex: 0,
          explanation:
            'Use avoir (not être) for temperature feelings. Vous avez froid? = Are you cold?'
        },
        {
          id: 'a1p-ch3-l5-q10',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'I need water.',
          correctAnswer: "J'ai besoin d'eau.",
          acceptableAnswers: [
            "J'ai besoin d'eau",
            "J'ai besoin de l'eau",
            "J"ai besoin d'de l'eau\"
          ],
          explanation:
            "\"Avoir besoin de\" means to need. J'ai besoin d'eau = I need water (d' before vowel)."
        },
        {
          id: 'a1p-ch3-l5-q11',
          type: 'fill_blank',
          sentence: 'Elles ont ___ de voyager.',
          correctAnswer: 'envie',
          acceptableAnswers: ['envie'],
          explanation:
            '"Avoir envie de" means to want/feel like. Elles ont envie de voyager = they want to travel.'
        },
        {
          id: 'a1p-ch3-l5-q12',
          type: 'multiple_choice',
          prompt: 'Which expression uses "avoir" correctly?',
          options: [
            'J'ai besoin de dormir.',
            'Je suis besoin de dormir.',
            'Je fais besoin de dormir.',
            'Je vais besoin de dormir.'
          ],
          correctIndex: 0,
          explanation:
            '"Avoir besoin de" means to need. J'ai besoin de dormir = I need to sleep.'
        }
      ]
    },
    {
      id: 'a1p-ch3-l6',
      title: 'Common Expressions with Faire',
      order: 6,
      comprehensibleInput: {
        title: 'Ma journée et la météo',
        frenchText:
          "Ce matin, il fait beau et il fait chaud. Je fais du sport dans le parc à 7h. Ensuite, je rentre et je fais la cuisine - je prépare le petit-déjeuner pour ma famille. Mon fils fait attention à ses devoirs avant l"école. L'après-midi, ma femme fait les courses au supermarché. Elle achète tout ce dont nous avons besoin pour la semaine. Le soir, il fait un peu froid, alors nous restons à la maison. Demain, la météo dit qu'il va faire mauvais - il va pleuvoir. Tant pis! Je vais faire du yoga à la maison. Le weekend, nous faisons toujours quelque chose d'intéressant en famille.\",
        englishHint: 'A text about daily activities and weather using faire expressions',
        vocabularyHighlights: [
          { french: 'il fait beau', english: 'it is nice (weather)' },
          { french: 'il fait chaud', english: 'it is hot (weather)' },
          { french: 'je fais du sport', english: 'I do sports/exercise' },
          { french: 'je fais la cuisine', english: 'I cook' },
          { french: 'faire attention', english: 'to pay attention' },
          { french: 'elle fait les courses', english: 'she does the shopping' },
          { french: 'il fait froid', english: 'it is cold (weather)' },
          { french: 'il va faire mauvais', english: 'it is going to be bad weather' },
          { french: 'faire du yoga', english: 'to do yoga' }
        ]
      },
      warmupQuestions: [
        {
          id: 'a1p-ch3-l6-q1',
          type: 'multiple_choice',
          prompt: 'How do you say "They are hungry"?',
          options: ['Ils ont faim', 'Ils sont faim', 'Ils faire faim', 'Ils avez faim'],
          correctIndex: 0,
          explanation: 'Review: Use avoir for hunger. Ils ont faim = they are hungry.'
        },
        {
          id: 'a1p-ch3-l6-q2',
          type: 'fill_blank',
          sentence: 'Tu ___ besoin de repos.',
          correctAnswer: 'as',
          acceptableAnswers: ['as'],
          explanation:
            'Review: "Avoir besoin de" means to need. Tu as besoin de = you need (+ noun/infinitive).'
        }
      ],
      drillQuestions: [
        {
          id: 'a1p-ch3-l6-q3',
          type: 'multiple_choice',
          prompt: 'How do you say "It is nice (weather)" in French?',
          options: ['Il fait beau', 'Il est beau', 'C'est beau', 'Il a beau'],
          correctIndex: 0,
          explanation:
            'For weather, use "il fait + adjective". Il fait beau = it is nice weather.'
        },
        {
          id: 'a1p-ch3-l6-q4',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'I do sports.',
          correctAnswer: 'Je fais du sport.',
          acceptableAnswers: ['Je fais du sport', 'Je fais le sport', 'Je fait du sport'],
          explanation:
            '"Faire du sport" means to do sports/exercise. Use "du" (partitive article) with sport.'
        },
        {
          id: 'a1p-ch3-l6-q5',
          type: 'fill_blank',
          sentence: 'Il ___ froid en hiver.',
          correctAnswer: 'fait',
          acceptableAnswers: ['fait'],
          explanation:
            '"Il fait froid" means it is cold (weather). Use "il fait + weather adjective".'
        },
        {
          id: 'a1p-ch3-l6-q6',
          type: 'multiple_choice',
          prompt: 'What does "faire la cuisine" mean?',
          options: ['to cook', 'to do the shopping', 'to clean', 'to eat'],
          correctIndex: 0,
          explanation:
            '"Faire la cuisine" literally means "to make the cooking" = to cook.'
        },
        {
          id: 'a1p-ch3-l6-q7',
          type: 'translation',
          direction: 'fr_to_en',
          sourceText: 'Elle fait les courses tous les samedis.',
          correctAnswer: 'She does the shopping every Saturday.',
          acceptableAnswers: [
            'She does the shopping every Saturday',
            'She goes shopping every Saturday',
            'She shops every Saturday'
          ],
          explanation:
            '"Faire les courses" means to do the shopping/go shopping. Tous les samedis = every Saturday.'
        },
        {
          id: 'a1p-ch3-l6-q8',
          type: 'fill_blank',
          sentence: 'Nous ___ attention en classe.',
          correctAnswer: 'faisons',
          acceptableAnswers: ['faisons'],
          explanation:
            '"Faire attention" means to pay attention. Nous faisons attention = we pay attention.'
        },
        {
          id: 'a1p-ch3-l6-q9',
          type: 'error_correction',
          incorrectSentence: "Il est chaud aujourd'hui. (talking about weather)",
          options: [
            "Il fait chaud aujourd'hui.",
            "Il a chaud aujourd'hui.",
            "C'est chaud aujourd'hui.",
            "Ça est chaud aujourd'hui."
          ],
          correctIndex: 0,
          explanation:
            'For weather, use "il fait". Il fait chaud = it is hot (weather). "Il a chaud" = he is hot (person).'
        },
        {
          id: 'a1p-ch3-l6-q10',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'It is bad weather today.',
          correctAnswer: "Il fait mauvais aujourd'hui.",
          acceptableAnswers: [
            "Il fait mauvais aujourd'hui",
            'Il fait mauvais',
            "Il fait un mauvais temps aujourd'hui"
          ],
          explanation:
            '"Il fait mauvais" means it is bad weather. Can also say "il fait mauvais temps".'
        },
        {
          id: 'a1p-ch3-l6-q11',
          type: 'multiple_choice',
          prompt: 'Which sentence is correct?',
          options: [
            'Je fais du yoga.',
            'Je fais le yoga.',
            'Je fait du yoga.',
            'Je faire du yoga.'
          ],
          correctIndex: 0,
          explanation:
            '"Faire du yoga" uses the partitive "du". Je fais du yoga = I do yoga (first person "fais").'
        },
        {
          id: 'a1p-ch3-l6-q12',
          type: 'fill_blank',
          sentence: 'Vous ___ du vélo le weekend?',
          correctAnswer: 'faites',
          acceptableAnswers: ['faites'],
          explanation:
            '"Faire du vélo" means to ride a bike/go cycling. Vous faites du vélo? = Do you ride a bike?'
        }
      ]
    },
    {
      id: 'a1p-ch3-l7',
      title: 'Time Expressions & Connectors',
      order: 7,
      comprehensibleInput: {
        title: 'Mon week-end',
        frenchText:
          "La semaine dernière, j"ai eu un week-end très chargé. Samedi, d'abord, je me suis réveillé tôt. Ensuite, je suis allé au marché acheter des légumes frais. Puis, j'ai rencontré mes amis au café. Pendant l'après-midi, nous avons fait du sport ensemble. Après le sport, nous avons pris une douche et nous sommes allés au restaurant. Finalement, je suis rentré chez moi tard le soir. Hier (dimanche), avant le petit-déjeuner, j'ai fait du yoga. La matinée était calme. Aujourd'hui, je suis fatigué mais content. Demain et la semaine prochaine, je vais me reposer davantage!\",
        englishHint: 'A narrative using time connectors to describe weekend activities',
        vocabularyHighlights: [
          { french: 'la semaine dernière', english: 'last week' },
          { french: "d'abord", english: "first" },
          { french: 'ensuite', english: 'then/next' },
          { french: 'puis', english: 'then' },
          { french: 'pendant', english: 'during' },
          { french: 'après', english: 'after' },
          { french: 'finalement', english: 'finally' },
          { french: 'hier', english: 'yesterday' },
          { french: 'avant', english: 'before' },
          { french: "aujourd'hui", english: "today" },
          { french: 'demain', english: 'tomorrow' },
          { french: 'la semaine prochaine', english: 'next week' }
        ]
      },
      warmupQuestions: [
        {
          id: 'a1p-ch3-l7-q1',
          type: 'multiple_choice',
          prompt: 'What does "faire les courses" mean?',
          options: [
            'to do the shopping',
            'to run races',
            'to take courses',
            'to make courses'
          ],
          correctIndex: 0,
          explanation: 'Review: "Faire les courses" means to do the shopping/go shopping.'
        },
        {
          id: 'a1p-ch3-l7-q2',
          type: 'fill_blank',
          sentence: "Il ___ beau aujourd'hui.",
          correctAnswer: 'fait',
          acceptableAnswers: ['fait'],
          explanation: 'Review: For weather, use "il fait". Il fait beau = it is nice weather.'
        },
        {
          id: 'a1p-ch3-l7-q3',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'She is hot. (person feels hot)',
          correctAnswer: 'Elle a chaud.',
          acceptableAnswers: ['Elle a chaud', 'Elle as chaud'],
          explanation:
            'Review: For personal feelings of temperature, use avoir. Elle a chaud = she is hot.'
        }
      ],
      drillQuestions: [
        {
          id: 'a1p-ch3-l7-q4',
          type: 'multiple_choice',
          prompt: 'How do you say "yesterday" in French?',
          options: ["hier", "demain", "aujourd'hui", "avant"],
          correctIndex: 0,
          explanation: "Hier = yesterday. (Demain = tomorrow, aujourd'hui = today)"
        },
        {
          id: 'a1p-ch3-l7-q5',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'tomorrow',
          correctAnswer: 'demain',
          acceptableAnswers: ['demain'],
          explanation: "Demain = tomorrow. (Hier = yesterday, aujourd'hui = today)"
        },
        {
          id: 'a1p-ch3-l7-q6',
          type: 'fill_blank',
          sentence: "___ la semaine dernière, j'ai visité Paris.",
          correctAnswer: 'La',
          acceptableAnswers: ['La', 'Pendant'],
          explanation:
            '"La semaine dernière" = last week. Can also use "Pendant la semaine dernière" = during last week.'
        },
        {
          id: 'a1p-ch3-l7-q7',
          type: 'multiple_choice',
          prompt: "What does \"d'abord\" mean?",
          options: ['first', 'then', 'finally', 'during'],
          correctIndex: 0,
          explanation:
            'D'abord = first/at first. Used to introduce the first action in a sequence.'
        },
        {
          id: 'a1p-ch3-l7-q8',
          type: 'translation',
          direction: 'fr_to_en',
          sourceText: 'Ensuite, nous sommes allés au cinéma.',
          correctAnswer: 'Then, we went to the cinema.',
          acceptableAnswers: [
            'Then, we went to the cinema',
            'Next, we went to the cinema',
            'Then we went to the movies',
            'After that, we went to the cinema'
          ],
          explanation:
            'Ensuite = then/next. It connects actions in sequence. Puis is a synonym.'
        },
        {
          id: 'a1p-ch3-l7-q9',
          type: 'fill_blank',
          sentence: 'Finalement, je suis ___ chez moi.',
          correctAnswer: 'rentré',
          acceptableAnswers: ['rentré', 'rentrée'],
          explanation:
            'Finalement = finally. "Rentrer" (to return home) uses être in passé composé. Je suis rentré(e).'
        },
        {
          id: 'a1p-ch3-l7-q10',
          type: 'error_correction',
          incorrectSentence:
            "Finalement je suis allé au parc, ensuite j'ai mangé, d'abord je me suis réveillé.",
          options: [
            "D'abord je me suis réveillé, ensuite j'ai mangé, finalement je suis allé au parc.",
            "Ensuite je me suis réveillé, d'abord j'ai mangé, finalement je suis allé au parc.",
            "Finalement je me suis réveillé, d'abord j'ai mangé, ensuite je suis allé au parc.",
            "D'abord je suis allé au parc, finalement j'ai mangé, ensuite je me suis réveillé."
          ],
          correctIndex: 0,
          explanation:
            'Logical order: D'abord (first) → ensuite (then) → finalement (finally). Waking up comes first!'
        },
        {
          id: 'a1p-ch3-l7-q11',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'during the day',
          correctAnswer: 'pendant la journée',
          acceptableAnswers: ['pendant la journée', 'pendant le jour'],
          explanation:
            'Pendant = during. "La journée" = the day. Pendant la journée = during the day.'
        },
        {
          id: 'a1p-ch3-l7-q12',
          type: 'fill_blank',
          sentence: 'Après le dîner, nous avons ___ un film. (regarder)',
          correctAnswer: 'regardé',
          acceptableAnswers: ['regardé'],
          explanation:
            'Après = after. Après le dîner = after dinner. "Regarder" uses avoir: nous avons regardé.'
        },
        {
          id: 'a1p-ch3-l7-q13',
          type: 'multiple_choice',
          prompt: 'How do you say "next week" in French?',
          options: [
            'la semaine prochaine',
            'la semaine dernière',
            'la semaine suivante',
            'la prochaine semaine'
          ],
          correctIndex: 0,
          explanation:
            'La semaine prochaine = next week. (La semaine dernière = last week)'
        },
        {
          id: 'a1p-ch3-l7-q14',
          type: 'translation',
          direction: 'fr_to_en',
          sourceText: 'Avant le petit-déjeuner, je fais du sport.',
          correctAnswer: 'Before breakfast, I do sports.',
          acceptableAnswers: [
            'Before breakfast, I do sports',
            'Before breakfast, I exercise',
            'Before breakfast I work out'
          ],
          explanation:
            'Avant = before. Avant le petit-déjeuner = before breakfast. Faire du sport = to do sports/exercise.'
        }
      ]
    }
  ]
}
