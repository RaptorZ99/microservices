---
paths:
  - "**/*.spec.ts"
  - "**/*.test.ts"
  - "**/*.e2e-spec.ts"
  - "**/test_*.py"
  - "**/tests/**"
  - "**/test/**"
  - "**/__tests__/**"
  - "**/jest.config.*"
  - "**/pytest.ini"
  - "**/conftest.py"
  - "**/*.pact.spec.ts"
  - "**/*.contract.spec.ts"
  - "**/pact/**"
  - "**/stryker*"
  - "**/cosmic-ray*"
  - "**/*.k6.ts"
  - "**/*.k6.js"s
  - "**/k6/**"
  - "**/playwright.config.*"
  - "**/e2e/**"
  - ".gitlab-ci.yml"
  - ".gitlab/ci/**/*"
---

# TP03 - Cours - Tests Automatisés & Intégration

### Introduction : pourquoi automatiser les tests ?

Dans un projet logiciel traditionnel, les tests sont souvent manuels — un développeur ou un testeur exécute le logiciel, observe son comportement et vérifie qu'il correspond aux attentes. Cette approche a une limite évidente : elle ne passe pas à l'échelle.

À mesure qu'une base de code grandit, le nombre de fonctionnalités à vérifier augmente, les interactions entre composants se multiplient, et le temps nécessaire pour tester manuellement l'ensemble du système devient prohibitif. On finit par tester moins, tester mal, ou ne pas tester du tout.

L'automatisation des tests répond à ce problème en transformant les vérifications en code — du code qui s'exécute de façon déterministe, rapide et reproductible, à chaque modification du système.

#### Le test comme filet de sécurité

Un test automatisé joue le rôle d'un contrat exécutable : il formalise une attente sur le comportement du système et vérifie que cette attente est toujours satisfaite. Si le comportement change, le test échoue — et cet échec est détecté immédiatement, avant que le code ne soit déployé.

Cette détection précoce est la valeur fondamentale des tests automatisés. Une régression découverte cinq minutes après sa création coûte quelques minutes à corriger. La même régression découverte trois semaines plus tard, après avoir été intégrée dans d'autres fonctionnalités et déployée en production, peut coûter des jours.

#### Le pipeline comme gardien

Dans un pipeline CI/CD, les tests ne sont pas une étape optionnelle — ils sont le mécanisme qui valide que chaque modification est acceptable avant qu'elle ne progresse vers la production. Un pipeline sans tests est un pipeline sans garde-fou : le code peut avancer librement, mais sans garantie qu'il fonctionne.

Un pipeline avec une suite de tests bien conçue transforme la confiance subjective ("je pense que ça marche") en confiance objective ("les tests passent, donc les comportements vérifiés sont préservés").

## Partie 1 — Tests unitaires

### 1.1 — Définition et périmètre

Un test unitaire vérifie le comportement d'une unité de code en isolation — typiquement une fonction, une méthode, ou une classe — sans dépendance à des systèmes externes : pas de base de données, pas de réseau, pas de système de fichiers.

La définition d'"unité" varie selon les contextes et les équipes. En pratique, une unité est la plus petite portion de code qui peut être testée de façon indépendante et qui a un comportement observable. Pour une fonction pure qui prend des arguments et retourne une valeur, c'est évident. Pour une classe avec des dépendances, l'unité est la classe — et ses dépendances sont remplacées par des substituts contrôlés.

#### Caractéristiques d'un bon test unitaire

Un test unitaire efficace présente cinq propriétés souvent regroupées sous l'acronyme F.I.R.S.T. :

| Propriété | Signification |
| --- | --- |
| Fast | S'exécute en millisecondes — des milliers de tests en quelques secondes |
| Isolated | Ne dépend pas d'autres tests ni d'un état global |
| Repeatable | Donne toujours le même résultat dans n'importe quel environnement |
| Self-validating | Retourne un succès ou un échec sans intervention humaine |
| Timely | Écrit au moment où le code est écrit, pas après coup |

#### Le pattern AAA

La structure canonique d'un test unitaire suit le pattern AAA :

Arrange → Préparer les données et l'état initial
Act → Exécuter le comportement à tester
Assert → Vérifier que le résultat correspond à l'attendu

​

Ce pattern impose une séparation claire entre la mise en place du contexte, l'action testée, et la vérification. Un test qui mélange ces trois phases est plus difficile à lire et à maintenir.

