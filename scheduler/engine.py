"""Constraint-based assignment. Coverage is optimized before all preferences."""
from ortools.sat.python import cp_model
from models import Problem


def overlap(a, b):
    return a.start < b.end and b.start < a.end


def reasons(employee, shift, problem):
    errors = []
    # Merge adjacent availability windows before testing complete coverage.
    windows = []
    for window in sorted(employee.availability, key=lambda x: x.start):
        if windows and window.start <= windows[-1][1]:
            windows[-1][1] = max(windows[-1][1], window.end)
        else:
            windows.append([window.start, window.end])
    if not any(a <= shift.start and b >= shift.end for a, b in windows):
        errors.append("outside submitted availability")
    if any(overlap(shift, x) for x in employee.exceptions):
        errors.append("date-specific unavailability")
    if shift.end-shift.start > problem.rules.maxContinuousHours*60:
        errors.append("shift exceeds continuous-work limit")
    if any(x.employeeId == employee.id and overlap(shift, x) for x in problem.existing):
        errors.append("overlap with another published week")
    return errors


def validate(problem: Problem):
    """Independent whole-schedule validator, also used before manager edits/publishing."""
    errors = []
    known = {e.id: e for e in problem.employees}
    for shift in problem.shifts:
        if len(set(shift.assignees)) != len(shift.assignees):
            errors.append(f"{shift.id}: duplicate assignment")
        if len(shift.assignees) > shift.required:
            errors.append(f"{shift.id}: exceeds staffing requirement")
        for eid in shift.assignees:
            if eid not in known:
                errors.append(f"{shift.id}: unknown employee")
            else:
                errors.extend(f"{shift.id}: {known[eid].name}: {r}" for r in reasons(known[eid], shift, problem))
    for employee in problem.employees:
        assigned = [s for s in problem.shifts if employee.id in s.assignees]
        carried = [x for x in problem.existing if x.employeeId == employee.id]
        minutes = sum(s.end-s.start for s in assigned)
        minutes += sum(max(0, min(x.end, problem.weekEnd)-max(x.start, problem.weekStart)) for x in carried)
        if minutes > problem.rules.maxHours*60:
            errors.append(f"{employee.name}: weekly maximum exceeded")
        spans = sorted(assigned + carried, key=lambda x: x.start)
        run_start, end = None, None
        for span in spans:
            if end is not None:
                gap = span.start-end
                if gap < 0:
                    errors.append(f"{employee.name}: overlapping shifts")
                elif gap > 0 and gap < problem.rules.minRestHours*60:
                    errors.append(f"{employee.name}: insufficient rest")
            if end is None or span.start != end:
                run_start = span.start
            if span.end-run_start > problem.rules.maxContinuousHours*60:
                errors.append(f"{employee.name}: continuous work exceeds limit")
            end = max(end or span.end, span.end)
    return sorted(set(errors))


