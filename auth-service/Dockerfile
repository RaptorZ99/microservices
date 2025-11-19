FROM python:3.12-slim

# Répertoire de travail du conteneur
WORKDIR /app

# Copie des dépendances Python et installation
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copie du code de l'application
COPY . .

# Permet à Python de trouver automatiquement les modules locaux
ENV PYTHONPATH=/app

# Lancement : initialise la base puis démarre Uvicorn
CMD ["bash", "-c", "python init_db.py && uvicorn main:app --host 0.0.0.0 --port 8000"]