\# Exemple générique — vérification d'une fonction de hashagedeftest\_hash\_is\_not\_equal\_to\_plain\_text():\# Arrange
plain\_password ="secret123"\# Act
hashed = hash\_password(plain\_password)\# Assertassert hashed != plain\_password

​

### 1.2 — L'isolation par les mocks

Tester une unité en isolation nécessite de remplacer ses dépendances externes par des substituts contrôlés. Ces substituts sont appelés test doubles — terme générique qui recouvre plusieurs variantes.

#### Taxonomie des test doubles

| Type | Description | Usage typique |
| --- | --- | --- |
| Dummy | Objet passé mais jamais utilisé | Remplir un paramètre obligatoire |
| Stub | Retourne des valeurs prédéfinies | Simuler une réponse de base de données |
| Mock | Vérifie que certains appels ont été effectués | Valider qu'une méthode a été appelée avec les bons arguments |
| Spy | Enregistre les appels pour inspection ultérieure | Observer les interactions sans les remplacer complètement |
| Fake | Implémentation fonctionnelle simplifiée | Base de données en mémoire à la place d'une vraie |

Dans le langage courant, on utilise souvent "mock" pour désigner n'importe quel test double. C'est un abus de langage, mais il est si répandu qu'il est devenu acceptable dans la plupart des contextes.

#### Pourquoi mocker ?

Considérons une fonction qui vérifie les credentials d'un utilisateur en interrogeant une base de données. Tester cette fonction sans mock nécessiterait :

Qu'une base de données soit accessible depuis l'environnement de test

Que la base contienne des données dans un état précis

Que la base soit réinitialisée entre chaque test pour garantir l'isolation

Ces contraintes rendent le test lent, fragile, et difficile à exécuter en dehors d'un environnement spécifique. En remplaçant la base de données par un stub qui retourne des données prédéfinies, on obtient un test rapide, isolé, et exécutable partout.

\# Exemple générique — mock d'un repositorydeftest\_login\_succeeds\_with\_valid\_credentials():\# Arrange — le repository renvoie toujours un utilisateur valide
user\_repository = MockUserRepository(returns=User(id=1, username="alice"))
auth\_service = AuthService(repository=user\_repository)\# Act
result = auth\_service.login("alice","correct\_password")\# Assertassert result.success isTrue

​

#### La limite des mocks

Les mocks sont puissants mais introduisent un risque : si l'implémentation réelle se comporte différemment du mock, les tests passent mais le code est quand même cassé. C'est pourquoi les tests unitaires ne suffisent pas — ils doivent être complétés par des tests qui vérifient les interactions réelles. C'est l'objet de la partie suivante.

### 1.3 — Couverture de code

La couverture de code (code coverage) mesure quelle proportion du code source est exécutée lors de l'exécution des tests. Elle est exprimée en pourcentage et peut être calculée selon plusieurs granularités :

Couverture de lignes : pourcentage de lignes exécutées

Couverture de branches : pourcentage de branches conditionnelles explorées

Couverture de fonctions : pourcentage de fonctions appelées

#### La couverture n'est pas une métrique de qualité

C'est le piège classique : une couverture à 100% ne garantit pas que les tests sont utiles. Un test peut exécuter une fonction sans jamais vérifier que son résultat est correct.

\# Test avec couverture 100% mais sans valeurdeftest\_hash\_password():
result = hash\_password("secret")assert result isnotNone\# passe même si hash\_password retourne "n'importe quoi"

​

Ce test couvre la fonction

hash\_password

mais ne détecte pas un bug dans son implémentation. La couverture est un indicateur de ce qui n'est pas testé — une faible couverture révèle des zones d'ombre. Mais une forte couverture ne révèle rien sur la qualité des assertions.

La couverture est donc un seuil minimal, pas un objectif. La vraie métrique de qualité des tests est leur capacité à détecter des régressions — c'est ce que mesurent les tests de mutation, abordés en Partie 4.

## Partie 2 — Tests d'intégration

### 2.1 — Définition et périmètre

