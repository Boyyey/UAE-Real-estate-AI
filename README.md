# 🏘️ UAE Housing Affordability Heatmap 🌍

**AI-Driven, Interactive, and Powerful Home Finder for the UAE**

Find your perfect home in the UAE with real estate prices, income levels, transport, and amenities visualized on a beautiful, professional map. Powered by AI for smart suggestions and deep analytics.

---

## ✨ Features
- 🗺️ **Interactive Price Heatmap**: See affordable and expensive areas at a glance
- 🤖 **AI-Powered Suggestions**: Get personalized area recommendations based on your job, income, family, and needs
- 🏢 **All Major UAE Professions**: Salary data for 30+ jobs
- 🚇 **Transport Proximity**: Filter by distance to metro/bus stops
- 🏫 **Amenities & Filters**: School, park, supermarket, property type, bedrooms, furnished, pet-friendly, new listings, family-friendly, and more
- 📊 **Advanced Analytics**: Compare professions, export data, download CSV, and more
- 🌙 **Dark Mode**: Stunning, modern, and mobile-friendly UI
- 🆘 **Onboarding & Tooltips**: Easy to use for everyone

---

## 🚀 Quick Start

### 1. Backend (Flask API)
```sh
cd backend
pip install -r requirements.txt
pip install scikit-learn numpy
python app.py
```

### 2. Frontend (Static Server)
```sh
cd frontend
python -m http.server 8000
```
Open [http://localhost:8000](http://localhost:8000) in your browser.

---

## 🧠 How It Works
- **Heatmap**: Colors all UAE areas by price (green = affordable, red = expensive)
- **AI Suggestions**: Enter your income, job, family size, and needs to get the best-matching areas
- **Filters**: Drill down by property type, bedrooms, amenities, and more
- **Compare**: See how affordability changes by profession
- **Export**: Download your results as CSV or image

---

## 📂 Data
- `backend/data/real_estate.csv`: 50+ UAE areas, prices, property types, amenities, etc.
- `backend/data/income.csv`: 30+ professions and average incomes
- `backend/data/transport.csv`: 30+ metro/bus stops

---

## 🌐 Deployment
- **Frontend**: Can be deployed to GitHub Pages, Netlify, or Vercel (static hosting)
- **Backend**: Deploy to Render, Railway, Heroku, or your own server
- **Frontend Config**: Update API URLs in JS to point to your backend

---

## 🙌 Credits
Built with ❤️ to make UAE housing more accessible and equitable for all. 