def solve(problem: Problem):
    model = cp_model.CpModel()
    employees, shifts, rules = problem.employees, problem.shifts, problem.rules
    choice = {(e.id, s.id): model.new_bool_var(f"{e.id}:{s.id}") for e in employees for s in shifts}
    missing = []
    for s in shifts:
        gap = model.new_int_var(0, s.required, f"gap:{s.id}")
        model.add(sum(choice[e.id, s.id] for e in employees)+gap == s.required)
        missing.append(gap*(s.end-s.start))
        if s.locked and (len(set(s.assignees)) != len(s.assignees) or any(eid not in {e.id for e in employees} for eid in s.assignees)):
            return {"status": "INFEASIBLE", "message": "Locked shift contains invalid assignees"}
        for e in employees:
            if reasons(e, s, problem):
                model.add(choice[e.id, s.id] == 0)
            if s.locked:
                model.add(choice[e.id, s.id] == int(e.id in s.assignees))
    penalties = []
    for e in employees:
        carried = [x for x in problem.existing if x.employeeId == e.id]
        carried_minutes = sum(max(0, min(x.end, problem.weekEnd)-max(x.start, problem.weekStart)) for x in carried)
        total = sum((s.end-s.start)*choice[e.id, s.id] for s in shifts)+carried_minutes
        model.add(total <= rules.maxHours*60)
        shortfall = model.new_int_var(0, rules.targetHours*60, f"target:{e.id}")
        model.add(shortfall >= rules.targetHours*60-total)
        penalties.append(shortfall*4)
        # An apparent short gap is allowed only if selected blocks completely
        # bridge it. This permits 2h+2h+2h as one 6h work period.
        spans = [(s, choice[e.id, s.id]) for s in shifts] + [(x, 1) for x in carried]
        for i, (a, selected_a) in enumerate(spans):
            for b, selected_b in spans[i+1:]:
                if overlap(a, b):
                    model.add(selected_a+selected_b <= 1)
                    continue
                first, second = sorted([a, b], key=lambda x: x.start)
                gap = second.start-first.end
                if 0 < gap < rules.minRestHours*60:
                    bridge = sum(max(0, min(c.end, second.start)-max(c.start, first.end))*selected for c, selected in spans)
                    model.add(bridge == gap).only_enforce_if([selected_a, selected_b])
        # Pairwise checks miss 2h+2h+2h+2h chains. Every rolling max+1-minute
        # window therefore limits occupied minutes, including neighboring weeks.
        endpoints = {s.start for s in shifts} | {x.start for x in carried}
        for start in endpoints:
            end = start+rules.maxContinuousHours*60+1
            occupied = sum(max(0, min(s.end, end)-max(s.start, start))*choice[e.id, s.id] for s in shifts)
            occupied += sum(max(0, min(x.end, end)-max(x.start, start)) for x in carried)
            model.add(occupied <= rules.maxContinuousHours*60)
        if not e.nightPreference:
            night_blocks = model.new_int_var(0, len(shifts), f"nights:{e.id}")
            model.add(night_blocks == sum(choice[e.id, s.id] for s in shifts if s.night))
            squared = model.new_int_var(0, len(shifts)**2, f"night_balance:{e.id}")
            model.add_multiplication_equality(squared, [night_blocks, night_blocks])
            penalties.append(squared*20)
        for s in shifts:
            if s.night:
                # Previous four weeks' night minutes influence the cost; volunteers are preferred.
                cost = 1 if e.nightPreference else 20 + min(e.previousNightMinutes//60, 200)
                penalties.append(choice[e.id, s.id]*(s.end-s.start)*cost)
    # Two solve phases make coverage lexicographically more important than preference costs.
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 10
    solver.parameters.num_search_workers = 4
    coverage = sum(missing)
    model.minimize(coverage)
    status = solver.solve(model)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return {"status": solver.status_name(status), "message": "No solution found. Check locked assignments or retry."}
    coverage_optimal = status == cp_model.OPTIMAL
    best_gap = int(solver.value(coverage)) if missing else 0
    first = {s.id: [e.id for e in employees if solver.value(choice[e.id, s.id])] for s in shifts}
    model.add(coverage == best_gap)
    model.minimize(sum(penalties))
    status = solver.solve(model)
    assigned = {s.id: [e.id for e in employees if solver.value(choice[e.id, s.id])] for s in shifts} if status in (cp_model.OPTIMAL, cp_model.FEASIBLE) else first
    result = problem.model_copy(deep=True)
    for s in result.shifts:
        s.assignees = assigned[s.id]
    violations = validate(result)
    if violations:
        return {"status": "INVALID", "message": "Generated schedule failed independent validation", "errors": violations}
    gaps = []
    for s in result.shifts:
        if len(s.assignees) < s.required:
            candidates = []
            for e in employees:
                if e.id in s.assignees:
                    continue
                why = reasons(e, s, result)
                if not why:
                    trial = result.model_copy(deep=True)
                    next(x for x in trial.shifts if x.id == s.id).assignees.append(e.id)
                    why = validate(trial)
                candidates.append({"employee": e.name, "reasons": why or ["eligible in isolation; other assignments or locked staffing affect this solution"]})
            gaps.append({"shiftId": s.id, "missing": s.required-len(s.assignees), "candidates": candidates})
    return {"status": "OPTIMAL" if coverage_optimal and status == cp_model.OPTIMAL else "FEASIBLE", "coverageOptimal": coverage_optimal, "assignments": assigned, "gaps": gaps, "uncoveredMinutes": best_gap}