Un test d'intégration vérifie le comportement d'un système lorsque plusieurs composants interagissent — contrairement au test unitaire qui les isole. On ne mocke plus les dépendances : on les utilise réellement, ou on utilise des substituts qui en reproduisent le comportement fidèlement (une base de données en mémoire plutôt qu'une base de production).

L'objectif est de vérifier que les composants fonctionnent ensemble : que
la couche de routage transmet correctement les requêtes à la couche métier,
que la couche métier produit les bonnes requêtes vers la couche de persistance,
et que la réponse finale est cohérente avec l'entrée.

#### La pyramide des tests

Le rapport entre tests unitaires, tests d'intégration et tests E2E est souvent représenté sous forme de pyramide :


/ ───── \
/ E2E \ ← peu nombreux, lents, coûteux
/ ───────── \
/ Intégration \ ← nombre modéré, vitesse moyenne
/ ───────────── \
/ Tests unitaires \ ← nombreux, rapides, bon marché
/\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\

​

La pyramide reflète un principe économique : les tests les plus proches du code source sont les moins coûteux à écrire, exécuter et maintenir. Plus on monte dans la pyramide, plus les tests sont coûteux en infrastructure, en temps d'exécution et en maintenance.

Une base de code bien testée respecte grossièrement cette forme : beaucoup de tests unitaires, moins de tests d'intégration, très peu de tests E2E. Une pyramide inversée — peu de tests unitaires, beaucoup de tests E2E — est un signal d'alerte : le pipeline sera lent, les échecs difficiles à diagnostiquer, et la maintenance coûteuse.

### 2.2 — Stratégies d'intégration

#### Intégration avec une base de données réelle (en mémoire)

La stratégie la plus courante pour les tests d'intégration d'une API REST est de remplacer la base de données de production par une base en mémoire — SQLite en mémoire pour les bases relationnelles, par exemple. Cette base est créée à l'initialisation de la suite de tests, peuplée avec des données contrôlées, et détruite à la fin.

L'avantage : les requêtes SQL réelles sont exécutées, les contraintes d'intégrité sont vérifiées, le comportement de la couche de persistance est testé. L'inconvénient : certains comportements spécifiques à un moteur de base de données (procédures stockées, types spécifiques, fonctionnement du transactionnel) ne peuvent pas être reproduits avec SQLite.

#### Intégration avec des services externes mockés

Lorsqu'un composant dépend de services externes — une API tierce, un service d'envoi d'emails, un broker de messages — ces services sont généralement mockés dans les tests d'intégration. On ne veut pas envoyer de vrais emails pendant les tests, ni appeler une API externe dont la disponibilité n'est pas garantie.

La distinction avec les mocks des tests unitaires : ici, le mock reproduit le comportement complet du service (y compris les codes HTTP, les formats de réponse, les délais) plutôt que de se contenter de retourner une valeur prédéfinie.

### 2.3 — Fixtures et isolation

Un problème classique des tests d'intégration est la contamination entre tests : un test modifie l'état de la base de données, et ce changement affecte les tests suivants. Pour éviter ce problème, on utilise des fixtures — des mécanismes de préparation et de nettoyage de l'état.

La stratégie la plus robuste est de recréer la base de données entre chaque test — ce qui garantit une isolation totale au prix d'un overhead en temps d'exécution. Une alternative moins coûteuse est d'utiliser des transactions : chaque test s'exécute dans une transaction qui est annulée (rollback) à la fin, laissant la base dans son état initial.

\# Exemple générique — fixture d'isolation par transaction@pytest.fixturedefdb\_session():
session = create\_session()
transaction = session.begin()yield session
transaction.rollback()\# annule toutes les modifications du test
session.close()

​

## Partie 3 — Tests de contrat

### 3.1 — Le problème des interfaces entre services

Dans une architecture microservices, chaque service expose une interface — un ensemble d'endpoints HTTP, de messages ou d'événements — que d'autres services consomment. Ces interfaces constituent des contrats implicites : le consommateur suppose que le producteur respecte une certaine structure, et le producteur suppose que le consommateur s'adapte à ses réponses.

Tant que les équipes travaillent en coordination étroite, ces contrats implicites tiennent. Mais dans une organisation à plusieurs équipes — ou même dans une même équipe sur plusieurs semaines — les hypothèses divergent.

#### Un scénario typique de rupture de contrat

Un service producteur renomme un champ dans sa réponse JSON lors d'un refactoring interne —

access\_token

devient

accessToken

, conformément aux conventions camelCase du reste du projet. Les tests unitaires et d'intégration du producteur passent : ils testent la logique interne, pas le nom des champs de la réponse.

Le consommateur n'est pas informé du changement. Son code cherche

access\_token

et trouve

undefined

. L'erreur n'est découverte qu'en production ou lors d'un test E2E, bien après le changement.

Ce scénario est si fréquent dans les architectures microservices qu'il a un nom : le Hyrum's Law effect — avec le temps, tous les comportements observables d'un service deviennent des dépendances implicites pour ses consommateurs, y compris des comportements non documentés.

### 3.2 — Consumer-Driven Contract Testing

Le Consumer-Driven Contract Testing (CDCT) est une approche qui formalise et vérifie les contrats entre services de façon automatisée. L'idée centrale est d'inverser la responsabilité : plutôt que le producteur définisse son interface et le consommateur s'y adapte, c'est le consommateur qui définit ce qu'il attend et le producteur qui vérifie qu'il le fournit.

#### Les rôles

Consumer : le service qui consomme une interface. Il définit les interactions qu'il utilise — les requêtes qu'il envoie et les réponses qu'il attend.

Provider : le service qui expose l'interface. Il vérifie qu'il respecte les attentes de chaque consumer.

#### Le contrat comme artefact

Le contrat est un fichier JSON généré par le consumer lors de l'exécution de ses tests. Ce fichier décrit les interactions : pour telle requête, j'attends telle réponse. Il est ensuite transmis au provider, qui le rejoue contre sa propre implémentation.

Consumer (frontend)
↓ génère
frontend-auth-service.json
↓ transmis à
Provider (auth-service)
↓ vérifie contre son implémentation
✓ Contrat respecté / ✗ Rupture détectée

​

#### Les matchers

Les contrats n'ont pas besoin de spécifier des valeurs exactes — ce serait trop rigide. On utilise des matchers qui décrivent la structure attendue :

like(value)

: vérifie le type de la valeur, pas la valeur elle-même.

like("eyJ...")

signifie "je veux une chaîne, peu importe laquelle".

eachLike(item)

: vérifie que la réponse est un tableau dont chaque
élément a la structure de

item

.

integer(n)

: vérifie que la valeur est un entier.

string(s)

: vérifie que la valeur est une chaîne.

Cette flexibilité est essentielle : un token JWT change à chaque génération. Vérifier sa valeur exacte rendrait les tests fragiles. On vérifie sa présence et son type — c'est suffisant pour garantir que le contrat est respecté.

### 3.3 — Le Pact Broker

Dans un projet avec plusieurs équipes et plusieurs dépôts, les fichiers de contrat doivent être partagés entre les pipelines du consumer et du provider. Cette coordination est assurée par un Pact Broker — un serveur centralisé qui stocke les contrats, gère les versions, et orchestre les vérifications.

Pipeline consumer → publie le contrat → Pact Broker
Pipeline provider → télécharge et vérifie → publie le résultat
Pipeline consumer → can-i-deploy? → Pact Broker → oui/non

​

La commande

can-i-deploy

est la pièce maîtresse : avant de déployer une nouvelle version du consumer ou du provider, le pipeline interroge le Pact Broker pour vérifier que tous les contrats en vigueur sont satisfaits. Si une rupture est détectée, le déploiement est bloqué.

Dans un mono-repo avec une seule équipe, le Pact Broker peut être remplacé par un mécanisme plus simple — comme les artifacts GitLab — qui transmettent le fichier de contrat entre les jobs du pipeline.

### 3.4 — Limites du CDCT

Le Consumer-Driven Contract Testing est puissant mais ne couvre pas tout :

Il vérifie la forme des échanges (structure, types) mais pas la logique métier (est-ce que la commande est vraiment créée en base ?)

Il suppose que le consumer sait ce qu'il va utiliser — si une nouvelle fonctionnalité du provider n'est pas encore consommée, elle n'est pas couverte

Il ne remplace pas les tests d'intégration et E2E — il les complète

Le CDCT est particulièrement efficace pour détecter les régressions d'interface lors de refactorings. C'est un filet de sécurité horizontal (entre services) qui complète les filets de sécurité verticaux (unitaires et intégration) de chaque service.

## Partie 4 — Tests de mutation

### 4.1 — Le problème de la qualité des tests

Les tests unitaires et d'intégration donnent confiance, mais ils peuvent être trompeurs. Une suite de tests avec une couverture de 90% peut ne pas détecter des bugs évidents si les assertions sont insuffisantes. Il manque une métrique qui mesure non pas ce qui est exécuté par les tests, mais ce qui est vérifié.

C'est le problème que résolvent les tests de mutation.

### 4.2 — Le principe des mutants

Un test de mutation est une technique d'évaluation de la qualité des tests. Le principe est le suivant : un outil automatique modifie le code source en introduisant des mutations — de petites altérations qui simulent des bugs réels. Il exécute ensuite la suite de tests pour chaque version mutée.

Si un test échoue face à une mutation → le mutant est tué (les tests sont efficaces)

Si tous les tests passent malgré la mutation → le mutant survit (les tests ne détectent pas ce bug)

#### Exemples de mutations classiques

| Type de mutation | Original | Muté |
| --- | --- | --- |
| Inversion de condition | if x > 0 | if x >= 0 |
| Inversion de booléen | return True | return False |
| Changement d'opérateur | a + b | a - b |
| Suppression de condition | if auth: do\_something() | do\_something() |
| Remplacement de constante | MAX\_RETRIES = 3 | MAX\_RETRIES = 4 |

Chacune de ces mutations représente un type de bug réel qui peut survenir lors d'un refactoring ou d'une modification inattentive.

### 4.3 — Le score de mutation

Le score de mutation (mutation score) est le rapport entre les mutants tués et le nombre total de mutants :

Score de mutation = (mutants tués / total mutants) × 100

​

Un score de 75% signifie que 75% des bugs simulés ont été détectés par la suite de tests. Les 25% restants sont des zones de vulnérabilité : des bugs de ce type pourraient passer inaperçus.

| Score | Interprétation |
| --- | --- |
| < 50% | Suite de tests insuffisante |
| 50–70% | Acceptable pour du code peu critique |
| 70–85% | Bon niveau — standard industriel courant |
| \> 85% | Excellent — mais coût de maintenance croissant |

#### La relation avec la couverture

Un score de mutation élevé nécessite une couverture élevée, mais l'inverse n'est pas vrai. Une couverture à 100% peut coexister avec un score de mutation de 30% si les assertions sont superficielles. Les tests de mutation sont donc une métrique complémentaire et plus exigeante que la couverture de code.

### 4.4 — Faux positifs et exclusions

Tous les mutants survivants ne représentent pas des lacunes des tests. Certaines mutations correspondent à des changements qui n'altèrent pas le comportement observable du programme — on les appelle des faux positifs.

#### Exemples de faux positifs courants

Constantes de configuration : remplacer

TIMEOUT = 30

par

TIMEOUT = 31

ne change rien si aucun test ne vérifie la valeur exacte du timeout — et il n'est pas nécessairement utile d'en écrire un

Messages de log : modifier un message de log n'affecte pas le comportement fonctionnel du système

Opérations commutatives :

a + b

et

b + a

sont équivalents pour les entiers — l'un ou l'autre muté ne change rien

Lorsqu'un outil de mutation permet d'exclure des opérateurs ou des fichiers entiers, il faut documenter chaque exclusion avec sa justification. Une exclusion non justifiée masque potentiellement de vrais problèmes.

### 4.5 — Quoi cibler

Les tests de mutation ont un coût en temps d'exécution — sur une base de code importante, une session complète peut durer des heures. Il faut donc cibler judicieusement :

À cibler en priorité :

La logique métier critique (calculs, validations, règles métier)

Les fonctions pures avec des branches conditionnelles

Le code de sécurité (hashage, autorisation, tokens)

À éviter ou exclure :

Le code de configuration et d'initialisation

Les contrôleurs/routes qui orchestrent sans logique propre

Les adapters vers des systèmes externes

Dans un pipeline CI, on restreint généralement les tests de mutation aux fichiers modifiés dans la branche courante — plutôt que de rejouer la session complète à chaque commit.

## Partie 5 — Tests de performance

### 5.1 — Pourquoi tester les performances ?

Un service peut être fonctionnellement correct — toutes ses fonctionnalités marchent, tous les tests passent — et pourtant se révéler inutilisable en conditions réelles parce qu'il répond en 10 secondes au lieu de 200 millisecondes sous charge.

Les tests de performance vérifient le comportement d'un système non pas pour un utilisateur unique, mais pour un grand nombre d'utilisateurs simultanés. Ils révèlent des problèmes qui n'apparaissent qu'à l'échelle : goulots d'étranglement, fuites mémoire, dégradation progressive, effondrement sous pic.

Ces problèmes sont particulièrement difficiles à détecter sans tests dédiés car ils n'apparaissent pas dans les logs d'un développement nominal. Un service qui répond en 5ms pour un utilisateur peut répondre en 10 secondes pour 50 utilisateurs simultanés si son architecture n'est pas conçue pour la concurrence.

### 5.2 — Les métriques clés

Tout test de performance s'appuie sur un ensemble de métriques standardisées :

#### Temps de réponse

Le temps de réponse (response time) mesure le délai entre l'envoi d'une requête et la réception de la réponse complète. Il inclut le temps réseau, le temps de traitement serveur, et le temps de sérialisation de la réponse.

On ne travaille jamais avec la moyenne du temps de réponse — elle est trop sensible aux valeurs extrêmes. On utilise des percentiles :

p50 (médiane) : 50% des requêtes répondent en moins de ce délai

p95 : 95% des requêtes répondent en moins de ce délai — c'est le seuil standard car il capture l'expérience de la quasi-totalité des utilisateurs sans être perturbé par les outliers extrêmes

p99 : 99% des requêtes répondent en moins de ce délai — utilisé pour les services à haute exigence de fiabilité

#### Débit

Le débit (throughput) mesure le nombre de requêtes que le système peut traiter par unité de temps. Il est exprimé en requêtes par seconde (rps ou req/s). Le débit est la contrepartie du temps de réponse : augmenter la charge tend à augmenter le temps de réponse et peut plafonner le débit.

#### Taux d'erreur

Le taux d'erreur mesure la proportion de requêtes qui se terminent par une erreur (codes HTTP 4xx ou 5xx). Un service peut maintenir un temps de réponse acceptable tout en commençant à rejeter des requêtes sous charge — c'est un signal de saturation.

#### Concurrent Users / Virtual Users

Le nombre d'utilisateurs simultanés (Virtual Users dans k6, Concurrent Users dans d'autres outils) représente le nombre de sessions actives en parallèle. C'est le paramètre principal d'un test de charge : on monte progressivement le nombre de VU et on observe comment les métriques évoluent.

