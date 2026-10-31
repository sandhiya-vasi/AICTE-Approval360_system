"""Advisory synthetic-data model. Never used to make approval decisions.
No training records are persisted: they are deterministic generated training inputs,
not application state. Operational data always comes from managed PostgreSQL.
"""
from functools import lru_cache
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error

FEATURES = ['missing_documents', 'violations', 'pending_days', 'compliance_score', 'days_to_deadline']

def synthetic_training_data():
    rng = np.random.default_rng(360)
    count = 1600
    frame = pd.DataFrame({
        'missing_documents': rng.integers(0, 7, count),
        'violations': rng.integers(0, 9, count),
        'pending_days': rng.integers(0, 91, count),
        'compliance_score': rng.integers(20, 101, count),
        'days_to_deadline': rng.integers(-30, 61, count),
    })
    target = np.maximum(0, frame.missing_documents * 2.2 + frame.violations * 1.4
                        + frame.pending_days * 0.09 + (100 - frame.compliance_score) * 0.08
                        + np.maximum(0, -frame.days_to_deadline) * 0.06
                        + rng.normal(0, 1.7, count) - 4)
    return frame, target

@lru_cache(maxsize=1)
def trained_model():
    frame, target = synthetic_training_data()
    x_train, x_test, y_train, y_test = train_test_split(frame, target, test_size=0.2, random_state=360)
    model = RandomForestRegressor(n_estimators=90, max_depth=10, min_samples_leaf=3, random_state=360, n_jobs=1)
    model.fit(x_train, y_train)
    error = float(mean_absolute_error(y_test, model.predict(x_test)))
    return model, round(error, 2)

def predict_delay(features):
    model, mae = trained_model()
    limits = {'missing_documents': (0, 6), 'violations': (0, 8), 'pending_days': (0, 90),
              'compliance_score': (20, 100), 'days_to_deadline': (-30, 60)}
    bounded = {key: min(high, max(low, float(features[key]))) for key, (low, high) in limits.items()}
    prediction = max(0, round(float(model.predict(pd.DataFrame([bounded], columns=FEATURES))[0])))
    return {'estimatedDelayDays': prediction,
            'model': 'Random forest trained on 1,600 synthetic examples (seed 360); advisory demonstration only.',
            'modelMetrics': {'syntheticHoldoutMAEDays': mae, 'holdoutSamples': 320,
                             'limitation': 'Synthetic validation does not establish real-world accuracy. Inputs are clipped to the synthetic training ranges.'},
            'featureImportance': dict(zip(FEATURES, [round(float(v), 3) for v in model.feature_importances_]))}
