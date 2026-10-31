from app.ai.delay import predict_delay, trained_model

def test_model_is_reproducible_and_explained():
    features = dict(missing_documents=4, violations=5, pending_days=30, compliance_score=55, days_to_deadline=-2)
    first = predict_delay(features)
    assert first == predict_delay(features)
    assert first['estimatedDelayDays'] >= 0
    assert len(first['featureImportance']) == 5
    assert first['modelMetrics']['holdoutSamples'] == 320
    assert 'synthetic' in first['model']

def test_risk_factors_increase_prediction():
    low = predict_delay(dict(missing_documents=0, violations=0, pending_days=1, compliance_score=99, days_to_deadline=30))
    high = predict_delay(dict(missing_documents=6, violations=8, pending_days=60, compliance_score=30, days_to_deadline=-15))
    assert high['estimatedDelayDays'] > low['estimatedDelayDays']