### 5.3 — Les quatre types de tests de performance

On distingue quatre scénarios de test qui correspondent à des questions différentes sur le comportement sous charge.

#### Load test (test de charge)

Le load test vérifie le comportement du système sous une charge nominale — les conditions normales d'utilisation. On simule le nombre d'utilisateurs simultanés attendu en production et on vérifie que les seuils de qualité sont respectés.

C'est le test le plus fondamental — il répond à la question : "Mon service tient-il dans des conditions normales ?"

#### Stress test (test de stress)

Le stress test pousse la charge au-delà du nominal pour trouver le point de rupture du système. On monte progressivement le nombre d'utilisateurs jusqu'à observer une dégradation significative ou un effondrement.

L'objectif n'est pas de faire échouer le système gratuitement, mais d'identifier la capacité maximale et de comprendre comment le système se dégrade. Un service qui se dégrade gracieusement (en ralentissant) est préférable à un service qui s'effondre brutalement (en retournant des erreurs).

#### Spike test (test de pic)

Le spike test simule un pic soudain et massif de trafic — comme un effet de mise en avant médiatique ou l'ouverture d'une campagne promotionnelle. La charge passe brutalement de quelques utilisateurs à des centaines en quelques secondes, puis redescend.

Ce test révèle des problèmes spécifiques aux variations rapides : pools de connexions saturés, files d'attente débordées, autoscaling trop lent à réagir. Il teste aussi la récupération : est-ce que le système retrouve son comportement normal après le pic ?

