# TP 06 - Orchestration des conteneurs (Kubernetes - Minikube / Orbstack) - Cours

# Partie 1 — Introduction à Kubernetes

Cette partie vise à fournir une compréhension technique approfondie des concepts fondamentaux de Kubernetes. L'objectif est que l’étudiant comprenne non seulement **ce que fait Kubernetes**, mais surtout **comment et pourquoi cela fonctionne**, ce qui permettra de maîtriser les déploiements des microservices dans les sections suivantes.

---

### Comprendre Kubernetes

Kubernetes (*K8s*) est une plateforme d'orchestration de conteneurs **déclarative**, **auto-réparatrice** et **scalable**, conçue initialement par Google puis rendue open source via la CNCF.

Contrairement à Docker Compose (déclaratif mais non auto-réparateur et mono-machine), Kubernetes fonctionne sur le principe :

1. **Déclaration d’un état désiré** (desired state) — via des manifestes YAML.
1. **Convergence automatique vers cet état** — par les control-planes.
1. **Reconciliation loop** — Kubernetes vérifie en permanence que l’état réel (current state) correspond à l’état voulu, et corrige si nécessaire.

Cette “boucle de réconciliation” est le cœur du fonctionnement.

Exemple :

→ Tu demandes 3 Pods.

→ Kubernetes voit qu’il en existe 2.

→ Kubernetes recrée automatiquement le pod manquant.

Ceci explique pourquoi un simple crash de conteneur ne provoque pas d’indisponibilité durable : Kubernetes le remplace immédiatement.

---

### Architecture interne détaillée de Kubernetes

Un cluster Kubernetes est composé de deux couches principales : le **Control Plane** et les **Nodes**.

### Control Plane — Le cerveau du cluster

Le Control Plane orchestre l’ensemble :

- **kube-apiserver**
  - point d'entrée unique pour l'API Kubernetes,
  - toute commande `kubectl` passe par lui,
  - expose l’état complet du cluster.
- **etcd**
  - base de données clé-valeur distribuée,
  - stocke l’état global du cluster (pods, services, secrets…),
  - extrêmement critique : c’est le “source of truth”.
- **kube-scheduler**
  - affecte chaque Pod à un Node en fonction :
    - ressources CPU/RAM disponibles,
    - affinités/anti-affinités,
    - taints & tolerations,
    - contraintes topologiques.
- **kube-controller-manager**
  - contient les “contrôleurs” (boucles de réconciliation),
  - par exemple :
    - DeploymentController (maintient les réplicas),
    - NodeController (détecte les nodes down),
    - JobController, ReplicationController…

**Principe :**

Le control plane ne fait pas tourner les conteneurs.

Il dit *“je veux ça”* et vérifie que les nœuds l’exécutent.

---

### Node — Les machines qui exécutent réellement les conteneurs

Chaque node (VM ou physique) contient :

- **kubelet**
  - agent local qui exécute les Pods,
  - reçoit les ordres du kube-apiserver,
  - s’assure que les conteneurs sont bien lancés.
- **kube-proxy**
  - implémente le réseau Kubernetes,
  - gère les règles iptables/ipvs,
  - route le trafic vers les Pods derrière un Service.
- **Container Runtime**
  - containerd (par défaut),
  - CRI-O,
  - Docker (non recommandé mais possible via CRI avec shim).

Kubernetes **ne gère pas** les conteneurs directement :

il délègue au runtime via l'interface CRI (Container Runtime Interface).

---

## Les entités Kubernetes

Kubernetes repose sur un ensemble de ressources déclaratives qui coopèrent pour garantir la disponibilité, la scalabilité et la résilience des applications conteneurisées. Ces entités sont gérées par des “Controllers” intégrés au Control Plane via la **Reconciliation Loop**, qui corrige en permanence les écarts entre l’état voulu (définitions YAML) et l’état réel (état des Nodes / Pods).

Voici les ressources fondamentales utilisées dans tout déploiement moderne.

---

## Pod — Unité d’exécution minimale

*(Ce que Kubernetes exécute réellement sur les Nodes)*

Le Pod est la brique de base d’exécution dans Kubernetes.

C’est **l'unité atomique programmée sur un Node**.

Caractéristiques techniques :

- Un Pod peut contenir **un ou plusieurs conteneurs** mais il s’agit d’un cas rare hors sidecars (ex. envoy proxy).
- Tous les conteneurs d’un Pod partagent les mêmes ressources bas niveau :
  - **network namespace** (une IP unique pour l’ensemble du Pod),
  - **port space** (les conteneurs ne doivent pas exposer des ports en conflit),
  - **IPC namespace** (communication processes entre conteneurs),
  - **volumes** (système de fichiers partagé, persistant ou non).
- Les Pods sont **éphémères** :
  - ils peuvent être supprimés, recréés ou déplacés,
  - ils ne garantissent **aucune** persistance (réseau ou stockage).

Le Pod n'a pas de mécanisme intégré de redémarrage automatique.

Cela signifie que si un Pod crash :

→ Kubernetes **ne le relancera pas**

→ sauf si un contrôleur supérieur (Deployment, ReplicaSet, DaemonSet…) le gère.

Dans un environnement de production, **on ne crée jamais de Pods bruts**.

Ils sont générés automatiquement par un Deployment ou un autre contrôleur.

---

## Deployment — Gestion complète du cycle de vie des Pods

*(Stratégie, scalabilité, haute disponibilité)*

Un Deployment est une ressource de haut niveau qui décrit l’**état désiré** d’un ensemble de Pods identiques.

