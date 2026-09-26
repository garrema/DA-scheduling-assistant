import pytest
from models import Problem
from engine import solve, validate
from fastapi.testclient import TestClient
from main import app

BASE = 30000000

def employee(id='a', night=False):
    return dict(id=id, name=id, availability=[dict(start=BASE, end=BASE+10080)], nightPreference=night)

def shift(id='s', start=0, hours=4, **kw):
    return dict(id=id, start=BASE+start*60, end=BASE+(start+hours)*60, required=1, **kw)

def problem(shifts=None, employees=None, **kw):
    return Problem.model_validate(dict(employees=employees if employees is not None else [employee()], shifts=shifts or [shift()], existing=kw.pop('existing', []), rules=kw.pop('rules', dict(maxHours=20, targetHours=10, maxContinuousHours=6, minRestHours=8)), weekStart=BASE, weekEnd=BASE+10080, **kw))

def assigned(result):
    return sum(len(v) for v in result['assignments'].values())

def test_assignment_and_soft_ten_hour_target():
    r = solve(problem()); assert assigned(r) == 1; assert r['uncoveredMinutes'] == 0

def test_availability_and_exceptions():
    e = employee(); e['availability'] = [dict(start=BASE+60, end=BASE+120)]
    assert assigned(solve(problem(employees=[e]))) == 0
    e = employee(); e['exceptions'] = [dict(start=BASE+30, end=BASE+60)]
    assert assigned(solve(problem(employees=[e]))) == 0

def test_weekly_twenty_hour_limit():
    p = problem([shift(str(i), i*24, 6) for i in range(4)])
    assert assigned(solve(p)) == 3

def test_six_am_to_eight_am_is_rejected():
    assert assigned(solve(problem([shift('a', 0, 6), shift('b', 8, 4)]))) == 1

def test_adjacent_two_hour_blocks_can_form_six_hours():
    assert assigned(solve(problem([shift(str(i), i*2, 2) for i in range(3)]))) == 3

def test_adjacent_chain_cannot_exceed_six_hours():
    assert assigned(solve(problem([shift(str(i), i*2, 2) for i in range(4)]))) == 3

def test_overlap_never_double_assigns():
    assert assigned(solve(problem([shift('a', 0, 4), shift('b', 2, 4)]))) == 1

def test_cross_week_rest_and_continuous_limits():
    existing = [dict(employeeId='a', start=BASE-240, end=BASE)]
    assert assigned(solve(problem([shift('a', 2, 2)], existing=existing))) == 0
    assert assigned(solve(problem([shift('a', 0, 4)], existing=existing))) == 0
    assert assigned(solve(problem([shift('a', 0, 2)], existing=existing))) == 1

def test_cross_week_bridging_chain():
    existing = [dict(employeeId='a', start=BASE-120, end=BASE)]
    assert assigned(solve(problem([shift('a', 0, 2), shift('b', 2, 2)], existing=existing))) == 2

def test_locked_unavailable_person_is_infeasible():
    e = employee(); e['availability'] = []
    assert solve(problem([shift(assignees=['a'], locked=True)], [e]))['status'] == 'INFEASIBLE'

def test_night_volunteer_is_preferred():
    r = solve(problem([shift(night=True)], [employee('a'), employee('b', True)]))
    assert r['assignments']['s'] == ['b']

def test_history_prefers_less_burdened_nonvolunteer():
    e = employee('a'); e['previousNightMinutes'] = 1200
    assert solve(problem([shift(night=True)], [e, employee('b')]))['assignments']['s'] == ['b']

def test_validator_rejects_unknown_and_duplicate_assignments():
    p = problem([shift(assignees=['x', 'x'])])
    errors = validate(p)
    assert any('unknown' in e for e in errors)
    assert any('duplicate' in e for e in errors)

def test_no_employees_has_explained_gap():
    r = solve(problem(employees=[])); assert r['gaps'][0]['missing'] == 1

def test_service_key(monkeypatch):
    monkeypatch.setenv('SCHEDULER_KEY', 'test-secret')
    client = TestClient(app)
    assert client.post('/solve', json=problem().model_dump()).status_code == 401
    assert client.post('/solve', headers={'X-Scheduler-Key': 'test-secret'}, json=problem().model_dump()).status_code == 200

@pytest.mark.parametrize('shifts', [[shift('a', 0, 4), shift('b', 3, 4)], [shift(str(i), i*2, 2) for i in range(4)]])
def test_independent_validator_catches_invalid_manual_schedules(shifts):
    for s in shifts: s['assignees'] = ['a']
    assert validate(problem(shifts))

def test_unwanted_nights_are_softly_shared_within_week():
    r = solve(problem([shift('x', 0, 4, night=True), shift('y', 24, 4, night=True)], [employee('a'), employee('b')]))
    assert r['assignments']['x'] != r['assignments']['y']