#### Soak test (test d'endurance)

Le soak test applique une charge modérée sur une durée très longue — plusieurs heures, voire plusieurs jours. Il vise à détecter des problèmes qui n'apparaissent qu'avec le temps : fuites mémoire, accumulation de connexions non fermées, fragmentation de la mémoire, dégradation progressive des performances.

Un service peut passer un load test en 30 minutes et commencer à se dégrader après 6 heures d'utilisation continue. Le soak test est le seul type de test qui révèle ces problèmes — au prix d'un temps d'exécution prohibitif en pipeline standard.

### 5.4 — Seuils et critères d'acceptation

Un test de performance sans seuils n'est qu'une observation. Les seuils (thresholds) transforment les mesures en critères d'acceptation : le test passe ou échoue selon que les métriques respectent ou non les valeurs définies.

#### Définir des seuils pertinents

Les seuils doivent refléter les exigences réelles des utilisateurs, pas des valeurs arbitraires. Pour les définir :

Partir des exigences métier : un formulaire de login doit répondre en moins de 2 secondes selon les études UX — c'est le seuil utilisateur

Déduire un seuil technique : si le frontend ajoute 200ms de latence, le service backend doit répondre en moins de 1800ms

Calibrer sur l'environnement : un test en CI sur des runners partagés donnera des résultats différents d'un test sur un serveur dédié — les seuils doivent tenir compte de l'environnement d'exécution