Il définit :

- **l’image conteneur** (avec version taggée),
- **le nombre de réplicas** (scaling horizontal),
- **la stratégie de mise à jour** :
  - `RollingUpdate` : remplacement progressif des Pods, sans interruption,
  - `Recreate` : tous les Pods sont stoppés d’abord, puis redéployés (rare).
- **les sondes de santé** :
  - `readinessProbe` → détermine quand un Pod peut recevoir du trafic,
  - `livenessProbe` → redémarre automatiquement un Pod bloqué ou crashé.

Fonctionnement interne :

- Un Deployment gère un **ReplicaSet**,
- Le ReplicaSet gère les **Pods**,
- Kubernetes garantit en continu que la quantité désirée est respectée.

Garanties du système :

- **Haute disponibilité** via plusieurs réplicas,
- **Autoscaling** (via HPA si configuré),
- **Self-healing** : si un Pod devient défaillant, il est remplacé,
- **Rolling updates sans downtime** lors des changements d'image,
- **Rollback automatique** si une mise à jour échoue.

En bref :

Le Deployment est *le contrôleur fiable qui permet à Kubernetes de maintenir une application en production sans interruption*.

---

## Service — Point d’accès réseau stable

*(Abstraction réseau interne avec load balancing)*

Les Pods ont des adresses IP *éphémères* et non persistentes.

Pour communiquer avec eux, Kubernetes expose un **Service**, qui fournit :

- une **IP fixe** interne dans le cluster,
- un **nom DNS stable** géré par CoreDNS :
  - ex : `auth-service.default.svc.cluster.local`,
- du **load balancing** entre les Pods cibles via kube-proxy,
- un accès réseau uniforme malgré les redéploiements.

Chaque Service sélectionne automatiquement les Pods via les **labels** et le champ `selector`.

### Types de Services

- **ClusterIP** *(par défaut)*
  - accès uniquement depuis l'intérieur du cluster,
  - utilisé pour la communication entre microservices.
- **NodePort**
  - expose un port fixe sur chaque Node,
  - utile pour accès externe sans Ingress (rare en production).
- **LoadBalancer**
  - crée un load balancer cloud (AWS ELB, GCP LB…),
  - adapté aux environnements managés (EKS, GKE, AKS).
- **Headless Service**
  - aucune IP cluster attribuée,
  - indispensable pour :
    - bases distribuées (Cassandra, MongoDB),
    - StatefulSets,
    - service discovery avancé.

Grâce au Service, même si 10 Pods sont remplacés pendant un déploiement,

le réseau reste **stable**, car le Service est l'unique point d'entrée.

---

## ConfigMap & Secret — Gestion de configuration

Application, logique métier et configuration ne doivent jamais être liés.

Kubernetes fournit deux ressources pour cela :

### ConfigMap

Pour stocker des configurations **non sensibles** :

- URLs de services,
- paramètres applicatifs,
- variables d'environnement non critiques.

Un ConfigMap peut être injecté dans un Pod :

- en variables d'environnement (`env:`),
- en fichiers montés dans un volume (`volumeMounts:`),
- ou référencé directement dans un manifeste.

### Secret

Pour stocker des données **sensibles** :

- clés JWT,
- mots de passe,
- certificats TLS,
- tokens API.

Caractéristiques techniques :

- Encodé en Base64 (non chiffré par défaut),
- Peut être chiffré avec “Encryption at Rest” dans etcd,
- Accessible uniquement par les Pods autorisés.

Injection dans les Pods :

- via des variables d’environnement,
- sous forme de fichiers montés,
- via des CSI drivers externes (Vault, AWS Secrets Manager…).

Secrets et ConfigMaps permettent de **versionner l'infrastructure sans exposer les données sensibles**, et de changer les valeurs **sans redéployer l’application**.

---

### Ingress — Routage HTTP/HTTPS externe

Un Ingress permet d’exposer des applications via HTTP/HTTPS à partir d’un nom de domaine unique.

Exemple dans notre TP :

```plain text
devops.local/auth      → auth-service:8000
devops.local/orders    → order-service:4000
devops.local/          → frontend:3000
```

L’Ingress **ne fonctionne pas seul** :

il faut un **Ingress Controller**, comme Nginx Ingress.

Fonctions importantes :

- reverse proxy L7,
- TLS termination,
- réécriture de chemin,
- load balancing HTTP avancé.

---

### Minikube — Kubernetes local pour l’apprentissage

Minikube est un environnement Kubernetes local tout-en-un.

Il crée :

- un seul nœud Kubernetes (master + worker),
- un runtime containerd,
- support du réseau CNI,
- un tunnel réseau permettant d’exposer les Services.

Minikube permet :

- d’activer **Ingress** via `minikube addons enable ingress`,
- de tester des déploiements réels,
- d’exécuter `kubectl` exactement comme en production.

Pour un usage pédagogique, c’est idéal.

---

### Le dossier `k8s/` — Organisation des manifests

Chaque microservice aura :

- 1 Deployment,
- 1 Service,
- éventuellement un ConfigMap/Secret.

Organisation proposée :

```plain text
k8s/
├── auth/
│   ├── deployment.yaml
│   └── service.yaml
├── order/
│   ├── deployment.yaml
│   └── service.yaml
├── frontend/
│   ├── deployment.yaml
│   └── service.yaml
└── ingress/
    └── ingress.yaml
```

Cette organisation respecte les pratiques GitOps (un fichier = une ressource).
