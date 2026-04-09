import type { Chapter } from '../../types/lesson'

export const a2Ch5: Chapter = {
  id: 'a2-ch5',
  levelId: 'A2',
  title: 'Voyages',
  description:
    'Learn essential travel vocabulary and expressions for navigating airports, hotels, restaurants, and tourist situations in French-speaking countries.',
  lessons: [
    {
      id: 'a2-ch5-l1',
      levelId: 'A2',
      chapterId: 'a2-ch5',
      lessonNumber: 1,
      title: 'À l\'aéroport et à la gare',
      description: 'Master essential vocabulary for airports and train stations',
      warmup: [],
      comprehensibleInput: {
        title: 'Arriving at Charles de Gaulle Airport',
        frenchText:
          'Marie arrive à l\'aéroport Charles de Gaulle. Elle cherche le comptoir d\'enregistrement. "Excusez-moi, où est le comptoir Air France?" demande-t-elle. L\'employé répond: "C\'est au terminal 2E, porte F." Marie prend son billet et sa carte d\'embarquement. Elle passe le contrôle de sécurité. Maintenant, elle attend son vol à la porte d\'embarquement. L\'avion décolle dans trente minutes.',
        englishHint:
          'Marie navigates the airport, asking for directions to her check-in counter and going through security.',
        vocabularyHighlights: [
          { french: 'le comptoir d\'enregistrement', english: 'check-in counter' },
          { french: 'la carte d\'embarquement', english: 'boarding pass' },
          { french: 'le contrôle de sécurité', english: 'security checkpoint' },
          { french: 'la porte d\'embarquement', english: 'departure gate' },
          { french: 'décolle', english: 'takes off' }
        ]
      },
      drillQuestions: [
        {
          id: 'a2-ch5-l1-q1',
          type: 'multiple_choice',
          prompt: 'Comment dit-on "boarding pass" en français?',
          options: [
            'la carte d\'identité',
            'la carte d\'embarquement',
            'le passeport',
            'le billet'
          ],
          correctIndex: 1,
          explanation:
            'La carte d\'embarquement (boarding pass) est le document qui permet de monter dans l\'avion.'
        },
        {
          id: 'a2-ch5-l1-q2',
          type: 'fill_blank',
          sentence: 'L\'avion _____ à 15h30.',
          correctAnswer: 'décolle',
          acceptableAnswers: ['décolle', 'décollera'],
          explanation: 'Le verbe "décoller" signifie "to take off" pour un avion.'
        },
        {
          id: 'a2-ch5-l1-q3',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'Where is the check-in counter?',
          correctAnswer: 'Où est le comptoir d\'enregistrement?',
          acceptableAnswers: [
            'Où est le comptoir d\'enregistrement?',
            'Où est le comptoir d\'enregistrement',
            'Où se trouve le comptoir d\'enregistrement?'
          ],
          explanation:
            'Cette question essentielle vous aide à trouver où enregistrer vos bagages.'
        },
        {
          id: 'a2-ch5-l1-q4',
          type: 'error_correction',
          incorrectSentence: 'Je cherche la porte d\'embarquement 23.',
          options: [
            'Je cherche le porte d\'embarquement 23.',
            'Je cherche la porte d\'embarquement 23.',
            'Je cherches la porte d\'embarquement 23.',
            'Je cherche une porte d\'embarquement 23.'
          ],
          correctIndex: 1,
          explanation:
            'La phrase est déjà correcte. "La porte d\'embarquement" est féminin et "je cherche" est bien conjugué.'
        },
        {
          id: 'a2-ch5-l1-q5',
          type: 'multiple_choice',
          prompt: 'Quel document devez-vous montrer au contrôle de sécurité?',
          options: [
            'Votre permis de conduire',
            'Votre carte d\'embarquement et passeport',
            'Votre carte bancaire',
            'Votre billet de train'
          ],
          correctIndex: 1,
          explanation:
            'Au contrôle de sécurité, vous devez présenter votre carte d\'embarquement et votre passeport.'
        },
        {
          id: 'a2-ch5-l1-q6',
          type: 'fill_blank',
          sentence: 'Mon vol est retardé. L\'avion _____ avec deux heures de retard.',
          correctAnswer: 'décolle',
          acceptableAnswers: ['décolle', 'décollera', 'va décoller'],
          explanation:
            'Quand un vol est retardé, l\'avion décolle plus tard que prévu.'
        },
        {
          id: 'a2-ch5-l1-q7',
          type: 'translation',
          direction: 'fr_to_en',
          sourceText: 'Je dois enregistrer mes bagages.',
          correctAnswer: 'I need to check in my luggage.',
          acceptableAnswers: [
            'I need to check in my luggage.',
            'I have to check in my luggage.',
            'I must check in my luggage.',
            'I need to check in my bags.'
          ],
          explanation:
            '"Enregistrer mes bagages" means to check in your luggage at the counter.'
        },
        {
          id: 'a2-ch5-l1-q8',
          type: 'multiple_choice',
          prompt: 'À la gare, où achetez-vous votre billet?',
          options: [
            'Au guichet ou à la billetterie automatique',
            'Au restaurant',
            'Sur le quai',
            'Dans le train'
          ],
          correctIndex: 0,
          explanation:
            'On achète les billets de train au guichet (ticket window) ou à la billetterie automatique (ticket machine).'
        },
        {
          id: 'a2-ch5-l1-q9',
          type: 'error_correction',
          incorrectSentence: 'Le train part du quai numéro cinq.',
          options: [
            'Le train pars du quai numéro cinq.',
            'Le train part du quai numéro cinq.',
            'La train part du quai numéro cinq.',
            'Le train part de quai numéro cinq.'
          ],
          correctIndex: 1,
          explanation:
            'Cette phrase est correcte. "Le train" (masculin) "part" (3ème personne) "du quai" (de + le).'
        },
        {
          id: 'a2-ch5-l1-q10',
          type: 'fill_blank',
          sentence: 'Le TGV _____ dans dix minutes. Dépêchez-vous!',
          correctAnswer: 'part',
          acceptableAnswers: ['part', 'va partir'],
          explanation:
            'Le verbe "partir" signifie "to leave/depart". Le TGV part = The TGV is leaving.'
        },
        {
          id: 'a2-ch5-l1-q11',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'What time does the train arrive?',
          correctAnswer: 'À quelle heure arrive le train?',
          acceptableAnswers: [
            'À quelle heure arrive le train?',
            'À quelle heure arrive le train',
            'À quelle heure est-ce que le train arrive?',
            'Le train arrive à quelle heure?'
          ],
          explanation:
            'Cette question vous permet de savoir l\'heure d\'arrivée du train.'
        },
        {
          id: 'a2-ch5-l1-q12',
          type: 'multiple_choice',
          prompt: 'Que signifie "un aller-retour"?',
          options: [
            'Un billet pour aller seulement',
            'Un billet pour aller et revenir',
            'Un billet de groupe',
            'Un billet gratuit'
          ],
          correctIndex: 1,
          explanation:
            'Un aller-retour est un billet pour aller et revenir (round-trip ticket).'
        },
        {
          id: 'a2-ch5-l1-q13',
          type: 'fill_blank',
          sentence: 'J\'ai réservé une place en _____ classe.',
          correctAnswer: 'première',
          acceptableAnswers: ['première', 'deuxième', 'seconde'],
          explanation:
            'On peut voyager en première classe (first class) ou en deuxième/seconde classe (second class).'
        },
        {
          id: 'a2-ch5-l1-q14',
          type: 'translation',
          direction: 'fr_to_en',
          sourceText: 'Mon vol a été annulé.',
          correctAnswer: 'My flight has been cancelled.',
          acceptableAnswers: [
            'My flight has been cancelled.',
            'My flight has been canceled.',
            'My flight was cancelled.',
            'My flight was canceled.'
          ],
          explanation:
            '"Annulé" means cancelled. This is an important phrase if your travel plans change.'
        }
      ]
    },
    {
      id: 'a2-ch5-l2',
      levelId: 'A2',
      chapterId: 'a2-ch5',
      lessonNumber: 2,
      title: 'Hôtels et hébergement',
      description: 'Learn how to book hotels and communicate about accommodation',
      warmup: [
        {
          id: 'a2-ch5-l2-w1',
          question: {
            id: 'a2-ch5-l2-w1-q',
            type: 'multiple_choice',
            prompt: 'Comment dit-on "luggage" en français?',
            options: ['les valises', 'les bagages', 'les sacs', 'les colis'],
            correctIndex: 1,
            explanation: 'Les bagages = luggage (collectif). Les valises = suitcases.'
          }
        },
        {
          id: 'a2-ch5-l2-w2',
          question: {
            id: 'a2-ch5-l2-w2-q',
            type: 'fill_blank',
            sentence: 'L\'avion _____ de Paris à 14h.',
            correctAnswer: 'part',
            acceptableAnswers: ['part', 'décolle'],
            explanation: 'Review: partir = to leave, décoller = to take off.'
          }
        },
        {
          id: 'a2-ch5-l2-w3',
          question: {
            id: 'a2-ch5-l2-w3-q',
            type: 'translation',
            direction: 'en_to_fr',
            sourceText: 'I am looking for gate 12.',
            correctAnswer: 'Je cherche la porte 12.',
            acceptableAnswers: [
              'Je cherche la porte 12.',
              'Je cherche la porte douze.',
              'Je cherche la porte d\'embarquement 12.'
            ],
            explanation: 'Review from lesson 1: asking for directions at the airport.'
          }
        }
      ],
      comprehensibleInput: {
        title: 'Checking into a Hotel',
        frenchText:
          'Thomas arrive à l\'hôtel le Jardin. Il s\'approche de la réception. "Bonjour, j\'ai une réservation au nom de Thomas Martin," dit-il. La réceptionniste vérifie sur l\'ordinateur. "Oui, une chambre double pour trois nuits. Voici votre clé. Vous êtes au troisième étage, chambre 305. Le petit-déjeuner est servi de 7h à 10h au restaurant. Le WiFi est gratuit, le code est sur la clé." Thomas demande: "Y a-t-il un parking?" Elle répond: "Oui, le parking est derrière l\'hôtel. C\'est 15 euros par jour."',
        englishHint:
          'Thomas checks into his hotel, receives his room key, and learns about breakfast and parking.',
        vocabularyHighlights: [
          { french: 'la réception', english: 'reception desk' },
          { french: 'une réservation', english: 'a reservation' },
          { french: 'une chambre double', english: 'a double room' },
          { french: 'le petit-déjeuner', english: 'breakfast' },
          { french: 'le WiFi gratuit', english: 'free WiFi' }
        ]
      },
      drillQuestions: [
        {
          id: 'a2-ch5-l2-q1',
          type: 'multiple_choice',
          prompt: 'Quelle est la différence entre "une chambre simple" et "une chambre double"?',
          options: [
            'Le prix seulement',
            'Une chambre simple a un lit, une double a deux lits ou un grand lit',
            'La taille de la salle de bain',
            'Il n\'y a pas de différence'
          ],
          correctIndex: 1,
          explanation:
            'Une chambre simple (single room) a un lit pour une personne. Une chambre double a un grand lit ou deux lits.'
        },
        {
          id: 'a2-ch5-l2-q2',
          type: 'fill_blank',
          sentence: 'Bonjour, j\'ai une _____ au nom de Dupont.',
          correctAnswer: 'réservation',
          acceptableAnswers: ['réservation', 'reservation'],
          explanation:
            'Quand vous arrivez à l\'hôtel, vous dites que vous avez une réservation (a reservation).'
        },
        {
          id: 'a2-ch5-l2-q3',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'What time is breakfast served?',
          correctAnswer: 'À quelle heure est servi le petit-déjeuner?',
          acceptableAnswers: [
            'À quelle heure est servi le petit-déjeuner?',
            'À quelle heure est servi le petit-déjeuner',
            'À quelle heure est le petit-déjeuner?',
            'Le petit-déjeuner est à quelle heure?'
          ],
          explanation:
            'Question importante pour savoir quand prendre le petit-déjeuner à l\'hôtel.'
        },
        {
          id: 'a2-ch5-l2-q4',
          type: 'error_correction',
          incorrectSentence: 'Est-ce que le WiFi est gratuite?',
          options: [
            'Est-ce que le WiFi est gratuite?',
            'Est-ce que le WiFi est gratuit?',
            'Est-ce que la WiFi est gratuite?',
            'Est-ce que WiFi est gratuit?'
          ],
          correctIndex: 1,
          explanation:
            '"Le WiFi" est masculin, donc on dit "gratuit" (pas "gratuite"). Gratuit = free.'
        },
        {
          id: 'a2-ch5-l2-q5',
          type: 'multiple_choice',
          prompt: 'Où laissez-vous vos bagages si vous arrivez avant l\'heure d\'enregistrement?',
          options: [
            'Dans la rue',
            'À la bagagerie ou consigne',
            'Dans le restaurant',
            'Dans une autre chambre'
          ],
          correctIndex: 1,
          explanation:
            'La bagagerie ou consigne (luggage storage) garde vos bagages si vous arrivez trop tôt.'
        },
        {
          id: 'a2-ch5-l2-q6',
          type: 'fill_blank',
          sentence: 'Je voudrais une chambre avec _____ sur la mer.',
          correctAnswer: 'vue',
          acceptableAnswers: ['vue'],
          explanation:
            'Une vue sur la mer = a sea view. C\'est un équipement recherché dans les hôtels.'
        },
        {
          id: 'a2-ch5-l2-q7',
          type: 'translation',
          direction: 'fr_to_en',
          sourceText: 'La climatisation ne fonctionne pas.',
          correctAnswer: 'The air conditioning doesn\'t work.',
          acceptableAnswers: [
            'The air conditioning doesn\'t work.',
            'The air conditioning is not working.',
            'The air conditioning does not work.',
            'The AC doesn\'t work.'
          ],
          explanation:
            'Phrase utile si vous avez un problème avec la climatisation dans votre chambre.'
        },
        {
          id: 'a2-ch5-l2-q8',
          type: 'multiple_choice',
          prompt: 'Que signifie "une auberge de jeunesse"?',
          options: [
            'Un hôtel de luxe',
            'Un hôtel pour personnes âgées',
            'Un hébergement économique pour voyageurs',
            'Un restaurant pour jeunes'
          ],
          correctIndex: 2,
          explanation:
            'Une auberge de jeunesse (youth hostel) est un hébergement économique, souvent avec des dortoirs.'
        },
        {
          id: 'a2-ch5-l2-q9',
          type: 'fill_blank',
          sentence: 'À quelle heure dois-je _____ la chambre?',
          correctAnswer: 'libérer',
          acceptableAnswers: ['libérer', 'quitter', 'laisser'],
          explanation:
            'Libérer la chambre = to check out. On demande l\'heure limite de départ (check-out time).'
        },
        {
          id: 'a2-ch5-l2-q10',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'Is breakfast included in the price?',
          correctAnswer: 'Le petit-déjeuner est-il inclus dans le prix?',
          acceptableAnswers: [
            'Le petit-déjeuner est-il inclus dans le prix?',
            'Le petit-déjeuner est-il inclus dans le prix',
            'Est-ce que le petit-déjeuner est inclus dans le prix?',
            'Le petit-déjeuner est inclus dans le prix?'
          ],
          explanation:
            'Question importante pour savoir si le petit-déjeuner est compris dans le tarif.'
        },
        {
          id: 'a2-ch5-l2-q11',
          type: 'error_correction',
          incorrectSentence: 'J\'ai oublié ma clé dans ma chambre.',
          options: [
            'J\'ai oublié mon clé dans ma chambre.',
            'J\'ai oublié ma clé dans ma chambre.',
            'J\'ai oublier ma clé dans ma chambre.',
            'J\'oublié ma clé dans ma chambre.'
          ],
          correctIndex: 1,
          explanation:
            'Cette phrase est correcte. "La clé" est féminin, donc "ma clé". "J\'ai oublié" est le passé composé correct.'
        },
        {
          id: 'a2-ch5-l2-q12',
          type: 'multiple_choice',
          prompt: 'Comment demandez-vous des serviettes supplémentaires?',
          options: [
            'Je voudrais des serviettes supplémentaires, s\'il vous plaît.',
            'Donnez-moi des serviettes!',
            'Où sont les serviettes?',
            'J\'achète des serviettes.'
          ],
          correctIndex: 0,
          explanation:
            'La manière polie: "Je voudrais des serviettes supplémentaires, s\'il vous plaît."'
        },
        {
          id: 'a2-ch5-l2-q13',
          type: 'fill_blank',
          sentence: 'Y a-t-il un _____ dans la chambre pour garder mes objets de valeur?',
          correctAnswer: 'coffre-fort',
          acceptableAnswers: ['coffre-fort', 'coffre'],
          explanation:
            'Un coffre-fort (safe) permet de sécuriser vos objets de valeur dans la chambre.'
        },
        {
          id: 'a2-ch5-l2-q14',
          type: 'translation',
          direction: 'fr_to_en',
          sourceText: 'Pourriez-vous me réveiller à 7 heures demain matin?',
          correctAnswer: 'Could you wake me up at 7 o\'clock tomorrow morning?',
          acceptableAnswers: [
            'Could you wake me up at 7 o\'clock tomorrow morning?',
            'Could you wake me at 7 tomorrow morning?',
            'Could you wake me up at 7am tomorrow?',
            'Can you wake me up at 7 o\'clock tomorrow morning?'
          ],
          explanation:
            'Demander un réveil téléphonique (wake-up call) est un service courant dans les hôtels.'
        }
      ]
    },
    {
      id: 'a2-ch5-l3',
      levelId: 'A2',
      chapterId: 'a2-ch5',
      lessonNumber: 3,
      title: 'Demander son chemin',
      description: 'Master asking for and understanding directions in French',
      warmup: [
        {
          id: 'a2-ch5-l3-w1',
          question: {
            id: 'a2-ch5-l3-w1-q',
            type: 'fill_blank',
            sentence: 'J\'ai une _____ pour deux nuits.',
            correctAnswer: 'réservation',
            acceptableAnswers: ['réservation', 'reservation'],
            explanation: 'Review: une réservation = a reservation.'
          }
        },
        {
          id: 'a2-ch5-l3-w2',
          question: {
            id: 'a2-ch5-l3-w2-q',
            type: 'multiple_choice',
            prompt: 'Comment dit-on "The WiFi is free" en français?',
            options: [
              'Le WiFi est cher',
              'Le WiFi est gratuit',
              'Le WiFi est rapide',
              'Le WiFi est lent'
            ],
            correctIndex: 1,
            explanation: 'Review: gratuit(e) = free (no cost).'
          }
        }
      ],
      comprehensibleInput: {
        title: 'Lost in Paris',
        frenchText:
          'Sophie est perdue dans le Marais. Elle arrête un passant: "Excusez-moi, je cherche la Place des Vosges. Pouvez-vous m\'aider?" Le passant sourit et dit: "Bien sûr! C\'est très facile. Vous allez tout droit dans cette rue pendant deux minutes. Ensuite, vous tournez à gauche au feu rouge. Vous continuez tout droit, et vous verrez la place sur votre droite. C\'est à environ cinq minutes à pied." Sophie le remercie: "Merci beaucoup! Bonne journée!"',
        englishHint:
          'Sophie is lost and asks a passerby for directions to Place des Vosges. He gives clear walking directions.',
        vocabularyHighlights: [
          { french: 'je suis perdu(e)', english: 'I am lost' },
          { french: 'tout droit', english: 'straight ahead' },
          { french: 'tourner à gauche/droite', english: 'turn left/right' },
          { french: 'le feu rouge', english: 'traffic light' },
          { french: 'à pied', english: 'on foot' }
        ]
      },
      drillQuestions: [
        {
          id: 'a2-ch5-l3-q1',
          type: 'multiple_choice',
          prompt: 'Comment commencez-vous poliment quand vous demandez votre chemin?',
          options: [
            'Hé! Où est...?',
            'Excusez-moi, je cherche...',
            'Dites-moi où est...',
            'Vous! Je cherche...'
          ],
          correctIndex: 1,
          explanation:
            'La manière polie de commencer: "Excusez-moi, je cherche..." ou "Pardon, où est...?"'
        },
        {
          id: 'a2-ch5-l3-q2',
          type: 'fill_blank',
          sentence: 'Allez _____ pendant 200 mètres, puis tournez à droite.',
          correctAnswer: 'tout droit',
          acceptableAnswers: ['tout droit'],
          explanation: '"Tout droit" signifie "straight ahead" - direction très fréquente.'
        },
        {
          id: 'a2-ch5-l3-q3',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'Turn left at the traffic light.',
          correctAnswer: 'Tournez à gauche au feu rouge.',
          acceptableAnswers: [
            'Tournez à gauche au feu rouge.',
            'Tournez à gauche au feu.',
            'Tourne à gauche au feu rouge.',
            'Tourner à gauche au feu rouge.'
          ],
          explanation:
            'Instruction de direction basique: tourner à gauche (turn left) au feu (traffic light).'
        },
        {
          id: 'a2-ch5-l3-q4',
          type: 'error_correction',
          incorrectSentence: 'C\'est à droite ou à la gauche?',
          options: [
            'C\'est à droite ou à la gauche?',
            'C\'est à droite ou à gauche?',
            'C\'est à la droite ou à gauche?',
            'C\'est droite ou gauche?'
          ],
          correctIndex: 1,
          explanation:
            'On dit "à gauche" et "à droite" (sans article). Not "à la gauche" or "à la droite".'
        },
        {
          id: 'a2-ch5-l3-q5',
          type: 'multiple_choice',
          prompt: 'Que signifie "traverser la rue"?',
          options: [
            'Marcher le long de la rue',
            'Passer de l\'autre côté de la rue',
            'Chercher une rue',
            'Tourner dans la rue'
          ],
          correctIndex: 1,
          explanation: 'Traverser = to cross. Traverser la rue = to cross the street.'
        },
        {
          id: 'a2-ch5-l3-q6',
          type: 'fill_blank',
          sentence: 'Le musée est _____ de la gare, à 300 mètres.',
          correctAnswer: 'en face',
          acceptableAnswers: ['en face', 'près', 'à côté'],
          explanation:
            'En face de = across from, près de = near, à côté de = next to. Toutes sont des prépositions de lieu.'
        },
        {
          id: 'a2-ch5-l3-q7',
          type: 'translation',
          direction: 'fr_to_en',
          sourceText: 'Prenez la deuxième rue à droite.',
          correctAnswer: 'Take the second street on the right.',
          acceptableAnswers: [
            'Take the second street on the right.',
            'Take the second road on the right.',
            'Take the 2nd street on the right.'
          ],
          explanation:
            'Instruction précise: prendre (to take) la deuxième rue (second street) à droite (on the right).'
        },
        {
          id: 'a2-ch5-l3-q8',
          type: 'multiple_choice',
          prompt: 'Si quelqu\'un dit "C\'est à dix minutes à pied", que signifie cela?',
          options: [
            'C\'est à 10 minutes en voiture',
            'C\'est à 10 minutes en marchant',
            'C\'est fermé pendant 10 minutes',
            'C\'est ouvert 10 minutes'
          ],
          correctIndex: 1,
          explanation:
            '"À pied" signifie "on foot/walking". Donc 10 minutes à pied = 10 minutes walking.'
        },
        {
          id: 'a2-ch5-l3-q9',
          type: 'fill_blank',
          sentence: 'Vous _____ tout droit jusqu\'au rond-point.',
          correctAnswer: 'continuez',
          acceptableAnswers: ['continuez', 'allez'],
          explanation:
            'Continuer (to continue) ou aller (to go) sont des verbes courants pour donner des directions.'
        },
        {
          id: 'a2-ch5-l3-q10',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'Is it far from here?',
          correctAnswer: 'C\'est loin d\'ici?',
          acceptableAnswers: [
            'C\'est loin d\'ici?',
            'C\'est loin d\'ici',
            'Est-ce que c\'est loin d\'ici?',
            'Est-ce loin d\'ici?'
          ],
          explanation:
            'Question pratique: loin = far, d\'ici = from here. Permet de savoir la distance.'
        },
        {
          id: 'a2-ch5-l3-q11',
          type: 'error_correction',
          incorrectSentence: 'Le café est à côté du la boulangerie.',
          options: [
            'Le café est à côté du la boulangerie.',
            'Le café est à côté de la boulangerie.',
            'Le café est à côté des la boulangerie.',
            'Le café est à côté la boulangerie.'
          ],
          correctIndex: 1,
          explanation:
            '"À côté de" + "la boulangerie" = "à côté de la boulangerie" (pas "du la").'
        },
        {
          id: 'a2-ch5-l3-q12',
          type: 'multiple_choice',
          prompt: 'Quel mot signifie "corner" en français?',
          options: ['le coin', 'le bord', 'le centre', 'le milieu'],
          correctIndex: 0,
          explanation:
            'Le coin = the corner. "Au coin de la rue" = at the corner of the street.'
        },
        {
          id: 'a2-ch5-l3-q13',
          type: 'fill_blank',
          sentence: 'Désolé, je ne suis pas d\'ici. Je suis _____ aussi.',
          correctAnswer: 'perdu',
          acceptableAnswers: ['perdu', 'perdue', 'touriste'],
          explanation:
            'Être perdu(e) = to be lost. Réponse courante si vous ne connaissez pas le chemin.'
        },
        {
          id: 'a2-ch5-l3-q14',
          type: 'translation',
          direction: 'fr_to_en',
          sourceText: 'Vous ne pouvez pas le rater.',
          correctAnswer: 'You can\'t miss it.',
          acceptableAnswers: [
            'You can\'t miss it.',
            'You cannot miss it.',
            'You won\'t miss it.'
          ],
          explanation:
            'Expression courante après donner des directions: "You can\'t miss it" = c\'est facile à trouver.'
        }
      ]
    },
    {
      id: 'a2-ch5-l4',
      levelId: 'A2',
      chapterId: 'a2-ch5',
      lessonNumber: 4,
      title: 'Au restaurant et commander',
      description: 'Learn to order food and navigate restaurant situations',
      warmup: [
        {
          id: 'a2-ch5-l4-w1',
          question: {
            id: 'a2-ch5-l4-w1-q',
            type: 'translation',
            direction: 'en_to_fr',
            sourceText: 'Turn right at the corner.',
            correctAnswer: 'Tournez à droite au coin.',
            acceptableAnswers: [
              'Tournez à droite au coin.',
              'Tourne à droite au coin.',
              'Tournez à droite au coin de la rue.'
            ],
            explanation: 'Review: directions vocabulary - tourner à droite, le coin.'
          }
        },
        {
          id: 'a2-ch5-l4-w2',
          question: {
            id: 'a2-ch5-l4-w2-q',
            type: 'fill_blank',
            sentence: 'C\'est _____ ou c\'est près?',
            correctAnswer: 'loin',
            acceptableAnswers: ['loin'],
            explanation: 'Review: loin (far) ≠ près (near).'
          }
        },
        {
          id: 'a2-ch5-l4-w3',
          question: {
            id: 'a2-ch5-l4-w3-q',
            type: 'multiple_choice',
            prompt: 'Que veut dire "tout droit"?',
            options: ['Tout de suite', 'Straight ahead', 'À droite', 'À gauche'],
            correctIndex: 1,
            explanation: 'Review: tout droit = straight ahead.'
          }
        }
      ],
      comprehensibleInput: {
        title: 'Dinner at a French Bistro',
        frenchText:
          'Marc entre dans un bistro parisien. Le serveur l\'accueille: "Bonsoir monsieur, une table pour combien de personnes?" Marc répond: "Une table pour deux, s\'il vous plaît." Le serveur l\'installe près de la fenêtre. "Voici le menu et la carte des vins. Je reviens dans quelques minutes pour prendre votre commande." Marc regarde le menu. Quand le serveur revient, Marc commande: "Je voudrais le steak-frites, s\'il vous plaît. Comme boisson, une carafe d\'eau." Le serveur note: "Très bien. Et la cuisson du steak?" "À point, merci."',
        englishHint:
          'Marc arrives at a bistro, gets seated, reviews the menu, and orders steak-frites with specific cooking preferences.',
        vocabularyHighlights: [
          { french: 'le menu / la carte', english: 'the menu' },
          { french: 'prendre la commande', english: 'to take the order' },
          { french: 'je voudrais', english: 'I would like' },
          { french: 'la cuisson', english: 'cooking/doneness' },
          { french: 'à point', english: 'medium (for steak)' }
        ]
      },
      drillQuestions: [
        {
          id: 'a2-ch5-l4-q1',
          type: 'multiple_choice',
          prompt: 'Comment demandez-vous poliment le menu?',
          options: [
            'Donnez-moi le menu!',
            'Le menu, vite!',
            'Pourriez-vous m\'apporter le menu, s\'il vous plaît?',
            'Où est le menu?'
          ],
          correctIndex: 2,
          explanation:
            'Formule polie: "Pourriez-vous m\'apporter le menu?" ou "Je voudrais voir le menu, s\'il vous plaît."'
        },
        {
          id: 'a2-ch5-l4-q2',
          type: 'fill_blank',
          sentence: 'Pour commander: "Je _____ le poulet rôti, s\'il vous plaît."',
          correctAnswer: 'voudrais',
          acceptableAnswers: ['voudrais', 'prends', 'vais prendre'],
          explanation:
            '"Je voudrais" (I would like) est la forme polie pour commander. On peut aussi dire "Je prends".'
        },
        {
          id: 'a2-ch5-l4-q3',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'What do you recommend?',
          correctAnswer: 'Qu\'est-ce que vous recommandez?',
          acceptableAnswers: [
            'Qu\'est-ce que vous recommandez?',
            'Qu\'est-ce que vous recommandez',
            'Que recommandez-vous?',
            'Quelle est votre recommandation?'
          ],
          explanation:
            'Question utile pour demander conseil au serveur sur les spécialités du restaurant.'
        },
        {
          id: 'a2-ch5-l4-q4',
          type: 'error_correction',
          incorrectSentence: 'Je voudrais une carafe d\'eau, s\'il te plaît.',
          options: [
            'Je voudrais une carafe d\'eau, s\'il te plaît.',
            'Je voudrais une carafe d\'eau, s\'il vous plaît.',
            'Je voudrais un carafe d\'eau, s\'il vous plaît.',
            'Je voudrai une carafe d\'eau, s\'il vous plaît.'
          ],
          correctIndex: 1,
          explanation:
            'Au restaurant, on utilise "vous" (formel) avec le serveur, pas "tu". Donc "s\'il vous plaît".'
        },
        {
          id: 'a2-ch5-l4-q5',
          type: 'multiple_choice',
          prompt: 'Comment demandez-vous la cuisson de votre steak si vous le voulez bien cuit?',
          options: [
            'Saignant',
            'À point',
            'Bien cuit',
            'Bleu'
          ],
          correctIndex: 2,
          explanation:
            'Bleu = very rare, Saignant = rare, À point = medium, Bien cuit = well done.'
        },
        {
          id: 'a2-ch5-l4-q6',
          type: 'fill_blank',
          sentence: 'Comme _____, je vais prendre un verre de vin rouge.',
          correctAnswer: 'boisson',
          acceptableAnswers: ['boisson', 'apéritif'],
          explanation:
            '"Comme boisson" = as a drink. Le serveur demande souvent: "Et comme boisson?"'
        },
        {
          id: 'a2-ch5-l4-q7',
          type: 'translation',
          direction: 'fr_to_en',
          sourceText: 'L\'addition, s\'il vous plaît.',
          correctAnswer: 'The bill, please.',
          acceptableAnswers: [
            'The bill, please.',
            'The check, please.',
            'The bill please.',
            'The check please.'
          ],
          explanation:
            'Pour demander à payer: "L\'addition, s\'il vous plaît" (The bill/check, please).'
        },
        {
          id: 'a2-ch5-l4-q8',
          type: 'multiple_choice',
          prompt: 'Que signifie "le plat du jour"?',
          options: [
            'Le dessert spécial',
            'Le plat principal du menu',
            'La spécialité quotidienne du chef',
            'Le menu pour enfants'
          ],
          correctIndex: 2,
          explanation:
            'Le plat du jour = dish of the day, la spécialité que le chef propose chaque jour.'
        },
        {
          id: 'a2-ch5-l4-q9',
          type: 'fill_blank',
          sentence: 'Avez-vous des plats _____ sans gluten?',
          correctAnswer: 'végétariens',
          acceptableAnswers: ['végétariens', 'végétaliens', 'véganes', 'végans'],
          explanation:
            'Questions courantes: végétarien (vegetarian), végétalien/végan (vegan), sans gluten (gluten-free).'
        },
        {
          id: 'a2-ch5-l4-q10',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'Can I have the wine list?',
          correctAnswer: 'Puis-je avoir la carte des vins?',
          acceptableAnswers: [
            'Puis-je avoir la carte des vins?',
            'Puis-je avoir la carte des vins',
            'Pourriez-vous m\'apporter la carte des vins?',
            'Je voudrais voir la carte des vins.'
          ],
          explanation:
            'La carte des vins = the wine list. Important dans les restaurants français!'
        },
        {
          id: 'a2-ch5-l4-q11',
          type: 'error_correction',
          incorrectSentence: 'Je suis allergique aux les fruits de mer.',
          options: [
            'Je suis allergique aux les fruits de mer.',
            'Je suis allergique aux fruits de mer.',
            'Je suis allergique des fruits de mer.',
            'Je suis allergique à les fruits de mer.'
          ],
          correctIndex: 1,
          explanation:
            '"Allergique à" + "les fruits de mer" = "allergique aux fruits de mer" (à + les = aux).'
        },
        {
          id: 'a2-ch5-l4-q12',
          type: 'multiple_choice',
          prompt: 'Dans un menu français typique, quel est l\'ordre des plats?',
          options: [
            'Dessert, plat, entrée',
            'Entrée, plat, dessert',
            'Plat, entrée, dessert',
            'Dessert, entrée, plat'
          ],
          correctIndex: 1,
          explanation:
            'Ordre classique: entrée (appetizer/starter), plat (main course), dessert.'
        },
        {
          id: 'a2-ch5-l4-q13',
          type: 'fill_blank',
          sentence: 'Puis-je avoir un peu plus de _____, s\'il vous plaît?',
          correctAnswer: 'pain',
          acceptableAnswers: ['pain', 'vin', 'eau', 'sauce'],
          explanation:
            'Pour demander plus de quelque chose: "un peu plus de..." (pain, vin, eau, sauce, etc.).'
        },
        {
          id: 'a2-ch5-l4-q14',
          type: 'translation',
          direction: 'fr_to_en',
          sourceText: 'Est-ce que le service est compris?',
          correctAnswer: 'Is service included?',
          acceptableAnswers: [
            'Is service included?',
            'Is the service included?',
            'Is tip included?',
            'Is gratuity included?'
          ],
          explanation:
            'Question importante: savoir si le service/pourboire est déjà inclus dans l\'addition.'
        }
      ]
    },
    {
      id: 'a2-ch5-l5',
      levelId: 'A2',
      chapterId: 'a2-ch5',
      lessonNumber: 5,
      title: 'Shopping et souvenirs',
      description: 'Learn shopping vocabulary and how to make purchases',
      warmup: [
        {
          id: 'a2-ch5-l5-w1',
          question: {
            id: 'a2-ch5-l5-w1-q',
            type: 'fill_blank',
            sentence: 'Je _____ le menu, s\'il vous plaît.',
            correctAnswer: 'voudrais',
            acceptableAnswers: ['voudrais', 'veux'],
            explanation: 'Review: Je voudrais = I would like (polite form).'
          }
        },
        {
          id: 'a2-ch5-l5-w2',
          question: {
            id: 'a2-ch5-l5-w2-q',
            type: 'translation',
            direction: 'fr_to_en',
            sourceText: 'L\'addition, s\'il vous plaît.',
            correctAnswer: 'The bill, please.',
            acceptableAnswers: [
              'The bill, please.',
              'The check, please.',
              'The bill please.',
              'The check please.'
            ],
            explanation: 'Review: asking for the bill at a restaurant.'
          }
        },
        {
          id: 'a2-ch5-l5-w3',
          question: {
            id: 'a2-ch5-l5-w3-q',
            type: 'multiple_choice',
            prompt: 'Comment dit-on "well done" pour un steak?',
            options: ['Bleu', 'Saignant', 'À point', 'Bien cuit'],
            correctIndex: 3,
            explanation: 'Review: Bien cuit = well done for steak.'
          }
        }
      ],
      comprehensibleInput: {
        title: 'Souvenir Shopping in Montmartre',
        frenchText:
          'Claire visite une boutique de souvenirs à Montmartre. Elle regarde des cartes postales et des affiches. "Bonjour, puis-je vous aider?" demande la vendeuse. Claire répond: "Oui, je cherche un cadeau pour ma mère. Combien coûte cette écharpe en soie?" La vendeuse dit: "Elle coûte 45 euros." Claire réfléchit: "C\'est un peu cher. Avez-vous quelque chose de moins cher?" "Oui, nous avons ces foulards à 25 euros." Claire sourit: "Parfait! Je prends le foulard bleu. Acceptez-vous les cartes de crédit?" "Oui, bien sûr!"',
        englishHint:
          'Claire shops for souvenirs, asks about prices, negotiates for something cheaper, and pays by credit card.',
        vocabularyHighlights: [
          { french: 'combien coûte', english: 'how much does it cost' },
          { french: 'un cadeau', english: 'a gift' },
          { french: 'moins cher', english: 'cheaper/less expensive' },
          { french: 'je prends', english: 'I\'ll take it' },
          { french: 'accepter', english: 'to accept' }
        ]
      },
      drillQuestions: [
        {
          id: 'a2-ch5-l5-q1',
          type: 'multiple_choice',
          prompt: 'Comment demandez-vous le prix d\'un article?',
          options: [
            'Quel est le prix?',
            'Combien ça coûte?',
            'C\'est combien?',
            'Toutes ces réponses sont correctes'
          ],
          correctIndex: 3,
          explanation:
            'On peut dire: "Combien ça coûte?", "C\'est combien?", "Quel est le prix?" - toutes sont correctes.'
        },
        {
          id: 'a2-ch5-l5-q2',
          type: 'fill_blank',
          sentence: 'Je cherche un _____ pour mon père.',
          correctAnswer: 'cadeau',
          acceptableAnswers: ['cadeau', 'souvenir'],
          explanation:
            'Un cadeau = a gift. Un souvenir = a souvenir. Les deux sont possibles selon le contexte.'
        },
        {
          id: 'a2-ch5-l5-q3',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'Do you have this in a smaller size?',
          correctAnswer: 'Avez-vous ceci dans une taille plus petite?',
          acceptableAnswers: [
            'Avez-vous ceci dans une taille plus petite?',
            'Avez-vous ceci dans une taille plus petite',
            'Avez-vous ça en plus petit?',
            'Est-ce que vous avez ça en plus petit?'
          ],
          explanation:
            'Question pratique pour les vêtements: taille plus petite (smaller size) ou plus grande (larger size).'
        },
        {
          id: 'a2-ch5-l5-q4',
          type: 'error_correction',
          incorrectSentence: 'Puis-je essayer cette robe?',
          options: [
            'Puis-je essayer cette robe?',
            'Puis-je essayer cet robe?',
            'Puis-je essayer ce robe?',
            'Puis-je essayer cette robes?'
          ],
          correctIndex: 0,
          explanation:
            'Cette phrase est correcte. "La robe" est féminin, donc "cette robe". Essayer = to try on.'
        },
        {
          id: 'a2-ch5-l5-q5',
          type: 'multiple_choice',
          prompt: 'Où pouvez-vous essayer des vêtements dans un magasin?',
          options: [
            'À la caisse',
            'Dans la cabine d\'essayage',
            'Au rayon',
            'À l\'entrée'
          ],
          correctIndex: 1,
          explanation:
            'La cabine d\'essayage = fitting room/changing room, où on essaie les vêtements.'
        },
        {
          id: 'a2-ch5-l5-q6',
          type: 'fill_blank',
          sentence: 'C\'est trop cher. Avez-vous quelque chose de moins _____?',
          correctAnswer: 'cher',
          acceptableAnswers: ['cher'],
          explanation:
            '"Moins cher" = cheaper/less expensive. Utile pour négocier ou trouver des alternatives.'
        },
        {
          id: 'a2-ch5-l5-q7',
          type: 'translation',
          direction: 'fr_to_en',
          sourceText: 'Je peux payer par carte bancaire?',
          correctAnswer: 'Can I pay by credit card?',
          acceptableAnswers: [
            'Can I pay by credit card?',
            'Can I pay by card?',
            'Can I pay with a credit card?',
            'May I pay by credit card?'
          ],
          explanation:
            'Carte bancaire/carte de crédit = credit card. Question importante pour savoir les modes de paiement.'
        },
        {
          id: 'a2-ch5-l5-q8',
          type: 'multiple_choice',
          prompt: 'Si vous n\'êtes pas satisfait d\'un achat, que demandez-vous?',
          options: [
            'Un rabais',
            'Un remboursement ou un échange',
            'Un cadeau',
            'Une réduction'
          ],
          correctIndex: 1,
          explanation:
            'Un remboursement = refund, un échange = exchange. Ce sont vos options si vous n\'êtes pas content.'
        },
        {
          id: 'a2-ch5-l5-q9',
          type: 'fill_blank',
          sentence: 'Avez-vous ce pull en _____? Je porte du M.',
          correctAnswer: 'taille',
          acceptableAnswers: ['taille'],
          explanation:
            'La taille = size. En taille M, L, XL, etc. ou en taille 38, 40, 42, etc.'
        },
        {
          id: 'a2-ch5-l5-q10',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'I\'m just looking, thank you.',
          correctAnswer: 'Je regarde seulement, merci.',
          acceptableAnswers: [
            'Je regarde seulement, merci.',
            'Je regarde seulement merci.',
            'Je ne fais que regarder, merci.',
            'Je regarde simplement, merci.'
          ],
          explanation:
            'Phrase utile quand un vendeur vous approche mais vous voulez juste regarder.'
        },
        {
          id: 'a2-ch5-l5-q11',
          type: 'error_correction',
          incorrectSentence: 'Je cherche une chemise pour homme.',
          options: [
            'Je cherche un chemise pour homme.',
            'Je cherche une chemise pour homme.',
            'Je cherches une chemise pour homme.',
            'Je cherche des chemise pour homme.'
          ],
          correctIndex: 1,
          explanation:
            'Cette phrase est correcte. "Une chemise" (féminin) pour homme (for men).'
        },
        {
          id: 'a2-ch5-l5-q12',
          type: 'multiple_choice',
          prompt: 'Comment dit-on "sales" (période de réductions) en français?',
          options: [
            'Les ventes',
            'Les soldes',
            'Les promotions',
            'Les rabais'
          ],
          correctIndex: 1,
          explanation:
            'Les soldes = sales period (winter and summer sales in France). Les promotions = promotions.'
        },
        {
          id: 'a2-ch5-l5-q13',
          type: 'fill_blank',
          sentence: 'Pouvez-vous me faire un _____? C\'est mon budget maximum.',
          correctAnswer: 'rabais',
          acceptableAnswers: ['rabais', 'prix', 'discount'],
          explanation:
            'Un rabais = discount. "Faire un rabais" = to give a discount. Utile pour négocier.'
        },
        {
          id: 'a2-ch5-l5-q14',
          type: 'translation',
          direction: 'fr_to_en',
          sourceText: 'Gardez la monnaie.',
          correctAnswer: 'Keep the change.',
          acceptableAnswers: [
            'Keep the change.',
            'Keep the change'
          ],
          explanation:
            'La monnaie = change (coins). "Gardez la monnaie" = keep the change (comme pourboire).'
        }
      ]
    },
    {
      id: 'a2-ch5-l6',
      levelId: 'A2',
      chapterId: 'a2-ch5',
      lessonNumber: 6,
      title: 'Raconter son voyage',
      description: 'Put it all together: describe travel experiences using past tenses',
      warmup: [
        {
          id: 'a2-ch5-l6-w1',
          question: {
            id: 'a2-ch5-l6-w1-q',
            type: 'translation',
            direction: 'en_to_fr',
            sourceText: 'How much does this cost?',
            correctAnswer: 'Combien ça coûte?',
            acceptableAnswers: [
              'Combien ça coûte?',
              'Combien ça coûte',
              'C\'est combien?',
              'Quel est le prix?'
            ],
            explanation: 'Review: asking about prices.'
          }
        },
        {
          id: 'a2-ch5-l6-w2',
          question: {
            id: 'a2-ch5-l6-w2-q',
            type: 'fill_blank',
            sentence: 'Je cherche un _____ pour ma sœur.',
            correctAnswer: 'cadeau',
            acceptableAnswers: ['cadeau', 'souvenir'],
            explanation: 'Review: un cadeau = a gift, un souvenir = a souvenir.'
          }
        },
        {
          id: 'a2-ch5-l6-w3',
          question: {
            id: 'a2-ch5-l6-w3-q',
            type: 'multiple_choice',
            prompt: 'Que signifie "les soldes"?',
            options: [
              'Les magasins',
              'Les périodes de réductions',
              'Les vendeurs',
              'Les cadeaux'
            ],
            correctIndex: 1,
            explanation: 'Review: les soldes = sales period (discounts).'
          }
        }
      ],
      comprehensibleInput: {
        title: 'Recounting a Trip to Lyon',
        frenchText:
          'La semaine dernière, je suis allé à Lyon avec ma famille. Nous avons pris le TGV depuis Paris. Le voyage a duré seulement deux heures. Nous sommes arrivés à midi et nous avons déjeuné dans un bouchon lyonnais traditionnel. L\'après-midi, nous avons visité le Vieux Lyon et nous nous sommes promenés dans les traboules. C\'était magnifique! Le soir, nous sommes montés à la basilique de Fourvière. La vue sur la ville était spectaculaire. Nous avons passé trois jours merveilleux. J\'ai adoré la gastronomie lyonnaise et l\'ambiance de la ville. Je recommande vivement Lyon comme destination!',
        englishHint:
          'A traveler recounts their trip to Lyon, describing transportation, meals, sightseeing, and overall impressions using past tense.',
        vocabularyHighlights: [
          { french: 'la semaine dernière', english: 'last week' },
          { french: 'je suis allé(e)', english: 'I went' },
          { french: 'nous avons visité', english: 'we visited' },
          { french: 'c\'était magnifique', english: 'it was magnificent' },
          { french: 'j\'ai adoré', english: 'I loved' }
        ]
      },
      drillQuestions: [
        {
          id: 'a2-ch5-l6-q1',
          type: 'multiple_choice',
          prompt: 'Quel temps utilisez-vous pour raconter un voyage passé?',
          options: [
            'Le présent',
            'Le futur',
            'Le passé composé et l\'imparfait',
            'Le conditionnel'
          ],
          correctIndex: 2,
          explanation:
            'Pour raconter un voyage, on utilise le passé composé (actions) et l\'imparfait (descriptions, habitudes).'
        },
        {
          id: 'a2-ch5-l6-q2',
          type: 'fill_blank',
          sentence: 'L\'été dernier, nous _____ en Provence.',
          correctAnswer: 'sommes allés',
          acceptableAnswers: ['sommes allés', 'sommes allées', 'avons voyagé'],
          explanation:
            '"Aller" utilise l\'auxiliaire "être" au passé composé: je suis allé(e), nous sommes allés/allées.'
        },
        {
          id: 'a2-ch5-l6-q3',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'We visited many museums.',
          correctAnswer: 'Nous avons visité beaucoup de musées.',
          acceptableAnswers: [
            'Nous avons visité beaucoup de musées.',
            'Nous avons visité beaucoup de musées',
            'Nous avons visité de nombreux musées.',
            'On a visité beaucoup de musées.'
          ],
          explanation:
            '"Visiter" prend l\'auxiliaire "avoir": nous avons visité (we visited).'
        },
        {
          id: 'a2-ch5-l6-q4',
          type: 'error_correction',
          incorrectSentence: 'Le voyage a été magnifique.',
          options: [
            'Le voyage a été magnifique.',
            'Le voyage était magnifique.',
            'Les deux sont correctes selon le contexte.',
            'Aucune n\'est correcte.'
          ],
          correctIndex: 2,
          explanation:
            'Les deux sont possibles! "A été" (passé composé) = was (event). "Était" (imparfait) = was (description).'
        },
        {
          id: 'a2-ch5-l6-q5',
          type: 'multiple_choice',
          prompt: 'Comment exprimez-vous que vous avez aimé votre séjour?',
          options: [
            'J\'ai détesté mon séjour.',
            'J\'ai adoré mon séjour.',
            'Je n\'ai pas aimé mon séjour.',
            'Mon séjour était horrible.'
          ],
          correctIndex: 1,
          explanation:
            'J\'ai adoré = I loved. Autres options positives: j\'ai beaucoup aimé, c\'était formidable/génial.'
        },
        {
          id: 'a2-ch5-l6-q6',
          type: 'fill_blank',
          sentence: 'Pendant notre séjour, nous _____ dans un hôtel cinq étoiles.',
          correctAnswer: 'sommes restés',
          acceptableAnswers: ['sommes restés', 'sommes restées', 'avons logé', 'avons séjourné'],
          explanation:
            'Rester (to stay) utilise "être": nous sommes restés. Loger/séjourner utilisent "avoir".'
        },
        {
          id: 'a2-ch5-l6-q7',
          type: 'translation',
          direction: 'fr_to_en',
          sourceText: 'La nourriture était délicieuse.',
          correctAnswer: 'The food was delicious.',
          acceptableAnswers: [
            'The food was delicious.',
            'The food was delicious'
          ],
          explanation:
            'Imparfait pour une description: "était" (was). Délicieux/délicieuse = delicious.'
        },
        {
          id: 'a2-ch5-l6-q8',
          type: 'multiple_choice',
          prompt: 'Quelle expression signifie "I highly recommend"?',
          options: [
            'Je déteste',
            'Je déconseille',
            'Je recommande vivement',
            'Je refuse'
          ],
          correctIndex: 2,
          explanation:
            'Je recommande vivement = I highly recommend. Vivement = strongly/highly.'
        },
        {
          id: 'a2-ch5-l6-q9',
          type: 'fill_blank',
          sentence: 'Nous _____ trois jours à Nice et c\'était merveilleux.',
          correctAnswer: 'avons passé',
          acceptableAnswers: ['avons passé', 'avons passés'],
          explanation:
            'Passer du temps utilise "avoir": nous avons passé trois jours (we spent three days).'
        },
        {
          id: 'a2-ch5-l6-q10',
          type: 'translation',
          direction: 'en_to_fr',
          sourceText: 'The weather was perfect.',
          correctAnswer: 'Le temps était parfait.',
          acceptableAnswers: [
            'Le temps était parfait.',
            'Le temps était parfait',
            'Il faisait un temps parfait.'
          ],
          explanation:
            'Le temps = the weather. Imparfait pour description: était parfait (was perfect).'
        },
        {
          id: 'a2-ch5-l6-q11',
          type: 'error_correction',
          incorrectSentence: 'Nous avons arrivés tard le soir.',
          options: [
            'Nous avons arrivés tard le soir.',
            'Nous sommes arrivés tard le soir.',
            'Nous avons arrivé tard le soir.',
            'Nous sommes arriver tard le soir.'
          ],
          correctIndex: 1,
          explanation:
            'Arriver utilise l\'auxiliaire "être" (pas "avoir"): nous sommes arrivés (we arrived).'
        },
        {
          id: 'a2-ch5-l6-q12',
          type: 'multiple_choice',
          prompt: 'Comment décrivez-vous une expérience négative poliment?',
          options: [
            'C\'était horrible et nul.',
            'C\'était un peu décevant.',
            'C\'était le pire voyage de ma vie.',
            'Je déteste cet endroit.'
          ],
          correctIndex: 1,
          explanation:
            'Manière polie et modérée: "C\'était un peu décevant" (it was a bit disappointing).'
        },
        {
          id: 'a2-ch5-l6-q13',
          type: 'fill_blank',
          sentence: 'Chaque jour, nous _____ nous promener le long de la plage.',
          correctAnswer: 'allions',
          acceptableAnswers: ['allions'],
          explanation:
            'Imparfait pour une habitude répétée: nous allions (we used to go/would go).'
        },
        {
          id: 'a2-ch5-l6-q14',
          type: 'translation',
          direction: 'fr_to_en',
          sourceText: 'Ce voyage restera inoubliable.',
          correctAnswer: 'This trip will remain unforgettable.',
          acceptableAnswers: [
            'This trip will remain unforgettable.',
            'This trip will be unforgettable.',
            'This trip will stay unforgettable.',
            'This journey will remain unforgettable.'
          ],
          explanation:
            'Futur simple pour conclusion: restera (will remain). Inoubliable = unforgettable.'
        }
      ]
    }
  ]
}