#### Seuils en CI vs production

Dans un pipeline CI, les tests de performance ont une valeur limitée car l'infrastructure de test ne ressemble pas à la production : CPU partagé, réseau interne différent, services sur la même machine. Ces tests CI sont utiles pour détecter des régressions grossières — un endpoint qui passe de 5ms à 5000ms — mais pas pour calibrer des seuils précis.

Les seuils précis et contraignants s'appliquent aux tests contre un environnement de staging qui reproduit la production. Dans ce contexte, un échec de performance est une raison valide de bloquer un déploiement.

## Partie 6 — Tests E2E

### 6.1 — Définition et positionnement

Les tests End-to-End (E2E) vérifient le comportement de l'application complète du point de vue d'un utilisateur réel. Un vrai navigateur navigue sur l'interface, interagit avec les éléments, et le test vérifie que le résultat correspond aux attentes — en passant par toutes les couches du système : interface, API, logique métier, base de données.

Contrairement aux tests unitaires et d'intégration qui testent des composants isolés, les tests E2E ne font aucune hypothèse sur l'implémentation interne. Ils vérifient uniquement ce qu'un utilisateur peut observer.

#### La place des tests E2E dans la pyramide

Les tests E2E sont au sommet de la pyramide — peu nombreux, lents, et coûteux.
Leurs caractéristiques :

