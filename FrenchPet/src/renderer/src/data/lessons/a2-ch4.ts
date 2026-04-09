import type { Chapter } from '../../types/lesson'

export const a2Ch4: Chapter = {
  id: 'a2-ch4',
  title: 'Narration & Futur Simple',
  level: 'A2',
  lessons: [
    {
      id: 'a2-ch4-l1',
      title: 'Imparfait Formation',
      grammarExplanation: `The imparfait (imperfect tense) is used to describe past habits, ongoing states, and background descriptions.

Formation: Take the nous form of the present tense, remove -ons, add: -ais, -ais, -ait, -ions, -iez, -aient

Examples:
- parler → nous parlons → je parlais
- finir → nous finissons → tu finissais
- attendre → nous attendons → il attendait

Exception: être → j'étais, tu étais, il était, nous étions, vous étiez, ils étaient`,

      comprehensibleInput: {
        title: 'Mon enfance',
        content: `Quand j"étais petit, j'habitais dans un petit village. Mes parents travaillaient à la ferme. Chaque matin, je me réveillais tôt et j'aidais mon père. Nous avions beaucoup d'animaux : des vaches, des chevaux et des poules. Ma mère préparait toujours un bon petit-déjeuner. Après l'école, mes amis et moi, nous jouions dans les champs. C'était une belle époque.`,
        translation: 'When I was little, I lived in a small village. My parents worked on the farm. Every morning, I would wake up early and help my father. We had many animals: cows, horses, and chickens. My mother always prepared a good breakfast. After school, my friends and I would play in the fields. It was a beautiful time.'
      },

      warmupQuestions: [
        {
          id: 'a2-ch4-l1-q1',
          type: 'multiple_choice',
          prompt: 'Comment dit-on "I went to the market" en français?',
          options: [
            'Je suis allé au marché',
            'Je vais au marché',
            'J\'irai au marché',
            'J\'allais au marché'
          ],
          correctIndex: 0,
          explanation: 'Passé composé review: aller uses être as auxiliary. "I went" = je suis allé(e).'
        },
        {
          id: 'a2-ch4-l1-q2',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'We are going to eat soon.',
          correctAnswer: 'Nous allons manger bientôt.',
          acceptableAnswers: ['On va manger bientôt.', 'Nous allons bientôt manger.'],
          explanation: 'Futur proche review: aller + infinitive expresses near future.'
        }
      ],

      drillQuestions: [
        {
          id: 'a2-ch4-l1-q3',
          type: 'fill_blank',
          sentence: 'Quand j\'étais jeune, je ___ au parc tous les jours. (jouer)',
          correctAnswer: 'jouais',
          explanation: 'Jouer → nous jouons → je jouais. The imparfait describes a habitual past action.'
        },
        {
          id: 'a2-ch4-l1-q4',
          type: 'multiple_choice',
          prompt: 'Quelle est la forme correcte? "Tu ___ beaucoup de livres." (lire - to read)',
          options: [
            'lisais',
            'lises',
            'lis',
            'lisait'
          ],
          correctIndex: 0,
          explanation: 'Lire → nous lisons → lis- + ais = tu lisais. Remember to use the nous stem.'
        },
        {
          id: 'a2-ch4-l1-q5',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'They were finishing their homework.',
          correctAnswer: 'Ils finissaient leurs devoirs.',
          acceptableAnswers: ['Elles finissaient leurs devoirs.'],
          explanation: 'Finir → nous finissons → finiss- + aient = ils finissaient.'
        },
        {
          id: 'a2-ch4-l1-q6',
          type: 'fill_blank',
          sentence: 'Nous ___ très heureux ensemble. (être)',
          correctAnswer: 'étions',
          explanation: 'Être is irregular in the imparfait: j\'étais, tu étais, il était, nous étions, vous étiez, ils étaient.'
        },
        {
          id: 'a2-ch4-l1-q7',
          type: 'error_correction',
          incorrectSentence: 'Vous faisiez vos courses chaque samedi.',
          options: [
            'Correct as is',
            'Vous faisez vos courses chaque samedi.',
            'Vous faites vos courses chaque samedi.',
            'Vous ferez vos courses chaque samedi.'
          ],
          correctIndex: 0,
          explanation: 'This is already correct! Faire → nous faisons → fais- + iez = vous faisiez.'
        },
        {
          id: 'a2-ch4-l1-q8',
          type: 'multiple_choice',
          prompt: 'Complete: "Elle ___ toujours à 7 heures." (se réveiller)',
          options: [
            'se réveillait',
            'se réveille',
            'se réveillera',
            'se réveillais'
          ],
          correctIndex: 0,
          explanation: 'Se réveiller → nous nous réveillons → se réveill- + ait = elle se réveillait.'
        },
        {
          id: 'a2-ch4-l1-q9',
          type: 'translation',
          direction: 'fr_to_en',
          sourceText: 'Mes grands-parents habitaient à la campagne.',
          correctAnswer: 'My grandparents lived in the countryside.',
          acceptableAnswers: ['My grandparents used to live in the countryside.'],
          explanation: 'L\'imparfait can be translated as "lived" or "used to live" for habitual past actions.'
        },
        {
          id: 'a2-ch4-l1-q10',
          type: 'fill_blank',
          sentence: 'Quand il pleuvait, nous ___ à la maison. (rester)',
          correctAnswer: 'restions',
          acceptableAnswers: ['demeurions'],
          explanation: 'Rester → nous restons → rest- + ions = nous restions.'
        },
        {
          id: 'a2-ch4-l1-q11',
          type: 'multiple_choice',
          prompt: 'Quelle phrase est correcte?',
          options: [
            'J\'avais un chien quand j\'étais petit.',
            'J\'avais un chien quand je suis petit.',
            'J\'ai un chien quand j\'étais petit.',
            'Je suis un chien quand j\'étais petit.'
          ],
          correctIndex: 0,
          explanation: 'Both verbs need imparfait: "I had a dog when I was little." Avoir → j\'avais, être → j\'étais.'
        },
        {
          id: 'a2-ch4-l1-q12',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'You (formal) were waiting for the bus.',
          correctAnswer: 'Vous attendiez le bus.',
          explanation: 'Attendre → nous attendons → attend- + iez = vous attendiez.'
        }
      ]
    },
    {
      id: 'a2-ch4-l2',
      title: 'Imparfait vs Passé Composé',
      grammarExplanation: `Use passé composé for:
- Completed, one-time actions
- Specific events with clear beginning/end
- Actions that interrupted ongoing situations

Use imparfait for:
- Background descriptions, ongoing states
- Habitual/repeated actions
- Time, weather, age in the past
- Actions in progress (when interrupted)

Example: "Il pleuvait (ongoing) quand je suis sorti (specific action)."`,

      comprehensibleInput: {
        title: 'Une aventure inattendue',
        content: `Hier, il faisait beau et je me promenais dans le parc. Les oiseaux chantaient et les enfants jouaient. Tout était calme. Soudain, j"ai entendu un grand bruit. Je me suis retourné et j'ai vu un chien qui courait vers moi. Il avait l'air perdu. J'ai regardé son collier et j'ai trouvé le numéro de son propriétaire. Pendant que j'appelais, le chien attendait patiemment. Son maître est arrivé dix minutes plus tard. Il était très content de retrouver son chien!`,
        translation: 'Yesterday, the weather was nice and I was walking in the park. The birds were singing and children were playing. Everything was calm. Suddenly, I heard a loud noise. I turned around and saw a dog running toward me. He looked lost. I looked at his collar and found his owner\'s number. While I was calling, the dog was waiting patiently. His owner arrived ten minutes later. He was very happy to find his dog!'
      },

      warmupQuestions: [
        {
          id: 'a2-ch4-l2-q1',
          type: 'fill_blank',
          sentence: 'Chaque dimanche, ma famille ___ à la messe. (aller)',
          correctAnswer: 'allait',
          explanation: '"Chaque dimanche" indicates a habitual action, so we use imparfait: allait.'
        },
        {
          id: 'a2-ch4-l2-q2',
          type: 'multiple_choice',
          prompt: 'Quelle forme est correcte? "Nous ___ souvent au cinéma."',
          options: [
            'allions',
            'sommes allés',
            'allons',
            'irons'
          ],
          correctIndex: 0,
          explanation: '"Souvent" (often) indicates a repeated action in the past → imparfait: nous allions.'
        }
      ],

      drillQuestions: [
        {
          id: 'a2-ch4-l2-q3',
          type: 'multiple_choice',
          prompt: 'Complete: "Pendant que je ___, le téléphone ___." (cuisiner, sonner)',
          options: [
            'cuisinais, a sonné',
            'ai cuisiné, sonnait',
            'cuisinais, sonnait',
            'ai cuisiné, a sonné'
          ],
          correctIndex: 0,
          explanation: 'Ongoing action (cuisinais - imparfait) interrupted by specific event (a sonné - passé composé).'
        },
        {
          id: 'a2-ch4-l2-q4',
          type: 'fill_blank',
          sentence: 'Quand j\'___ petit, je ___ peur du noir. (être, avoir)',
          correctAnswer: 'étais, avais',
          acceptableAnswers: ['étais...avais'],
          explanation: 'Both describe ongoing states in the past, so both use imparfait: étais, avais.'
        },
        {
          id: 'a2-ch4-l2-q5',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'It was raining when she arrived.',
          correctAnswer: 'Il pleuvait quand elle est arrivée.',
          explanation: 'Weather (ongoing) = imparfait (pleuvait). Specific arrival = passé composé (est arrivée).'
        },
        {
          id: 'a2-ch4-l2-q6',
          type: 'error_correction',
          incorrectSentence: 'Hier, je marchais au marché et j\'achetais des légumes.',
          options: [
            'Hier, je suis allé au marché et j\'ai acheté des légumes.',
            'Hier, je vais au marché et j\'achète des légumes.',
            'Correct as is',
            'Hier, j\'irai au marché et j\'achèterai des légumes.'
          ],
          correctIndex: 0,
          explanation: '"Hier" (yesterday) with specific completed actions requires passé composé: je suis allé, j\'ai acheté.'
        },
        {
          id: 'a2-ch4-l2-q7',
          type: 'multiple_choice',
          prompt: 'Quelle phrase est correcte?',
          options: [
            'Nous regardions la télé quand tu es arrivé.',
            'Nous avons regardé la télé quand tu arrivais.',
            'Nous regardons la télé quand tu es arrivé.',
            'Nous avons regardé la télé quand tu as arrivé.'
          ],
          correctIndex: 0,
          explanation: 'Ongoing action (watching TV) uses imparfait, interrupting event (arrival) uses passé composé.'
        },
        {
          id: 'a2-ch4-l2-q8',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'I was ten years old when we moved.',
          correctAnswer: 'J\'avais dix ans quand nous avons déménagé.',
          acceptableAnswers: ['J\'avais dix ans quand on a déménagé.'],
          explanation: 'Age (ongoing state) = imparfait (avais). Specific event of moving = passé composé (avons déménagé).'
        },
        {
          id: 'a2-ch4-l2-q9',
          type: 'fill_blank',
          sentence: 'Les étudiants ___ quand le professeur ___ dans la classe. (parler, entrer)',
          correctAnswer: 'parlaient, est entré',
          acceptableAnswers: ['parlaient...est entré'],
          explanation: 'Ongoing action (talking) = imparfait (parlaient). Interrupting event (entering) = passé composé (est entré).'
        },
        {
          id: 'a2-ch4-l2-q10',
          type: 'multiple_choice',
          prompt: 'Complete: "Autrefois, nous ___ à la plage chaque été."',
          options: [
            'allions',
            'sommes allés',
            'allons',
            'irons'
          ],
          correctIndex: 0,
          explanation: '"Autrefois" (in the past) + "chaque été" (every summer) = habitual action → imparfait: allions.'
        },
        {
          id: 'a2-ch4-l2-q11',
          type: 'translation',
          direction: 'fr_to_en',
          sourceText: 'Il faisait froid, alors j\'ai mis mon manteau.',
          correctAnswer: 'It was cold, so I put on my coat.',
          explanation: 'Weather description (background) = imparfait (faisait). Specific action = passé composé (ai mis).'
        },
        {
          id: 'a2-ch4-l2-q12',
          type: 'error_correction',
          incorrectSentence: 'Quand je suis été jeune, je jouais au football.',
          options: [
            'Quand j\'étais jeune, je jouais au football.',
            'Quand je suis jeune, je jouais au football.',
            'Quand j\'étais jeune, j\'ai joué au football.',
            'Correct as is'
          ],
          correctIndex: 0,
          explanation: 'Être in imparfait is "j\'étais" not "je suis été". Both clauses describe ongoing past states.'
        }
      ]
    },
    {
      id: 'a2-ch4-l3',
      title: 'Futur Simple — Regular Verbs',
      grammarExplanation: `The futur simple expresses future actions and is more formal than futur proche.

Formation for regular verbs:
- Take the infinitive (for -re verbs, drop final -e)
- Add: -ai, -as, -a, -ons, -ez, -ont

Examples:
- parler: je parlerai, tu parleras, il parlera, nous parlerons, vous parlerez, ils parleront
- finir: je finirai, tu finiras, il finira, nous finirons, vous finirez, ils finiront
- attendre: j'attendrai (drop the -e), tu attendras, il attendra, nous attendrons, vous attendrez, ils attendront`,

      comprehensibleInput: {
        title: 'La voyante',
        content: `— Bonjour, madame. Je vois votre avenir dans ma boule de cristal. Vous voyagerez beaucoup l"année prochaine. Vous visiterez trois pays différents. Vous rencontrerez une personne très importante pour vous. Dans deux ans, vous changerez de travail et vous gagnerez plus d'argent. Vos enfants réussiront à l'école et vous serez très fier de vos enfants. La vie vous sourira!`,
        translation: 'Hello, madam. I see your future in my crystal ball. You will travel a lot next year. You will visit three different countries. You will meet a very important person. In two years, you will change jobs and you will earn more money. Your children will succeed at school and you will be very proud of them. Life will smile upon you!'
      },

      warmupQuestions: [
        {
          id: 'a2-ch4-l3-q1',
          type: 'multiple_choice',
          prompt: 'Quelle phrase utilise l\'imparfait correctement?',
          options: [
            'Quand j\'étais petit, je jouais au tennis.',
            'Quand j\'ai été petit, je jouais au tennis.',
            'Quand je suis petit, je jouais au tennis.',
            'Quand j\'étais petit, j\'ai joué au tennis.'
          ],
          correctIndex: 0,
          explanation: 'Both "being young" and "playing tennis" are ongoing past states → both imparfait.'
        },
        {
          id: 'a2-ch4-l3-q2',
          type: 'fill_blank',
          sentence: 'Il ___ du café quand je ___ à la porte. (boire, frapper)',
          correctAnswer: 'buvait, ai frappé',
          acceptableAnswers: ['buvait...ai frappé'],
          explanation: 'Ongoing action (drinking) = imparfait. Interrupting action (knocking) = passé composé.'
        }
      ],

      drillQuestions: [
        {
          id: 'a2-ch4-l3-q3',
          type: 'fill_blank',
          sentence: 'Demain, nous ___ au restaurant. (manger)',
          correctAnswer: 'mangerons',
          explanation: 'Manger + ons = mangerons. Regular -er verb in futur simple.'
        },
        {
          id: 'a2-ch4-l3-q4',
          type: 'multiple_choice',
          prompt: 'Complete: "Tu ___ tes devoirs ce soir?" (finir)',
          options: [
            'finiras',
            'finissais',
            'as fini',
            'finis'
          ],
          correctIndex: 0,
          explanation: '"Ce soir" (tonight) indicates future → futur simple: tu finiras.'
        },
        {
          id: 'a2-ch4-l3-q5',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'They will wait for us at the station.',
          correctAnswer: 'Ils attendront à la gare.',
          acceptableAnswers: ['Elles attendront à la gare.', 'Ils nous attendront à la gare.'],
          explanation: 'Attendre (drop -e) + ont = attendront. Remember -re verbs drop final -e.'
        },
        {
          id: 'a2-ch4-l3-q6',
          type: 'error_correction',
          incorrectSentence: 'L\'année prochaine, je voyagerai en Italie.',
          options: [
            'Correct as is',
            'L\'année prochaine, je voyagais en Italie.',
            'L\'année prochaine, je voyage en Italie.',
            'L\'année prochaine, j\'ai voyagé en Italie.'
          ],
          correctIndex: 0,
          explanation: 'Already correct! Voyager + ai = je voyagerai. Future time expression requires futur simple.'
        },
        {
          id: 'a2-ch4-l3-q7',
          type: 'multiple_choice',
          prompt: 'Quelle est la forme correcte? "Vous ___ la réponse demain." (répondre)',
          options: [
            'répondrez',
            'répondez',
            'répondiez',
            'avez répondu'
          ],
          correctIndex: 0,
          explanation: 'Répondre (drop -e) = répondr- + ez = vous répondrez.'
        },
        {
          id: 'a2-ch4-l3-q8',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'I will choose the blue dress.',
          correctAnswer: 'Je choisirai la robe bleue.',
          explanation: 'Choisir + ai = je choisirai. Regular -ir verb in futur simple.'
        },
        {
          id: 'a2-ch4-l3-q9',
          type: 'fill_blank',
          sentence: 'Dans dix ans, ils ___ dans une grande maison. (habiter)',
          correctAnswer: 'habiteront',
          explanation: 'Habiter + ont = ils habiteront. Time expression "dans dix ans" signals futur simple.'
        },
        {
          id: 'a2-ch4-l3-q10',
          type: 'multiple_choice',
          prompt: 'Complete: "Elle ___ ses amis samedi prochain." (inviter)',
          options: [
            'invitera',
            'invitait',
            'a invité',
            'invite'
          ],
          correctIndex: 0,
          explanation: '"Samedi prochain" (next Saturday) = future → inviter + a = elle invitera.'
        },
        {
          id: 'a2-ch4-l3-q11',
          type: 'translation',
          direction: 'fr_to_en',
          sourceText: 'Nous vendrons notre voiture bientôt.',
          correctAnswer: 'We will sell our car soon.',
          explanation: 'Vendre (drop -e) + ons = nous vendrons. Futur simple expresses future action.'
        },
        {
          id: 'a2-ch4-l3-q12',
          type: 'error_correction',
          incorrectSentence: 'Tu attenderas ton ami devant le cinéma?',
          options: [
            'Correct as is',
            'Tu attends ton ami devant le cinéma?',
            'Tu attendais ton ami devant le cinéma?',
            'Tu as attendu ton ami devant le cinéma?'
          ],
          correctIndex: 0,
          explanation: 'Already correct! Attendre (drop -e) + as = tu attendras. Future question is properly formed.'
        }
      ]
    },
    {
      id: 'a2-ch4-l4',
      title: 'Futur Simple — Irregular Stems',
      grammarExplanation: `Many common verbs have irregular stems in futur simple, but use the same endings: -ai, -as, -a, -ons, -ez, -ont

Key irregular stems:
- être → ser- (je serai)
- avoir → aur- (j'aurai)
- faire → fer- (je ferai)
- aller → ir- (j'irai)
- pouvoir → pourr- (je pourrai)
- vouloir → voudr- (je voudrai)
- venir → viendr- (je viendrai)
- voir → verr- (je verrai)
- savoir → saur- (je saurai)
- devoir → devr- (je devrai)`,

      comprehensibleInput: {
        title: 'Mes projets pour l\'été',
        content: `Cet été sera fantastique! J'irai en Grèce avec ma famille. Nous verrons les monuments antiques d'Athènes. Je pourrai nager dans la mer Égée tous les jours. Mes parents feront de la plongée et ma sœur voudra visiter tous les musées. Nous devrons prendre beaucoup de photos. J'aurai enfin des vacances parfaites! Je saurai parler un peu de grec à la fin du voyage.`,
        translation: 'This summer will be fantastic! I will go to Greece with my family. We will see the ancient monuments of Athens. I will be able to swim in the Aegean Sea every day. My parents will go diving and my sister will want to visit all the museums. We will have to take lots of photos. I will finally have perfect vacations! I will know how to speak a bit of Greek at the end of the trip.'
      },

      warmupQuestions: [
        {
          id: 'a2-ch4-l4-q1',
          type: 'fill_blank',
          sentence: 'L\'année prochaine, je ___ le français. (parler)',
          correctAnswer: 'parlerai',
          explanation: 'Parler is regular in futur simple: parler + ai = je parlerai.'
        },
        {
          id: 'a2-ch4-l4-q2',
          type: 'multiple_choice',
          prompt: 'Quelle phrase est au futur simple? ',
          options: [
            'Nous choisirons un bon restaurant.',
            'Nous choisissons un bon restaurant.',
            'Nous avons choisi un bon restaurant.',
            'Nous choisissions un bon restaurant.'
          ],
          correctIndex: 0,
          explanation: 'Choisir + ons = nous choisirons is futur simple. The others are present, passé composé, and imparfait.'
        }
      ],

      drillQuestions: [
        {
          id: 'a2-ch4-l4-q3',
          type: 'fill_blank',
          sentence: 'Demain, je ___ au cinéma avec mes amis. (aller)',
          correctAnswer: 'irai',
          explanation: 'Aller has irregular stem ir- in futur simple: j\'irai.'
        },
        {
          id: 'a2-ch4-l4-q4',
          type: 'multiple_choice',
          prompt: 'Complete: "Tu ___ content de me voir!" (être)',
          options: [
            'seras',
            'étais',
            'es',
            'as été'
          ],
          correctIndex: 0,
          explanation: 'Être has irregular stem ser-: tu seras. Future tense for "you will be happy".'
        },
        {
          id: 'a2-ch4-l4-q5',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'We will have a lot of work.',
          correctAnswer: 'Nous aurons beaucoup de travail.',
          explanation: 'Avoir → irregular stem aur-: nous aurons. "We will have" = nous aurons.'
        },
        {
          id: 'a2-ch4-l4-q6',
          type: 'error_correction',
          incorrectSentence: 'Ils feront leurs devoirs ce soir.',
          options: [
            'Correct as is',
            'Ils font leurs devoirs ce soir.',
            'Ils faisaient leurs devoirs ce soir.',
            'Ils fairont leurs devoirs ce soir.'
          ],
          correctIndex: 0,
          explanation: 'Already correct! Faire → irregular stem fer-: ils feront is properly formed.'
        },
        {
          id: 'a2-ch4-l4-q7',
          type: 'multiple_choice',
          prompt: 'Quelle est la forme correcte? "Elle ___ venir à la fête." (pouvoir)',
          options: [
            'pourra',
            'peut',
            'pouvait',
            'a pu'
          ],
          correctIndex: 0,
          explanation: 'Pouvoir → irregular stem pourr-: elle pourra. "She will be able to come".'
        },
        {
          id: 'a2-ch4-l4-q8',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'You (plural) will want to visit Paris.',
          correctAnswer: 'Vous voudrez visiter Paris.',
          explanation: 'Vouloir → irregular stem voudr-: vous voudrez. "You will want".'
        },
        {
          id: 'a2-ch4-l4-q9',
          type: 'fill_blank',
          sentence: 'Mes cousins ___ nous voir en juillet. (venir)',
          correctAnswer: 'viendront',
          explanation: 'Venir → irregular stem viendr-: ils viendront. "They will come to see us".'
        },
        {
          id: 'a2-ch4-l4-q10',
          type: 'multiple_choice',
          prompt: 'Complete: "Je te ___ demain au café." (voir)',
          options: [
            'verrai',
            'vois',
            'voyais',
            'ai vu'
          ],
          correctIndex: 0,
          explanation: 'Voir → irregular stem verr-: je verrai. "I will see you tomorrow".'
        },
        {
          id: 'a2-ch4-l4-q11',
          type: 'translation',
          direction: 'fr_to_en',
          sourceText: 'Tu sauras la réponse bientôt.',
          correctAnswer: 'You will know the answer soon.',
          explanation: 'Savoir → irregular stem saur-: tu sauras means "you will know".'
        },
        {
          id: 'a2-ch4-l4-q12',
          type: 'fill_blank',
          sentence: 'Nous ___ partir tôt demain matin. (devoir)',
          correctAnswer: 'devrons',
          explanation: 'Devoir → irregular stem devr-: nous devrons. "We will have to leave early".'
        }
      ]
    },
    {
      id: 'a2-ch4-l5',
      title: 'Relative Pronouns (qui, que, où, dont)',
      grammarExplanation: `Relative pronouns connect clauses and avoid repetition:

**qui** (who, which, that) — replaces the subject
- L'homme qui parle est mon père. (The man who is speaking is my father.)

**que** (whom, which, that) — replaces the direct object
- Le livre que je lis est intéressant. (The book that I'm reading is interesting.)

**où** (where, when) — replaces a place or time
- La ville où j'habite est petite. (The city where I live is small.)

**dont** (whose, of which, about which) — replaces de + noun
- L"ami dont je parle s'appelle Marc. (The friend I'm talking about is named Marc.)`,

      comprehensibleInput: {
        title: 'Ma ville natale',
        content: `La ville où je suis né s"appelle Annecy. C'est une ville qui se trouve dans les Alpes. Le lac dont elle est célèbre est magnifique. Les touristes que nous voyons en été adorent la vieille ville. J'ai beaucoup d'amis qui habitent encore là-bas. La maison où j'ai grandi est près du centre. Les souvenirs que j'ai de mon enfance sont merveilleux. C'est un endroit dont je suis très fier.`,
        translation: 'The city where I was born is called Annecy. It\'s a city that is located in the Alps. The lake for which it is famous is magnificent. The tourists that we see in summer love the old town. I have many friends who still live there. The house where I grew up is near the center. The memories that I have of my childhood are wonderful. It\'s a place of which I am very proud.'
      },

      warmupQuestions: [
        {
          id: 'a2-ch4-l5-q1',
          type: 'fill_blank',
          sentence: 'Un jour, je ___ médecin. (être)',
          correctAnswer: 'serai',
          explanation: 'Être → irregular stem ser- in futur simple: je serai.'
        },
        {
          id: 'a2-ch4-l5-q2',
          type: 'multiple_choice',
          prompt: 'Complete: "Nous ___ nos vacances en Espagne." (passer)',
          options: [
            'passerons',
            'passons',
            'passions',
            'avons passé'
          ],
          correctIndex: 0,
          explanation: 'Context suggests future: passer + ons = nous passerons (we will spend).'
        }
      ],

      drillQuestions: [
        {
          id: 'a2-ch4-l5-q3',
          type: 'fill_blank',
          sentence: 'La femme ___ travaille ici est très gentille.',
          correctAnswer: 'qui',
          explanation: 'Qui replaces the subject: "The woman who works here is very nice."'
        },
        {
          id: 'a2-ch4-l5-q4',
          type: 'multiple_choice',
          prompt: 'Complete: "Le film ___ nous avons vu était excellent."',
          options: [
            'que',
            'qui',
            'où',
            'dont'
          ],
          correctIndex: 0,
          explanation: 'Que replaces the direct object: "The film that we saw was excellent."'
        },
        {
          id: 'a2-ch4-l5-q5',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'The restaurant where we ate was expensive.',
          correctAnswer: 'Le restaurant où nous avons mangé était cher.',
          acceptableAnswers: ['Le restaurant où on a mangé était cher.'],
          explanation: 'Où replaces a place: "the restaurant where we ate" = le restaurant où nous avons mangé.'
        },
        {
          id: 'a2-ch4-l5-q6',
          type: 'error_correction',
          incorrectSentence: 'C\'est le professeur que j\'ai parlé.',
          options: [
            'C\'est le professeur dont j\'ai parlé.',
            'C\'est le professeur qui j\'ai parlé.',
            'C\'est le professeur où j\'ai parlé.',
            'Correct as is'
          ],
          correctIndex: 0,
          explanation: 'Parler DE quelqu\'un → use dont: "the teacher I talked about" = le professeur dont j\'ai parlé.'
        },
        {
          id: 'a2-ch4-l5-q7',
          type: 'multiple_choice',
          prompt: 'Quelle phrase est correcte?',
          options: [
            'Les amis qui viennent ce soir sont sympathiques.',
            'Les amis que viennent ce soir sont sympathiques.',
            'Les amis dont viennent ce soir sont sympathiques.',
            'Les amis où viennent ce soir sont sympathiques.'
          ],
          correctIndex: 0,
          explanation: 'Qui is the subject of "viennent": "The friends who are coming tonight are nice."'
        },
        {
          id: 'a2-ch4-l5-q8',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'The book that I need is at the library.',
          correctAnswer: 'Le livre dont j\'ai besoin est à la bibliothèque.',
          acceptableAnswers: ['Le livre dont j\'ai besoin se trouve à la bibliothèque.'],
          explanation: 'Avoir besoin DE → use dont: "the book that I need" = le livre dont j\'ai besoin.'
        },
        {
          id: 'a2-ch4-l5-q9',
          type: 'fill_blank',
          sentence: 'Le jour ___ je suis né, il neigeait.',
          correctAnswer: 'où',
          explanation: 'Où can replace a time expression: "The day when I was born" = le jour où je suis né.'
        },
        {
          id: 'a2-ch4-l5-q10',
          type: 'multiple_choice',
          prompt: 'Complete: "Voici la voiture ___ mon père vient d\'acheter."',
          options: [
            'que',
            'qui',
            'dont',
            'où'
          ],
          correctIndex: 0,
          explanation: 'Que replaces the direct object of acheter: "the car that my father just bought".'
        },
        {
          id: 'a2-ch4-l5-q11',
          type: 'translation',
          direction: 'fr_to_en',
          sourceText: 'C\'est une histoire dont tout le monde parle.',
          correctAnswer: 'It\'s a story that everyone is talking about.',
          acceptableAnswers: ['It\'s a story everyone talks about.', 'It\'s a story of which everyone speaks.'],
          explanation: 'Parler DE → dont: "a story that everyone talks about" = une histoire dont tout le monde parle.'
        },
        {
          id: 'a2-ch4-l5-q12',
          type: 'fill_blank',
          sentence: 'Les étudiants ___ réussissent travaillent beaucoup.',
          correctAnswer: 'qui',
          explanation: 'Qui is the subject of réussissent: "The students who succeed work a lot."'
        }
      ]
    },
    {
      id: 'a2-ch4-l6',
      title: 'Narration Practice',
      grammarExplanation: `This lesson combines all elements from Chapter 4:
- Imparfait for background, descriptions, and ongoing actions
- Passé composé for specific completed events
- Futur simple for future plans and predictions
- Relative pronouns to connect ideas smoothly

Practice moving between time frames and using these structures together to tell complete stories.`,

      comprehensibleInput: {
        title: 'Mon voyage mémorable',
        content: `L"été dernier, je suis allé en Bretagne, une région qui se trouve dans l'ouest de la France. Il faisait beau et les plages que nous avons visitées étaient magnifiques. Chaque jour, nous nous promenions le long de la côte où les vagues étaient impressionnantes. Un matin, pendant que je prenais mon petit-déjeuner, j'ai rencontré une famille dont les enfants parlaient anglais. Nous sommes devenus amis et nous avons passé toute la semaine ensemble.

Maintenant, je prépare mon prochain voyage. L'année prochaine, j'irai au Québec. Je verrai les chutes du Niagara et je visiterai Montréal, une ville que mes amis adorent. Je pourrai pratiquer mon français tous les jours. Ce sera une expérience dont je me souviendrai toute ma vie!`,
        translation: 'Last summer, I went to Brittany, a region that is located in western France. The weather was nice and the beaches that we visited were magnificent. Every day, we would walk along the coast where the waves were impressive. One morning, while I was having breakfast, I met a family whose children spoke English. We became friends and spent the whole week together. Now, I\'m preparing my next trip. Next year, I will go to Quebec. I will see Niagara Falls and visit Montreal, a city that my friends love. I will be able to practice my French every day. It will be an experience that I will remember all my life!'
      },

      warmupQuestions: [
        {
          id: 'a2-ch4-l6-q1',
          type: 'fill_blank',
          sentence: 'Voici le café ___ je vais tous les matins.',
          correctAnswer: 'où',
          explanation: 'Où replaces a place: "the café where I go every morning".'
        },
        {
          id: 'a2-ch4-l6-q2',
          type: 'multiple_choice',
          prompt: 'Complete: "Les livres ___ tu as achetés sont sur la table."',
          options: [
            'que',
            'qui',
            'dont',
            'où'
          ],
          correctIndex: 0,
          explanation: 'Que replaces the direct object: "The books that you bought are on the table."'
        },
        {
          id: 'a2-ch4-l6-q3',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'The teacher I told you about is very strict.',
          correctAnswer: 'Le professeur dont je t\'ai parlé est très strict.',
          acceptableAnswers: ['La professeure dont je t\'ai parlé est très stricte.'],
          explanation: 'Parler DE → dont. "The teacher I told you about" = le professeur dont je t\'ai parlé.'
        }
      ],

      drillQuestions: [
        {
          id: 'a2-ch4-l6-q4',
          type: 'fill_blank',
          sentence: 'Quand j\'___ petit, je ___ au foot tous les weekends, mais un jour, je ___ ma jambe et je ___ arrêter. (être, jouer, casser, devoir)',
          correctAnswer: 'étais, jouais, ai cassé, ai dû',
          acceptableAnswers: ['étais...jouais...ai cassé...ai dû'],
          explanation: 'Background (être, jouer) = imparfait. Specific events (casser, devoir) = passé composé.'
        },
        {
          id: 'a2-ch4-l6-q5',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'When I arrive in Paris, I will visit the museums that I love.',
          correctAnswer: 'Quand j\'arriverai à Paris, je visiterai les musées que j\'aime.',
          acceptableAnswers: ['Quand j\'arriverai à Paris, je visiterai les musées que j\'adore.'],
          explanation: 'After "quand" with future meaning, French uses futur simple in both clauses. Que = direct object.'
        },
        {
          id: 'a2-ch4-l6-q6',
          type: 'multiple_choice',
          prompt: 'Quelle phrase est correcte?',
          options: [
            'Pendant que nous regardions la télé, quelqu\'un a frappé à la porte.',
            'Pendant que nous avons regardé la télé, quelqu\'un frappait à la porte.',
            'Pendant que nous regardons la télé, quelqu\'un a frappé à la porte.',
            'Pendant que nous regardions la télé, quelqu\'un frappait à la porte.'
          ],
          correctIndex: 0,
          explanation: 'Ongoing action (regardions - imparfait) interrupted by specific event (a frappé - passé composé).'
        },
        {
          id: 'a2-ch4-l6-q7',
          type: 'error_correction',
          incorrectSentence: 'Demain, je vais aller au marché et j\'achèterai des fruits.',
          options: [
            'Demain, j\'irai au marché et j\'achèterai des fruits.',
            'Demain, je suis allé au marché et j\'ai acheté des fruits.',
            'Correct as is',
            'Demain, j\'allais au marché et j\'achetais des fruits.'
          ],
          correctIndex: 0,
          explanation: 'For stylistic consistency with "demain", use futur simple for both verbs: j\'irai, j\'achèterai.'
        },
        {
          id: 'a2-ch4-l6-q8',
          type: 'translation',
          direction: 'fr_to_en',
          sourceText: 'La maison où j\'habitais quand j\'étais jeune n\'existe plus.',
          correctAnswer: 'The house where I lived when I was young no longer exists.',
          acceptableAnswers: ['The house where I used to live when I was young doesn\'t exist anymore.'],
          explanation: 'Où = where. Both habitais and étais are imparfait (ongoing past states).'
        },
        {
          id: 'a2-ch4-l6-q9',
          type: 'fill_blank',
          sentence: 'L\'année prochaine, nous ___ dans une ville ___ il y a beaucoup de musées. (habiter, où)',
          correctAnswer: 'habiterons, où',
          acceptableAnswers: ['habiterons...où'],
          explanation: 'Future time → futur simple: nous habiterons. Place → relative pronoun où.'
        },
        {
          id: 'a2-ch4-l6-q10',
          type: 'multiple_choice',
          prompt: 'Complete: "C\'est le film ___ tout le monde ___ en ce moment." (parler)',
          options: [
            'dont, parle',
            'que, parle',
            'qui, parlent',
            'où, parle'
          ],
          correctIndex: 0,
          explanation: 'Parler DE → dont. "The film everyone is talking about" = le film dont tout le monde parle.'
        },
        {
          id: 'a2-ch4-l6-q11',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'Yesterday it was snowing when we left, so we took a taxi.',
          correctAnswer: 'Hier il neigeait quand nous sommes partis, alors nous avons pris un taxi.',
          acceptableAnswers: ['Hier il neigeait quand on est parti, alors on a pris un taxi.'],
          explanation: 'Weather (ongoing) = imparfait (neigeait). Specific actions = passé composé (sommes partis, avons pris).'
        },
        {
          id: 'a2-ch4-l6-q12',
          type: 'fill_blank',
          sentence: 'Quand tu ___ en France, tu ___ des choses ___ tu ___ toujours. (être, voir, dont, se souvenir)',
          correctAnswer: 'seras, verras, dont, te souviendras',
          acceptableAnswers: ['seras...verras...dont...te souviendras'],
          explanation: 'All future actions → futur simple: seras, verras, te souviendras. Se souvenir DE → dont.'
        }
      ]
    }
  ]
}
