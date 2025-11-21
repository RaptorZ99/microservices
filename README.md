## Kubernetes (Minikube / Multipass)

1. Construire les images et les charger dans Minikube :

```bash
# Depuis la racine
minikube start --driver=docker
minikube image build -t auth-service:latest auth-service
minikube image build -t order-service:latest order-service
minikube image build -t book-service:latest book-service
minikube image build -t frontend:latest frontend
```

2. Appliquer les manifests :

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/auth -n microservices
kubectl apply -f k8s/order -n microservices
kubectl apply -f k8s/book -n microservices
kubectl apply -f k8s/frontend -n microservices
kubectl apply -f k8s/ingress -n microservices
```

3. Activer l’ingress (Minikube) :

```bash
minikube addons enable ingress
minikube tunnel
# Ajouter devops.local -> 127.0.0.1 dans /etc/hosts
```

4. Accès :

- Frontend : http://devops.local