Lents : un test E2E lance un navigateur, charge l'application, attend le rendu, interagit avec l'interface — chaque test dure plusieurs secondes

Fragiles : ils dépendent de l'interface graphique, du réseau, des services backend, et de données en base — chaque dépendance est une source potentielle d'instabilité

Précieux : ils valident les flux utilisateur complets que les tests inférieurs ne peuvent pas couvrir

### 6.2 — Les locators sémantiques

Un point de fragilité classique des tests E2E est la sélection des éléments de l'interface. Si un test sélectionne un bouton via son sélecteur CSS (

.btn-primary

) ou son XPath (

//div\[3\]/button\[1\]

), il devient fragile : le moindre changement de style ou de structure HTML le casse.

Les frameworks modernes comme Playwright encouragent les locators sémantiques — des sélecteurs basés sur le sens de l'élément plutôt que sur sa forme :

| Locator | Sélection |
| --- | --- |
| getByRole('button', { name: 'Se connecter' }) | Bouton avec le texte "Se connecter" |
| getByLabel('Nom d\\'utilisateur') | Champ associé au label "Nom d'utilisateur" |
| getByText('Erreur de connexion') | Élément contenant ce texte |
| getByPlaceholder('john.doe') | Champ avec ce placeholder |

Ces locators sont résistants aux changements de style car ils s'appuient sur le comportement et le contenu, pas sur la présentation. Ils ont un avantage supplémentaire : ils incitent à écrire un HTML accessible — un label correctement associé à son champ est à la fois une bonne pratique d'accessibilité et la condition nécessaire à

getByLabel()

.

### 6.3 — L'auto-waiting

Une source majeure de fragilité dans les tests E2E est la gestion du temps : une page met du temps à se charger, un composant React met du temps à se rendre, une requête réseau met du temps à revenir. Les anciens outils exigeaient des

sleep()

explicites —

wait(2000)

après chaque action — qui rendent les tests à la fois lents et fragiles.

Les frameworks modernes comme Playwright implémentent l'auto-waiting : avant chaque interaction, Playwright attend que l'élément soit dans un état approprié — visible, activé, stable (non en train de changer). Avant chaque assertion, il réessaie automatiquement pendant un délai configurable.

// Playwright attend automatiquement que le texte soit visible// Il réessaie toutes les 100ms pendant 5 secondes avant d'échouerawaitexpect(page.getByText('Connexion réussie')).toBeVisible();

​

Cette approche élimine les

sleep()

arbitraires et rend les tests plus robustes face aux latences réseau et aux délais de rendu.

### 6.4 — Isolation entre les tests

Chaque test E2E doit partir d'un état connu et ne pas dépendre de l'ordre d'exécution des autres tests. Dans les frameworks modernes, cette isolation est assurée par des contextes de navigateur indépendants : chaque test reçoit un contexte frais — cookies vides, localStorage vide, aucun état persistant.

Cette isolation a un coût : les données de test doivent être créées pour chaque test, ce qui ralentit l'exécution. Des stratégies permettent d'en mitiger l'impact :

Setup via API : plutôt que de créer un utilisateur via l'interface (lent), on appelle directement l'API de création (rapide) dans le

before

du test

Partage de session : pour les tests qui nécessitent un utilisateur authentifié, on peut partager un état d'authentification entre plusieurs tests via les mécanismes de fixtures du framework

### 6.5 — Tests E2E en CI : l'approche contre staging

La question de l'infrastructure des tests E2E en CI est délicate. Trois approches existent :

#### Approche 1 : serveur de développement local

On lance le serveur de l'application en mode développement dans le job CI, et les tests s'exécutent contre ce serveur local. C'est la plus simple à mettre en place mais la moins représentative : le serveur de développement a des comportements différents du serveur de production (hot-reload, cache différent, configuration différente).

#### Approche 2 : services Docker dans le pipeline

On lance les services backend comme des conteneurs Docker dans le job CI. C'est plus réaliste que le mode développement, mais les ressources limitées des runners CI peuvent produire des résultats différents de la production.

#### Approche 3 : tests contre staging (recommandée en production)

Les tests E2E s'exécutent contre un environnement de staging déployé — identique à la production en termes d'infrastructure, de configuration et de données. Le pipeline déploie d'abord sur staging, puis exécute les tests E2E, puis déploie en production si les tests passent.

Build → Deploy staging → Test E2E → Deploy production

​

C'est l'approche recommandée car elle teste l'application dans les conditions réelles. Elle nécessite une infrastructure de staging dédiée, mais c'est le prix de la fiabilité.

### 6.6 — Les tests E2E comme documentation vivante

Un bénéfice souvent sous-estimé des tests E2E est leur rôle de documentation vivante. Un test E2E bien écrit décrit un scénario utilisateur complet en termes lisibles :

test('un utilisateur peut se connecter avec des identifiants valides',async({ page })=>{await page.goto('/login');await page.getByLabel('Email').fill('alice@exemple.com');await page.getByLabel('Mot de passe').fill('secret123');await page.getByRole('button',{ name:'Se connecter'}).click();awaitexpect(page).toHaveURL('/tableau-de-bord');});

​

Ce test est compréhensible par un non-développeur. Il décrit ce que le système doit faire, pas comment il le fait. C'est une spécification exécutable — si le comportement change, le test échoue et le code doit être mis à jour, ou la spécification doit être revue. Dans les deux cas, le changement est explicite et délibéré.

### Synthèse : les niveaux de test en perspective

| Niveau | Vérifie | Vitesse | Fragilité | Coût |
| --- | --- | --- | --- | --- |
| Unitaire | Une fonction isolée | < 1ms | Très faible | Très faible |
| Intégration | Une couche complète avec ses dépendances | 10ms–1s | Faible | Faible |
| Contrat | L'interface entre deux services | Quelques secondes | Faible | Modéré |
| Mutation | La qualité des assertions des tests | Minutes | N/A | Modéré–élevé |
| Performance | Le comportement sous charge | Minutes | Modérée | Modéré–élevé |
| E2E | Un flux utilisateur complet | Secondes–minutes | Élevée | Élevé |

Ces niveaux ne sont pas en compétition — ils sont complémentaires. Chacun détecte des catégories de problèmes que les autres ne voient pas. Une stratégie de test robuste combine tous ces niveaux en proportion adaptée à la criticité du système et aux ressources disponibles.

La pyramide des tests reste le guide : beaucoup de tests rapides à la base, peu de tests lents au sommet. À chaque niveau, on teste uniquement ce que les niveaux inférieurs ne peuvent pas vérifier.