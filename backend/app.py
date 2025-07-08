from flask import Flask, jsonify, request
import pandas as pd
import os
import numpy as np
from sklearn.cluster import KMeans

app = Flask(__name__)

# Load data once at startup
DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
real_estate_df = pd.read_csv(os.path.join(DATA_DIR, 'real_estate.csv'))
income_df = pd.read_csv(os.path.join(DATA_DIR, 'income.csv'))
transport_df = pd.read_csv(os.path.join(DATA_DIR, 'transport.csv'))

AMENITIES = ['school', 'park', 'supermarket']

@app.route('/api/affordability')
def affordability():
    profession = request.args.get('profession', 'Teacher')
    amenities = request.args.get('amenities')
    area_search = request.args.get('area')
    property_type = request.args.get('property_type')
    bedrooms = request.args.get('bedrooms')
    furnished = request.args.get('furnished')
    pet_friendly = request.args.get('pet_friendly')
    new_listing = request.args.get('new_listing')
    family_friendly = request.args.get('family_friendly')
    df = real_estate_df.copy()
    if amenities:
        for amenity in amenities.split(','):
            if amenity in AMENITIES:
                df = df[df[amenity] == 1]
    if area_search:
        df = df[df['location'].str.contains(area_search, case=False)]
    if property_type:
        df = df[df['property_type'] == property_type]
    if bedrooms:
        if bedrooms == '5':
            df = df[df['bedrooms'] >= 5]
        else:
            df = df[df['bedrooms'] == int(bedrooms)]
    if furnished:
        df = df[df['furnished'] == 1]
    if pet_friendly:
        df = df[df['pet_friendly'] == 1]
    if new_listing:
        df = df[df['new_listing'] == 1]
    if family_friendly:
        df = df[df['family_friendly'] == 1]
    income_row = income_df[income_df['profession'].str.lower() == profession.lower()]
    if income_row.empty:
        avg_income = income_df['avg_income'].mean()
    else:
        avg_income = income_row.iloc[0]['avg_income']
    scores = []
    max_score = 0
    for _, row in df.iterrows():
        score = avg_income / row['price']
        scores.append(score)
        if score > max_score:
            max_score = score
    norm_scores = [s / max_score if max_score > 0 else 0 for s in scores]
    areas = []
    for i, row in df.iterrows():
        area = {
            'name': row['location'],
            'latitude': row['latitude'],
            'longitude': row['longitude'],
            'price': row['price'],
            'score': round(norm_scores[i], 2),
            'school': int(row['school']),
            'park': int(row['park']),
            'supermarket': int(row['supermarket']),
            'property_type': row['property_type'],
            'bedrooms': int(row['bedrooms']),
            'furnished': int(row['furnished']),
            'pet_friendly': int(row['pet_friendly']),
            'new_listing': int(row['new_listing']),
            'family_friendly': int(row['family_friendly'])
        }
        areas.append(area)
    return jsonify({'areas': areas, 'profession': profession})

@app.route('/api/transport')
def transport():
    stops = []
    for _, row in transport_df.iterrows():
        stops.append({
            'stop_name': row['stop_name'],
            'latitude': row['latitude'],
            'longitude': row['longitude']
        })
    return jsonify({'stops': stops})

@app.route('/api/suggest', methods=['POST'])
def suggest():
    data = request.json
    income = float(data.get('income', 100000))
    family = int(data.get('family', 1))
    amenities = data.get('amenities', [])
    max_proximity = float(data.get('proximity', 10))
    property_type = data.get('property_type')
    bedrooms = data.get('bedrooms')
    furnished = data.get('furnished')
    pet_friendly = data.get('pet_friendly')
    new_listing = data.get('new_listing')
    family_friendly = data.get('family_friendly')
    df = real_estate_df.copy()
    def min_dist(row):
        dists = np.sqrt((transport_df['latitude'] - row['latitude'])**2 + (transport_df['longitude'] - row['longitude'])**2)
        return dists.min() * 111
    df['proximity'] = df.apply(min_dist, axis=1)
    df = df[df['proximity'] <= max_proximity]
    for amenity in amenities:
        if amenity in AMENITIES:
            df = df[df[amenity] == 1]
    if property_type:
        df = df[df['property_type'] == property_type]
    if bedrooms:
        if bedrooms == '5':
            df = df[df['bedrooms'] >= 5]
        else:
            df = df[df['bedrooms'] == int(bedrooms)]
    if furnished:
        df = df[df['furnished'] == 1]
    if pet_friendly:
        df = df[df['pet_friendly'] == 1]
    if new_listing:
        df = df[df['new_listing'] == 1]
    if family_friendly:
        df = df[df['family_friendly'] == 1]
    scores = []
    for _, row in df.iterrows():
        score = income / row['price']
        for amenity in amenities:
            if amenity in AMENITIES and row[amenity] == 1:
                score += 0.1
        score -= 0.01 * row['proximity']
        if family > 4 and row['school'] == 1:
            score += 0.05
        scores.append(score)
    if scores:
        max_score = max(scores)
        norm_scores = [s / max_score if max_score > 0 else 0 for s in scores]
    else:
        norm_scores = []
    areas = []
    for i, row in df.iterrows():
        area = {
            'name': row['location'],
            'latitude': row['latitude'],
            'longitude': row['longitude'],
            'price': row['price'],
            'score': round(norm_scores[i], 2),
            'school': int(row['school']),
            'park': int(row['park']),
            'supermarket': int(row['supermarket']),
            'property_type': row['property_type'],
            'bedrooms': int(row['bedrooms']),
            'furnished': int(row['furnished']),
            'pet_friendly': int(row['pet_friendly']),
            'new_listing': int(row['new_listing']),
            'family_friendly': int(row['family_friendly']),
            'proximity': round(row['proximity'], 2)
        }
        areas.append(area)
    if len(areas) >= 3:
        X = np.array([[a['price'], a['score']] for a in areas])
        kmeans = KMeans(n_clusters=min(3, len(areas)), n_init=10).fit(X)
        labels = kmeans.labels_
        cluster_scores = [0] * kmeans.n_clusters
        cluster_counts = [0] * kmeans.n_clusters
        for idx, a in enumerate(areas):
            cluster_scores[labels[idx]] += a['score']
            cluster_counts[labels[idx]] += 1
        best_cluster = np.argmax([s/c if c > 0 else 0 for s, c in zip(cluster_scores, cluster_counts)])
        suggested = [a for idx, a in enumerate(areas) if labels[idx] == best_cluster]
        suggested = sorted(suggested, key=lambda x: -x['score'])
    else:
        suggested = sorted(areas, key=lambda x: -x['score'])
    return jsonify({'suggested': suggested[:5], 'all': areas})

if __name__ == '__main__':
    app.run(debug=True) 