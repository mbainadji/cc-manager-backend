# CC Manager : API

API de gestion des examens de contrôle continu (Express, MongoDB, JWT).

## Lancer en local
```bash
npm install
cp .env.example .env     # puis remplir JWT_SECRET
npm run seed             # crée le professeur de test
npm run dev              # http://localhost:3000
```
MongoDB doit tourner en local, ou mettre une chaîne MongoDB Atlas dans `MONGODB_URI`.

Compte professeur de test : `amadou.diallo@univ.test` / `motdepasse123` (à changer avant toute mise en ligne).

## Routes principales
- `POST /api/auth/student/register`, `POST /api/auth/student/login`, `POST /api/auth/professor/login`
- `GET /api/students` (professeur)
- `GET/POST /api/exams`, `GET/PUT /api/exams/:id/grades`, `POST /api/exams/:id/publish` (professeur)
- `GET /api/results`, `GET /api/results/:id` (étudiant : ses notes publiées uniquement)

## Contribuer
Ne pas pousser sur `main`.
```bash
git checkout -b feature/nom-de-la-fonctionnalite
git add . && git commit -m "feat: description"
git push -u origin feature/nom-de-la-fonctionnalite
```
Puis ouvrir une Pull Request vers `main`. Ne jamais commiter `.env`.
